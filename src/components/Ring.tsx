import { useEffect, useRef, useState } from 'react'

interface Props {
  eaten: number
  goal: number
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Telt zichtbaar op naar de doelwaarde (respecteert reduced motion). */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target)
  const prev = useRef(target)
  useEffect(() => {
    if (reducedMotion() || prev.current === target) {
      prev.current = target
      setShown(target)
      return
    }
    const from = prev.current
    prev.current = target
    const start = performance.now()
    const duration = 700
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (target - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

/**
 * De centrale caloriering: volle cirkel met gradient die bij het laden
 * naar de dagstand veegt, met een optellend restgetal in het midden.
 */
export default function Ring({ eaten, goal }: Props) {
  const remaining = Math.round(goal - eaten)
  const over = remaining < 0
  const frac = goal > 0 ? Math.min(eaten / goal, 1) : 0
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const size = 210
  const r = 88
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - (mounted || reducedMotion() ? frac : 0))
  const getal = useCountUp(Math.abs(remaining))

  return (
    <div className="ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(eaten)} van ${goal} kcal`}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--groen)" />
            <stop offset="100%" stopColor="var(--groen-fel)" />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--groen-zacht)" strokeWidth="15" />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={over ? 'var(--danger)' : 'url(#ringGrad)'}
          strokeWidth="15"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="ring-centrum">
        <div className={`ring-getal${over ? ' over' : ''}`}>{getal}</div>
        <div className="ring-label">{over ? 'over je doel' : 'kcal te gaan'}</div>
      </div>
      <div className="ring-sub">
        <span>{Math.round(eaten)} gegeten</span>
        <span className="punt">·</span>
        <span>doel {goal}</span>
      </div>
    </div>
  )
}
