import { Link, useNavigate } from 'react-router-dom'
import Gauge from '../components/Gauge'
import MacroBars from '../components/MacroBars'
import EntryCard from '../components/EntryCard'
import { dayKey, entriesForDay, useLog, useSettings } from '../lib/store'
import { dayTotals, macroGoals } from '../types'

function vandaagLabel(): string {
  return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function begroeting(): string {
  const uur = new Date().getHours()
  if (uur < 6) return 'Nog wakker?'
  if (uur < 12) return 'Goedemorgen'
  if (uur < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export default function Today() {
  const log = useLog()
  const settings = useSettings()
  const navigate = useNavigate()
  const entries = entriesForDay(log, dayKey(Date.now())).sort((a, b) => b.ts - a.ts)
  const totals = dayTotals(entries)
  const goals = macroGoals(settings)

  // Weekstrip: de afgelopen 7 dagen, vandaag rechts.
  const dagen = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = dayKey(d.getTime())
    const kcal = dayTotals(entriesForDay(log, key)).kcal
    return { key, kcal, letter: d.toLocaleDateString('nl-NL', { weekday: 'short' }).slice(0, 2) }
  })

  return (
    <>
      <header className="app-header">
        <h1>FoodTrack</h1>
        <span className="datum">{vandaagLabel()}</span>
      </header>

      <div className="card held-kaart">
        <div className="begroeting">{begroeting()} 👋</div>
        <Gauge eaten={totals.kcal} goal={settings.kcalGoal} />
        <MacroBars totals={totals} goals={goals} />
      </div>

      <div className="actie-rij">
        <Link to="/log" className="knop" aria-label="Snel loggen met je stem">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z" />
          </svg>
          Loggen
        </Link>
        <Link to="/chat" className="knop chat-knop" aria-label="Chatten over je eten">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-5 4V5a1 1 0 0 1 1-1zm3 5h10v2H7zm0-3h10v2H7z" />
          </svg>
          Chat
        </Link>
      </div>

      <button className="week-strip" onClick={() => navigate('/agenda')} aria-label="Open weekoverzicht en agenda">
        {dagen.map((d, i) => {
          const pct = Math.min((d.kcal / settings.kcalGoal) * 100, 100)
          const over = d.kcal > settings.kcalGoal
          return (
            <span className="week-dag" key={d.key}>
              <span className="week-balk">
                <span
                  className="week-vulling"
                  style={{ height: `${Math.max(pct, d.kcal > 0 ? 8 : 0)}%`, background: over ? 'var(--danger)' : 'var(--groen)' }}
                />
              </span>
              <span className={`week-letter${i === 6 ? ' nu' : ''}`}>{d.letter}</span>
            </span>
          )
        })}
        <span className="week-meer">agenda ›</span>
      </button>

      <h2 className="sectie-kop">Vandaag gegeten</h2>
      {entries.length === 0 ? (
        <div className="card leeg">
          Nog niets gelogd vandaag. Zeg tegen Siri:
          <span className="gesproken-voorbeeld">“Hey Siri, eten loggen”</span>
        </div>
      ) : (
        entries.map((e) => <EntryCard key={e.id} entry={e} />)
      )}
    </>
  )
}
