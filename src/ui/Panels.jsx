import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { X, Check, Volume2, LogIn, Upload, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { SCENES } from '../data/scenes'
import { BIKES } from '../data/bikes'
import { PLAYLIST, PLAYLIST_NAME } from '../data/playlist'
import { CREDITS } from '../data/credits'
import { chooseScene, chooseBike, setMix } from '../actions'
import { music } from '../audio/music'

function Sheet({ title, kicker, children, onClose }) {
  const ref = useRef()
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' })
    })
    return () => ctx.revert()
  }, [])
  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-3 sm:p-6" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="glass-strong flex max-h-[78vh] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
          <div>
            <p className="label !text-marigold">{kicker}</p>
            <h2 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 hover:bg-white/12">
            <X size={18} />
          </button>
        </div>
        <div className="scroll-y min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6 sm:px-7 sm:pb-7">{children}</div>
      </div>
    </div>
  )
}

function ScenesPanel() {
  const sceneId = useStore((s) => s.sceneId)
  const close = useStore((s) => s.closePanel)
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SCENES.map((sc, i) => {
        const on = sc.id === sceneId
        return (
          <button
            key={sc.id}
            onClick={() => {
              chooseScene(sc.id)
              close()
            }}
            style={{ animationDelay: `${i * 40}ms` }}
            aria-pressed={on}
            className={`group relative aspect-[16/10] animate-rise overflow-hidden rounded-2xl text-left ring-1 transition ${on ? 'ring-2 ring-marigold' : 'ring-white/10 hover:ring-white/40'}`}
          >
            <img src={sc.poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <span className="absolute top-2.5 left-2.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{sc.region}</span>
            {on && (
              <span className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-marigold text-ink">
                <Check size={15} strokeWidth={3} />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 p-3.5">
              <span className="block font-deva text-3xl leading-none font-extrabold">{sc.hindi}</span>
              <span className="mt-1 block text-[13px] font-semibold">{sc.name}</span>
              <span className="block text-[12px] text-cream/65">{sc.place}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function BikesPanel() {
  const bikeId = useStore((s) => s.bikeId)
  const close = useStore((s) => s.closePanel)
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {BIKES.map((b) => {
        const on = b.id === bikeId
        return (
          <article key={b.id} className={`flex flex-col overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ${on ? 'ring-2 ring-marigold' : 'ring-white/10'}`}>
            <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
              {b.photo && <img src={b.photo.src} alt={`${b.maker} ${b.name}`} loading="lazy" className="h-full w-full object-cover" />}
              {b.photo && (
                <a href={b.photo.href} target="_blank" rel="noreferrer" className="absolute right-2 bottom-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-cream/75 hover:text-cream">
                  Photo: {b.photo.credit}
                </a>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="label text-cream/50">
                {b.maker} · {b.nick}
              </p>
              <h3 className="mt-1 text-[19px] leading-tight font-semibold tracking-tight">{b.name}</h3>
              <p className="mt-1 text-sm text-cream/70">{b.line}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                {b.specs.map(([k, v]) => (
                  <div key={k}>
                    <dt className="label !text-[10px]">{k}</dt>
                    <dd className="leading-snug font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <button
                onClick={() => {
                  chooseBike(b.id)
                  close()
                }}
                className={`mt-4 rounded-full py-2.5 text-sm font-semibold transition ${on ? 'bg-white/10 text-white/60' : 'bg-white text-ink hover:bg-cream'}`}
              >
                {on ? 'Riding this one' : 'Ride this bike'}
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function FullSongsBar() {
  const local = useStore((s) => s.music.local)
  const input = useRef()
  const [msg, setMsg] = useState(null)
  const onFiles = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    const { added, unmatched } = await music.addFiles(files)
    setMsg(
      [added.length ? `Added ${added.length} full song${added.length > 1 ? 's' : ''}.` : null, unmatched.length ? `Couldn’t match ${unmatched.join(', ')}; use the + next to a song instead.` : null]
        .filter(Boolean)
        .join(' '),
    )
  }
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/8 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">
          Full songs <span className="ml-1 font-normal text-white/45">{local.length} of {PLAYLIST.length} on this device</span>
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-white/55">
          Log in to Spotify for every full song, or add song files you own. They stay in this browser and are never uploaded.
        </p>
        {msg && <p className="mt-1.5 text-[12.5px] text-marigold">{msg}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button onClick={() => music.login()} className="flex items-center gap-1.5 rounded-full bg-[#1ed760] px-3.5 py-2 text-[13px] font-semibold text-black transition hover:brightness-110">
          <LogIn size={14} strokeWidth={2.4} /> Spotify login
        </button>
        <button onClick={() => input.current.click()} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-ink transition hover:bg-cream">
          <Upload size={14} strokeWidth={2.4} /> Add song files
        </button>
        <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" multiple hidden onChange={onFiles} />
      </div>
    </div>
  )
}

function PlaylistPanel() {
  const m = useStore((s) => s.music)
  const pick = useRef()
  const target = useRef(null)
  const onPick = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (f && target.current) await music.attach(target.current, f)
  }
  return (
    <>
      <FullSongsBar />
      <input ref={pick} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" hidden onChange={onPick} />
      <ol className="grid gap-1 md:grid-cols-2">
        {PLAYLIST.map((t, i) => {
          const on = i === m.index
          const full = m.local.includes(t.n)
          return (
            <li key={t.n} className={`group flex items-center gap-1 rounded-xl pr-1.5 transition ${on ? 'bg-white/10' : 'hover:bg-white/5'}`}>
              <button onClick={() => (on ? music.toggle() : music.select(i))} className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left">
                <span className="w-6 text-right font-cond text-lg text-white/35 tabular-nums">{t.num}</span>
                <img src={t.art} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-2 text-[15px] font-semibold ${on ? 'text-marigold' : ''}`}>
                    <span className="truncate">{t.title}</span>
                    {full && <span className="shrink-0 rounded bg-marigold/20 px-1.5 py-px text-[10px] font-semibold tracking-wide text-marigold">FULL</span>}
                  </span>
                  <span className="block truncate text-[12px] text-white/50">
                    {t.film} · {t.year} · {t.artists}
                  </span>
                </span>
                {on && m.playing && <Volume2 size={16} className="mr-1 shrink-0 text-marigold" />}
              </button>
              {full ? (
                <button onClick={() => music.detach(t.n)} aria-label={`Remove your file for ${t.title}`} title="Remove your file" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/40 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus-visible:opacity-100">
                  <Trash2 size={15} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    target.current = t.n
                    pick.current.click()
                  }}
                  aria-label={`Add your file for ${t.title}`}
                  title="Add your song file"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/40 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus-visible:opacity-100 max-sm:opacity-100"
                >
                  <Plus size={16} />
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

function Mixer() {
  const mix = useStore((s) => s.mix)
  const rows = [
    ['engine', 'Engine', 0, 1, 0.01],
    ['ambience', 'Ambience', 0, 1, 0.01],
    ['music', 'Your songs', 0, 100, 1],
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map(([k, label, min, max, step]) => {
        const v = mix[k]
        return (
          <label key={k} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/8">
            <span className="w-20 text-sm font-semibold">{label}</span>
            <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => setMix(k, +e.target.value)} className="range flex-1" style={{ '--v': `${((v - min) / (max - min)) * 100}%` }} aria-label={`${label} volume`} />
          </label>
        )
      })}
    </div>
  )
}

function AboutPanel() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4 text-[15px] leading-relaxed text-cream/80">
        <p className="font-serif text-3xl leading-snug text-cream italic">“Helmet pehno, bike start karo, aur India explore karne nikal pado.”</p>
        <p>
          देसी THROTTLE puts you in the saddle on real Indian roads. Pick a scene, a motorcycle, the weather and the time of day, then play your road-trip songs. Every scene is a painted moment on a real Indian road. Move the mouse to look around; the controls fade after a few seconds so it’s just you and the view.
        </p>
        <p className="text-sm text-cream/55">
          Shortcuts: <kbd className="rounded bg-white/10 px-1.5">Space</kbd> play/pause · <kbd className="rounded bg-white/10 px-1.5">N</kbd> next song · <kbd className="rounded bg-white/10 px-1.5">← →</kbd> scenes · <kbd className="rounded bg-white/10 px-1.5">W</kbd> throttle · <kbd className="rounded bg-white/10 px-1.5">S</kbd> brake · <kbd className="rounded bg-white/10 px-1.5">A</kbd> <kbd className="rounded bg-white/10 px-1.5">D</kbd> lean left / right · <kbd className="rounded bg-white/10 px-1.5">R</kbd> or <kbd className="rounded bg-white/10 px-1.5">↑</kbd> rev the engine (hold for more) · <kbd className="rounded bg-white/10 px-1.5">B</kbd> bike · <kbd className="rounded bg-white/10 px-1.5">T</kbd> time of day · <kbd className="rounded bg-white/10 px-1.5">H</kbd> hide controls · <kbd className="rounded bg-white/10 px-1.5">F</kbd> fullscreen · <kbd className="rounded bg-white/10 px-1.5">Esc</kbd> close.
        </p>
        <div>
          <p className="label mb-2 text-cream/50">Sound mix</p>
          <Mixer />
          <p className="mt-2 text-xs text-cream/45">“Your songs” sets the volume of song files you’ve added. Spotify songs use Spotify’s own volume (or your device’s). Log in to Spotify in this browser for full songs; otherwise Spotify plays 30-second previews.</p>
        </div>
      </div>
      <div>
        <p className="label mb-2 text-cream/50">Credits & licences</p>
        <ul className="space-y-3 text-[13px] text-cream/70">
          {CREDITS.map((g) => (
            <li key={g.group}>
              <p className="font-semibold text-cream">{g.group}</p>
              <ul className="mt-1 space-y-0.5">
                {g.items.map((it, i) => (
                  <li key={i}>
                    {it.href ? (
                      <a href={it.href} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2 hover:decoration-white">
                        {it.text}
                      </a>
                    ) : (
                      it.text
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const PANELS = {
  scenes: ['Choose a scene', 'Painted roads across India', ScenesPanel],
  bikes: ['Choose your bike', 'Garage', BikesPanel],
  playlist: [PLAYLIST_NAME, 'Playlist · Spotify or your own files', PlaylistPanel],
  about: ['About the ride', 'देसी THROTTLE', AboutPanel],
}

export default function Panels() {
  const panel = useStore((s) => s.panel)
  const close = useStore((s) => s.closePanel)
  if (!panel) return null
  const [title, kicker, Body] = PANELS[panel]
  return (
    <Sheet key={panel} title={title} kicker={kicker} onClose={close}>
      <Body />
    </Sheet>
  )
}
