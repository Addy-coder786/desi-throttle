// High-resolution instrument faces drawn on canvas (no brand logos).
import * as THREE from 'three'

function mk(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return { c, ctx: c.getContext('2d'), t }
}

// Analog face: sweep from 225° (bottom-left) clockwise 270°.
const A0 = (135 * Math.PI) / 180
const SWEEP = (270 * Math.PI) / 180
export const dialAngle = (frac) => A0 + SWEEP * Math.min(1.02, Math.max(0, frac))

function face(ctx, S, { max, major, minor, label, sub, red, lamps, lcd }) {
  const c = S / 2
  ctx.clearRect(0, 0, S, S)
  // deep black face with a soft centre lift
  const g = ctx.createRadialGradient(c, c * 0.85, S * 0.05, c, c, c)
  g.addColorStop(0, '#1a1a1a')
  g.addColorStop(0.7, '#0b0b0b')
  g.addColorStop(1, '#030303')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(c, c, c, 0, Math.PI * 2)
  ctx.fill()
  // fine outer ring
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = S * 0.004
  ctx.beginPath()
  ctx.arc(c, c, c * 0.93, 0, Math.PI * 2)
  ctx.stroke()
  if (red != null) {
    ctx.strokeStyle = '#d0241b'
    ctx.lineWidth = S * 0.03
    ctx.beginPath()
    ctx.arc(c, c, c * 0.84, dialAngle(red / max), dialAngle(1))
    ctx.stroke()
  }
  for (let v = 0; v <= max + 1e-6; v += minor) {
    const a = dialAngle(v / max)
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6
    const r0 = c * 0.9
    const r1 = c * (isMajor ? 0.76 : 0.83)
    ctx.strokeStyle = red != null && v >= red ? '#ff4a3a' : '#f4f1ea'
    ctx.lineWidth = S * (isMajor ? 0.011 : 0.005)
    ctx.beginPath()
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0)
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1)
    ctx.stroke()
    if (isMajor) {
      ctx.fillStyle = '#f4f1ea'
      ctx.font = `600 ${S * 0.085}px "Barlow Condensed", "Khand", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const rr = c * 0.62
      ctx.fillText(String(Math.round(v)), c + Math.cos(a) * rr, c + Math.sin(a) * rr)
    }
  }
  ctx.fillStyle = 'rgba(244,241,234,0.75)'
  ctx.font = `500 ${S * 0.045}px "Barlow", "Manrope", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(label, c, c + c * 0.32)
  if (sub) {
    ctx.fillStyle = 'rgba(244,241,234,0.45)'
    ctx.font = `500 ${S * 0.034}px "Barlow", "Manrope", sans-serif`
    ctx.fillText(sub, c, c + c * 0.42)
  }
  if (lcd) {
    const w = S * 0.3, h = S * 0.09
    ctx.fillStyle = '#121a12'
    ctx.fillRect(c - w / 2, c + c * 0.52, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.strokeRect(c - w / 2, c + c * 0.52, w, h)
    ctx.fillStyle = '#c7e8a6'
    ctx.font = `600 ${S * 0.06}px "Barlow Condensed", "Khand", monospace`
    ctx.textBaseline = 'middle'
    ctx.fillText(lcd, c, c + c * 0.52 + h / 2)
  }
  if (lamps) {
    lamps.forEach((col, i) => {
      const x = c + (i - (lamps.length - 1) / 2) * S * 0.07
      ctx.fillStyle = col
      ctx.globalAlpha = 0.18
      ctx.beginPath()
      ctx.arc(x, c - c * 0.38, S * 0.018, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })
  }
}

/** Twin analog clocks (café racer). Faces are static; needles are 3D. */
export function analogFaces() {
  const S = 1024
  const speedo = mk(S, S)
  const tacho = mk(S, S)
  const drawSpeedo = (odo) =>
    face(speedo.ctx, S, { max: 180, major: 20, minor: 10, label: 'km/h', sub: 'MPH 0–110', lamps: ['#3cff6b', '#ff9a1a', '#ff9a1a'], lcd: odo })
  face(tacho.ctx, S, { max: 9, major: 1, minor: 0.5, label: 'r/min ×1000', red: 7.5, lamps: ['#3a8bff', '#ff3a2a', '#ffcc33'] })
  drawSpeedo('ODO 01247')
  return {
    speedo: speedo.t,
    tacho: tacho.t,
    setOdo(km) {
      drawSpeedo(`ODO ${String(Math.floor(1247 + km)).padStart(5, '0')}`)
      speedo.t.needsUpdate = true
    },
  }
}

function round(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Race-style TFT (sport bike). Updated live. */
export function raceTFT() {
  const W = 1024, H = 600
  const s = mk(W, H)
  return {
    texture: s.t,
    draw(st) {
      const { ctx } = s
      ctx.fillStyle = '#020203'
      ctx.fillRect(0, 0, W, H)
      // rpm bar arc across the top
      const rn = Math.min(1, st.rpm / st.redline)
      const cx = W / 2, cy = H * 1.15, R = H * 1.02
      const a0 = Math.PI * 1.15, a1 = Math.PI * 1.85
      ctx.lineWidth = 46
      ctx.strokeStyle = '#151518'
      ctx.beginPath()
      ctx.arc(cx, cy, R, a0, a1)
      ctx.stroke()
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, '#e9e9e9')
      grad.addColorStop(0.7, '#e9e9e9')
      grad.addColorStop(0.84, '#ffae2e')
      grad.addColorStop(1, '#ff2a1f')
      ctx.strokeStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * rn)
      ctx.stroke()
      ctx.fillStyle = '#7d7d82'
      ctx.font = '600 30px "Barlow Condensed", sans-serif'
      ctx.textAlign = 'center'
      for (let k = 0; k <= 16; k += 2) {
        const f = (k * 1000) / st.redline
        if (f > 1.05) break
        const a = a0 + (a1 - a0) * Math.min(1, f)
        ctx.fillText(String(k), cx + Math.cos(a) * (R - 62), cy + Math.sin(a) * (R - 62))
      }
      // speed
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 230px "Barlow Condensed", sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(String(Math.round(st.speed)), W * 0.63, H * 0.86)
      ctx.font = '500 34px "Barlow", sans-serif'
      ctx.fillStyle = '#a9a9ae'
      ctx.textAlign = 'left'
      ctx.fillText('km/h', W * 0.64, H * 0.83)
      // gear
      ctx.lineWidth = 6
      ctx.strokeStyle = '#d7261e'
      round(ctx, W * 0.78, H * 0.42, 150, 190, 18)
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = '700 170px "Barlow Condensed", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(st.gear), W * 0.78 + 75, H * 0.42 + 160)
      // left column
      ctx.textAlign = 'left'
      ctx.font = '600 34px "Barlow Condensed", sans-serif'
      ctx.fillStyle = '#d7261e'
      ctx.fillText('ROAD', 40, H * 0.5)
      ctx.fillStyle = '#c9c9ce'
      ctx.font = '500 30px "Barlow", sans-serif'
      ctx.fillText(`TRIP ${st.trip.toFixed(1)} km`, 40, H * 0.62)
      ctx.fillText(`${st.temp}°C  ·  ${st.clock}`, 40, H * 0.72)
      ctx.fillText(`FUEL`, 40, H * 0.84)
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i < 6 ? '#e9e9e9' : '#2a2a2e'
        ctx.fillRect(120 + i * 22, H * 0.84 - 22, 16, 24)
      }
      s.t.needsUpdate = true
    },
  }
}

