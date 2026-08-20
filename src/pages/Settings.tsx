import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCloudConfig, pendingCount, saveCloudConfig, signInWithEmail, signOut, useCloudStatus } from '../lib/cloud'
import { saveSettings, useSettings } from '../lib/store'
import { macroGoals } from '../types'

function CloudSection() {
  const status = useCloudStatus()
  const stored = getCloudConfig()
  const [url, setUrl] = useState(stored?.url ?? '')
  const [anonKey, setAnonKey] = useState(stored?.anonKey ?? '')
  const [email, setEmail] = useState('')
  const [melding, setMelding] = useState<string | null>(null)

  const opslaan = () => {
    saveCloudConfig(url.trim() && anonKey.trim() ? { url: url.trim(), anonKey: anonKey.trim(), aiEnabled: stored?.aiEnabled ?? true } : null)
    setMelding(url.trim() ? 'Opgeslagen. Log nu in met je e-mailadres.' : 'Cloud uitgeschakeld.')
  }

  const login = async () => {
    const fout = await signInWithEmail(email.trim())
    setMelding(fout ?? `Inloglink verstuurd naar ${email.trim()} — open die op dit apparaat.`)
  }

  const statusTekst: Record<typeof status.state, string> = {
    uit: 'Niet geconfigureerd — alles blijft lokaal op dit apparaat.',
    'niet-ingelogd': 'Geconfigureerd, nog niet ingelogd.',
    synct: 'Synchroniseren…',
    ok: `Gesynchroniseerd${pendingCount() > 0 ? ` (${pendingCount()} wijzigingen in wachtrij)` : ''}.`,
    fout: `Sync-fout — wijzigingen staan veilig in de wachtrij (${pendingCount()}).`
  }

  return (
    <>
      <h2 className="sectie-kop">Cloud &amp; AI (Supabase)</h2>
      <div className="card">
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 12 }}>
          {statusTekst[status.state]}
          {status.user ? ` Ingelogd als ${status.user.email}.` : ''}
        </p>
        {melding && (
          <p role="status" style={{ fontSize: 14, marginBottom: 12 }}>{melding}</p>
        )}
        <div className="veld">
          <label htmlFor="supa-url">Supabase-URL</label>
          <input id="supa-url" type="text" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
        </div>
        <div className="veld">
          <label htmlFor="supa-key">Supabase anon key (publiek)</label>
          <input id="supa-key" type="text" placeholder="eyJhbGciOi…" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} autoComplete="off" />
        </div>
        <button className="knop secundair" onClick={opslaan} style={{ marginBottom: 14 }}>
          Cloud-instellingen opslaan
        </button>

        {status.configured && !status.user && (
          <>
            <div className="veld">
              <label htmlFor="supa-email">E-mailadres (magic link)</label>
              <input id="supa-email" type="text" inputMode="email" placeholder="jij@voorbeeld.nl" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <button className="knop" onClick={login} disabled={!email.includes('@')}>
              Stuur inloglink
            </button>
          </>
        )}

        {status.user && (
          <>
            <div className="schakel-rij">
              <div className="tekst">
                <div className="titel">Claude AI in de chat</div>
                <div className="uitleg">Laat Claude (via jouw Edge Function) berichten begrijpen en beantwoorden. Zonder dit werkt de chat lokaal.</div>
              </div>
              <input
                type="checkbox"
                checked={stored?.aiEnabled ?? false}
                onChange={(e) => stored && saveCloudConfig({ ...stored, aiEnabled: e.target.checked })}
                aria-label="Claude AI in de chat"
              />
            </div>
            <button className="knop gevaar klein" onClick={() => void signOut()} style={{ marginTop: 10 }}>
              Uitloggen
            </button>
          </>
        )}
      </div>
    </>
  )
}

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

      <CloudSection />

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
