import { describe, expect, it } from 'vitest'
import { extractTime } from './time'
import { detectIntent } from './chat'

// woensdag 19 augustus 2026, 21:00 lokale tijd
const NOW = new Date(2026, 7, 19, 21, 0, 0).getTime()

function d(t: ReturnType<typeof extractTime>) {
  if (!t) return null
  const x = new Date(t.ts)
  return `${x.getDate()}-${x.getMonth() + 1} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

describe('extractTime', () => {
  it('gisteren om 13:00', () => {
    const t = extractTime('gisteren om 13:00 twee boterhammen', NOW)
    expect(d(t)).toBe('18-8 13:00')
    expect(t!.cleaned).toBe('twee boterhammen')
  })

  it('vanmorgen', () => {
    const t = extractTime('vanmorgen een appel', NOW)
    expect(d(t)).toBe('19-8 08:30')
    expect(t!.cleaned).toBe('een appel')
  })

  it('om half 8 met avondhint', () => {
    const t = extractTime('gisteravond om half 8 een pizza', NOW)
    expect(d(t)).toBe('18-8 19:30')
  })

  it('om 1 uur wordt 13:00', () => {
    const t = extractTime('om 1 uur een broodje', NOW)
    expect(d(t)).toBe('19-8 13:00')
  })

  it('bij de lunch', () => {
    const t = extractTime('bij de lunch een salade', NOW)
    expect(d(t)).toBe('19-8 12:30')
  })

  it('geen tijd → null', () => {
    expect(extractTime('twee bitterkoekjes', NOW)).toBeNull()
  })
})

describe('detectIntent', () => {
  it.each([
    ['verwijder de laatste', 'delete'],
    ['hoeveel kcal heb ik nog?', 'status'],
    ['wat heb ik vandaag gegeten', 'list'],
    ['help', 'help'],
    ['twee boterhammen met kaas', 'log'],
    ['gisteren om 13:00 een muscle meat gnocchi maaltijd', 'log']
  ])('"%s" → %s', (text, intent) => {
    expect(detectIntent(text)).toBe(intent)
  })
})
