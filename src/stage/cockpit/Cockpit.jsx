import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  gripGeometry, barEndGeometry, tubeGeometry, leverGeometry, roundedBox, spanCylinder, gaugeCupGeometry,
  needleGeometry, tankGeometry, fairingGeometry, fairingEdge, yokeGeometry, forkCapGeometry, latheY, handguardGeometry,
} from './geo'
import { createMaterials } from './materials'
import { analogFaces, raceTFT, nakedTFT, classicFace, roundTFT, dialAngle } from './dials'
import { createMirrorMaterial, backdrop } from '../backdrop'
import { ride } from '../ride'

const X = new THREE.Vector3(1, 0, 0)

function M({ geometry, material, cast = true, ...rest }) {
  return <mesh geometry={geometry} material={material} castShadow={cast} receiveShadow {...rest} />
}

function Span({ a, b, r, r2, material, seg = 20 }) {
  const s = useMemo(() => spanCylinder(a, b, r, r2 ?? r, seg), [a.join(), b.join(), r, r2, seg]) // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={s.geometry} position={s.position} quaternion={s.quaternion} material={material} castShadow receiveShadow />
}

function Tube({ pts, r, material, seg = 64 }) {
  const g = useMemo(() => tubeGeometry(pts, r, seg), [JSON.stringify(pts), r]) // eslint-disable-line react-hooks/exhaustive-deps
  return <M geometry={g} material={material} />
}

// ------------------------------------------------------------------ controls
/** Right-hand controls built along local +x (outward). Mirror with scale-x −1 for the left. */
function HandControls({ m, kind, leverMat, perchMat, gripLen = 0.13, guard }) {
  const g = useMemo(
    () => ({
      grip: gripGeometry(gripLen),
      end: barEndGeometry(),
      house: roundedBox(0.05, 0.048, 0.058, 0.012),
      perch: roundedBox(0.058, 0.03, 0.036, 0.008),
      lever: leverGeometry(0.135, 1),
      btn: roundedBox(0.016, 0.008, 0.02, 0.003),
      btnRound: new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 20),
      res: new THREE.CylinderGeometry(0.017, 0.017, 0.03, 32),
      cap: new THREE.CylinderGeometry(0.0195, 0.0195, 0.008, 32),
      guard: guard ? handguardGeometry() : null,
    }),
    [gripLen, guard],
  )
  const brake = kind === 'brake'
  return (
    <group>
      <M geometry={g.grip} material={m.rubber} />
      <M geometry={g.end} material={m.chrome} position={[gripLen, 0, 0]} />
      <Hand m={m} />
      {g.guard && <M geometry={g.guard} material={guard} />}
      {/* switch / throttle housing */}
      <M geometry={g.house} material={m.plastic} position={[-0.03, 0.002, 0]} />
      {brake ? (
        <>
          <M geometry={g.btn} material={m.redButton} position={[-0.03, 0.028, -0.004]} />
          <M geometry={g.btnRound} material={m.greyButton} position={[-0.03, 0.004, 0.03]} rotation={[Math.PI / 2, 0, 0]} />
        </>
      ) : (
        <>
          {[0.014, -0.004].map((y) => (
            <M key={y} geometry={g.btn} material={m.greyButton} position={[-0.03, y, 0.03]} rotation={[Math.PI / 2, 0, 0]} />
          ))}
          <M geometry={g.btn} material={m.greyButton} position={[-0.03, 0.028, -0.002]} />
        </>
      )}
      {/* lever perch / master cylinder */}
      <M geometry={g.perch} material={perchMat} position={[-0.088, 0.002, -0.01]} />
      {brake && (
        <group position={[-0.1, 0.02, 0.008]} rotation={[0.25, 0, 0]}>
          <M geometry={g.res} material={m.reservoir} position={[0, 0.015, 0]} />
          <M geometry={g.cap} material={m.plastic} position={[0, 0.034, 0]} />
        </group>
      )}
      <M geometry={g.lever} material={leverMat} position={[-0.07, -0.012, -0.034]} rotation={[0.08, 0.05, 0]} />
      {/* hose / cable out of the perch */}
      <Tube pts={[[-0.09, -0.01, -0.03], [-0.11, -0.06, -0.07], [-0.13, -0.16, -0.1], [-0.15, -0.3, -0.12]]} r={0.0045} material={brake ? m.braided : m.hose} seg={32} />
      <Tube pts={[[-0.035, -0.02, 0.0], [-0.06, -0.08, -0.03], [-0.09, -0.2, -0.06], [-0.11, -0.35, -0.08]]} r={0.0038} material={m.hose} seg={32} />
    </group>
  )
}

