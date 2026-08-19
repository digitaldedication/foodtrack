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

export default function MacroBars({ totals, goals }: Props) {
  return (
    <div className="macros">
      {MACROS.map((m) => {
        const eaten = Math.round(totals[m.key])
        const goal = goals[m.key]
        const pct = goal > 0 ? Math.min((totals[m.key] / goal) * 100, 100) : 0
        return (
          <div className="macro" key={m.key}>
            <div className="naam">
              <span>{m.label}</span>
            </div>
            <div className="balk" role="progressbar" aria-valuenow={eaten} aria-valuemax={goal} aria-label={m.label}>
              <div className="vulling" style={{ width: `${pct}%`, background: m.color }} />
            </div>
            <div className="waarde">
              {eaten}
              <span> / {goal} g</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
