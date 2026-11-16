// Physically-based materials for the cockpit. Real textures are CC0 from
// Poly Haven; brushed-metal / plastic grain / paint flake are generated.
import * as THREE from 'three'

const loader = new THREE.TextureLoader()
const cache = new Map()

function tex(url, srgb = false, repeat = [1, 1]) {
  const key = url + repeat.join()
  if (cache.has(key)) return cache.get(key)
  const t = loader.load(url)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  cache.set(key, t)
  return t
}

function canvasTex(w, h, draw, { srgb = false, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

// height-noise → tangent-space normal map
function normalFromHeight(w, h, heightFn, strength = 2) {
  return canvasTex(w, h, (ctx) => {
    const H = new Float32Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = heightFn(x, y)
    const img = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)]
        const u = H[((y - 1 + h) % h) * w + x], d = H[((y + 1) % h) * w + x]
        const nx = (l - r) * strength, ny = (u - d) * strength, nz = 1
        const len = Math.hypot(nx, ny, nz)
        const i = (y * w + x) * 4
        img.data[i] = ((nx / len) * 0.5 + 0.5) * 255
        img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255
        img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255
        img.data[i + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
  })
}

let shared = null
function sharedMaps() {
  if (shared) return shared
  // brushed metal: streaks along U
  const rowNoise = Array.from({ length: 512 }, () => Math.random())
  const brushed = normalFromHeight(512, 512, (x, y) => rowNoise[y] * 0.7 + Math.random() * 0.15, 1.2)
  // textured plastic: fine stipple
  const plastic = normalFromHeight(256, 256, () => Math.random(), 0.9)
  plastic.repeat.set(6, 6)
  // metallic flake for paint
  const flake = normalFromHeight(512, 512, () => (Math.random() < 0.5 ? 0 : 1), 0.35)
  flake.repeat.set(8, 8)
  // dust / wear: soft blotches that roughen surfaces unevenly (nothing is showroom-perfect)
  const wear = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d8d8d8'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 4 + Math.random() * 46
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const v = Math.random() < 0.5 ? 255 : 150
      g.addColorStop(0, `rgba(${v},${v},${v},${0.05 + Math.random() * 0.12})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }, { repeat: [2, 2] })
  shared = { brushed, plastic, flake, wear }
  return shared
}

export function createMaterials(bike) {
  const m = sharedMaps()
  const leather = {
    map: tex('/tex/brown_leather_diff.jpg', true, [3, 3]),
    normalMap: tex('/tex/brown_leather_nor.jpg', false, [3, 3]),
    roughnessMap: tex('/tex/brown_leather_rough.jpg', false, [3, 3]),
  }
  const rubberN = tex('/tex/rubberized_track_nor.jpg', false, [4, 1])

  const paint = new THREE.MeshPhysicalMaterial({
    color: bike.paint,
    metalness: bike.metal ?? 0.15,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
    roughnessMap: m.wear,
    clearcoatRoughnessMap: m.wear,
    normalMap: m.flake,
    normalScale: new THREE.Vector2(0.08, 0.08),
    envMapIntensity: 1,
  })

  return {
    paint,
    paintAccent: new THREE.MeshPhysicalMaterial({ color: bike.accent, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e6e6e6', metalness: 1, roughness: 0.12, roughnessMap: m.wear }),
    brushedAlu: new THREE.MeshStandardMaterial({ color: '#a9adb2', metalness: 1, roughness: 0.42, roughnessMap: m.wear, normalMap: m.brushed, normalScale: new THREE.Vector2(0.04, 0.04) }),
    blackAlu: new THREE.MeshStandardMaterial({ color: '#161719', metalness: 0.7, roughness: 0.48, roughnessMap: m.wear, normalMap: m.brushed, normalScale: new THREE.Vector2(0.03, 0.03) }),
    anodGold: new THREE.MeshStandardMaterial({ color: '#b8904a', metalness: 1, roughness: 0.34, roughnessMap: m.wear }),
    anodRed: new THREE.MeshStandardMaterial({ color: '#b3231a', metalness: 0.9, roughness: 0.3 }),
    anodOrange: new THREE.MeshStandardMaterial({ color: '#e8640f', metalness: 0.85, roughness: 0.32 }),
    frameOrange: new THREE.MeshPhysicalMaterial({ color: '#ff6a10', metalness: 0.2, roughness: 0.4, clearcoat: 0.8 }),
    anodBlue: new THREE.MeshStandardMaterial({ color: '#2a4f8f', metalness: 0.9, roughness: 0.35 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.0, roughness: 0.66, roughnessMap: m.wear, normalMap: m.plastic, normalScale: new THREE.Vector2(0.35, 0.35) }),
    mirrorHousing: new THREE.MeshPhysicalMaterial({ color: '#0d0d0e', metalness: 0.1, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3, roughnessMap: m.wear }),
    plasticGloss: new THREE.MeshPhysicalMaterial({ color: '#0e0e0e', metalness: 0, roughness: 0.25, clearcoat: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#161616', metalness: 0, roughness: 0.88, normalMap: rubberN, normalScale: new THREE.Vector2(0.4, 0.4) }),
    hose: new THREE.MeshStandardMaterial({ color: '#0f0f10', metalness: 0.1, roughness: 0.5 }),
    braided: new THREE.MeshStandardMaterial({ color: '#7d8186', metalness: 0.8, roughness: 0.45, normalMap: m.brushed, normalScale: new THREE.Vector2(0.6, 0.6) }),
    leather: new THREE.MeshStandardMaterial({ ...leather, color: '#6b5a50', roughness: 1 }),
    seatBlack: new THREE.MeshStandardMaterial({ map: tex('/tex/fabric_leather_02_diff.jpg', true, [4, 4]), normalMap: tex('/tex/fabric_leather_02_nor.jpg', false, [4, 4]), color: '#3a3a3a', roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.05, transparent: true, opacity: 0.08, clearcoat: 0.6, envMapIntensity: 0.5, depthWrite: false }),
    smoke: new THREE.MeshPhysicalMaterial({ color: '#1a1e24', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.5, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    reservoir: new THREE.MeshPhysicalMaterial({ color: '#2a2622', metalness: 0, roughness: 0.15, transparent: true, opacity: 0.85, clearcoat: 1 }),
    amberLens: new THREE.MeshPhysicalMaterial({ color: '#ff9a1a', emissive: '#ff7a00', emissiveIntensity: 0.05, roughness: 0.15, transmission: 0, clearcoat: 1 }),
    headLens: new THREE.MeshPhysicalMaterial({ color: '#dfe6ea', metalness: 0.1, roughness: 0.05, clearcoat: 1, emissive: '#fff6e0', emissiveIntensity: 0.15 }),
    redButton: new THREE.MeshStandardMaterial({ color: '#c3271c', roughness: 0.45 }),
    greyButton: new THREE.MeshStandardMaterial({ color: '#3b3d40', roughness: 0.5 }),
    screenBezel: new THREE.MeshPhysicalMaterial({ color: '#070707', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    gloveLeather: new THREE.MeshStandardMaterial({ map: tex('/tex/brown_leather_diff.jpg', true, [2, 2]), normalMap: tex('/tex/brown_leather_nor.jpg', false, [2, 2]), normalScale: new THREE.Vector2(0.8, 0.8), color: '#2a2624', roughness: 0.62 }),
    gloveShell: new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
    gloveAccent: new THREE.MeshStandardMaterial({ color: '#c8321e', roughness: 0.5 }),
    jacket: new THREE.MeshStandardMaterial({ map: tex('/tex/fabric_leather_02_diff.jpg', true, [3, 3]), normalMap: tex('/tex/fabric_leather_02_nor.jpg', false, [3, 3]), color: '#3a3a3e', roughness: 0.85 }),
    mirrorGlass: new THREE.MeshStandardMaterial({ color: '#d9e0e6', metalness: 1, roughness: 0.03 }),
    fairingInner: new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.75, normalMap: m.plastic, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.BackSide }),
  }
}
