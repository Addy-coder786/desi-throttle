// Geometry factories for realistic motorcycle cockpit parts.
// Units are metres. Bike space: +x right, +y up, −z forward (towards the road).
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const v2 = (x, y) => new THREE.Vector2(x, y)
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2])
const UP = new THREE.Vector3(0, 1, 0)

/** Lathe around the local X axis (profile = [[radius, x], ...]). */
export function latheX(profile, segments = 40) {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => v2(Math.max(0.0001, r), x)), segments)
  g.rotateZ(-Math.PI / 2) // lathe axis Y -> X
  g.computeVertexNormals()
  return g
}

/** Lathe around Y (vertical) */
export function latheY(profile, segments = 48) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => v2(Math.max(0.0001, r), y)), segments)
  g.computeVertexNormals()
  return g
}

/** Ribbed rubber grip along +x, length L. Inner flange at x=0. */
export function gripGeometry(L = 0.13, r = 0.0168, ribs = 46) {
  const p = []
  p.push([0.0001, -0.004])
  p.push([0.024, -0.004])
  p.push([0.0245, -0.001])
  p.push([0.024, 0.002])
  p.push([0.019, 0.005])
  const n = 220
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = 0.006 + t * (L - 0.012)
    const taper = 1 + 0.06 * Math.sin(t * Math.PI) // slight belly
    const rib = Math.pow(Math.max(0, Math.sin(t * ribs * Math.PI * 2)), 3) * 0.0011
    p.push([r * taper + rib, x])
  }
  p.push([r * 0.98, L - 0.004])
  p.push([r * 0.7, L])
  p.push([0.0001, L])
  return latheX(p, 36)
}

/** Bar-end weight, along +x */
export function barEndGeometry() {
  return latheX(
    [
      [0.0001, 0],
      [0.015, 0],
      [0.0175, 0.004],
      [0.0175, 0.016],
      [0.016, 0.022],
      [0.011, 0.026],
      [0.0001, 0.027],
    ],
    32,
  )
}

/** Smooth tube through points. */
export function tubeGeometry(points, radius, tubular = 64, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map(v3), false, 'centripetal')
  return new THREE.TubeGeometry(curve, tubular, radius, radial, false)
}

/** Brake / clutch lever blade (lies in XZ plane, pivot at origin, pointing +x). */
export function leverGeometry(len = 0.17, flip = 1) {
  const s = new THREE.Shape()
  const w0 = 0.022
  s.moveTo(-0.012, -w0 / 2)
  s.lineTo(0.02, -0.012)
  s.bezierCurveTo(len * 0.4, -0.006 + 0.012 * flip, len * 0.75, 0.004 + 0.02 * flip, len, 0.012 * flip + 0.004)
  s.lineTo(len + 0.004, 0.012 * flip + 0.014)
  s.bezierCurveTo(len * 0.75, 0.014 + 0.02 * flip, len * 0.4, 0.006 + 0.012 * flip, 0.02, 0.012)
  s.lineTo(-0.012, w0 / 2)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0018, bevelSize: 0.0016, bevelSegments: 3, curveSegments: 18 })
  g.translate(0, 0, -0.003)
  g.rotateX(-Math.PI / 2) // shape XY -> XZ
  g.computeVertexNormals()
  return g
}

export function roundedBox(w, h, d, r = 0.008, seg = 4) {
  return new RoundedBoxGeometry(w, h, d, seg, r)
}

/** Cylinder whose axis runs from a to b. Returns { geometry, position, quaternion }. */
export function spanCylinder(a, b, rA, rB = rA, seg = 20) {
  const A = v3(a), B = v3(b)
  const d = B.clone().sub(A)
  const len = d.length()
  const geometry = new THREE.CylinderGeometry(rB, rA, len, seg)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())
  const position = A.clone().add(B).multiplyScalar(0.5)
  return { geometry, position, quaternion }
}

/** Gauge pod cup (opening faces +y), outer radius R, depth D. */
export function gaugeCupGeometry(R = 0.052, D = 0.05) {
  return latheY(
    [
      [0.0001, -D],
      [R * 0.55, -D],
      [R * 0.86, -D * 0.9],
      [R * 0.98, -D * 0.55],
      [R, -D * 0.1],
      [R * 1.04, 0],
      [R * 1.06, 0.004],
      [R * 1.03, 0.008],
      [R * 0.93, 0.0085],
      [R * 0.9, 0.004],
    ],
    64,
  )
}

/** Tapered gauge needle in XY plane pointing +y from pivot. */
export function needleGeometry(len, w = 0.0035) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, -len * 0.18)
  s.lineTo(w / 2, -len * 0.18)
  s.lineTo(w * 0.16, len)
  s.lineTo(-w * 0.16, len)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0012, bevelEnabled: false })
  g.computeVertexNormals()
  return g
}

/** Fuel tank: an ellipsoid shaped into a tank (knee cut-outs, flattened top). */
export function tankGeometry({ w = 0.17, h = 0.13, l = 0.34, knee = 0.25, flat = 0.35, frontRise = 0.03 }) {
  const g = new THREE.SphereGeometry(1, 72, 48)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    // flatten the top a little, keep the bottom open-ish
    if (y > 0) y = y * (1 - flat * y * y * 0.35)
    else y = y * 0.85
    // knee recesses on the rear-lower flanks
    const rear = THREE.MathUtils.smoothstep(z, -0.1, 0.7)
    const low = THREE.MathUtils.smoothstep(-y, -0.3, 0.6)
    x *= 1 - knee * rear * low
    // a rider-ward taper
    x *= 1 - 0.22 * THREE.MathUtils.smoothstep(z, 0.2, 1)
    const yy = y * h + (z < 0 ? -z * frontRise : 0)
    p.setXYZ(i, x * w, yy, z * l)
  }
  g.computeVertexNormals()
  return g
}

