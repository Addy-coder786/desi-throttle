// Real recorded engine + ambience audio (no synthesis). Loops are made
// seamless by crossfading the end of the steady section into its start.
import { ride } from '../stage/ride'

const cache = new Map()

// bring every recording to a common loudness (RMS), without clipping peaks
function normalize(buf, targetRms) {
  let sum = 0, peak = 0, n = 0
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i += 4) {
      sum += d[i] * d[i]
      peak = Math.max(peak, Math.abs(d[i]))
      n++
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n))
  if (!rms) return buf
  const g = Math.min(targetRms / rms, 0.97 / Math.max(peak, 1e-4))
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] *= g
  }
  return buf
}

// copy a [start, end] section out of a buffer
function slice(ctx, buf, start, end) {
  const sr = buf.sampleRate
  const s = Math.floor(start * sr), e = Math.floor(Math.min(end, buf.duration) * sr)
  const out = ctx.createBuffer(buf.numberOfChannels, Math.max(1, e - s), sr)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.getChannelData(ch).set(buf.getChannelData(ch).subarray(s, e))
  // 30 ms fades so a section never clicks
  const f = Math.min(Math.floor(0.03 * sr), Math.floor((e - s) / 4))
  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const d = out.getChannelData(ch)
    for (let i = 0; i < f; i++) {
      d[i] *= i / f
      d[d.length - 1 - i] *= i / f
    }
  }
  return out
}

function makeLoop(ctx, buf, start = 0, end = buf.duration, fade = 0.35) {
  const sr = buf.sampleRate
  const s = Math.floor(Math.max(0, start) * sr)
  const e = Math.floor(Math.min(buf.duration, end) * sr)
  const f = Math.min(Math.floor(fade * sr), Math.floor((e - s) / 3))
  const len = e - s - f
  if (len <= sr * 0.5) return buf
  const out = ctx.createBuffer(buf.numberOfChannels, len, sr)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch)
    const dst = out.getChannelData(ch)
    for (let i = 0; i < len; i++) dst[i] = src[s + i]
    // blend the tail (after `len`) into the head with an equal-power crossfade
    for (let i = 0; i < f; i++) {
      const t = i / f
      dst[i] = src[s + i] * Math.sin(t * Math.PI * 0.5) + src[s + len + i] * Math.cos(t * Math.PI * 0.5)
    }
  }
  return out
}

class Layer {
  constructor(ctx, out) {
    this.ctx = ctx
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(out)
    this.src = null
    this.key = null
  }
  play(buffer, key, rate = 1) {
    if (this.key === key && this.src) return
    this.stop(0.6)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.playbackRate.value = rate
    const g = this.ctx.createGain()
    g.gain.value = 0
    src.connect(g).connect(this.gain)
    src.start(0, Math.random() * Math.max(0.01, buffer.duration - 0.1))
    g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.4)
    this.src = src
    this.local = g
    this.key = key
  }
  stop(fade = 0.5) {
    if (!this.src) return
    const { src, local } = this
    local.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3)
    setTimeout(() => {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
      src.disconnect()
    }, fade * 1000 + 200)
    this.src = null
    this.key = null
  }
  level(v, tc = 0.3) {
    this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, tc)
  }
  rate(r) {
    if (this.src) this.src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.25)
  }
}

