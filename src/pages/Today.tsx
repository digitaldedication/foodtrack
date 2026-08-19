import { Link } from 'react-router-dom'
import Gauge from '../components/Gauge'
import MacroBars from '../components/MacroBars'
import EntryCard from '../components/EntryCard'
import { dayKey, entriesForDay, useLog, useSettings } from '../lib/store'
import { dayTotals, macroGoals } from '../types'

function vandaagLabel(): string {
  return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function Today() {
  const log = useLog()
  const settings = useSettings()
  const entries = entriesForDay(log, dayKey(Date.now())).sort((a, b) => b.ts - a.ts)
  const totals = dayTotals(entries)
  const goals = macroGoals(settings)

  return (
    <>
      <header className="app-header">
        <h1>FoodTrack</h1>
        <span className="datum">{vandaagLabel()}</span>
      </header>

      <div className="card">
        <Gauge eaten={totals.kcal} goal={settings.kcalGoal} />
        <MacroBars totals={totals} goals={goals} />
      </div>

      <Link to="/log" className="knop" aria-label="Eten loggen">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z" />
        </svg>
        Eten loggen
      </Link>

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
