import type { LogEntry, Settings } from '../types'
import { entryTotals } from '../types'

/**
 * Builds the URL that runs the "FoodTrack Health" shortcut on iOS. The
 * shortcut receives one JSON dictionary and writes four samples (energy,
 * protein, carbs, fat) to Apple Health. See the Uitleg page for the setup.
 */
export function healthShortcutUrl(entry: LogEntry, settings: Settings): string {
  const t = entryTotals(entry)
  const payload = {
    naam: entry.items.map((i) => i.name).join(', ').slice(0, 120),
    kcal: Math.round(t.kcal),
    eiwit: Math.round(t.p * 10) / 10,
    koolhydraten: Math.round(t.c * 10) / 10,
    vet: Math.round(t.f * 10) / 10
  }
  const name = encodeURIComponent(settings.healthShortcutName)
  const input = encodeURIComponent(JSON.stringify(payload))
  return `shortcuts://run-shortcut?name=${name}&input=text&text=${input}`
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}
