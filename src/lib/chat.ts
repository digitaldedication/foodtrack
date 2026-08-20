import { loadFoodIndex } from './db'
import { parsePhrase } from './parser'
import { resolveUnknowns } from './resolve'
import { addEntry, dayKey, entriesForDay, getSettings, isDuplicate, newId, removeEntry, useLog } from './store'
import { extractTime } from './time'
import type { LogEntry, Settings } from '../types'
import { dayTotals, entryTotals, macroGoals } from '../types'

export type ChatIntent = 'log' | 'status' | 'list' | 'delete' | 'help'

/** Pure intent detection, testable without side effects. */
export function detectIntent(text: string): ChatIntent {
  const s = text.toLowerCase()
  if (/\b(verwijder|ongedaan|undo|weg\b|foutje|toch niet)/.test(s)) return 'delete'
  if (/\b(wat heb ik|wat at ik|overzicht|laat.*zien)\b/.test(s)) return 'list'
  if (/\b(hoeveel|status|nog over|te gaan|zit ik)\b/.test(s) || /kcal.*\?|calorie.*\?/.test(s)) return 'status'
  if (/^(help|hulp|wat kan|hoe werkt)/.test(s)) return 'help'
  return 'log'
}

function fmtTijd(ts: number): string {
  return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function fmtDag(ts: number, now: number): string {
  const dag = dayKey(ts)
  if (dag === dayKey(now)) return 'vandaag'
  const gisteren = new Date(now)
  gisteren.setDate(gisteren.getDate() - 1)
  if (dag === dayKey(gisteren.getTime())) return 'gisteren'
  return new Date(ts).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function statusText(log: LogEntry[], settings: Settings, now: number): string {
  const entries = entriesForDay(log, dayKey(now))
  const t = dayTotals(entries)
  const goals = macroGoals(settings)
  const rest = Math.round(settings.kcalGoal - t.kcal)
  const restZin = rest >= 0 ? `nog ${rest} kcal te gaan` : `${-rest} kcal over je doel`
  return (
    `Je zit vandaag op ${Math.round(t.kcal)} van ${settings.kcalGoal} kcal — ${restZin}. ` +
    `Eiwit ${Math.round(t.p)}/${goals.p} g · koolhydraten ${Math.round(t.c)}/${goals.c} g · vet ${Math.round(t.f)}/${goals.f} g.`
  )
}

export interface ChatReply {
  reply: string
  entry?: LogEntry
  unresolvedNames?: string[]
}

/**
 * Voert één chatbericht uit: loggen (met tijdherkenning), status, overzicht,
 * of laatste logging verwijderen. Draait volledig lokaal.
 */
export async function handleChatMessage(raw: string, log: LogEntry[], now: number = Date.now()): Promise<ChatReply> {
  const settings = getSettings()
  const text = raw.trim()
  if (!text) return { reply: 'Vertel me wat je gegeten hebt, bijvoorbeeld: “twee boterhammen met kaas”.' }

  const intent = detectIntent(text)

  if (intent === 'help') {
    return {
      reply:
        'Je kunt me vertellen wat je at (“vanmorgen twee boterhammen met pindakaas”, “gisteren om 19:00 een muscle meat gnocchi”), ' +
        'vragen hoe je ervoor staat (“hoeveel kcal heb ik nog?”), een overzicht opvragen (“wat heb ik vandaag gegeten?”) ' +
        'of iets terugdraaien (“verwijder de laatste”).'
    }
  }

  if (intent === 'delete') {
    const laatste = [...log].sort((a, b) => b.ts - a.ts)[0]
    if (!laatste) return { reply: 'Er valt niets te verwijderen — je log is leeg.' }
    removeEntry(laatste.id)
    return { reply: `Verwijderd: “${laatste.rawText}” (${Math.round(entryTotals(laatste).kcal)} kcal, ${fmtDag(laatste.ts, now)} ${fmtTijd(laatste.ts)}).` }
  }

  if (intent === 'status') {
    return { reply: statusText(log, settings, now) }
  }

  if (intent === 'list') {
    const time = extractTime(text, now)
    const dag = dayKey(time?.ts ?? now)
    const entries = entriesForDay(log, dag).sort((a, b) => a.ts - b.ts)
    if (entries.length === 0) return { reply: `Niets gelogd ${fmtDag(time?.ts ?? now, now)}.` }
    const regels = entries.map((e) => `• ${fmtTijd(e.ts)} — ${e.rawText} (${Math.round(entryTotals(e).kcal)} kcal)`)
    const t = dayTotals(entries)
    return { reply: `${regels.join('\n')}\nTotaal: ${Math.round(t.kcal)} kcal.` }
  }

  // Loggen, eventueel met tijdsaanduiding.
  const time = extractTime(text, now)
  const eten = time?.cleaned ?? text
  const index = await loadFoodIndex()
  let items = parsePhrase(index, eten)
  if (items.length === 0) {
    return { reply: 'Dat klinkt niet als eten — probeer bijvoorbeeld “een appel en een handje noten”.' }
  }
  if (isDuplicate(text, now)) {
    return { reply: 'Dit stond net al in je log — ik heb het niet dubbel geteld.' }
  }
  items = await resolveUnknowns(items)

  const entry: LogEntry = { id: newId(), ts: time?.ts ?? now, rawText: text, items }
  addEntry(entry)

  const t = entryTotals(entry)
  const herkend = items.filter((i) => i.resolved)
  const onbekend = items.filter((i) => !i.resolved)
  const delen = herkend.map((i) => `${i.name} (${i.kcal} kcal)`).join(', ')

  let reply = `Gelogd voor ${fmtDag(entry.ts, now)} ${fmtTijd(entry.ts)}: ${delen || '—'} — samen ${Math.round(t.kcal)} kcal.`
  if (dayKey(entry.ts) === dayKey(now)) {
    const totaalVandaag = dayTotals(entriesForDay([...log, entry], dayKey(now)))
    const rest = Math.round(settings.kcalGoal - totaalVandaag.kcal)
    reply += rest >= 0 ? ` Nog ${rest} kcal te gaan vandaag.` : ` Je zit ${-rest} kcal over je doel.`
  }
  if (onbekend.length > 0) {
    reply += `\nNiet herkend: ${onbekend.map((i) => `“${i.rawText}”`).join(', ')}. Voeg het toe via Mijn producten, dan onthoud ik het.`
  }
  return { reply, entry, unresolvedNames: onbekend.map((i) => i.rawText) }
}

export { useLog }
