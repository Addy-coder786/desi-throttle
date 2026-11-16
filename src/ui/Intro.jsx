import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { startRide } from '../actions'
import { SCENES, SCENE_MAP, DEFAULT_SCENE } from '../data/scenes'
import { BIKES } from '../data/bikes'
import { PLAYLIST } from '../data/playlist'

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export default function Intro() {
  const loading = useStore((s) => s.loading)
  const sceneReady = useStore((s) => s.sceneReady)
  const [starting, setStarting] = useState(false)
  const root = useRef()

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.fromTo('.i-bg', { scale: 1.12, opacity: 0 }, { scale: 1.04, opacity: 1, duration: 2.4, ease: 'power2.out' })
        .fromTo('.i-deva', { y: 30, opacity: 0, filter: 'blur(8px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.4 }, 0.2)
        .fromTo('.i-rule', { scaleY: 0 }, { scaleY: 1, duration: 0.9 }, 0.55)
        .fromTo('.i-lat', { x: -16, opacity: 0, letterSpacing: '0.2em' }, { x: 0, opacity: 1, letterSpacing: '0.42em', duration: 1.4 }, 0.6)
        .fromTo('.i-fade', { y: 12, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 1 }, 0.9)
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!starting || !sceneReady) return
    startRide()
    gsap.to(root.current, { opacity: 0, duration: 1.4, ease: 'power2.inOut', delay: 0.2, onComplete: () => useStore.setState({ phase: 'ride' }) })
  }, [starting, sceneReady])

  const pct = Math.round(loading.progress * 100)
  const scene = SCENE_MAP[useStore.getState().sceneId] ?? DEFAULT_SCENE
  return (
    <div ref={root} className="fixed inset-0 z-50 overflow-hidden bg-black">
      <img src={scene.poster} alt="" className="i-bg absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.25)_40%,rgba(0,0,0,0.85)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_45%,transparent,rgba(0,0,0,0.5))]" />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="sr-only">Desi Throttle</h1>
        <div className="flex items-center gap-[clamp(14px,2.4vw,28px)]" aria-hidden>
          <span className="i-deva font-deva text-[clamp(72px,13vw,150px)] leading-[0.85] font-extrabold tracking-tight text-white">देसी</span>
          <span className="i-rule h-[clamp(56px,9vw,110px)] w-px origin-center bg-white/35" />
          <span className="i-lat font-cond text-[clamp(28px,4.6vw,54px)] leading-none font-semibold tracking-[0.42em] text-marigold">THROTTLE</span>
        </div>
        <p className="i-fade mt-6 font-serif text-[clamp(20px,2.4vw,28px)] text-white/90 italic">Raaste apne, andaaz apna.</p>
        <p className="i-fade mt-3 max-w-[460px] text-[15px] leading-relaxed text-white/60">
          Painted roads across India, {NUMBER_WORDS[BIKES.length] ?? BIKES.length} motorcycles and your road-trip playlist. Pick a scene, pick a bike and ride.
        </p>

        <button
          onClick={() => setStarting(true)}
          disabled={starting}
          className="i-fade group mt-9 flex items-center gap-3 rounded-full bg-white py-3.5 pr-5 pl-7 text-[15px] font-semibold text-ink shadow-[0_18px_40px_-14px_rgba(0,0,0,0.8)] transition duration-200 hover:bg-cream disabled:cursor-wait"
        >
          {starting ? (sceneReady ? 'Starting the engine' : `Loading the road · ${pct}%`) : 'Start the ride'}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white transition duration-200 group-hover:translate-x-0.5">
            {starting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={16} />}
          </span>
        </button>

        <dl className="i-fade mt-12 flex items-center gap-6 text-left sm:gap-10">
          {[
            [SCENES.length, 'Destinations'],
            [BIKES.length, 'Motorcycles'],
            [PLAYLIST.length, 'Road-trip songs'],
          ].map(([n, l], i) => (
            <div key={l} className="flex items-center gap-6 sm:gap-10">
              {i > 0 && <span className="h-8 w-px bg-white/15" />}
              <div>
                <dt className="label">{l}</dt>
                <dd className="mt-1 font-cond text-[28px] leading-none font-semibold text-white tabular-nums">{String(n).padStart(2, '0')}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      <p className="i-fade absolute inset-x-0 bottom-6 text-center text-[12px] tracking-wide text-white/40">Sound on · headphones recommended</p>
    </div>
  )
}