/** A gloved hand wrapped around the grip (grip-local frame: +x along the grip, +z towards the rider). */
function Hand({ m, gripR = 0.0175 }) {
  const g = useMemo(() => {
    const R = gripR + 0.0102
    const finger = (arc, start, tube = 0.0104) => {
      const t = new THREE.TorusGeometry(R, tube, 12, 28, arc)
      t.rotateY(Math.PI / 2)
      t.rotateX(start)
      return t
    }
    return {
      back: roundedBox(0.088, 0.03, 0.08, 0.013),
      shell: roundedBox(0.078, 0.012, 0.032, 0.006),
      finger: finger(Math.PI, (-110 * Math.PI) / 180),
      tip: new THREE.SphereGeometry(0.0108, 14, 10),
      thumb: finger((75 * Math.PI) / 180, (-165 * Math.PI) / 180, 0.0115),
      cuffRing: new THREE.TorusGeometry(0.043, 0.004, 8, 32),
      cuff: tubeGeometry([[0.062, 0.05, 0.07], [0.06, 0.07, 0.15], [0.058, 0.09, 0.2]], 0.043, 24, 20),
      sleeve: tubeGeometry([[0.058, 0.088, 0.19], [0.07, 0.15, 0.3], [0.09, 0.24, 0.44]], 0.056, 24, 20),
    }
  }, [gripR])
  const xs = [0.03, 0.053, 0.076, 0.098]
  const tipAngle = (-110 * Math.PI) / 180
  const tipPos = (x) => [x, Math.sin(tipAngle) * (gripR + 0.0102), -Math.cos(tipAngle) * (gripR + 0.0102)]
  return (
    <group>
      <M geometry={g.back} material={m.gloveLeather} position={[0.064, 0.03, 0.026]} rotation={[-0.32, 0, 0]} />
      <M geometry={g.shell} material={m.gloveShell} position={[0.064, 0.046, 0.002]} rotation={[-0.5, 0, 0]} />
      {xs.map((x, i) => (
        <group key={x}>
          <M geometry={g.finger} material={m.gloveLeather} position={[x, 0, 0]} scale={[1, 1 - i * 0.02, 1 - i * 0.02]} />
          <M geometry={g.tip} material={m.gloveLeather} position={tipPos(x)} />
        </group>
      ))}
      <M geometry={g.thumb} material={m.gloveLeather} position={[0.012, 0, 0]} />
      <M geometry={g.cuff} material={m.gloveLeather} />
      <mesh geometry={g.cuffRing} material={m.gloveAccent} position={[0.06, 0.07, 0.15]} rotation={[-0.25, 0, 0]} />
      <M geometry={g.sleeve} material={m.jacket} />
    </group>
  )
}

/** Places a pair of hand-control assemblies along the bar directions. */
function Controls({ m, inner, dir, leverMat, perchMat, guard }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(X, new THREE.Vector3(...dir).normalize()), [dir.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <group position={inner} quaternion={q}>
        <HandControls m={m} kind="brake" leverMat={leverMat} perchMat={perchMat} guard={guard} />
      </group>
      <group scale={[-1, 1, 1]}>
        <group position={inner} quaternion={q}>
          <HandControls m={m} kind="clutch" leverMat={leverMat} perchMat={perchMat} guard={guard} />
        </group>
      </group>
    </>
  )
}

