import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, ToneMapping, SMAA } from '@react-three/postprocessing'
import { PerformanceMonitor } from '@react-three/drei'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { backdrop, createBackdropMaterial, createRainOverlayMaterial, createVideoEnvMaterial } from './backdrop'
import { footage } from './footage'
import Cockpit from './cockpit/Cockpit'
import { ride } from './ride'
import { pointer } from './pointer'
import { stage } from './handle'
import { GradeEffect } from './painterly'
import { sound } from '../audio/sound'
import { useStore } from '../store'
import { BIKE_MAP } from '../data/bikes'
import { SCENES, SCENE_MAP, DEFAULT_SCENE } from '../data/scenes'
import { TIME_MAP } from '../data/times'
import { artworkFor } from '../data/artwork'

// which image to show, and whether it already includes the bike
function useBackdropSource() {
  const scene = useScene()
  const bikeId = useStore((s) => s.bikeId)
  const art = artworkFor(scene.id, bikeId)
  return { scene, src: art?.src ?? scene.still, full: !!art?.full }
}

// development only: ?raw shows the scene without the painterly grade, ?shot hides the bike
const params = import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams()
const RAW = params.has('raw')
const SHOT = params.has('shot')
// phones and tablets: lighter shadows (see main.jsx)
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const useScene = () => SCENE_MAP[useStore((s) => s.sceneId)] ?? DEFAULT_SCENE

// The scene still, drawn full-screen behind the bike (with rain / mist).
function Backdrop() {
  const ref = useRef()
  const material = useMemo(() => createBackdropMaterial(), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  const { size } = useThree()
  const weather = useStore((s) => s.weather)
  const headlight = useStore((s) => s.headlight)
  const time = useStore((s) => s.time)
  const fx = useRef({ rain: 0, fog: 0, head: 0 })
  useFrame((state, dt) => {
    const u = backdrop.uniforms
    u.uLinear.value = RAW ? 0 : 1
    u.uTime.value = state.clock.elapsedTime
    u.uRes.value.set(size.width, size.height)
    const f = fx.current
    f.rain += ((weather === 'rain' ? 1 : 0) - f.rain) * (1 - Math.exp(-dt * 0.8))
    f.fog += ((weather === 'fog' ? 1 : 0) - f.fog) * (1 - Math.exp(-dt * 0.8))
    const headTarget = headlight ? { night: 1, sunset: 0.55, golden: 0.3, day: 0.18 }[time] : 0
    f.head += (headTarget - f.head) * (1 - Math.exp(-dt * 6))
    u.uRain.value = f.rain
    u.uFog.value = f.fog
    u.uHead.value = f.head
    // birds only when it's light and dry
    const birdsTarget = weather === 'clear' && time !== 'night' ? 1 : 0
    u.uBirds.value += (birdsTarget - u.uBirds.value) * (1 - Math.exp(-dt * 1.5))
    // a breath of head movement + pointer parallax (the scene is a still moment)
    const t = state.clock.elapsedTime
    // leaning (A / D): the horizon rolls the other way and the road pans into the turn;
    // zoom in just enough that the rolled frame still covers the screen
    const roll = Math.sin(t * 0.17) * 0.002 + ride.lean * 0.13
    u.uSway.value.set(pointer.x * 0.008 + Math.sin(t * 0.21) * 0.0012 + ride.lean * 0.012, pointer.y * 0.006 + Math.sin(t * 0.33) * 0.0009, roll)
    const a = size.width / size.height
    const c = Math.cos(Math.abs(roll)), s = Math.sin(Math.abs(roll))
    u.uZoom.value = Math.max(1, Math.max(c + a * s, c + s / a) * (1 + Math.abs(ride.lean) * 0.03))
    footage.tick(size.width, size.height)
    if (ref.current) ref.current.visible = !!u.uA.value
  })
  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-1000} />
}

function RainOverlay() {
  const material = useMemo(() => createRainOverlayMaterial(), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1000} />
}

