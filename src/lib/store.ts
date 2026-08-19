import { useSyncExternalStore } from 'react'
import type { LogEntry, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const LOG_KEY = 'foodtrack.log.v1'
const SETTINGS_KEY = 'foodtrack.settings.v1'

type Listener = () => void
const listeners = new Set<Listener>()

let logCache: LogEntry[] | null = null
let settingsCache: Settings | null = null

function emit() {
  for (const l of listeners) l()
}

function readLog(): LogEntry[] {
  if (logCache) return logCache
  try {
    logCache = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as LogEntry[]
  } catch {
    logCache = []
  }
  return logCache
}

function writeLog(entries: LogEntry[]) {
  logCache = entries
  localStorage.setItem(LOG_KEY, JSON.stringify(entries))
  emit()
}

export function getSettings(): Settings {
  if (settingsCache) return settingsCache
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')
    settingsCache = raw ? { ...DEFAULT_SETTINGS, ...raw } : DEFAULT_SETTINGS
  } catch {
    settingsCache = DEFAULT_SETTINGS
  }
  return settingsCache ?? DEFAULT_SETTINGS
}

export function saveSettings(next: Settings) {
  settingsCache = next
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  emit()
}

export function addEntry(entry: LogEntry) {
  writeLog([...readLog(), entry])
}

export function removeEntry(id: string) {
  writeLog(readLog().filter((e) => e.id !== id))
}

export function updateEntry(updated: LogEntry) {
  writeLog(readLog().map((e) => (e.id === updated.id ? updated : e)))
}

export function getEntry(id: string): LogEntry | undefined {
  return readLog().find((e) => e.id === id)
}

/** True when the same text was logged in the last 90 seconds (deep-link double fire). */
export function isDuplicate(rawText: string, now: number): boolean {
  return readLog().some((e) => e.rawText === rawText && now - e.ts < 90_000)
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function entriesForDay(entries: LogEntry[], key: string): LogEntry[] {
  return entries.filter((e) => dayKey(e.ts) === key)
}

function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useLog(): LogEntry[] {
  return useSyncExternalStore(subscribe, readLog)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
