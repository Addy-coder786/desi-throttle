import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Home, Bike, MapPin, Music, Info, Settings, Maximize, Minimize, Pause, Play, Camera, Lamp, Map as MapIcon, X, ChevronRight, Sun, Sunrise, Sunset, Moon, CloudRain, CloudFog, Mountain, Timer } from 'lucide-react'
import { useStore } from '../store'
import { SCENES, SCENE_MAP, DEFAULT_SCENE } from '../data/scenes'
import { BIKES } from '../data/bikes'
import { TIMES, TIME_MAP, WEATHERS } from '../data/times'
import { chooseWeather, chooseScene, chooseBike, chooseTime, toggleFullscreen, takePhoto, exitRide, togglePauseRide } from '../actions'
import { music } from '../audio/music'
import { sound } from '../audio/sound'
import { ride } from '../stage/ride'
import MusicCard from './MusicCard'
import Panels from './Panels'
import TitleCard from './TitleCard'
import TouchControls from './TouchControls'

const ICONS = { sun: Sun, sunrise: Sunrise, sunset: Sunset, moon: Moon, rain: CloudRain, fog: CloudFog }
// riding keys → ride input flags; they don't wake the auto-hidden controls
const DRIVE = { w: 'throttleHeld', s: 'brakeHeld', a: 'leftHeld', d: 'rightHeld' }
const RIDING_KEYS = new Set([...Object.keys(DRIVE), 'r', 'arrowup'])

/* ---------------------------------------------------------------- brand */
function BrandLockup({ size = 'md' }) {
  const lg = size === 'lg'
  return (
    <div className={`flex items-center ${lg ? 'gap-5' : 'gap-3'}`}>
      <span className={`font-deva leading-[0.85] font-extrabold tracking-tight text-white ${lg ? 'text-[clamp(64px,11vw,128px)]' : 'text-[30px] sm:text-[38px]'}`}>देसी</span>
      <span className={`w-px bg-white/30 ${lg ? 'h-[clamp(52px,8vw,96px)]' : 'h-8 sm:h-9'}`} aria-hidden />
      <span className="leading-none">
        <span className={`block font-cond font-semibold text-marigold ${lg ? 'text-[clamp(26px,4vw,46px)] tracking-[0.42em]' : 'text-[17px] tracking-[0.38em] sm:text-[20px]'}`}>THROTTLE</span>
        <span className={`block font-serif text-white/80 italic ${lg ? 'mt-2 text-[clamp(17px,2vw,24px)]' : 'mt-1.5 hidden text-[14px] sm:block'}`}>Raaste apne, andaaz apna.</span>
      </span>
    </div>
  )
}

function Brand() {
  return (
    <div className="fadeable pointer-events-none fixed top-4 left-4 z-20 select-none tshadow sm:top-6 sm:left-7">
      <BrandLockup />
    </div>
  )
}

