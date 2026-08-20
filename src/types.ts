export interface Macro {
  kcal: number
  p: number
  c: number
  f: number
}

export interface Portion {
  n: string
  g: number
  a: string[]
}

export interface Food {
  id: string
  name: string
  cat: string
  aliases: string[]
  per100: Macro
  portions: Portion[]
}

export interface FoodDb {
  version: number
  foods: Food[]
}

export interface LoggedItem {
  foodId: string | null
  name: string
  rawText: string
  qty: number
  portionName: string | null
  grams: number
  kcal: number
  p: number
  c: number
  f: number
  resolved: boolean
}

export interface LogEntry {
  id: string
  ts: number
  rawText: string
  items: LoggedItem[]
}

export interface Settings {
  kcalGoal: number
  macroPct: { p: number; c: number; f: number }
  healthExport: boolean
  healthAutoOpen: boolean
  healthShortcutName: string
}

export const DEFAULT_SETTINGS: Settings = {
  kcalGoal: 2200,
  macroPct: { p: 25, c: 45, f: 30 },
  healthExport: true,
  healthAutoOpen: true,
  healthShortcutName: 'FoodTrack Health'
}

export const KCAL_PER_GRAM = { p: 4, c: 4, f: 9 } as const

export function entryTotals(entry: LogEntry): Macro {
  return entry.items.reduce(
    (acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, c: acc.c + it.c, f: acc.f + it.f }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  )
}

export function dayTotals(entries: LogEntry[]): Macro {
  return entries.reduce((acc, e) => {
    const t = entryTotals(e)
    return { kcal: acc.kcal + t.kcal, p: acc.p + t.p, c: acc.c + t.c, f: acc.f + t.f }
  }, { kcal: 0, p: 0, c: 0, f: 0 })
}

/** Macro goals in grams, derived from the kcal goal and the percentage split. */
export function macroGoals(s: Settings): { p: number; c: number; f: number } {
  return {
    p: Math.round((s.kcalGoal * s.macroPct.p) / 100 / KCAL_PER_GRAM.p),
    c: Math.round((s.kcalGoal * s.macroPct.c) / 100 / KCAL_PER_GRAM.c),
    f: Math.round((s.kcalGoal * s.macroPct.f) / 100 / KCAL_PER_GRAM.f)
  }
}
