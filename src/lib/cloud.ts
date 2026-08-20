import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import type { Food, LogEntry } from '../types'
import {
  getLearnedFoods, getSettings, replaceLog, saveSettings,
  setMutationHandler, useLog, withSyncSuspended, type MutationOp
} from './store'
import { registerLearnedFood } from './db'

const CONFIG_KEY = 'foodtrack.cloud.v1'
const QUEUE_KEY = 'foodtrack.cloudqueue.v1'

export interface CloudConfig {
  url: string
  anonKey: string
  aiEnabled: boolean
}

let client: SupabaseClient | null = null
let currentUser: User | null = null
export type SyncState = 'uit' | 'niet-ingelogd' | 'synct' | 'ok' | 'fout'
let syncState: SyncState = 'uit'
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function getCloudConfig(): CloudConfig | null {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function saveCloudConfig(config: CloudConfig | null) {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  else localStorage.removeItem(CONFIG_KEY)
  client = null
  currentUser = null
  void initCloud()
}

export function getClient(): SupabaseClient | null {
  if (client) return client
  const config = getCloudConfig()
  if (!config?.url || !config?.anonKey) return null
  client = createClient(config.url, config.anonKey)
  return client
}

// ---- wachtrij: elke mutatie komt hier in en wordt (opnieuw) verstuurd ----

function readQueue(): MutationOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(q: MutationOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

function enqueue(op: MutationOp) {
  writeQueue([...readQueue(), op])
  void flushQueue()
}

let flushing = false

async function pushOp(supa: SupabaseClient, op: MutationOp): Promise<void> {
  const now = new Date().toISOString()
  if (op.kind === 'entry-upsert') {
    const e = op.entry
    const { error } = await supa.from('entries').upsert({
      id: e.id, ts: new Date(e.ts).toISOString(), raw_text: e.rawText, items: e.items, updated_at: now
    })
    if (error) throw error
  } else if (op.kind === 'entry-delete') {
    const { error } = await supa.from('entries').delete().eq('id', op.id)
    if (error) throw error
  } else if (op.kind === 'settings') {
    const { error } = await supa.from('settings').upsert({ data: op.settings, updated_at: now })
    if (error) throw error
  } else if (op.kind === 'food-upsert') {
    const { error } = await supa.from('learned_foods').upsert({ id: op.food.id, food: op.food, updated_at: now })
    if (error) throw error
  } else if (op.kind === 'food-delete') {
    const { error } = await supa.from('learned_foods').delete().eq('id', op.id)
    if (error) throw error
  }
}

export async function flushQueue(): Promise<void> {
  const supa = getClient()
  if (!supa || !currentUser || flushing) return
  flushing = true
  try {
    let queue = readQueue()
    while (queue.length > 0) {
      await pushOp(supa, queue[0])
      queue = queue.slice(1)
      writeQueue(queue)
    }
    setSyncState('ok')
  } catch {
    setSyncState('fout')
  } finally {
    flushing = false
  }
}

// ---- pull & merge ----

interface ServerEntryRow {
  id: string
  ts: string
  raw_text: string
  items: LogEntry['items']
}

/**
 * Pure mergelogica: de server wint per id; lokale entries die de server niet
 * kent (offline gelogd) blijven staan en worden teruggepusht.
 */
export function mergeEntries(local: LogEntry[], server: LogEntry[]): { merged: LogEntry[]; toPush: LogEntry[] } {
  const serverIds = new Set(server.map((e) => e.id))
  const toPush = local.filter((e) => !serverIds.has(e.id))
  const merged = [...server, ...toPush].sort((a, b) => a.ts - b.ts)
  return { merged, toPush }
}

async function pull(): Promise<void> {
  const supa = getClient()
  if (!supa || !currentUser) return
  setSyncState('synct')

  const [entriesRes, foodsRes, settingsRes] = await Promise.all([
    supa.from('entries').select('id, ts, raw_text, items'),
    supa.from('learned_foods').select('id, food'),
    supa.from('settings').select('data').maybeSingle()
  ])
  if (entriesRes.error || foodsRes.error || settingsRes.error) {
    setSyncState('fout')
    return
  }

  const serverEntries: LogEntry[] = (entriesRes.data as ServerEntryRow[]).map((r) => ({
    id: r.id, ts: new Date(r.ts).getTime(), rawText: r.raw_text, items: r.items
  }))

  withSyncSuspended(() => {
    // Entries: server wint per id, offline-loggings blijven en gaan de wachtrij in.
    const localEntries = currentLog()
    const { merged, toPush } = mergeEntries(localEntries, serverEntries)
    replaceLog(merged)
    for (const e of toPush) writeQueue([...readQueue(), { kind: 'entry-upsert', entry: e }])

    // Eigen/geleerde producten: samenvoegen op id (server aanvullen met lokaal).
    const serverFoods = (foodsRes.data as { id: string; food: Food }[]).map((r) => r.food)
    const serverFoodIds = new Set(serverFoods.map((f) => f.id))
    for (const f of serverFoods) {
      registerLearnedFood(f)
    }
    for (const f of getLearnedFoods()) {
      if (!serverFoodIds.has(f.id)) writeQueue([...readQueue(), { kind: 'food-upsert', food: f }])
    }

    // Instellingen: serverversie wint als die bestaat, anders lokaal pushen.
    if (settingsRes.data?.data) {
      saveSettings(settingsRes.data.data)
    } else {
      writeQueue([...readQueue(), { kind: 'settings', settings: getSettings() }])
    }
  })

  await flushQueue()
  setSyncState('ok')
}

// currentLog: de store exporteert alleen de hook; lees hier direct de opslag.
function currentLog(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem('foodtrack.log.v1') ?? '[]')
  } catch {
    return []
  }
}

// ---- auth ----

export async function signInWithEmail(email: string): Promise<string | null> {
  const supa = getClient()
  if (!supa) return 'Vul eerst de Supabase-gegevens in.'
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  })
  return error ? error.message : null
}

export async function signOut(): Promise<void> {
  await getClient()?.auth.signOut()
  currentUser = null
  setSyncState('niet-ingelogd')
}

function setSyncState(s: SyncState) {
  syncState = s
  refreshSnapshot()
  emit()
}

export function useCloudStatus(): { configured: boolean; user: User | null; state: SyncState } {
  useLog() // her-render bij datawijzigingen
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => statusSnapshot
  )
}

let statusSnapshot: { configured: boolean; user: User | null; state: SyncState } = {
  configured: false,
  user: null,
  state: syncState
}
function refreshSnapshot() {
  statusSnapshot = { configured: getCloudConfig() !== null, user: currentUser, state: syncState }
}

/** Eén keer aanroepen bij het opstarten van de app. */
export async function initCloud(): Promise<void> {
  setMutationHandler((op) => enqueue(op))
  const supa = getClient()
  if (!supa) {
    syncState = 'uit'
    refreshSnapshot()
    emit()
    return
  }
  supa.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null
    refreshSnapshot()
    emit()
    if (currentUser) void pull()
  })
  const { data } = await supa.auth.getSession()
  currentUser = data.session?.user ?? null
  syncState = currentUser ? 'synct' : 'niet-ingelogd'
  refreshSnapshot()
  emit()
  if (currentUser) await pull()
  window.addEventListener('online', () => void flushQueue())
}

export function aiActive(): boolean {
  const config = getCloudConfig()
  return Boolean(config?.aiEnabled && getClient() && currentUser)
}

export function pendingCount(): number {
  return readQueue().length
}