function Mirror({ m, pos, radii, yaw = 0, pitch = 0, side, stem, stemMat }) {
  const mat = useMemo(() => createMirrorMaterial(side), [side])
  const glassRef = useRef()
  // with footage: show the road behind; without: a plain reflective mirror
  useFrame(() => {
    if (glassRef.current) glassRef.current.material = backdrop.uniforms.uA.value ? mat : m.mirrorGlass
  })
  const g = useMemo(() => {
    // domed housing, opening towards the rider (+z)
    const shell = latheY([[0.0001, -0.05], [0.4, -0.048], [0.7, -0.038], [0.88, -0.024], [0.98, -0.009], [1.0, 0.0], [1.0, 0.004], [0.965, 0.0065]], 64)
    shell.scale(radii[0], 1, radii[1])
    shell.rotateX(Math.PI / 2)
    const lip = new THREE.TorusGeometry(1, 0.06, 10, 64)
    lip.scale(radii[0] * 0.965, radii[1] * 0.965, 0.06)
    const glass = new THREE.CircleGeometry(1, 64)
    glass.scale(radii[0] * 0.93, radii[1] * 0.93, 1)
    const ball = new THREE.SphereGeometry(0.011, 20, 14)
    return { shell, lip, glass, ball }
  }, [radii.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {stem && <Tube pts={stem} r={0.0072} material={stemMat ?? m.blackAlu} seg={28} />}
      {stem && <M geometry={g.ball} material={stemMat ?? m.blackAlu} position={stem[stem.length - 1]} />}
      <group position={pos} rotation={[pitch, yaw, 0]}>
        <M geometry={g.shell} material={m.mirrorHousing} />
        <mesh geometry={g.lip} material={m.plasticGloss} position={[0, 0, 0.0055]} />
        <mesh ref={glassRef} geometry={g.glass} material={mat} position={[0, 0, 0.002]} />
        <mesh geometry={g.glass} material={m.glass} position={[0, 0, 0.0026]} renderOrder={2} />
      </group>
    </>
  )
}

function AnalogPod({ m, position, tilt, R, face, needleRef, chrome }) {
  const g = useMemo(
    () => ({
      cup: gaugeCupGeometry(R, 0.055),
      face: new THREE.CircleGeometry(R * 0.9, 96),
      needle: needleGeometry(R * 0.76, 0.0034),
      cap: new THREE.CylinderGeometry(R * 0.075, R * 0.085, 0.005, 32),
      bezel: new THREE.TorusGeometry(R * 0.94, 0.0028, 12, 96),
      shadow: new THREE.RingGeometry(R * 0.82, R * 0.92, 96),
      glass: new THREE.CircleGeometry(R * 0.94, 96),
    }),
    [R],
  )
  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ map: face, color: new THREE.Color(0.8, 0.8, 0.8) }), [face])
  const needleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f1ea', emissive: '#ff6a1a', emissiveIntensity: 0.12, roughness: 0.45 }), [])
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.45, depthWrite: false }), [])
  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      <M geometry={g.cup} material={chrome} />
      <mesh geometry={g.face} material={faceMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]} />
      <mesh geometry={g.shadow} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0035, 0]} />
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]}>
        <mesh ref={needleRef} geometry={g.needle} material={needleMat} castShadow />
      </group>
      <mesh geometry={g.cap} material={m.plasticGloss} position={[0, 0.002, 0]} />
      <mesh geometry={g.bezel} material={chrome} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.0065, 0]} />
      <mesh geometry={g.glass} material={m.glass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0075, 0]} renderOrder={2} />
    </group>
  )
}

function Screen({ m, position, tilt, w, h, texture, housing = false }) {
  const g = useMemo(
    () => ({
      bezel: roundedBox(w + 0.014, h + 0.014, 0.018, 0.004),
      housing: roundedBox(w + 0.05, h + 0.045, 0.05, 0.012),
      screen: new THREE.PlaneGeometry(w, h),
      glass: new THREE.PlaneGeometry(w + 0.01, h + 0.01),
    }),
    [w, h],
  )
  // a lit LCD: emissive, tone-mapped and reflective (not a pasted-on sticker)
  const scr = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(0.85, 0.85, 0.85) }), [texture])
  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      {housing && <M geometry={g.housing} material={m.plastic} position={[0, -0.004, -0.02]} />}
      <M geometry={g.bezel} material={m.screenBezel} />
      <mesh geometry={g.screen} material={scr} position={[0, 0, 0.0092]} />
      <mesh geometry={g.glass} material={m.glass} position={[0, 0, 0.0096]} renderOrder={2} />
    </group>
  )
}

