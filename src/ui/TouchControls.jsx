import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { ride } from '../stage/ride'
import { sound } from '../audio/sound'

// On-screen riding controls for touch screens (the keyboard's W / S / A / D).
// Each button works while held; the pointer is captured so sliding a finger
// off the button still releases it.
function HoldButton({ flag, label, className = '', onPress, children }) {
  const [held, setHeld] = useState(false)
  const release = () => {
    ride[flag] = false
    setHeld(false)
  }
  return (
    <button
      data-drive
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        ride[flag] = true
        setHeld(true)
        onPress?.()
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      className={`grid touch-none place-items-center rounded-full select-none [-webkit-touch-callout:none] transition duration-100 ${held ? 'scale-95 bg-white/30' : 'surface'} ${className}`}
    >
      {children}
    </button>
  )
}

export default function TouchControls() {
  const paused = useStore((s) => s.paused)
  const panel = useStore((s) => s.panel)
  if (paused || panel) return null
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 hidden items-end justify-between touch:flex sm:inset-x-7">
      <div className="pointer-events-auto flex gap-3">
        <HoldButton flag="leftHeld" label="Lean left" className="h-14 w-14">
          <ChevronLeft size={26} strokeWidth={2.4} />
        </HoldButton>
        <HoldButton flag="rightHeld" label="Lean right" className="h-14 w-14">
          <ChevronRight size={26} strokeWidth={2.4} />
        </HoldButton>
      </div>
      <div className="pointer-events-auto flex items-end gap-3">
        <HoldButton flag="brakeHeld" label="Brake" className="h-14 w-[72px] font-cond text-[15px] font-semibold tracking-[0.12em]">
          BRAKE
        </HoldButton>
        <HoldButton flag="throttleHeld" label="Throttle" className="h-[68px] w-[96px] font-cond text-[16px] font-semibold tracking-[0.12em] text-marigold" onPress={() => ride.speed < 8 && sound.rev()}>
          THROTTLE
        </HoldButton>
      </div>
    </div>
  )
}