/* ---------------------------------------------------------------- nav */
function NavBar() {
  const panel = useStore((s) => s.panel)
  const openPanel = useStore((s) => s.openPanel)
  const close = useStore((s) => s.closePanel)
  const items = [
    ['home', 'Home', Home, () => close()],
    ['bikes', 'Choose Bike', Bike, () => openPanel('bikes')],
    ['scenes', 'Destinations', MapPin, () => openPanel('scenes')],
    ['playlist', 'Music', Music, () => openPanel('playlist')],
    ['about', 'About', Info, () => openPanel('about')],
  ]
  const active = panel ?? 'home'
  return (
    <nav aria-label="Main" className="fadeable pointer-events-auto fixed top-6 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
      <ul className="surface flex items-center gap-0.5 rounded-full p-1">
        {items.map(([id, label, Icon, fn]) => {
          const on = active === id
          return (
            <li key={id}>
              <button onClick={fn} aria-current={on ? 'page' : undefined} className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition duration-200 ${on ? 'bg-white text-ink shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
                <Icon size={15} strokeWidth={2} />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function RoundButton({ label, onClick, children, tone = 'dark', active }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} aria-pressed={active || undefined} className={`grid h-10 w-10 place-items-center rounded-full transition duration-200 active:scale-95 sm:h-11 sm:w-11 ${tone === 'red' ? 'btn-danger' : 'surface hover:bg-white/14'} ${active ? 'text-marigold' : 'text-white'}`}>
      {children}
    </button>
  )
}

function TopRight() {
  const openPanel = useStore((s) => s.openPanel)
  const playing = useStore((s) => s.music.playing)
  const paused = useStore((s) => s.paused)
  const [fs, setFs] = useState(false)
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  return (
    <div className="fadeable pointer-events-auto fixed top-4 right-4 z-20 flex gap-2 sm:top-6 sm:right-7 sm:gap-2.5">
      <RoundButton label={playing ? 'Pause music' : 'Play music'} onClick={() => music.toggle()} active={playing}>
        <Music size={18} strokeWidth={1.9} />
      </RoundButton>
      <span className="max-sm:hidden">
        <RoundButton label="Settings" onClick={() => openPanel('about')}>
          <Settings size={18} strokeWidth={1.9} />
        </RoundButton>
      </span>
      <span className="hidden sm:contents">
        <RoundButton label={fs ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
          {fs ? <Minimize size={18} strokeWidth={1.9} /> : <Maximize size={18} strokeWidth={1.9} />}
        </RoundButton>
      </span>
      <RoundButton label={paused ? 'Resume ride' : 'Pause ride'} onClick={togglePauseRide}>
        {paused ? <Play size={18} strokeWidth={1.9} fill="currentColor" /> : <Pause size={18} strokeWidth={1.9} fill="currentColor" />}
      </RoundButton>
    </div>
  )
}

/* ---------------------------------------------------------------- left: status cards */
function Picker({ open, onClose, children, label }) {
  const ref = useRef()
  useEffect(() => {
    if (!open) return
    const off = (e) => !ref.current?.contains(e.target) && onClose()
    setTimeout(() => window.addEventListener('pointerdown', off), 0)
    return () => window.removeEventListener('pointerdown', off)
  }, [open, onClose])
  if (!open) return null
  return (
    <div ref={ref} role="menu" aria-label={label} className="surface-strong scroll-y absolute bottom-0 left-[calc(100%+10px)] z-30 max-h-[min(440px,calc(100vh-140px))] w-64 animate-rise overflow-y-auto rounded-2xl p-1.5 max-sm:fixed max-sm:top-[118px] max-sm:right-4 max-sm:bottom-auto max-sm:left-4 max-sm:w-auto">
      <p className="label px-3 pt-2 pb-1.5">{label}</p>
      {children}
    </div>
  )
}

function StatusRow({ icon: Icon, kicker, value, onClick, expanded }) {
  return (
    <button onClick={onClick} aria-expanded={expanded} aria-label={`${kicker}: ${value}`} className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition duration-200 hover:bg-white/6 max-sm:gap-2 max-sm:px-2.5 max-sm:py-2 ${expanded ? 'bg-white/6' : ''}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/7 ring-1 ring-white/10 max-sm:h-7 max-sm:w-7">
        <Icon size={17} className="text-marigold max-sm:h-4 max-sm:w-4" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="label block max-sm:hidden">{kicker}</span>
        <span className="mt-0.5 block truncate text-[15px] leading-tight font-semibold text-white max-sm:mt-0 max-sm:text-[13px]">{value}</span>
      </span>
      <ChevronRight size={16} className={`text-white/40 transition duration-200 group-hover:text-white/80 max-sm:hidden ${expanded ? 'translate-x-0.5 text-white/80' : ''}`} />
    </button>
  )
}

function MenuItem({ on, onClick, children }) {
  return (
    <button role="menuitemradio" aria-checked={on} onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] font-medium transition duration-150 ${on ? 'bg-white/12 text-white' : 'text-white/80 hover:bg-white/7 hover:text-white'}`}>
      {children}
    </button>
  )
}

function StatusCards() {
  const sceneId = useStore((s) => s.sceneId)
  const weather = useStore((s) => s.weather)
  const time = useStore((s) => s.time)
  const scene = SCENE_MAP[sceneId] ?? DEFAULT_SCENE
  const [open, setOpen] = useState(null)
  const W = WEATHERS.find((w) => w.id === weather)
  const T = TIME_MAP[time]
  const close = () => setOpen(null)
  return (
    <section aria-label="Ride settings" className="fadeable pointer-events-auto fixed bottom-[104px] left-4 z-20 w-[236px] sm:left-7 short:bottom-24 touch:sm:bottom-[148px] max-sm:top-[64px] max-sm:right-4 max-sm:bottom-auto max-sm:w-auto">
      <div className="surface relative divide-y divide-white/8 overflow-visible rounded-2xl max-sm:flex max-sm:divide-x max-sm:divide-y-0">
        <div className="relative first:[&>button]:rounded-t-2xl last:[&>button]:rounded-b-2xl max-sm:min-w-0 max-sm:flex-1">
          <StatusRow icon={MapPin} kicker="Location" value={scene.region} onClick={() => setOpen(open === 'loc' ? null : 'loc')} expanded={open === 'loc'} />
          <Picker open={open === 'loc'} onClose={close} label="Location">
            {SCENES.map((s) => (
              <MenuItem key={s.id} on={s.id === scene.id} onClick={() => (chooseScene(s.id), close())}>
                <img src={s.poster} alt="" className="h-9 w-14 rounded-lg object-cover ring-1 ring-white/10" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.name}</span>
                  <span className="block truncate text-[12px] font-normal text-white/50">{s.place}</span>
                </span>
              </MenuItem>
            ))}
          </Picker>
        </div>
        <div className="relative first:[&>button]:rounded-t-2xl last:[&>button]:rounded-b-2xl max-sm:min-w-0 max-sm:flex-1">
          <StatusRow icon={ICONS[W.icon]} kicker="Weather" value={W.label} onClick={() => setOpen(open === 'w' ? null : 'w')} expanded={open === 'w'} />
          <Picker open={open === 'w'} onClose={close} label="Weather">
            {WEATHERS.map((w) => {
              const I = ICONS[w.icon]
              return (
                <MenuItem key={w.id} on={w.id === weather} onClick={() => (chooseWeather(w.id), close())}>
                  <I size={17} className="text-marigold" strokeWidth={1.9} /> {w.label} <span className="ml-auto font-deva text-[13px] font-normal text-white/45">{w.hindi}</span>
                </MenuItem>
              )
            })}
          </Picker>
        </div>
        <div className="relative first:[&>button]:rounded-t-2xl last:[&>button]:rounded-b-2xl max-sm:min-w-0 max-sm:flex-1">
          <StatusRow icon={ICONS[T.icon]} kicker="Time" value={T.label} onClick={() => setOpen(open === 't' ? null : 't')} expanded={open === 't'} />
          <Picker open={open === 't'} onClose={close} label="Time of day">
            {TIMES.map((t) => {
              const I = ICONS[t.icon]
              return (
                <MenuItem key={t.id} on={t.id === time} onClick={() => (chooseTime(t.id), close())}>
                  <I size={17} className="text-marigold" strokeWidth={1.9} /> {t.label} <span className="ml-auto font-deva text-[13px] font-normal text-white/45">{t.hindi}</span>
                </MenuItem>
              )
            })}
          </Picker>
        </div>
      </div>
    </section>
  )
}

function TripPill() {
  const dist = useRef()
  const time = useRef()
  useEffect(() => {
    const id = setInterval(() => {
      if (dist.current) dist.current.textContent = `${ride.trip.toFixed(1)} km`
      const t = Math.floor(ride.elapsed)
      if (time.current) time.current.textContent = `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    }, 500)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="fadeable pointer-events-none fixed bottom-6 left-4 z-20 sm:left-7 max-sm:hidden touch:hidden">
      <div className="surface flex items-center gap-5 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Mountain size={20} className="text-white/70" strokeWidth={1.7} />
          <div>
            <p className="label">Distance</p>
            <p ref={dist} className="mt-0.5 text-[15px] leading-tight font-semibold tabular-nums">0.0 km</p>
          </div>
        </div>
        <span className="h-8 w-px bg-white/12" />
        <div className="flex items-center gap-3">
          <Timer size={19} className="text-white/70" strokeWidth={1.7} />
          <div>
            <p className="label">Ride time</p>
            <p ref={time} className="mt-0.5 text-[15px] leading-tight font-semibold tabular-nums">00:00:00</p>
          </div>
        </div>
      </div>
    </div>
  )
}
/* ---------------------------------------------------------------- bottom-right actions */
function Actions() {
  const headlight = useStore((s) => s.headlight)
  const openPanel = useStore((s) => s.openPanel)
  return (
    <div className="fadeable pointer-events-auto fixed right-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-20 flex gap-2.5 sm:right-7 max-sm:bottom-[calc(20px+env(safe-area-inset-bottom))] max-sm:left-4 max-sm:justify-between">
      {/* no top navigation below lg: bikes are picked from here */}
      <span className="contents lg:hidden">
        <RoundButton label="Choose bike" onClick={() => openPanel('bikes')}>
          <Bike size={18} strokeWidth={1.9} />
        </RoundButton>
      </span>
      <RoundButton label="Take a photo" onClick={takePhoto}>
        <Camera size={18} strokeWidth={1.9} />
      </RoundButton>
      <RoundButton label={headlight ? 'Headlight off' : 'Headlight on'} onClick={() => useStore.setState({ headlight: !headlight })} active={headlight}>
        <Lamp size={18} strokeWidth={1.9} />
      </RoundButton>
      <RoundButton label="Destinations map" onClick={() => openPanel('scenes')}>
        <MapIcon size={18} strokeWidth={1.9} />
      </RoundButton>
      <RoundButton label="End ride" onClick={exitRide} tone="red">
        <X size={18} strokeWidth={1.9} />
      </RoundButton>
    </div>
  )
}

function Paused() {
  const paused = useStore((s) => s.paused)
  const ref = useRef()
  useEffect(() => {
    if (paused && ref.current) gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.5 })
  }, [paused])
  if (!paused) return null
  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-10 grid place-items-center bg-black/25">
      <div className="text-center">
        <p className="font-deva text-[clamp(56px,9vw,110px)] leading-none font-extrabold tshadow">रुको ज़रा</p>
        <p className="mt-3 font-serif text-2xl text-white/90 italic tshadow">Chai break. Press play when you’re ready.</p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- root */
export default function Interface() {
  const uiHidden = useStore((s) => s.uiHidden)
  const panel = useStore((s) => s.panel)

  // controls fade after a quiet spell; any movement brings them back
  useEffect(() => {
    let t
    const wake = (e) => {
      if (e?.type === 'keydown' && RIDING_KEYS.has(e.key?.toLowerCase())) return
      if (e?.target?.closest?.('[data-drive]')) return
      if (useStore.getState().uiHidden) useStore.setState({ uiHidden: false })
      clearTimeout(t)
      t = setTimeout(() => {
        const s = useStore.getState()
        if (!s.panel && s.phase === 'ride') useStore.setState({ uiHidden: true })
      }, 9000)
    }
    const evs = ['pointermove', 'pointerdown', 'keydown', 'touchstart']
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    wake()
    return () => {
      clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, wake))
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('ui-hidden', uiHidden && !panel)
  }, [uiHidden, panel])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const s = useStore.getState()
      if (e.key === 'Escape') return s.closePanel()
      if (s.phase !== 'ride') return
      const k = e.key.toLowerCase()
      if (k === 'f') toggleFullscreen()
      if (k === ' ') {
        e.preventDefault()
        music.toggle()
      }
      if (k === 'r' || k === 'arrowup') {
        e.preventDefault()
        if (!s.paused) {
          ride.revHeld = true
          if (!e.repeat) sound.rev()
        }
      }
      // W throttle · S brake · A / D lean
      if (DRIVE[k] && !s.paused) {
        ride[DRIVE[k]] = true
        // pulling away from a stop: the bike's own rev recording
        if (k === 'w' && !e.repeat && ride.speed < 8) sound.rev()
      }
      if (k === 'n') music.next()
      if (k === 'h') useStore.setState({ uiHidden: !s.uiHidden, panel: null })
      if (k === 'arrowright' || k === 'arrowleft') {
        const i = Math.max(0, SCENES.findIndex((x) => x.id === s.sceneId))
        chooseScene(SCENES[(i + (k === 'arrowright' ? 1 : SCENES.length - 1)) % SCENES.length].id)
      }
      if (k === 'b') {
        const i = BIKES.findIndex((x) => x.id === s.bikeId)
        chooseBike(BIKES[(i + 1) % BIKES.length].id)
      }
      if (k === 't') {
        const i = TIMES.findIndex((x) => x.id === s.time)
        chooseTime(TIMES[(i + 1) % TIMES.length].id)
      }
    }
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'r' || k === 'arrowup') ride.revHeld = false
      if (DRIVE[k]) ride[DRIVE[k]] = false
    }
    const release = () => {
      ride.revHeld = false
      for (const f of Object.values(DRIVE)) ride[f] = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
    }
  }, [])

  return (
    <div>
      <div className="vignette z-[1]" />
      <Brand />
      <NavBar />
      <TopRight />
      <TitleCard />
      <Paused />
      <StatusCards />
      <TripPill />
      <MusicCard />
      <TouchControls />
      <Actions />
      <Panels />
    </div>
  )
}