function Yoke({ m, y, z, span, forkR, material, rake = 0.44, caps = 'chrome' }) {
  const g = useMemo(
    () => ({
      yoke: yokeGeometry({ span, forkR, thick: 0.017 }),
      cap: forkCapGeometry(forkR * 0.9),
      adj: new THREE.CylinderGeometry(forkR * 0.27, forkR * 0.27, 0.008, 24),
      tube: new THREE.CylinderGeometry(forkR, forkR, 0.03, 40),
      stem: new THREE.CylinderGeometry(0.0115, 0.0115, 0.024, 6),
    }),
    [span, forkR],
  )
  const capMat = caps === 'gold' ? m.anodGold : caps === 'blue' ? m.anodBlue : caps === 'orange' ? m.anodOrange : m.chrome
  return (
    <group position={[0, y, z]} rotation={[rake, 0, 0]}>
      <M geometry={g.yoke} material={material} />
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * span) / 2, 0.013, 0]}>
          <M geometry={g.tube} material={m.blackAlu} position={[0, 0.002, 0]} />
          <M geometry={g.cap} material={m.blackAlu} />
          <M geometry={g.adj} material={capMat} position={[0, 0.03, 0]} />
        </group>
      ))}
      <M geometry={g.stem} material={m.blackAlu} position={[0, 0.012, 0.0307]} />
    </group>
  )
}
// ------------------------------------------------------------------ bikes
function GT650({ m, live }) {
  const faces = useMemo(() => analogFaces(), [])
  const speedN = useRef()
  const tachN = useRef()
  const g = useMemo(
    () => ({
      tank: tankGeometry({ w: 0.165, h: 0.125, l: 0.3, knee: 0.3 }),
      bucket: latheY([[0.0001, -0.1], [0.06, -0.098], [0.088, -0.07], [0.097, -0.02], [0.098, 0.0], [0.102, 0.008], [0.096, 0.012]], 64),
      lens: new THREE.CircleGeometry(0.094, 64),
      cap: latheY([[0.0001, 0.018], [0.03, 0.018], [0.036, 0.012], [0.038, 0.0], [0.04, -0.004]], 40),
      pad: new THREE.SphereGeometry(1, 32, 16),
    }),
    [],
  )
  live.current = (st) => {
    if (speedN.current) speedN.current.rotation.z = -dialAngle(st.speed / 180) - Math.PI / 2
    if (tachN.current) tachN.current.rotation.z = -dialAngle(st.rpm / 1000 / 9) - Math.PI / 2
  }
  useEffect(() => () => [faces.speedo, faces.tacho].forEach((t) => t.dispose()), [faces])
  return (
    <group>
      <M geometry={g.tank} material={m.chrome} position={[0, 0.82, -0.11]} />
      {[-1, 1].map((s) => (
        <M key={s} geometry={g.pad} material={m.rubber} position={[s * 0.15, 0.82, -0.06]} scale={[0.02, 0.05, 0.085]} />
      ))}
      <M geometry={g.cap} material={m.chrome} position={[0, 0.935, -0.27]} rotation={[0.2, 0, 0]} />
      <group position={[0, 0.86, -0.64]} rotation={[-Math.PI / 2 + 0.05, 0, 0]}>
        <M geometry={g.bucket} material={m.chrome} />
      </group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Span a={[s * 0.06, 0.86, -0.6]} b={[s * 0.15, 0.86, -0.62]} r={0.006} material={m.plastic} />
          <mesh geometry={g.pad} material={m.amberLens} position={[s * 0.16, 0.86, -0.625]} scale={[0.02, 0.016, 0.026]} />
        </group>
      ))}
      <Yoke m={m} y={0.905} z={-0.47} span={0.21} forkR={0.0205} material={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Span key={s} a={[s * 0.105, 0.6, -0.57]} b={[s * 0.105, 0.9, -0.47]} r={0.0205} material={m.chrome} />
      ))}
      {/* instrument bracket and twin clocks */}
      <M geometry={useMemo(() => roundedBox(0.24, 0.012, 0.07, 0.005), [])} material={m.blackAlu} position={[0, 0.955, -0.52]} rotation={[0.9, 0, 0]} />
      <AnalogPod m={m} position={[-0.068, 0.985, -0.525]} tilt={0.92} R={0.05} face={faces.speedo} needleRef={speedN} chrome={m.chrome} />
      <AnalogPod m={m} position={[0.068, 0.985, -0.525]} tilt={0.92} R={0.05} face={faces.tacho} needleRef={tachN} chrome={m.chrome} />
      {/* clip-ons */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Span a={[s * 0.105, 0.86, -0.455]} b={[s * 0.105, 0.89, -0.465]} r={0.03} material={m.blackAlu} />
          <Tube pts={[[s * 0.12, 0.872, -0.455], [s * 0.21, 0.866, -0.43], [s * 0.3, 0.858, -0.402]]} r={0.0112} material={m.blackAlu} />
        </group>
      ))}
      <Controls m={m} inner={[0.3, 0.858, -0.402]} dir={[0.96, -0.04, 0.26]} leverMat={m.chrome} perchMat={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Mirror key={s} m={m} side={s} pos={[s * 0.4, 1.065, -0.43]} radii={[0.05, 0.05]} yaw={-s * 0.22} pitch={-0.05} stem={[[s * 0.255, 0.878, -0.414], [s * 0.29, 0.93, -0.418], [s * 0.35, 1.0, -0.425], [s * 0.39, 1.045, -0.43]]} />
      ))}
      {/* wiring loom */}
      <Tube pts={[[0.04, 0.95, -0.5], [0.0, 0.9, -0.56], [-0.03, 0.85, -0.6]]} r={0.006} material={m.hose} />
    </group>
  )
}

