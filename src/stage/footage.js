// Scene images feeding the backdrop shader, with a soft crossfade between
// scenes. The images are already painted (baked by tools/bake.html).
import * as THREE from 'three'
import { backdrop } from './backdrop'
import { useStore } from '../store'

const loader = new THREE.TextureLoader()
const cache = new Map()
function loadTexture(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      new Promise((resolve) => {
        loader.load(
          url,
          (t) => {
            t.minFilter = THREE.LinearMipmapLinearFilter
            t.magFilter = THREE.LinearFilter
            t.anisotropy = 8
            resolve(t)
          },
          undefined,
          () => resolve(null),
        )
      }),
    )
  }
  return cache.get(url)
}

function crop(scene, iw, ih, sw, sh) {
  const c = scene.crop ?? {}
  const cb = c.bottom ?? 0
  const ct = c.top ?? 0
  const regionH = 1 - cb - ct
  const ra = iw / (ih * regionH)
  const sa = sw / sh
  let w = 1, h = regionH
  if (ra > sa) w = sa / ra
  else h = (regionH * ra) / sa
  const zoom = 1 / (c.zoom ?? 1.04)
  w *= zoom
  h *= zoom
  const x0 = (1 - w) / 2 + (c.panX ?? 0)
  const y0 = cb + (regionH - h) * (c.focusY ?? 0.5)
  return [w, h, x0, y0]
}

// per-scene living-picture parameters, toned down by weather and time of day
function liveParams(scene) {
  const L = scene.live ?? {}
  const { weather, time } = useStore.getState()
  const sunny = weather === 'clear' && time !== 'night'
  const sky = L.sky ?? [2, 2]
  return {
    sky: [sky[0], sky[1], L.horizon ?? 0.5, weather === 'rain' ? 0.02 : 0.011],
    fx: [sunny ? L.shadows ?? 0 : 0, sunny && time !== 'sunset' ? L.haze ?? 0 : 0, L.water ?? 0, (L.mist ?? 0) + (weather === 'fog' ? 0.25 : 0)],
  }
}

export const footage = {
  sceneA: null,
  sceneB: null,
  mixing: null,
  token: 0,
  last: performance.now(),

  /** `src` is the image to show for this scene (baked painting or your own artwork). */
  async show(scene, src) {
    const u = backdrop.uniforms
    const token = ++this.token
    const tex = await loadTexture(src)
    if (token !== this.token) return
    if (!tex) {
      useStore.getState().setLoading({ label: 'Could not load this scene' })
      return
    }
    const entry = { ...scene, src, tex }
    if (!u.uA.value) {
      this.sceneA = entry
      u.uA.value = tex
      u.uMix.value = 0
      useStore.setState({ sceneReady: true })
      useStore.getState().setLoading({ progress: 1, label: 'Ready' })
    } else if (this.sceneA?.src !== src) {
      this.sceneB = entry
      u.uB.value = tex
      this.mixing = { t: 0, dur: 1.4 }
    }
  },

  preload(urls) {
    urls.forEach((u) => u && loadTexture(u))
  },

  tick(sw, sh) {
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    const u = backdrop.uniforms
    const A = this.sceneA
    if (A?.tex?.image) {
      u.uCropA.value.set(...crop(A, A.tex.image.width, A.tex.image.height, sw, sh))
      u.uGradeA.value.set(...(A.grade ?? [1, 1, 1, 0]))
      const la = liveParams(A)
      u.uSkyA.value.set(...la.sky)
      u.uFxA.value.set(...la.fx)
    }
    const m = this.mixing
    if (m) {
      const B = this.sceneB
      if (B?.tex?.image) {
        u.uCropB.value.set(...crop(B, B.tex.image.width, B.tex.image.height, sw, sh))
        u.uGradeB.value.set(...(B.grade ?? [1, 1, 1, 0]))
        const lb = liveParams(B)
        u.uSkyB.value.set(...lb.sky)
        u.uFxB.value.set(...lb.fx)
      }
      m.t += dt / m.dur
      const e = Math.min(1, m.t)
      u.uMix.value = e * e * (3 - 2 * e)
      if (m.t >= 1) {
        this.sceneA = this.sceneB
        u.uA.value = this.sceneB.tex
        u.uCropA.value.copy(u.uCropB.value)
        u.uGradeA.value.copy(u.uGradeB.value)
        u.uSkyA.value.copy(u.uSkyB.value)
        u.uFxA.value.copy(u.uFxB.value)
        u.uMix.value = 0
        u.uB.value = null
        this.mixing = null
      }
    }
  },
}
