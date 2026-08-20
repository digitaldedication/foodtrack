import { aiActive, getClient } from './cloud'
import { addEntry, dayKey, entriesForDay, getSettings, newId } from './store'
import type { LogEntry, LoggedItem } from '../types'
import { dayTotals, entryTotals } from '../types'

interface AiItem {
  name: string
  grams: number
  kcal: number
  eiwit: number
  koolhydraten: number
  vet: number
}

interface AiAnswer {
  reply: string
  log: { when: string | null; items: AiItem[] } | null
}

export interface AiChatResult {
  reply: string
  entry?: LogEntry
}

/**
 * Stuurt het gesprek naar de Claude Edge Function (Supabase). Retourneert null
 * wanneer AI niet actief is of de aanroep faalt — de aanroeper valt dan terug
 * op de lokale chatafhandeling.
 */
export async function chatWithClaude(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  text: string,
  log: LogEntry[]
): Promise<AiChatResult | null> {
  if (!aiActive()) return null
  const supa = getClient()
  if (!supa) return null

  const settings = getSettings()
  const today = entriesForDay(log, dayKey(Date.now()))
  const totals = dayTotals(today)
  const recent = [...log]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 15)
    .map((e) => ({
      tijd: new Date(e.ts).toLocaleString('nl-NL'),
      tekst: e.rawText,
      kcal: Math.round(entryTotals(e).kcal)
    }))

  try {
    const { data, error } = await supa.functions.invoke('claude', {
      body: {
        messages: [...history.slice(-10), { role: 'user', content: text }],
        context: {
          nu: new Date().toString(),
          tijdzone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          caloriedoel: settings.kcalGoal,
          macroverdeling: settings.macroPct,
          vandaag: {
            kcal: Math.round(totals.kcal),
            eiwit: Math.round(totals.p),
            koolhydraten: Math.round(totals.c),
            vet: Math.round(totals.f)
          },
          recenteLoggings: recent
        }
      }
    })
    if (error || !data?.reply) return null
    const answer = data as AiAnswer

    let entry: LogEntry | undefined
    if (answer.log && answer.log.items.length > 0) {
      const ts = answer.log.when ? Date.parse(answer.log.when) : NaN
      const items: LoggedItem[] = answer.log.items.map((i) => ({
        foodId: null,
        name: i.name,
        rawText: i.name,
        qty: 1,
        portionName: null,
        grams: Math.round(i.grams),
        kcal: Math.round(i.kcal),
        p: Math.round(i.eiwit * 10) / 10,
        c: Math.round(i.koolhydraten * 10) / 10,
        f: Math.round(i.vet * 10) / 10,
        resolved: true
      }))
      entry = { id: newId(), ts: Number.isFinite(ts) ? ts : Date.now(), rawText: text, items }
      addEntry(entry)
    }
    return { reply: answer.reply, entry }
  } catch {
    return null
  }
}