function Panigale({ m, live }) {
  const tft = useMemo(() => raceTFT(), [])
  const g = useMemo(
    () => ({
      tank: tankGeometry({ w: 0.18, h: 0.12, l: 0.3, knee: 0.22, flat: 0.5 }),
      cover: new THREE.CylinderGeometry(0.024, 0.026, 0.006, 40),
      fairing: fairingGeometry({ zFront: -1.02, zRear: -0.6, wFront: 0.07, wRear: 0.27, hFront: 0.06, hRear: 0.26, yTop: 0.915 }),
      screen: fairingGeometry({ zFront: -0.99, zRear: -0.7, wFront: 0.06, wRear: 0.2, hFront: 0.06, hRear: 0.17, yTop: 1.0, angle: 1.5, segV: 24 }),
      damper: new THREE.CylinderGeometry(0.0075, 0.0075, 0.12, 20),
      edge: fairingEdge({ zRear: -0.6, wRear: 0.27, hRear: 0.26, yTop: 0.915 }),
    }),
    [],
  )
  live.current = (st) => tft.draw(st)
  useEffect(() => () => tft.texture.dispose(), [tft])
  return (
    <group>
      <M geometry={g.tank} material={m.paint} position={[0, 0.8, -0.17]} />
      <M geometry={g.cover} material={m.brushedAlu} position={[0, 0.905, -0.3]} rotation={[0.3, 0, 0]} />
      <M geometry={g.fairing} material={m.paint} />
      <M geometry={g.fairing} material={m.fairingInner} />
      <mesh geometry={g.screen} material={m.smoke} renderOrder={3} />
      <Screen m={m} position={[0, 0.955, -0.62]} tilt={-0.62} w={0.13} h={0.078} texture={tft.texture} housing />
      <Tube pts={g.edge} r={0.0045} material={m.rubber} seg={80} />
      <Yoke m={m} y={0.845} z={-0.5} span={0.21} forkR={0.0215} material={m.brushedAlu} caps="blue" />
      <M geometry={g.damper} material={m.blackAlu} position={[0, 0.857, -0.585]} rotation={[0, 0, Math.PI / 2]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Span a={[s * 0.105, 0.6, -0.6]} b={[s * 0.105, 0.84, -0.5]} r={0.0275} material={m.anodGold} />
          <Span a={[s * 0.105, 0.8, -0.483]} b={[s * 0.105, 0.83, -0.494]} r={0.033} material={m.blackAlu} />
          <Tube pts={[[s * 0.125, 0.82, -0.488], [s * 0.2, 0.816, -0.465], [s * 0.29, 0.81, -0.432]]} r={0.0112} material={m.blackAlu} />
        </group>
      ))}
      <Controls m={m} inner={[0.29, 0.81, -0.432]} dir={[0.95, -0.03, 0.3]} leverMat={m.brushedAlu} perchMat={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Mirror key={s} m={m} side={s} pos={[s * 0.36, 0.955, -0.705]} radii={[0.078, 0.041]} yaw={-s * 0.2} stem={[[s * 0.25, 0.9, -0.715], [s * 0.3, 0.925, -0.712], [s * 0.335, 0.94, -0.708]]} />
      ))}
    </group>
  )
}