/** Compact TFT (naked bike). Updated live. */
export function nakedTFT(accent = '#e8b10f') {
  const W = 900, H = 560
  const s = mk(W, H)
  return {
    texture: s.t,
    draw(st) {
      const { ctx } = s
      ctx.fillStyle = '#04060a'
      ctx.fillRect(0, 0, W, H)
      const rn = Math.min(1, st.rpm / st.redline)
      const segs = 36
      const sw = (W - 80) / segs
      for (let i = 0; i < segs; i++) {
        const t = i / segs
        const on = t < rn
        ctx.fillStyle = on ? (t > 0.86 ? '#ff3a2c' : t > 0.72 ? '#ffc21a' : '#f2f2f2') : '#151a22'
        const h = 30 + t * 60
        ctx.fillRect(40 + i * sw, 130 - h, sw - 5, h)
      }
      ctx.fillStyle = accent
      ctx.fillRect(40, 150, W - 80, 5)
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 230px "Barlow Condensed", sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(String(Math.round(st.speed)), 40, H - 70)
      ctx.font = '500 36px "Barlow", sans-serif'
      ctx.fillStyle = '#9aa1ab'
      ctx.fillText('km/h', 46, H - 28)
      ctx.textAlign = 'right'
      ctx.fillStyle = accent
      ctx.font = '700 210px "Barlow Condensed", sans-serif'
      ctx.fillText(String(st.gear), W - 40, H - 70)
      ctx.font = '500 32px "Barlow", sans-serif'
      ctx.fillStyle = '#9aa1ab'
      ctx.fillText('ROAD  ·  ' + st.clock, W - 44, H - 28)
      ctx.textAlign = 'center'
      ctx.fillText(`${st.temp}°C`, W * 0.55, H - 28)
      s.t.needsUpdate = true
    },
  }
}

