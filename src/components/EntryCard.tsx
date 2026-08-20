import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { LogEntry } from '../types'
import { entryTotals } from '../types'
import { removeEntry } from '../lib/store'
import { newFoodIssueUrl } from '../lib/github'

interface Props {
  entry: LogEntry
  showDelete?: boolean
}

function tijd(ts: number): string {
  return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export default function EntryCard({ entry, showDelete = true }: Props) {
  const [open, setOpen] = useState(false)
  const totals = entryTotals(entry)
  const unresolved = entry.items.filter((i) => !i.resolved)

  return (
    <div className={`entry${open ? ' open' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        style={{ cursor: 'pointer' }}
        aria-expanded={open}
      >
        <div className="gesproken">{entry.rawText}</div>
        <div className="meta">
          <span>{tijd(entry.ts)}</span>
          <span className="kcal">{Math.round(totals.kcal)} kcal</span>
        </div>
      </div>

      {unresolved.map((i) => (
        <div className="onbekend" key={i.rawText}>
          Niet herkend: “{i.rawText}” —{' '}
          <Link to={`/producten?naam=${encodeURIComponent(i.rawText)}`}>zelf toevoegen</Link>
          {' of '}
          <a href={newFoodIssueUrl(i.rawText)} target="_blank" rel="noreferrer">
            laat Claude het opzoeken
          </a>
        </div>
      ))}

      <div className="items">
        {entry.items.filter((i) => i.resolved).map((i, idx) => (
          <div className="item-rij" key={idx}>
            <div>
              {i.name}
              <div className="detail">
                {i.portionName ? `${i.qty}× ${i.portionName} · ` : ''}
                {i.grams} g · eiwit {i.p} · koolh {i.c} · vet {i.f}
              </div>
            </div>
            <div className="kcal">{i.kcal} kcal</div>
          </div>
        ))}
        {showDelete && (
          <button
            className="knop gevaar klein"
            style={{ marginTop: 8 }}
            onClick={() => {
              if (confirm('Deze logging verwijderen?')) removeEntry(entry.id)
            }}
          >
            Verwijderen
          </button>
        )}
      </div>
    </div>
  )
}
