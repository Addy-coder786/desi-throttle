import { useEffect, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ChevronUp, Loader2, LogIn } from 'lucide-react'
import { useStore } from '../store'
import { music } from '../audio/music'
import { PLAYLIST } from '../data/playlist'

function Seek() {
  const { time, duration } = useStore((s) => s.music)
  const bar = useRef()
  const frac = duration ? Math.min(1, time / duration) : 0
  const go = (e) => {
    const r = bar.current.getBoundingClientRect()
    music.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }
  return (
    <div
      ref={bar}
      onPointerDown={go}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') music.seek(Math.min(1, frac + 0.05))
        if (e.key === 'ArrowLeft') music.seek(Math.max(0, frac - 0.05))
      }}
      className="group relative h-4 cursor-pointer"
    >
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/18" />
      <div className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-marigold" style={{ width: `${frac * 100}%` }} />
      <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marigold shadow" style={{ left: `${frac * 100}%` }} />
    </div>
  )
}

export default function MusicCard() {
  const host = useRef()
  const m = useStore((s) => s.music)
  const openPanel = useStore((s) => s.openPanel)
  const RepeatIcon = m.repeat === 'one' ? Repeat1 : Repeat

  useEffect(() => {
    music.mount(host.current)
    music.init()
  }, [])
  const t = PLAYLIST[m.index]
  const file = m.source === 'file'
  // on touch screens the card sits at the top (the riding controls are at the bottom) and
  // fades with the rest of the controls; on desktop it stays while music plays
  const touch = document.documentElement.classList.contains('touch')

  return (
    <section
      aria-label="Music"
      className={`pointer-events-auto fixed right-4 bottom-[88px] z-20 w-[min(360px,calc(100vw-32px))] sm:right-7 sm:bottom-[90px] touch:bottom-auto touch:sm:top-[76px] max-sm:top-[112px] max-sm:bottom-auto ${m.playing && !touch ? '' : 'fadeable'}`}
    >
      <div className="surface rounded-[22px] p-2.5">
        <div className="relative h-20 overflow-hidden rounded-[12px] bg-black/30">
          {/* Spotify's own compact player (album cover, title, artist); kept mounted */}
          <div ref={host} className={`absolute inset-0 [&_iframe]:h-20 [&_iframe]:w-full [&_iframe]:rounded-[12px] ${file ? 'invisible' : ''}`} />
          {/* your own file: full song, same look */}
          {file && (
            <div className="absolute inset-0 flex items-center gap-3 rounded-[12px] bg-[linear-gradient(135deg,#2a1d17,#16120f)] p-2 pr-3">
              <img src={t.art} alt="" className="h-16 w-16 shrink-0 rounded-[8px] object-cover shadow-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] leading-tight font-semibold">{t.title}</p>
                <p className="mt-0.5 truncate text-[12px] text-white/60">{t.artists}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/45">
                  <span className="rounded bg-marigold/20 px-1.5 py-0.5 font-semibold text-marigold">FULL SONG</span>
                  {t.film}
                </p>
              </div>
            </div>
          )}
          {!m.ready && !m.error && !file && (
            <div className="absolute inset-0 grid place-items-center text-white/60">
              <Loader2 className="animate-spin" size={20} />
            </div>
          )}
          {m.error && <p className="absolute inset-0 grid place-items-center px-5 text-center text-[13px] text-white/75">{m.error}</p>}
        </div>
        <div className="collapsible mt-1.5 flex items-center justify-between px-1">
          <button onClick={() => useStore.getState().setMusic({ shuffle: !m.shuffle })} aria-label="Shuffle" aria-pressed={m.shuffle} className={`grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 ${m.shuffle ? 'text-marigold' : 'text-white/75'}`}>
            <Shuffle size={17} />
          </button>
          <button onClick={() => music.prev()} aria-label="Previous song" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
            <SkipBack size={19} fill="currentColor" />
          </button>
          <button onClick={() => music.toggle()} aria-label={m.playing ? 'Pause' : 'Play'} className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink transition hover:scale-105 active:scale-95">
            {m.playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}
          </button>
          <button onClick={() => music.next()} aria-label="Next song" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
            <SkipForward size={19} fill="currentColor" />
          </button>
          <button
            onClick={() => useStore.getState().setMusic({ repeat: { all: 'one', one: 'off', off: 'all' }[m.repeat] })}
            aria-label={`Repeat: ${m.repeat}`}
            className={`grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 ${m.repeat !== 'off' ? 'text-marigold' : 'text-white/75'}`}
          >
            <RepeatIcon size={17} />
          </button>
          <button onClick={() => openPanel('playlist')} aria-label="Open playlist" className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10">
            <ChevronUp size={20} />
          </button>
        </div>
        <div className="collapsible px-1.5 pt-0.5 touch:hidden">
          <Seek />
        </div>
        {!file && m.preview && (
          <div className="collapsible mt-1.5 flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2 touch:hidden">
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-white/70">
              <span className="font-semibold text-white">30-sec preview.</span> Log in to Spotify for full songs.
            </p>
            <button onClick={() => music.login()} className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#1ed760] px-3 py-1.5 text-[12px] font-semibold text-black transition hover:brightness-110">
              <LogIn size={13} strokeWidth={2.4} /> Log in
            </button>
          </div>
        )}
        {m.hint && <p className="collapsible px-2 pt-1 text-center text-[12px] text-marigold">{m.hint}</p>}
      </div>
    </section>
  )
}