function Triple({ m, live }) {
  const tft = useMemo(() => nakedTFT(), [])
  const g = useMemo(
    () => ({
      tank: tankGeometry({ w: 0.175, h: 0.13, l: 0.31, knee: 0.28, flat: 0.55 }),
      lamp: new THREE.SphereGeometry(1, 40, 24),
      riser: roundedBox(0.032, 0.05, 0.042, 0.008),
      fly: fairingGeometry({ zFront: -0.72, zRear: -0.61, wFront: 0.08, wRear: 0.12, hFront: 0.05, hRear: 0.09, yTop: 1.05, angle: 1.3, segV: 12 }),
    }),
    [],
  )
  live.current = (st) => tft.draw(st)
  useEffect(() => () => tft.texture.dispose(), [tft])
  const bar = [[-0.3, 0.995, -0.372], [-0.16, 0.982, -0.42], [0, 0.976, -0.438], [0.16, 0.982, -0.42], [0.3, 0.995, -0.372]]
  return (
    <group>
      <M geometry={g.tank} material={m.paint} position={[0, 0.84, -0.16]} />
      <M geometry={g.tank} material={m.brushedAlu} position={[0, 0.835, -0.15]} scale={[1.02, 0.55, 0.7]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <M geometry={g.lamp} material={m.plasticGloss} position={[s * 0.066, 0.85, -0.68]} scale={[0.062, 0.07, 0.07]} />
          <Span a={[s * 0.1, 0.6, -0.58]} b={[s * 0.1, 0.89, -0.46]} r={0.0265} material={m.anodGold} />
          <M geometry={g.riser} material={m.blackAlu} position={[s * 0.04, 0.95, -0.44]} rotation={[0.3, 0, 0]} />
        </group>
      ))}
      <Yoke m={m} y={0.89} z={-0.46} span={0.2} forkR={0.0215} material={m.blackAlu} caps="gold" />
      <mesh geometry={g.fly} material={m.smoke} renderOrder={3} />
      <Screen m={m} position={[0, 1.005, -0.58]} tilt={-0.55} w={0.104} h={0.064} texture={tft.texture} housing />
      <Tube pts={bar} r={0.0125} material={m.plastic} />
      <Controls m={m} inner={[0.3, 0.995, -0.372]} dir={[0.94, 0.02, 0.33]} leverMat={m.blackAlu} perchMat={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Mirror key={s} m={m} side={s} pos={[s * 0.5, 0.985, -0.33]} radii={[0.05, 0.05]} yaw={-s * 0.35} stem={[[s * 0.455, 0.997, -0.328], [s * 0.48, 0.99, -0.33]]} />
      ))}
    </group>
  )
}

// Royal Enfield Classic 350: teardrop tank, headlamp nacelle holding a single
// analog speedo, tiger-eye pilot lamps, wide pulled-back chrome handlebar.
function Classic350({ m, live }) {
  const face = useMemo(() => classicFace(), [])
  const needle = useRef()
  const g = useMemo(
    () => ({
      tank: tankGeometry({ w: 0.172, h: 0.13, l: 0.33, knee: 0.32 }),
      nacelle: latheY([[0.0001, -0.12], [0.07, -0.118], [0.105, -0.09], [0.118, -0.04], [0.12, 0.0], [0.124, 0.01], [0.118, 0.014]], 64),
      cap: latheY([[0.0001, 0.02], [0.032, 0.02], [0.038, 0.013], [0.04, 0.0], [0.043, -0.004]], 40),
      badge: new THREE.SphereGeometry(1, 32, 16),
      pilot: latheY([[0.0001, -0.03], [0.02, -0.028], [0.026, -0.01], [0.027, 0.0], [0.029, 0.004]], 32),
      pilotLens: new THREE.CircleGeometry(0.024, 32),
    }),
    [],
  )
  live.current = (st) => {
    if (needle.current) needle.current.rotation.z = -dialAngle(st.speed / 140) - Math.PI / 2
    face.setOdo(st.trip)
  }
  useEffect(() => () => face.speedo.dispose(), [face])
  const bar = [[-0.3, 0.958, -0.37], [-0.2, 0.975, -0.43], [-0.08, 0.985, -0.47], [0, 0.986, -0.475], [0.08, 0.985, -0.47], [0.2, 0.975, -0.43], [0.3, 0.958, -0.37]]
  return (
    <group>
      <M geometry={g.tank} material={m.paint} position={[0, 0.82, -0.1]} />
      {/* tank badges + rubber knee pads */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <M geometry={g.badge} material={m.chrome} position={[s * 0.163, 0.84, -0.17]} scale={[0.006, 0.03, 0.06]} />
          <M geometry={g.badge} material={m.rubber} position={[s * 0.15, 0.8, -0.03]} scale={[0.02, 0.048, 0.08]} />
        </group>
      ))}
      <M geometry={g.cap} material={m.chrome} position={[0, 0.94, -0.25]} rotation={[0.18, 0, 0]} />
      {/* headlamp nacelle (casquette) with the speedo set into its top */}
      <group position={[0, 0.86, -0.63]} rotation={[-Math.PI / 2 + 0.1, 0, 0]}>
        <M geometry={g.nacelle} material={m.paint} />
      </group>
      <AnalogPod m={m} position={[0, 1.0, -0.575]} tilt={0.78} R={0.066} face={face.speedo} needleRef={needle} chrome={m.chrome} />
      {/* tiger-eye pilot lamps either side of the nacelle */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.135, 0.84, -0.66]} rotation={[-Math.PI / 2, 0, 0]}>
          <M geometry={g.pilot} material={m.chrome} />
          <mesh geometry={g.pilotLens} material={m.headLens} position={[0, -0.031, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      <Yoke m={m} y={0.92} z={-0.47} span={0.2} forkR={0.02} material={m.blackAlu} />
      <Tube pts={bar} r={0.0125} material={m.chrome} />
      {[-1, 1].map((s) => (
        <Span key={s} a={[s * 0.06, 0.93, -0.465]} b={[s * 0.06, 0.982, -0.473]} r={0.016} material={m.chrome} />
      ))}
      <Controls m={m} inner={[0.3, 0.958, -0.37]} dir={[0.9, -0.05, 0.43]} leverMat={m.chrome} perchMat={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Mirror key={s} m={m} side={s} pos={[s * 0.36, 1.13, -0.44]} radii={[0.055, 0.055]} yaw={-s * 0.18} pitch={-0.06} stemMat={m.chrome} stem={[[s * 0.22, 0.978, -0.425], [s * 0.26, 1.04, -0.43], [s * 0.32, 1.1, -0.438], [s * 0.35, 1.115, -0.44]]} />
      ))}
      <Tube pts={[[0.03, 0.95, -0.5], [0.0, 0.9, -0.55], [-0.04, 0.86, -0.58]]} r={0.006} material={m.hose} />
    </group>
  )
}

