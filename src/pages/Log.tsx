import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EntryCard from '../components/EntryCard'
import { healthShortcutUrl, isIos } from '../lib/health'
import type { FoodIndex } from '../lib/parser'
import { parsePhrase } from '../lib/parser'
import { addEntry, getEntry, isDuplicate, newId, useSettings } from '../lib/store'
import type { LogEntry } from '../types'

interface Props {
  index: FoodIndex | null
}

export default function LogPage({ index }: Props) {
  const [params, setParams] = useSearchParams()
  const settings = useSettings()
  const [text, setText] = useState('')
  const [entryId, setEntryId] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const handledDeeplink = useRef(false)

  const logText = (raw: string): void => {
    if (!index) return
    const trimmed = raw.trim()
    if (!trimmed) return
    const now = Date.now()
    if (isDuplicate(trimmed, now)) {
      setDuplicate(true)
      return
    }
    const items = parsePhrase(index, trimmed)
    if (items.length === 0) return
    const entry: LogEntry = { id: newId(), ts: now, rawText: trimmed, items }
    addEntry(entry)
    setEntryId(entry.id)
    setText('')
    if (settings.healthExport && settings.healthAutoOpen && isIos()) {
      const url = healthShortcutUrl(entry, settings)
      setTimeout(() => {
        window.location.href = url
      }, 700)
    }
  }

  // Deep link from the Siri shortcut: #/log?text=twee%20bitterkoekjes
  useEffect(() => {
    const deeplinkText = params.get('text')
    if (!deeplinkText || !index || handledDeeplink.current) return
    handledDeeplink.current = true
    setParams({}, { replace: true })
    logText(deeplinkText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, index])

  const entry = entryId ? getEntry(entryId) : undefined

  if (entry) {
    return (
      <>
        <header className="app-header">
          <h1>Gelogd ✓</h1>
        </header>
        <EntryCard entry={entry} />
        {settings.healthExport && isIos() && (
          <a className="knop secundair" href={healthShortcutUrl(entry, settings)} style={{ marginBottom: 10 }}>
            Zet in Apple Health
          </a>
        )}
        <Link to="/" className="knop">
          Naar vandaag
        </Link>
        <button className="knop secundair" style={{ marginTop: 10 }} onClick={() => setEntryId(null)}>
          Nog iets loggen
        </button>
      </>
    )
  }

  return (
    <>
      <header className="app-header">
        <h1>Eten loggen</h1>
      </header>

      {duplicate && (
        <div className="card" role="status">
          Dit stond net al in je log — niet dubbel geteld.{' '}
          <Link to="/">Bekijk vandaag</Link>
        </div>
      )}

      <div className="card">
        <div className="veld">
          <label htmlFor="voer-in">Wat heb je gegeten of gedronken?</label>
          <input
            id="voer-in"
            type="text"
            placeholder="twee bitterkoekjes en een boterham met pindakaas"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && logText(text)}
            autoComplete="off"
          />
        </div>
        <button className="knop" onClick={() => logText(text)} disabled={!index}>
          {index ? 'Log het' : 'Database laden…'}
        </button>
      </div>

      <div className="card leeg">
        Sneller? Stel de Siri-shortcut in via <Link to="/uitleg">Uitleg</Link> en zeg voortaan
        <span className="gesproken-voorbeeld">“Hey Siri, eten loggen”</span>
      </div>
    </>
  )
}