class Sound {
  ctx = null
  bike = null
  scene = null
  weather = 'clear'
  mix = { engine: 0.55, ambience: 0.6 }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return this.ctx
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    const ctx = new AC()
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -12
    comp.ratio.value = 3
    this.master = ctx.createGain()
    this.master.gain.value = 1
    this.master.connect(comp).connect(ctx.destination)
    this.engineBus = ctx.createGain()
    this.ambBus = ctx.createGain()
    this.engineBus.connect(this.master)
    this.ambBus.connect(this.master)
    // a gentle low-pass on the engine: it's heard through a helmet
    const helmet = ctx.createBiquadFilter()
    helmet.type = 'lowpass'
    helmet.frequency.value = 5200
    this.engineIn = helmet
    helmet.connect(this.engineBus)
    this.idle = new Layer(ctx, helmet)
    this.cruise = new Layer(ctx, helmet)
    this.wind = new Layer(ctx, this.ambBus)
    this.rain = new Layer(ctx, this.ambBus)
    this.amb = [new Layer(ctx, this.ambBus), new Layer(ctx, this.ambBus)]
    this.setMix(this.mix)
    return ctx
  }

  // loop: [start, end] seconds to loop (null = default window); { shot: [start, end] } = one-shot section
  async buffer(url, loop, rms = 0.12) {
    if (!url) return null
    const key = url + JSON.stringify(loop ?? null) + rms
    if (cache.has(key)) return cache.get(key)
    const p = (async () => {
      try {
        const r = await fetch(url)
        if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) return null
        const raw = await this.ctx.decodeAudioData(await r.arrayBuffer())
        if (loop?.shot) return normalize(slice(this.ctx, raw, loop.shot[0], loop.shot[1]), rms)
        // default: a ~25 s steady window, so long field recordings don't sit in memory
        const start = loop?.[0] ?? Math.min(5, raw.duration * 0.1)
        const end = loop?.[1] ?? Math.min(raw.duration, start + 25)
        return normalize(makeLoop(this.ctx, raw, start, end), rms)
      } catch {
        return null
      }
    })()
    cache.set(key, p)
    return p
  }

  setMix({ engine, ambience }) {
    this.mix = { engine, ambience }
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.engineBus.gain.setTargetAtTime(engine, t, 0.1)
    this.ambBus.gain.setTargetAtTime(ambience, t, 0.1)
  }

  async setBike(bike, { rev = true } = {}) {
    if (!this.init()) return
    this.bike = bike
    const s = bike.sound
    if (!s) {
      // no recording for this bike: fade out the previous engine
      this.idle.stop(0.6)
      this.cruise.stop(0.6)
      return
    }
    const [idle, cruise, revBuf] = await Promise.all([this.buffer(s.idle, s.idleLoop), this.buffer(s.cruise, s.cruiseLoop), this.buffer(s.rev, { shot: s.revShot }, 0.16)])
    if (this.bike !== bike) return
    // key by file + section: two bikes can share one recording at different rpm
    if (idle) this.idle.play(idle, `${s.idle}#${s.idleLoop}`)
    if (cruise) this.cruise.play(cruise, `${s.cruise}#${s.cruiseLoop}`)
    if (rev && revBuf) this.oneShot(revBuf, 0.9)
  }

  // keyboard rev: the bike's own rev recording, not re-triggered until most of it has played
  async rev() {
    const s = this.bike?.sound
    if (!s || !this.init()) return
    const now = performance.now()
    if (now < (this.revUntil ?? 0)) return
    this.revUntil = now + 700
    const buf = await this.buffer(s.rev, { shot: s.revShot }, 0.16)
    if (!buf || this.bike?.sound !== s) return
    this.revUntil = now + Math.min(1500, Math.max(700, buf.duration * 600))
    this.oneShot(buf, 0.9)
  }

  oneShot(buf, vol = 1) {
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = vol
    src.connect(g).connect(this.engineIn)
    src.start()
    // duck the loops while the rev plays
    const t = this.ctx.currentTime
    this.idle.gain.gain.setTargetAtTime(0.15, t, 0.05)
    this.cruise.gain.gain.setTargetAtTime(0.1, t, 0.05)
    this.duckUntil = performance.now() + Math.min(2500, buf.duration * 1000)
  }

  async setScene(scene) {
    if (!this.init()) return
    this.scene = scene
    const files = scene.ambience ?? []
    const bufs = await Promise.all(files.map((f) => this.buffer(f.src, f.loop, 0.1)))
    if (this.scene !== scene) return
    this.amb.forEach((layer, i) => {
      if (bufs[i]) {
        layer.play(bufs[i], files[i].src)
        layer.level(files[i].gain ?? 0.5, 1)
      } else layer.stop(1)
    })
    const wind = await this.buffer('/sounds/amb-wind-ride.mp3', [0.5, 19.5], 0.1)
    if (wind) this.wind.play(wind, 'wind')
  }

  async setWeather(w) {
    if (!this.init()) return
    this.weather = w
    this.rain.level(w === 'rain' ? 0.55 : 0, 1.2)
    if (w !== 'rain') return
    // only downloaded once it actually rains
    const rain = await this.buffer('/sounds/amb-rain.mp3', [1, 42], 0.12)
    if (rain && this.weather === 'rain') this.rain.play(rain, 'rain')
  }

  // per frame
  update() {
    if (!this.ctx || !this.bike?.sound) return
    const s = this.bike.sound
    const v = ride.speed
    const on = ride.engineOn
    const ducking = this.duckUntil && performance.now() < this.duckUntil
    if (!ducking) {
      const k = Math.min(1, Math.max(0, (v - 6) / 18))
      this.idle.level(on ? (1 - k) * (s.idleGain ?? 0.8) : 0, 0.4)
      // louder on an open throttle (W), softer on a closed one (S)
      const load = 0.7 + ride.throttle * 0.65
      this.idle.level(on ? (1 - k) * (s.idleGain ?? 0.8) : 0, 0.4)
      this.cruise.level(on ? k * (s.cruiseGain ?? 0.8) * load : 0, 0.25)
    }
    // pitch follows the simulated rpm: cruiseRpm is the rpm at which the recording plays as is
    const r = Math.min(1.45, Math.max(0.75, ride.rpm / (s.cruiseRpm ?? (ride.rpm || 1))))
    this.cruise.rate(r)
    this.wind.level(Math.min(0.75, Math.pow(v / 90, 2) * 0.5), 0.6)
  }

  suspend() {
    this.ctx?.suspend()
  }
  resume() {
    this.ctx?.resume()
  }
}

export const sound = new Sound()