/** Superellipse "arch" surface for a sport-bike upper fairing (opening towards +z). */
export function fairingGeometry({ zFront = -0.98, zRear = -0.5, wFront = 0.08, wRear = 0.29, hFront = 0.07, hRear = 0.3, yTop = 0.86, angle = 1.9, segU = 60, segV = 40 }) {
  const g = new THREE.BufferGeometry()
  const pos = []
  const uv = []
  const idx = []
  for (let j = 0; j <= segV; j++) {
    const v = j / segV
    const e = Math.pow(v, 0.65)
    const z = zFront + (zRear - zFront) * v
    const w = wFront + (wRear - wFront) * e
    const h = hFront + (hRear - hFront) * e
    const yt = yTop - 0.06 * (1 - v) * (1 - v)
    for (let i = 0; i <= segU; i++) {
      const u = i / segU
      const th = (u - 0.5) * 2 * angle
      const s = Math.sin(th), c = Math.cos(th)
      const ex = 2 / 2.6
      const sx = Math.sign(s) * Math.pow(Math.abs(s), ex)
      const cy = Math.sign(c) * Math.pow(Math.abs(c), ex)
      pos.push(sx * w, yt - h + cy * h, z)
      uv.push(u, v)
    }
  }
  for (let j = 0; j < segV; j++)
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i
      const b = a + segU + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  g.setIndex(idx)
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Top triple clamp outline (XZ), extruded downwards. */
export function yokeGeometry({ span = 0.21, depth = 0.11, thick = 0.022, forkR = 0.027 }) {
  const s = new THREE.Shape()
  const hw = span / 2 + forkR + 0.012
  const back = depth * 0.62
  s.moveTo(-hw, -0.02)
  s.absarc(-span / 2, 0, forkR + 0.014, Math.PI, Math.PI * 1.5, false)
  s.bezierCurveTo(-span * 0.25, -forkR - 0.02, span * 0.25, -forkR - 0.02, span / 2, -forkR - 0.014)
  s.absarc(span / 2, 0, forkR + 0.014, -Math.PI / 2, 0, false)
  s.lineTo(hw, 0.02)
  s.bezierCurveTo(hw, back, span * 0.2, back + 0.01, 0, back + 0.012)
  s.bezierCurveTo(-span * 0.2, back + 0.01, -hw, back, -hw, 0.02)
  s.closePath()
  for (const sx of [-1, 1]) {
    const h = new THREE.Path()
    h.absarc((sx * span) / 2, 0, forkR, 0, Math.PI * 2, true)
    s.holes.push(h)
  }
  const stem = new THREE.Path()
  stem.absarc(0, back * 0.45, 0.012, 0, Math.PI * 2, true)
  s.holes.push(stem)
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 24 })
  g.rotateX(Math.PI / 2) // extrude goes down (-y); shape y -> z
  g.translate(0, thick, 0)
  g.computeVertexNormals()
  return g
}

/** Fork cap: hex nut with a preload adjuster on top (axis Y). */
export function forkCapGeometry(r = 0.024) {
  return latheY(
    [
      [0.0001, 0.026],
      [r * 0.42, 0.026],
      [r * 0.45, 0.02],
      [r * 0.62, 0.019],
      [r * 0.66, 0.012],
      [r * 1.0, 0.011],
      [r * 1.02, 0.0],
      [r * 0.98, -0.004],
    ],
    6, // hexagonal
  )
}

/** Points along the rear (rider-side) edge of a fairing, for a rubber trim. */
export function fairingEdge({ zRear, wRear, hRear, yTop, angle = 1.9, n = 40 }) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const th = (i / n - 0.5) * 2 * angle
    const s = Math.sin(th), c = Math.cos(th)
    const ex = 2 / 2.6
    const sx = Math.sign(s) * Math.pow(Math.abs(s), ex)
    const cy = Math.sign(c) * Math.pow(Math.abs(c), ex)
    pts.push([sx * wRear, yTop - hRear + cy * hRear, zRear])
  }
  return pts
}

/** Wrap-around handguard shell (grip-local frame: +x outward, −z forward). */
export function handguardGeometry() {
  const s = new THREE.Shape()
  // top view: a crescent that wraps the lever and the bar end
  s.moveTo(-0.07, 0.0)
  s.bezierCurveTo(-0.06, -0.075, 0.07, -0.115, 0.15, -0.075)
  s.bezierCurveTo(0.175, -0.06, 0.18, -0.02, 0.165, 0.01)
  s.lineTo(0.15, 0.008)
  s.bezierCurveTo(0.158, -0.03, 0.15, -0.055, 0.135, -0.062)
  s.bezierCurveTo(0.06, -0.095, -0.045, -0.06, -0.055, 0.0)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.075, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 24 })
  g.rotateX(Math.PI / 2) // extrude down the y axis
  g.translate(0, 0.045, 0)
  g.computeVertexNormals()
  return g
}
