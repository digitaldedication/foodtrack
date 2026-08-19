import { useState } from 'react'
import EntryCard from '../components/EntryCard'
import { dayKey, useLog, useSettings } from '../lib/store'
import { dayTotals } from '../types'

function dagLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function History() {
  const log = useLog()
  const settings = useSettings()
  const [openDag, setOpenDag] = useState<string | null>(null)

  const perDag = new Map<string, typeof log>()
  for (const e of log) {
    const k = dayKey(e.ts)
    perDag.set(k, [...(perDag.get(k) ?? []), e])
  }
  const dagen = [...perDag.keys()].sort().reverse()

  return (
    <>
      <header className="app-header">
        <h1>Historie</h1>
      </header>

      {dagen.length === 0 && <div className="card leeg">Nog geen geschiedenis — log je eerste maaltijd!</div>}

      <div className="card" style={{ padding: '6px 16px' }}>
        {dagen.map((k) => {
          const entries = perDag.get(k)!
          const totals = dayTotals(entries)
          const pct = Math.min((totals.kcal / settings.kcalGoal) * 100, 100)
          const isOpen = openDag === k
          return (
            <div key={k}>
              <a
                href="#"
                className="hist-dag"
                onClick={(e) => {
                  e.preventDefault()
                  setOpenDag(isOpen ? null : k)
                }}
                aria-expanded={isOpen}
              >
                <span style={{ width: 90 }}>{dagLabel(k)}</span>
                <span className="hist-balkje">
                  <span className="vulling" style={{ width: `${pct}%`, display: 'block' }} />
                </span>
                <span className="kcal">{Math.round(totals.kcal)}</span>
              </a>
              {isOpen && (
                <div style={{ padding: '10px 0' }}>
                  {entries
                    .sort((a, b) => b.ts - a.ts)
                    .map((e) => (
                      <EntryCard key={e.id} entry={e} />
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