// Reflections and ambient light come from the scene picture itself.
function SceneEnvironment() {
  const { gl, scene } = useThree()
  const time = useStore((s) => s.time)
  const weather = useStore((s) => s.weather)
  const pm = useMemo(() => new THREE.PMREMGenerator(gl), [gl])
  const envScene = useMemo(() => {
    const s = new THREE.Scene()
    s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), createVideoEnvMaterial()))
    return s
  }, [])
  const st = useRef({ rt: null, sig: '' })
  useEffect(
    () => () => {
      st.current.rt?.dispose()
      pm.dispose()
    },
    [pm],
  )
  useFrame(() => {
    const u = backdrop.uniforms
    scene.environmentIntensity = TIME_MAP[time].env * (weather === 'clear' ? 1 : 0.75)
    if (!u.uA.value) return
    const sig = `${u.uA.value.uuid}|${u.uB.value?.uuid}|${u.uMix.value.toFixed(1)}`
    if (sig === st.current.sig) return
    st.current.sig = sig
    const rt = pm.fromScene(envScene, 0.035, 0.1, 50)
    scene.environment = rt.texture
    st.current.rt?.dispose()
    st.current.rt = rt
  })
  return null
}

function Lights() {
  const time = useStore((s) => s.time)
  const weather = useStore((s) => s.weather)
  const T = TIME_MAP[time]
  const dim = weather === 'clear' ? 1 : weather === 'rain' ? 0.35 : 0.5
  const sun = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    if (sun.current) sun.current.target = target
    target.position.set(0, 0.9, -0.4)
  }, [target])
  const d = new THREE.Vector3(...T.sun.dir).normalize().multiplyScalar(4)
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={sun}
        position={[d.x, 0.9 + d.y, -0.4 + d.z]}
        color={T.sun.color}
        intensity={T.sun.intensity * dim}
        castShadow
        shadow-mapSize={TOUCH ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-0.8}
        shadow-camera-right={0.8}
        shadow-camera-top={0.8}
        shadow-camera-bottom={-0.8}
        shadow-camera-near={0.5}
        shadow-camera-far={8}
        shadow-bias={-0.0002}
        shadow-normalBias={0.01}
        shadow-radius={5}
      />
      <hemisphereLight args={[time === 'night' ? '#6b7fb3' : '#ffe2c2', '#5a4636', time === 'night' ? 0.35 : 0.9]} />
    </>
  )
}

function CockpitRig() {
  const { full } = useBackdropSource()
  const bikeId = useStore((s) => s.bikeId)
  const phase = useStore((s) => s.phase)
  const [shown, setShown] = useState(bikeId)
  const group = useRef()
  const swap = useRef({ t: 1, dir: 0 })
  const { camera, size } = useThree()

  useEffect(() => {
    if (bikeId !== shown) swap.current = { t: 0, dir: -1 }
  }, [bikeId, shown])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const bike = BIKE_MAP[shown]
    const s = swap.current
    let drop = 0
    if (s.dir === -1) {
      s.t += dt / 0.45
      drop = Math.min(1, s.t)
      if (s.t >= 1) {
        setShown(useStore.getState().bikeId)
        swap.current = { t: 0, dir: 1 }
        drop = 1
      }
    } else if (s.dir === 1) {
      s.t += dt / 0.8
      drop = 1 - (1 - Math.pow(1 - Math.min(1, s.t), 3))
      if (s.t >= 1) swap.current = { t: 1, dir: 0 }
    }
    if (phase === 'intro') drop = 1
    const p = bike.pov
    if (group.current) {
      // the rider keeps their head a little more upright than the bike: tilt the cockpit
      // about a point just below the eye, so the bars swing under you rather than slide away
      const phi = -ride.lean * 0.2
      const h = p.eye[1] - 0.3
      group.current.rotation.z = phi
      group.current.position.set(Math.sin(phi) * h, h - Math.cos(phi) * h - drop * 0.55, 0)
    }

    // rider's eye: idling-engine shiver, a slow breath and pointer look
    const t = state.clock.elapsedTime
    const vib = (ride.engineOn ? 1 : 0) * p.vib * 0.7 * (1 + ride.rev * 2.2 + ride.thr * 1.3 + ride.speed / 120)
    const jx = (Math.sin(t * 61.7) + Math.sin(t * 43.1)) * 0.00014 * vib
    const jy = (Math.sin(t * 57.3) + Math.sin(t * 38.9)) * 0.00018 * vib
    camera.position.set(p.eye[0] + jx + pointer.x * 0.01, p.eye[1] + jy + Math.sin(t * 0.9) * 0.0012, p.eye[2])
    const portrait = size.width < size.height
    camera.rotation.set(p.pitch + (portrait ? 0.1 : 0) - pointer.y * 0.03, -pointer.x * 0.05, Math.sin(t * 0.17) * 0.003, 'YXZ')
    const fov = portrait ? 96 : p.fov
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return (
    <group ref={group} visible={!full && !SHOT}>
      <Cockpit key={shown} bike={BIKE_MAP[shown]} />
    </group>
  )
}