// Royal Enfield Himalayan 450: round TFT on a navigation tower, tall screen,
// handguards, wide tapered bar, tank guards.
function Himalayan({ m, live }) {
  const tft = useMemo(() => roundTFT('#f2a93b'), [])
  const g = useMemo(
    () => ({
      tank: tankGeometry({ w: 0.19, h: 0.135, l: 0.32, knee: 0.24, flat: 0.62 }),
      screen: fairingGeometry({ zFront: -0.72, zRear: -0.63, wFront: 0.13, wRear: 0.16, hFront: 0.2, hRear: 0.25, yTop: 1.27, angle: 1.2, segV: 16 }),
      tower: roundedBox(0.15, 0.13, 0.04, 0.01),
      bezel: new THREE.CylinderGeometry(0.074, 0.077, 0.024, 64),
      disc: new THREE.CircleGeometry(0.066, 96),
      lens: new THREE.CircleGeometry(0.07, 96),
      cap: new THREE.CylinderGeometry(0.03, 0.032, 0.008, 40),
    }),
    [],
  )
  const scr = useMemo(() => new THREE.MeshBasicMaterial({ map: tft.texture, color: new THREE.Color(0.85, 0.85, 0.85) }), [tft])
  live.current = (st) => tft.draw(st)
  useEffect(() => () => tft.texture.dispose(), [tft])
  const bar = [[-0.31, 1.005, -0.37], [-0.17, 0.99, -0.415], [0, 0.984, -0.432], [0.17, 0.99, -0.415], [0.31, 1.005, -0.37]]
  return (
    <group>
      <M geometry={g.tank} material={m.paint} position={[0, 0.84, -0.13]} />
      <M geometry={g.cap} material={m.blackAlu} position={[0, 0.965, -0.27]} rotation={[0.25, 0, 0]} />
      {/* tank guards */}
      {[-1, 1].map((s) => (
        <Tube key={s} pts={[[s * 0.12, 0.86, -0.5], [s * 0.21, 0.82, -0.4], [s * 0.235, 0.74, -0.25], [s * 0.2, 0.62, -0.1]]} r={0.011} material={m.blackAlu} />
      ))}
      {/* navigation tower + round TFT */}
      <M geometry={g.tower} material={m.plastic} position={[0, 1.02, -0.6]} rotation={[-0.55, 0, 0]} />
      <group position={[0, 1.06, -0.565]} rotation={[Math.PI / 2 - 0.55, 0, 0]}>
        <M geometry={g.bezel} material={m.screenBezel} />
        <mesh geometry={g.disc} material={scr} position={[0, 0.0128, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={g.lens} material={m.glass} position={[0, 0.0134, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} />
      </group>
      <mesh geometry={g.screen} material={m.smoke} renderOrder={3} />
      <Yoke m={m} y={0.93} z={-0.47} span={0.22} forkR={0.024} material={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Span key={s} a={[s * 0.04, 0.94, -0.44]} b={[s * 0.04, 0.98, -0.43]} r={0.017} material={m.blackAlu} />
      ))}
      <Tube pts={bar} r={0.0135} material={m.blackAlu} />
      <Controls m={m} inner={[0.31, 1.005, -0.37]} dir={[0.93, 0.03, 0.36]} leverMat={m.blackAlu} perchMat={m.blackAlu} guard={m.plastic} />
      {[-1, 1].map((s) => (
        <Mirror key={s} m={m} side={s} pos={[s * 0.4, 1.17, -0.46]} radii={[0.06, 0.045]} yaw={-s * 0.2} pitch={-0.05} stem={[[s * 0.25, 1.0, -0.42], [s * 0.3, 1.08, -0.44], [s * 0.36, 1.14, -0.455], [s * 0.385, 1.155, -0.46]]} />
      ))}
    </group>
  )
}

// KTM 390 Duke: colour TFT on a stalk, angular orange tank shrouds, flat wide
// bar, orange trellis frame and WP fork adjusters.
function Duke390({ m, live }) {
  const tft = useMemo(() => nakedTFT('#ff6a10'), [])
  const g = useMemo(
    () => ({
      tank: tankGeometry({ w: 0.185, h: 0.135, l: 0.3, knee: 0.34, flat: 0.72 }),
      shroud: roundedBox(0.03, 0.075, 0.24, 0.012),
      cap: new THREE.CylinderGeometry(0.028, 0.03, 0.008, 6),
    }),
    [],
  )
  live.current = (st) => tft.draw(st)
  useEffect(() => () => tft.texture.dispose(), [tft])
  const bar = [[-0.31, 0.985, -0.375], [-0.16, 0.975, -0.42], [0, 0.97, -0.435], [0.16, 0.975, -0.42], [0.31, 0.985, -0.375]]
  return (
    <group>
      <M geometry={g.tank} material={m.paintAccent} position={[0, 0.83, -0.13]} />
      <M geometry={g.tank} material={m.paint} position={[0, 0.822, -0.12]} scale={[1.03, 0.7, 0.92]} />
      <M geometry={g.cap} material={m.brushedAlu} position={[0, 0.96, -0.24]} rotation={[0.2, 0, 0]} />
      {/* angular tank shrouds flaring forward */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <M geometry={g.shroud} material={m.paint} position={[s * 0.2, 0.78, -0.32]} rotation={[0.3, s * 0.3, s * -0.95]} />
          <Tube pts={[[s * 0.07, 0.79, -0.5], [s * 0.13, 0.74, -0.35], [s * 0.15, 0.66, -0.15]]} r={0.014} material={m.frameOrange} />
          <Span a={[s * 0.1, 0.6, -0.58]} b={[s * 0.1, 0.89, -0.465]} r={0.0255} material={m.blackAlu} />
        </group>
      ))}
      <Yoke m={m} y={0.892} z={-0.465} span={0.2} forkR={0.021} material={m.blackAlu} caps="orange" />
      <Screen m={m} position={[0, 1.02, -0.575]} tilt={-0.5} w={0.112} h={0.066} texture={tft.texture} housing />
      <Span a={[0, 0.9, -0.54]} b={[0, 0.98, -0.565]} r={0.012} material={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Span key={s} a={[s * 0.04, 0.905, -0.44]} b={[s * 0.04, 0.965, -0.435]} r={0.016} material={m.blackAlu} />
      ))}
      <Tube pts={bar} r={0.0128} material={m.blackAlu} />
      <Controls m={m} inner={[0.31, 0.985, -0.375]} dir={[0.94, 0.02, 0.33]} leverMat={m.anodOrange} perchMat={m.blackAlu} />
      {[-1, 1].map((s) => (
        <Mirror key={s} m={m} side={s} pos={[s * 0.38, 1.1, -0.42]} radii={[0.07, 0.038]} yaw={-s * 0.25} pitch={-0.04} stem={[[s * 0.23, 0.98, -0.41], [s * 0.29, 1.05, -0.415], [s * 0.34, 1.085, -0.418]]} />
      ))}
    </group>
  )
}

/** The rider's cockpit. `bike` comes from data/bikes.js. */
export default function Cockpit({ bike }) {
  const m = useMemo(() => createMaterials(bike), [bike])
  const live = useRef(() => {})
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    // needles every frame; screens at ~20 fps
    if (bike.dash === 'analog' || acc.current > 0.05) {
      acc.current = 0
      live.current(ride.dashState(bike))
    }
  })
  useEffect(() => () => Object.values(m).forEach((mat) => mat.dispose?.()), [m])
  return (
    <group>
      {bike.id === 'gt650' && <GT650 m={m} live={live} />}
      {bike.id === 'panigale' && <Panigale m={m} live={live} />}
      {bike.id === 'triple' && <Triple m={m} live={live} />}
      {bike.id === 'classic350' && <Classic350 m={m} live={live} />}
      {bike.id === 'himalayan' && <Himalayan m={m} live={live} />}
      {bike.id === 'duke390' && <Duke390 m={m} live={live} />}
    </group>
  )
}
