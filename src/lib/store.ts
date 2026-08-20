import { useSyncExternalStore } from 'react'
import type { Food, LogEntry, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const LOG_KEY = 'foodtrack.log.v1'
const SETTINGS_KEY = 'foodtrack.settings.v1'
const LEARNED_KEY = 'foodtrack.learned.v1'

type Listener = () => void
const listeners = new Set<Listener>()

/** Mutaties worden doorgegeven aan de cloud-sync (indien geconfigureerd). */
export type MutationOp =
  | { kind: 'entry-upsert'; entry: LogEntry }
  | { kind: 'entry-delete'; id: string }
  | { kind: 'settings'; settings: Settings }
  | { kind: 'food-upsert'; food: Food }
  | { kind: 'food-delete'; id: string }

type MutationHandler = (op: MutationOp) => void
let mutationHandler: MutationHandler | null = null
let suspendDepth = 0

export function setMutationHandler(h: MutationHandler | null) {
  mutationHandler = h
}

/** Wijzigingen toepassen zonder ze terug de cloud in te sturen (bij pull). */
export function withSyncSuspended(fn: () => void) {
  suspendDepth++
  try {
    fn()
  } finally {
    suspendDepth--
  }
}

function notifyMutation(op: MutationOp) {
  if (suspendDepth === 0) mutationHandler?.(op)
}

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
  notifyMutation({ kind: 'settings', settings: next })
}

export function addEntry(entry: LogEntry) {
  writeLog([...readLog(), entry])
  notifyMutation({ kind: 'entry-upsert', entry })
}

export function removeEntry(id: string) {
  writeLog(readLog().filter((e) => e.id !== id))
  notifyMutation({ kind: 'entry-delete', id })
}

export function updateEntry(updated: LogEntry) {
  writeLog(readLog().map((e) => (e.id === updated.id ? updated : e)))
  notifyMutation({ kind: 'entry-upsert', entry: updated })
}

/** Volledige log vervangen (na een cloud-merge). */
export function replaceLog(entries: LogEntry[]) {
  writeLog([...entries])
}

export function getEntry(id: string): LogEntry | undefined {
  return readLog().find((e) => e.id === id)
}

/** True when the same text was logged in the last 90 seconds (deep-link double fire). */
export function isDuplicate(rawText: string, now: number): boolean {
  return readLog().some((e) => e.rawText === rawText && now - e.ts < 90_000)
}

/** Products learned at runtime (branded / Open Food Facts matches). */
export function getLearnedFoods(): Food[] {
  try {
    return JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '[]') as Food[]
  } catch {
    return []
  }
}

export function saveLearnedFood(food: Food) {
  const all = getLearnedFoods().filter((f) => f.id !== food.id)
  localStorage.setItem(LEARNED_KEY, JSON.stringify([...all, food]))
  emit()
  notifyMutation({ kind: 'food-upsert', food })
}

export function deleteLearnedFood(foodId: string) {
  localStorage.setItem(LEARNED_KEY, JSON.stringify(getLearnedFoods().filter((f) => f.id !== foodId)))
  emit()
  notifyMutation({ kind: 'food-delete', id: foodId })
}

export function useLearnedFoods(): Food[] {
  return useSyncExternalStore(subscribe, getLearnedFoodsCached)
}

let learnedCache: { raw: string | null; foods: Food[] } = { raw: null, foods: [] }
function getLearnedFoodsCached(): Food[] {
  const raw = localStorage.getItem(LEARNED_KEY)
  if (raw !== learnedCache.raw) {
    learnedCache = { raw, foods: raw ? (JSON.parse(raw) as Food[]) : [] }
  }
  return learnedCache.foods
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
