import { useEffect } from 'react'
import Stage from './stage/Stage'
import Interface from './ui/Interface'
import Intro from './ui/Intro'
import { useStore } from './store'
import { startRide } from './actions'

// development only: ?shot hides the interface, ?dev=1 skips the intro
// (optionally with &bike= &scene= &weather= &time= &head=1)
const params = import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams()
const SHOT = params.has('shot')

export default function App() {
  const phase = useStore((s) => s.phase)

  useEffect(() => {
    if (!params.get('dev')) return
    const pick = { bike: 'bikeId', scene: 'sceneId', weather: 'weather', time: 'time' }
    const state = { phase: 'ride' }
    for (const [q, key] of Object.entries(pick)) if (params.get(q)) state[key] = params.get(q)
    if (params.get('head')) state.headlight = true
    useStore.setState(state)
    startRide()
  }, [])

  return (
    <>
      <Stage />
      {!SHOT && <Interface />}
      {phase === 'intro' && <Intro />}
    </>
  )
}