function Driver() {
  const { scene, src } = useBackdropSource()
  const sceneReady = useStore((s) => s.sceneReady)
  const bikeId = useStore((s) => s.bikeId)
  useFrame((_, dt) => {
    ride.step(Math.min(dt, 0.1), BIKE_MAP[bikeId], scene.cruise)
    sound.update()
  })
  useEffect(() => {
    footage.show(scene, src)
  }, [scene, src])
  // the other scenes download only after the first one is on screen
  useEffect(() => {
    if (!sceneReady) return
    const t = setTimeout(() => footage.preload(SCENES.map((s) => s.still)), 4000)
    return () => clearTimeout(t)
  }, [sceneReady])
  return null
}

// Final look: tone mapping → illustrator's grade (per time of day). The scenery
// is already painted (baked by tools/bake.html) and animated by the living-picture layer.
function Painting() {
  const { scene } = useBackdropSource()
  const time = useStore((s) => s.time)
  const weather = useStore((s) => s.weather)
  const grade = useMemo(() => new GradeEffect(), [])
  const cur = useRef(null)
  useFrame((_, dt) => {
    const g = TIME_MAP[time].grade
    const wet = weather === 'clear' ? 0 : 1
    // rain / mist: flatter, cooler light, no sun glow
    const target = { ...g, sat: g.sat * (1 - wet * 0.2), glow: g.glow * (1 - wet), motes: (g.motes ?? 0) * (1 - wet), split: g.split * (1 - wet * 0.5), exposure: g.exposure * (scene.exposure ?? 1) * (1 - wet * 0.08) }
    if (!cur.current) cur.current = JSON.parse(JSON.stringify(target))
    const c = cur.current
    const k = 1 - Math.exp(-dt * 2)
    for (const key of ['tint', 'shadow', 'high', 'sunPos', 'sunColor']) for (let i = 0; i < target[key].length; i++) c[key][i] += (target[key][i] - c[key][i]) * k
    for (const key of ['exposure', 'sat', 'contrast', 'split', 'glow', 'motes']) c[key] += (target[key] - c[key]) * k
    const U = grade.uniforms
    U.get('uTint').value.set(...c.tint)
    U.get('uShadow').value.set(...c.shadow)
    U.get('uHigh').value.set(...c.high)
    U.get('uSunPos').value.set(...c.sunPos)
    U.get('uSunColor').value.set(...c.sunColor)
    U.get('uExposure').value = c.exposure
    U.get('uSat').value = c.sat
    U.get('uContrast').value = c.contrast
    U.get('uSplit').value = c.split
    U.get('uGlow').value = c.glow
    U.get('uMotes').value = c.motes
  })
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={grade} />
      <SMAA />
    </EffectComposer>
  )
}

// Hands the canvas to the photo button, right after the frame is painted.
function PhotoGrab() {
  const { gl } = useThree()
  useEffect(() => {
    stage.canvas = gl.domElement
    stage.gl = gl
  }, [gl])
  useFrame(() => {
    if (!stage.pending) return
    const cb = stage.pending
    stage.pending = null
    cb(gl.domElement)
  }, 2)
  return null
}

export default function Stage() {
  // adaptive resolution: drop a little on slower devices (the painted look hides it)
  const [dpr, setDpr] = useState(1)
  return (
    <Canvas
      className="!fixed inset-0"
      dpr={dpr}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
      camera={{ fov: 56, near: 0.02, far: 200, position: [0, 1.3, 0.1] }}
    >
      <PerformanceMonitor flipflops={3} onDecline={() => setDpr(0.75)} onIncline={() => setDpr(1)} onFallback={() => setDpr(0.75)} />
      <Driver />
      <Backdrop />
      <Lights />
      <SceneEnvironment />
      <CockpitRig />
      <RainOverlay />
      {!RAW && <Painting />}
      <PhotoGrab />
    </Canvas>
  )
}
