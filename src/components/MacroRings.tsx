import { useEffect, useState } from 'react'
import type { Macro } from '../types'

interface Props {
  totals: Macro
  goals: { p: number; c: number; f: number }
}

const MACROS = [
  { key: 'p' as const, label: 'Eiwit', color: 'var(--eiwit)' },
  { key: 'c' as const, label: 'Koolh.', color: 'var(--koolh)' },
  { key: 'f' as const, label: 'Vet', color: 'var(--vet)' }
]

/** Drie mini-ringen voor de macroverdeling, in dezelfde taal als de grote ring. */
export default function MacroRings({ totals, goals }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const r = 24
  const size = 60
  const c = size / 2
  const circumference = 2 * Math.PI * r

  return (
    <div className="macro-ringen">
      {MACROS.map((m, i) => {
        const eaten = Math.round(totals[m.key])
        const goal = goals[m.key]
        const frac = goal > 0 ? Math.min(totals[m.key] / goal, 1) : 0
        const offset = circumference * (1 - (mounted ? frac : 0))
        return (
          <div className="macro-ring" key={m.key} style={{ animationDelay: `${i * 70}ms` }}>
            <div className="macro-ring-figuur">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${m.label}: ${eaten} van ${goal} gram`}>
                <circle cx={c} cy={c} r={r} fill="none" stroke="var(--groen-zacht)" strokeWidth="6" />
                <circle
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${c} ${c})`}
                  style={{ transition: `stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${i * 90}ms` }}
                />
              </svg>
              <span className="macro-ring-waarde">{eaten}</span>
            </div>
            <span className="macro-ring-label">{m.label}</span>
            <span className="macro-ring-doel">/ {goal} g</span>
          </div>
        )
      })}
    </div>
  )
}