/** Single analog speedometer with a small LCD inset (classic roadster). */
export function classicFace() {
  const S = 1024
  const sp = mk(S, S)
  const draw = (lcd) => face(sp.ctx, S, { max: 140, major: 20, minor: 10, label: 'km/h', sub: 'MPH 0–85', lamps: ['#3cff6b', '#ff9a1a', '#3a8bff', '#ff3a2a'], lcd })
  draw('ODO 08214')
  let last = -1
  return {
    speedo: sp.t,
    setOdo(km) {
      const v = Math.floor(8214 + km)
      if (v === last) return
      last = v
      draw(`ODO ${String(v).padStart(5, '0')}`)
      sp.t.needsUpdate = true
    },
  }
}

/** Round TFT (adventure bike). Updated live. */
export function roundTFT(accent = '#f2a93b') {
  const S = 720
  const s = mk(S, S)
  return {
    texture: s.t,
    draw(st) {
      const { ctx } = s
      const c = S / 2
      ctx.clearRect(0, 0, S, S)
      ctx.save()
      ctx.beginPath()
      ctx.arc(c, c, c, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = '#05070a'
      ctx.fillRect(0, 0, S, S)
      // rpm ring: segments sweeping from bottom-left over the top
      const rn = Math.min(1, st.rpm / st.redline)
      const segs = 44
      const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2
      for (let i = 0; i < segs; i++) {
        const t = i / segs
        const a = a0 + (a1 - a0) * t
        const on = t < rn
        ctx.strokeStyle = on ? (t > 0.85 ? '#ff3a2c' : t > 0.7 ? accent : '#f1f1f1') : '#1a1f27'
        ctx.lineWidth = 26
        ctx.beginPath()
        ctx.arc(c, c, c - 34, a, a + ((a1 - a0) / segs) * 0.7)
        ctx.stroke()
      }
      // speed
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.font = '700 210px "Barlow Condensed", sans-serif'
      ctx.fillText(String(Math.round(st.speed)), c, c + 58)
      ctx.font = '500 34px "Barlow", sans-serif'
      ctx.fillStyle = '#9aa1ab'
      ctx.fillText('km/h', c, c + 104)
      // gear + info row
      ctx.fillStyle = accent
      ctx.font = '700 92px "Barlow Condensed", sans-serif'
      ctx.fillText(String(st.gear), c + 200, c + 40)
      ctx.font = '500 30px "Barlow", sans-serif'
      ctx.fillStyle = '#c9ced6'
      ctx.fillText(st.clock, c, c - 132)
      ctx.fillText(`${st.temp}°C`, c - 196, c + 40)
      ctx.fillStyle = '#9aa1ab'
      ctx.fillText(`TRIP ${st.trip.toFixed(1)}`, c, c + 168)
      ctx.restore()
      s.t.needsUpdate = true
    },
  }
}
