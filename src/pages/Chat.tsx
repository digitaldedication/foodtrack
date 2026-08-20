import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { chatWithClaude } from '../lib/ai'
import { handleChatMessage } from '../lib/chat'
import { healthShortcutUrl, isIos } from '../lib/health'
import { useLog, useSettings } from '../lib/store'
import type { LogEntry } from '../types'

interface Msg {
  who: 'ik' | 'app'
  text: string
  entry?: LogEntry
  unresolved?: string[]
}

// Berichten blijven staan zolang de app open is (module-level, geen opslag).
const sessionMessages: Msg[] = []

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}

function getSpeech(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

export default function Chat() {
  const [params, setParams] = useSearchParams()
  const settings = useSettings()
  const log = useLog()
  const [messages, setMessages] = useState<Msg[]>(() => [...sessionMessages])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const handledDeeplink = useRef(false)
  const logRef = useRef(log)
  logRef.current = log

  const push = (msg: Msg) => {
    sessionMessages.push(msg)
    setMessages([...sessionMessages])
  }

  const send = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || busy) return
    const history = sessionMessages
      .filter((m) => !m.entry || m.who === 'ik')
      .slice(-10)
      .map((m) => ({ role: m.who === 'ik' ? ('user' as const) : ('assistant' as const), content: m.text }))
    setText('')
    push({ who: 'ik', text: trimmed })
    setBusy(true)
    try {
      // Met cloud + Claude actief gaat het gesprek naar de Edge Function;
      // anders (of bij een fout) handelt de lokale parser het af.
      const ai = await chatWithClaude(history, trimmed, logRef.current)
      if (ai) {
        push({ who: 'app', text: ai.reply, entry: ai.entry })
      } else {
        const result = await handleChatMessage(trimmed, logRef.current)
        push({ who: 'app', text: result.reply, entry: result.entry, unresolved: result.unresolvedNames })
      }
    } finally {
      setBusy(false)
    }
  }

  // Deep link vanuit een Shortcut: #/chat?text=...
  useEffect(() => {
    const deeplinkText = params.get('text')
    if (!deeplinkText || handledDeeplink.current) return
    handledDeeplink.current = true
    setParams({}, { replace: true })
    void send(deeplinkText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy])

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const SR = getSpeech()
    if (!SR) return
    const rec = new SR()
    rec.lang = 'nl-NL'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' ')
      void send(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  const speechAvailable = getSpeech() !== null

  return (
    <>
      <header className="app-header">
        <h1>Chat</h1>
      </header>

      <div className="chat-berichten">
        {messages.length === 0 && (
          <div className="card leeg">
            Vertel wat je gegeten hebt — met tijd erbij mag ook.
            <span className="gesproken-voorbeeld">“gisteren om 13:00 een muscle meat gnocchi maaltijd”</span>
            <div style={{ marginTop: 10, fontSize: 13 }}>
              Of vraag: “hoeveel kcal heb ik nog?” · “wat heb ik vandaag gegeten?” · “verwijder de laatste”
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-rij ${m.who}`}>
            <div className={`chat-bubbel ${m.who}`}>
              {m.text.split('\n').map((line, j) => (
                <div key={j}>{line}</div>
              ))}
              {m.entry && settings.healthExport && isIos() && (
                <a className="knop klein secundair" style={{ marginTop: 8 }} href={healthShortcutUrl(m.entry, settings)}>
                  Zet in Apple Health
                </a>
              )}
              {m.unresolved && m.unresolved.length > 0 && (
                <Link className="knop klein secundair" style={{ marginTop: 8 }} to={`/producten?naam=${encodeURIComponent(m.unresolved[0])}`}>
                  Toevoegen aan Mijn producten
                </Link>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="chat-rij app"><div className="chat-bubbel app">…</div></div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-invoer">
        <input
          type="text"
          placeholder={listening ? 'Luisteren…' : 'Typ of praat…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(text)}
          aria-label="Chatbericht"
          autoComplete="off"
        />
        {speechAvailable && (
          <button className={`chat-mic${listening ? ' actief' : ''}`} onClick={toggleMic} aria-label="Spreek je bericht in">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a4 4 0 0 1 4 4v5a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z" />
            </svg>
          </button>
        )}
        <button className="chat-verstuur" onClick={() => send(text)} disabled={busy || !text.trim()} aria-label="Verstuur">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 20v-6l8-2-8-2V4l19 8z" />
          </svg>
        </button>
      </div>
    </>
  )
}
