/**
 * Herkent tijdsaanduidingen in een gesproken/getypte zin ("gisteren om 13:00
 * twee boterhammen") en geeft de bijbehorende timestamp plus de zin zonder
 * die tijdwoorden terug, zodat de voedselparser alleen het eten ziet.
 */

interface DayPart {
  re: RegExp
  dayOffset: number
  hour: number
  minute?: number
}

const DAY_PARTS: DayPart[] = [
  { re: /\beergisteravond\b/, dayOffset: -2, hour: 19 },
  { re: /\beergisteren\b/, dayOffset: -2, hour: 12 },
  { re: /\bgisteravond\b/, dayOffset: -1, hour: 19 },
  { re: /\bgistermiddag\b/, dayOffset: -1, hour: 13 },
  { re: /\bgisterochtend\b|\bgistermorgen\b/, dayOffset: -1, hour: 8, minute: 30 },
  { re: /\bgisteren\b/, dayOffset: -1, hour: 12 },
  { re: /\bvanmorgen\b|\bvanochtend\b/, dayOffset: 0, hour: 8, minute: 30 },
  { re: /\bvanmiddag\b/, dayOffset: 0, hour: 13 },
  { re: /\bvanavond\b/, dayOffset: 0, hour: 19 },
  { re: /\bvannacht\b/, dayOffset: 0, hour: 23 },
  { re: /\bbij het ontbijt\b|\bals ontbijt\b|\bbij ontbijt\b/, dayOffset: 0, hour: 8 },
  { re: /\bbij de lunch\b|\bals lunch\b|\btussen de middag\b/, dayOffset: 0, hour: 12, minute: 30 },
  { re: /\bbij het avondeten\b|\bbij het diner\b|\bals avondeten\b/, dayOffset: 0, hour: 18, minute: 30 }
]

const HOUR_WORDS: Record<string, number> = {
  een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8,
  negen: 9, tien: 10, elf: 11, twaalf: 12
}

// "om 13:00", "om 8.30", "rond 9 uur", "om half 8", "om 8"
const CLOCK_RE = /\b(?:om|rond|tegen)\s+(?:(half)\s+)?(\d{1,2}|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf)(?:[:.](\d{2}))?(?:\s*uur)?\b/

export interface TimeMatch {
  ts: number
  cleaned: string
}

/**
 * @param text     de ruwe invoer (niet genormaliseerd — dubbele punten tellen)
 * @param now      referentietijd
 * @returns        null wanneer er geen tijdsaanduiding in de zin staat
 */
export function extractTime(text: string, now: number = Date.now()): TimeMatch | null {
  let s = ` ${text.toLowerCase()} `
  let dayOffset: number | null = null
  let hour: number | null = null
  let minute = 0
  let eveningHint = /avond|nacht|borrel/.test(s)

  for (const part of DAY_PARTS) {
    if (part.re.test(s)) {
      dayOffset = part.dayOffset
      hour = part.hour
      minute = part.minute ?? 0
      s = s.replace(part.re, ' ')
      break
    }
  }

  const clock = CLOCK_RE.exec(s)
  if (clock) {
    const rawHour = HOUR_WORDS[clock[2]] ?? parseInt(clock[2], 10)
    if (Number.isFinite(rawHour) && rawHour >= 0 && rawHour <= 23) {
      if (clock[1]) {
        // "half acht" = 7:30
        hour = rawHour - 1
        minute = 30
      } else {
        hour = rawHour
        minute = clock[3] ? parseInt(clock[3], 10) : 0
      }
      // 12-uursklok: "om 1 uur" eten is vrijwel altijd 's middags.
      if (hour <= 6 || (eveningHint && hour < 12)) hour += 12
      s = s.replace(CLOCK_RE, ' ')
      if (dayOffset === null) dayOffset = 0
    }
  }

  if (dayOffset === null && hour === null) return null

  const d = new Date(now)
  d.setDate(d.getDate() + (dayOffset ?? 0))
  d.setHours(hour ?? 12, minute, 0, 0)
  return { ts: d.getTime(), cleaned: s.replace(/\s+/g, ' ').trim() }
}
