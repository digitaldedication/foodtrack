import { Link } from 'react-router-dom'
import { saveSettings, useSettings } from '../lib/store'
import { macroGoals } from '../types'

const MACRO_LABELS = [
  { key: 'p' as const, label: 'Eiwit' },
  { key: 'c' as const, label: 'Koolhydraten' },
  { key: 'f' as const, label: 'Vet' }
]

export default function SettingsPage() {
  const settings = useSettings()
  const goals = macroGoals(settings)
  const totalPct = settings.macroPct.p + settings.macroPct.c + settings.macroPct.f

  const setPct = (key: 'p' | 'c' | 'f', value: number) => {
    saveSettings({ ...settings, macroPct: { ...settings.macroPct, [key]: value } })
  }

  return (
    <>
      <header className="app-header">
        <h1>Doelen</h1>
      </header>

      <div className="card">
        <div className="veld">
          <label htmlFor="kcal-doel">Caloriedoel per dag</label>
          <input
            id="kcal-doel"
            type="number"
            inputMode="numeric"
            min={800}
            max={6000}
            step={50}
            value={settings.kcalGoal}
            onChange={(e) => saveSettings({ ...settings, kcalGoal: Number(e.target.value) || 0 })}
          />
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Macroverdeling</label>
        <div style={{ marginTop: 8 }}>
          {MACRO_LABELS.map((m) => (
            <div className="slider-rij" key={m.key}>
              <span className="naam">{m.label}</span>
              <input
                type="range"
                min={5}
                max={70}
                value={settings.macroPct[m.key]}
                onChange={(e) => setPct(m.key, Number(e.target.value))}
                aria-label={`${m.label} percentage`}
              />
              <span className="pct">
                {settings.macroPct[m.key]}% · {goals[m.key]} g
              </span>
            </div>
          ))}
        </div>
        {totalPct !== 100 && (
          <div className="onbekend" role="alert">
            Samen {totalPct}% — zet de verdeling op precies 100% voor kloppende gramdoelen.
          </div>
        )}
      </div>

      <h2 className="sectie-kop">Producten</h2>
      <div className="card">
        <div className="schakel-rij">
          <div className="tekst">
            <div className="titel">Mijn producten &amp; maaltijden</div>
            <div className="uitleg">Voeg eigen maaltijden toe (bijv. “Muscle Meat gnocchi”) met kcal en macro’s — de app onthoudt ze.</div>
          </div>
          <Link to="/producten" className="knop klein secundair">
            Beheren
          </Link>
        </div>
      </div>

      <h2 className="sectie-kop">Apple Health</h2>
      <div className="card">
        <div className="schakel-rij">
          <div className="tekst">
            <div className="titel">Doorzetten naar Health</div>
            <div className="uitleg">Toon na het loggen een knop die de waarden via de Shortcut in Apple Health zet.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.healthExport}
            onChange={(e) => saveSettings({ ...settings, healthExport: e.target.checked })}
            aria-label="Doorzetten naar Health"
          />
        </div>
        <div className="schakel-rij">
          <div className="tekst">
            <div className="titel">Automatisch openen</div>
            <div className="uitleg">Open de Health-shortcut direct na elke logging, zonder extra tik.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.healthAutoOpen}
            onChange={(e) => saveSettings({ ...settings, healthAutoOpen: e.target.checked })}
            disabled={!settings.healthExport}
            aria-label="Automatisch openen"
          />
        </div>
        <div className="veld" style={{ marginTop: 12 }}>
          <label htmlFor="shortcut-naam">Naam van je Health-shortcut</label>
          <input
            id="shortcut-naam"
            type="text"
            value={settings.healthShortcutName}
            onChange={(e) => saveSettings({ ...settings, healthShortcutName: e.target.value })}
          />
        </div>
      </div>
    </>
  )
}
