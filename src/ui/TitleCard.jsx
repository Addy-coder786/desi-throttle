import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useStore } from '../store'
import { SCENE_MAP, DEFAULT_SCENE } from '../data/scenes'
import { BIKE_MAP } from '../data/bikes'

// Brief centred title when the scene or bike changes (not on first load).
export default function TitleCard() {
  const sceneId = useStore((s) => s.sceneId)
  const bikeId = useStore((s) => s.bikeId)
  const phase = useStore((s) => s.phase)
  const [card, setCard] = useState(null)
  const ref = useRef()
  const first = useRef(true)

  useEffect(() => {
    if (phase !== 'ride') return
    if (first.current) {
      first.current = false
      return
    }
    const sc = SCENE_MAP[sceneId] ?? DEFAULT_SCENE
    setCard({ key: 's' + sceneId, big: sc.hindi, small: `${sc.name} · ${sc.place}` })
  }, [sceneId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'ride' || first.current) return
    const b = BIKE_MAP[bikeId]
    setCard({ key: 'b' + bikeId, big: b.hindi, small: `${b.maker} ${b.name}` })
  }, [bikeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'ride') first.current = false
  }, [phase])

  useEffect(() => {
    if (!card || !ref.current) return
    const tl = gsap.timeline({ onComplete: () => setCard(null) })
    tl.fromTo(ref.current, { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out' })
      .to(ref.current, { opacity: 0, y: -8, filter: 'blur(6px)', duration: 1, ease: 'power2.in' }, '+=1.6')
    return () => tl.kill()
  }, [card])

  if (!card) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[24%] z-10 flex justify-center" aria-live="polite">
      <div ref={ref} key={card.key} className="text-center">
        <p className="font-deva text-[clamp(56px,9vw,120px)] leading-none font-extrabold tshadow">{card.big}</p>
        <p className="label mt-3 !text-[13px] text-cream/85 tshadow">{card.small}</p>
      </div>
    </div>
  )
}
