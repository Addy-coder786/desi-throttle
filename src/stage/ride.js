// The ride that drives the instruments, trip meter, engine audio and lean.
// By default it's a calm cruise whose speed wanders around the scene's pace.
// W / S take over (throttle / brake); A / D lean the bike.

export const ride = {
  t: 0,
  elapsed: 0, // ride time (s), stops while paused
  speed: 0, // km/h
  target: 0,
  rpm: 1100,
  gear: 1,
  trip: 0, // km
  throttle: 0, // 0..1, how open the throttle sounds
  engineOn: false,
  paused: false,
  temp: 24,
  revHeld: false, // R / ↑ held: a throttle blip on the clutch
  rev: 0, // 0..1, eases up while held and falls back after
  // rider input (keyboard)
  throttleHeld: false, // W
  brakeHeld: false, // S
  leftHeld: false, // A
  rightHeld: false, // D
  manual: false, // true once the rider has used W / S: speed is theirs until the scene changes
  thr: 0, // eased throttle input
  brk: 0, // eased brake input
  lean: 0, // -1 (left) .. 1 (right), eased

  reset() {
    this.elapsed = 0
    this.trip = 0
    this.speed = 0
    this.manual = false
  },

  // back to the scene's own cruise (new scene)
  cruise() {
    this.manual = false
  },

  step(dt, bike, cruise) {
    this.t += dt
    const t = this.t
    const moving = this.engineOn && !this.paused
    const ease = (v, to, k) => v + (to - v) * (1 - Math.exp(-dt * k))
    this.thr = ease(this.thr, moving && this.throttleHeld ? 1 : 0, this.throttleHeld ? 6 : 9)
    this.brk = ease(this.brk, moving && this.brakeHeld ? 1 : 0, this.brakeHeld ? 8 : 10)
    if (moving && (this.throttleHeld || this.brakeHeld)) this.manual = true

    const g = bike.gears
    const vmax = g[g.length - 1] * 1.08
    const prev = this.speed
    if (moving && this.manual) {
      // the rider's speed: throttle pulls (less near top speed), brakes stop hard, otherwise hold
      const pull = (5 + vmax / 12) * Math.max(0.04, 1 - Math.pow(this.speed / vmax, 2))
      this.speed = Math.min(vmax, Math.max(0, this.speed + (this.thr * pull - this.brk * 32) * dt))
      this.target = this.speed
    } else {
      const wander = Math.sin(t * 0.21) * 4 + Math.sin(t * 0.077 + 1.3) * 6 + Math.sin(t * 0.53) * 1.2
      this.target = moving ? Math.max(0, cruise + wander) : 0
      this.speed += (this.target - this.speed) * (1 - Math.exp(-dt * (moving ? 0.6 : 1.2)))
      if (this.speed < 0.3 && !moving) this.speed = 0
    }
    const accel = (this.speed - prev) / Math.max(dt, 1e-3)
    this.throttle = this.manual ? Math.max(0, Math.min(1, 0.3 + this.thr * 0.7 - this.brk * 0.25)) : Math.max(0, Math.min(1, 0.35 + accel * 0.18))

    // gears: short-shift when cruising, hold the gear longer under full throttle
    const shiftAt = 0.62 + this.thr * 0.23
    let gear = 1
    while (gear < g.length && this.speed > g[gear - 1] * shiftAt) gear++
    this.gear = gear
    const frac = this.speed / g[gear - 1]
    const want = this.engineOn && this.revHeld ? 1 : 0
    this.rev = ease(this.rev, want, want ? 7 : 2.2)
    const roadRpm = bike.idle + frac * (bike.redline - bike.idle) * 0.92
    const blipRpm = bike.idle + this.rev * (bike.redline - bike.idle) * 0.8
    const rpmTarget = this.engineOn ? Math.min(bike.redline, Math.max(bike.idle, roadRpm, blipRpm)) : 0
    // the needle snaps up on a blip and settles more slowly
    this.rpm += (rpmTarget - this.rpm) * (1 - Math.exp(-dt * (rpmTarget > this.rpm && (this.rev > 0.05 || this.thr > 0.05) ? 9 : 4)))

    // lean: only a moving bike leans; deeper with speed, up to full at ~25 km/h
    const steer = moving ? (this.rightHeld ? 1 : 0) - (this.leftHeld ? 1 : 0) : 0
    this.lean = ease(this.lean, steer * Math.min(1, this.speed / 25), 2.6)

    this.trip += (this.speed / 3600) * dt
    if (moving) this.elapsed += dt
  },

  dashState(bike) {
    const d = new Date()
    return {
      speed: this.speed,
      rpm: this.rpm,
      gear: this.speed < 3 ? 'N' : this.gear,
      redline: bike.redline,
      trip: this.trip,
      temp: this.temp,
      clock: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    }
  },
}
