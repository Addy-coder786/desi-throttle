import { useStore } from './store'
import { sound } from './audio/sound'
import { music } from './audio/music'
import { ride } from './stage/ride'
import { stage } from './stage/handle'
import { BIKE_MAP } from './data/bikes'
import { SCENE_MAP, DEFAULT_SCENE } from './data/scenes'
import { backdrop } from './stage/backdrop'

const S = () => useStore.getState()
const currentScene = () => SCENE_MAP[S().sceneId] ?? DEFAULT_SCENE

export function startRide() {
  sound.init()
  sound.setMix(S().mix)
  sound.setBike(BIKE_MAP[S().bikeId])
  sound.setScene(currentScene())
  sound.setWeather(S().weather)
  ride.engineOn = true
  ride.paused = false
  useStore.setState({ paused: false })
  backdrop.uniforms.uFade.value = 0
  music.play()
}

export function exitRide() {
  ride.engineOn = false
  ride.reset()
  music.pause()
  sound.suspend()
  useStore.setState({ phase: 'intro', panel: null, paused: false, uiHidden: false })
}

export function togglePauseRide() {
  const paused = !S().paused
  ride.paused = paused
  useStore.setState({ paused })
}

export function chooseScene(id) {
  if (id === S().sceneId) return
  S().setScene(id)
  ride.cruise() // a new road: back to its own pace
  sound.setScene(SCENE_MAP[id] ?? DEFAULT_SCENE)
}

export function chooseBike(id) {
  if (id === S().bikeId) return
  S().setBike(id)
  if (S().phase === 'ride') sound.setBike(BIKE_MAP[id])
}

export function chooseWeather(w) {
  S().setWeather(w)
  sound.setWeather(w)
}

export function chooseTime(t) {
  S().setTime(t)
}

export function setMix(key, value) {
  S().setMix(key, value)
  if (key === 'music') music.volume(value)
  else sound.setMix(S().mix)
}

export function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
  else document.exitFullscreen?.()
}

// Save the current view as a PNG postcard with the brand watermark.
export function takePhoto() {
  const src = stage.canvas
  if (!src) return
  stage.capture((frame) => {
    const W = frame.width, H = frame.height
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.drawImage(frame, 0, 0)
    const k = W / 1600
    const g = ctx.createLinearGradient(0, H * 0.7, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.62)')
    ctx.fillStyle = g
    ctx.fillRect(0, H * 0.7, W, H * 0.3)
    const sc = currentScene()
    const bike = BIKE_MAP[S().bikeId]
    const x = 48 * k, base = H - 78 * k
    // brand lockup: देसी | THROTTLE
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#fff'
    ctx.font = `800 ${54 * k}px Mukta, sans-serif`
    ctx.fillText('देसी', x, base)
    const w1 = ctx.measureText('देसी').width
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(x + w1 + 16 * k, base - 40 * k, 1.5 * k, 44 * k)
    ctx.fillStyle = '#f4ad3d'
    ctx.font = `600 ${26 * k}px "Barlow Condensed", sans-serif`
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${10 * k}px`
    ctx.fillText('THROTTLE', x + w1 + 34 * k, base - 12 * k)
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `italic ${19 * k}px "Instrument Serif", serif`
    ctx.fillText('Raaste apne, andaaz apna.', x + w1 + 34 * k, base + 10 * k)
    // caption
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `500 ${15 * k}px Inter, sans-serif`
    ctx.fillText(`${sc.name.toUpperCase()}  ·  ${sc.place}  ·  ${bike.maker} ${bike.name}`, x, H - 36 * k)
    c.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `desi-throttle-${sc.id}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    }, 'image/png')
  })
}
