import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import EntryCard from '../components/EntryCard'
import MacroBars from '../components/MacroBars'
import { dayKey, entriesForDay, useLog, useSettings } from '../lib/store'
import { dayTotals, macroGoals } from '../types'

function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function shiftDays(key: string, days: number): string {
  const d = keyToDate(key)
  d.setDate(d.getDate() + days)
  return dayKey(d.getTime())
}

/** Maandag van de week waarin deze dag valt. */
function weekStart(key: string): string {
  const d = keyToDate(key)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return dayKey(d.getTime())
}

export default function Agenda() {
  const log = useLog()
  const settings = useSettings()
  const [params, setParams] = useSearchParams()
  const vandaag = dayKey(Date.now())
  const dag = params.get('dag') ?? vandaag
  const kies = (key: string) => setParams({ dag: key }, { replace: true })

  const start = weekStart(dag)
  const week = Array.from({ length: 7 }, (_, i) => shiftDays(start, i))
  const weekTotalen = week.map((k) => dayTotals(entriesForDay(log, k)))
  const weekKcal = Math.round(weekTotalen.reduce((s, t) => s + t.kcal, 0))
  const dagenMetData = weekTotalen.filter((t) => t.kcal > 0).length
  const gemiddeld = dagenMetData > 0 ? Math.round(weekKcal / dagenMetData) : 0

  const maand = useMemo(() => {
    const d = keyToDate(dag)
    const eerste = new Date(d.getFullYear(), d.getMonth(), 1)
    const cellen: Array<string | null> = []
    for (let i = 0; i < (eerste.getDay() + 6) % 7; i++) cellen.push(null)
    const laatste = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= laatste; i++) {
      cellen.push(dayKey(new Date(d.getFullYear(), d.getMonth(), i).getTime()))
    }
    return { label: d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }), cellen }
  }, [dag])

  const dagEntries = entriesForDay(log, dag).sort((a, b) => b.ts - a.ts)
  const totals = dayTotals(dagEntries)
  const goals = macroGoals(settings)
  const dagLabel = keyToDate(dag).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  const weekLabel = `${keyToDate(start).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ${keyToDate(shiftDays(start, 6)).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`

  return (
    <>
      <header className="app-header">
        <h1>Agenda</h1>
      </header>

      <div className="card">
        <div className="agenda-nav">
          <button onClick={() => kies(shiftDays(dag, -7))} aria-label="Vorige week">‹</button>
          <span>{weekLabel}</span>
          <button onClick={() => kies(shiftDays(dag, 7))} aria-label="Volgende week">›</button>
        </div>
        <div className="week-grafiek">
          {week.map((k, i) => {
            const kcal = weekTotalen[i].kcal
            const pct = Math.min((kcal / settings.kcalGoal) * 100, 100)
            const over = kcal > settings.kcalGoal
            return (
              <button
                key={k}
                className={`week-kolom${k === dag ? ' gekozen' : ''}`}
                onClick={() => kies(k)}
                aria-label={`${k}: ${Math.round(kcal)} kcal`}
              >
                <span className="kcal-label">{kcal > 0 ? Math.round(kcal) : ''}</span>
                <span className="kolom-balk">
                  <span
                    className="kolom-vulling"
                    style={{ height: `${Math.max(pct, kcal > 0 ? 6 : 0)}%`, background: over ? 'var(--danger)' : 'var(--groen)' }}
                  />
                </span>
                <span className={`week-letter${k === vandaag ? ' nu' : ''}`}>
                  {keyToDate(k).toLocaleDateString('nl-NL', { weekday: 'short' }).slice(0, 2)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="week-samenvatting">
          Deze week {weekKcal} kcal{dagenMetData > 0 ? ` · gemiddeld ${gemiddeld} per gelogde dag` : ''} · doel {settings.kcalGoal}/dag
        </div>
      </div>

      <div className="card">
        <div className="agenda-nav">
          <button onClick={() => kies(shiftDays(dag, -28))} aria-label="Vorige maand">‹</button>
          <span>{maand.label}</span>
          <button onClick={() => kies(shiftDays(dag, 28))} aria-label="Volgende maand">›</button>
        </div>
        <div className="maand-koppen">
          {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>
        <div className="maand-grid">
          {maand.cellen.map((k, i) =>
            k === null ? (
              <span key={`leeg-${i}`} />
            ) : (
              <button
                key={k}
                className={`maand-dag${k === dag ? ' gekozen' : ''}${k === vandaag ? ' nu' : ''}`}
                onClick={() => kies(k)}
              >
                {Number(k.slice(-2))}
                <span className={`stip${entriesForDay(log, k).length > 0 ? ' vol' : ''}`} />
              </button>
            )
          )}
        </div>
      </div>

      <h2 className="sectie-kop">{dagLabel}</h2>
      <div className="card">
        <div className="dag-totaal">
          <span className="groot">{Math.round(totals.kcal)}</span> van {settings.kcalGoal} kcal
        </div>
        <MacroBars totals={totals} goals={goals} />
      </div>
      {dagEntries.length === 0 ? (
        <div className="card leeg">Niets gelogd op deze dag.</div>
      ) : (
        dagEntries.map((e) => <EntryCard key={e.id} entry={e} />)
      )}
    </>
  )
}
