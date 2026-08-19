import type { Food, LoggedItem } from '../types'

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9,;+&.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMBER_WORDS: Record<string, number> = {
  een: 1, eén: 1, één: 1, n: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6,
  zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12, dertien: 13,
  veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18,
  negentien: 19, twintig: 20, dertig: 30, veertig: 40, vijftig: 50,
  half: 0.5, halve: 0.5, anderhalf: 1.5, anderhalve: 1.5, kwart: 0.25,
  driekwart: 0.75, paar: 2, beide: 2, enkele: 2, dozijn: 12
}

const SIZE_MODIFIERS: Record<string, number> = {
  klein: 0.7, kleine: 0.7, kleintje: 0.7, mini: 0.6,
  groot: 1.3, grote: 1.3, flink: 1.3, flinke: 1.3, dubbele: 2, dubbel: 2,
  beetje: 0.5, klodder: 1, snufje: 0.25
}

const GRAM_UNITS: Record<string, number> = {
  gram: 1, gr: 1, g: 1, ml: 1, cc: 1, milliliter: 1,
  kilo: 1000, kg: 1000, kilogram: 1000, liter: 1000, l: 1000, ons: 100, pond: 500
}

// Words that carry no meaning for matching ("nog een appel", "ook wat chips").
const FILLER = new Set([
  'nog', 'ook', 'wat', 'even', 'net', 'vandaag', 'vanmorgen', 'vanmiddag',
  'vanavond', 'gisteren', 'zonet', 'daarna', 'toen', 'erbij', 'bij', 'de',
  'het', 'die', 'dat', 'me', 'mijn', 'ik', 'heb', 'gegeten', 'gedronken',
  'genomen', 'gehad', 'op', 'als', 'ontbijt', 'lunch', 'avondeten', 'tussendoortje',
  'snack', 'toe', 'x', 'keer', 'stuks'
])

interface AliasEntry {
  alias: string
  food: Food
  isPrimary: boolean
}

export class FoodIndex {
  private entries: AliasEntry[] = []

  constructor(foods: Food[]) {
    for (const food of foods) {
      this.add(food)
    }
  }

  add(food: Food) {
    const seen = new Set<string>()
    const push = (raw: string, isPrimary: boolean) => {
      const alias = normalize(raw)
      if (!alias || seen.has(alias)) return
      seen.add(alias)
      this.entries.push({ alias, food, isPrimary })
    }
    push(food.name.replace(/\s*\(.*\)\s*/g, ' '), true)
    push(food.name, true)
    push(food.id, false)
    for (const a of food.aliases) push(a, false)
    // Longest aliases first so "boterham met pindakaas"-style compounds win.
    this.entries.sort((x, y) => y.alias.length - x.alias.length)
  }

  /** Find the best matching food inside a normalized segment. */
  match(segment: string): { food: Food; matched: string } | null {
    const padded = ` ${segment} `
    for (const e of this.entries) {
      if (padded.includes(` ${e.alias} `)) {
        return { food: e.food, matched: e.alias }
      }
    }
    // Fuzzy fallback: single-word aliases within edit distance 1 (or 2 for long words).
    const words = segment.split(' ').filter((w) => w.length > 3 && !FILLER.has(w))
    let best: { food: Food; matched: string; dist: number; len: number } | null = null
    for (const w of words) {
      for (const e of this.entries) {
        if (e.alias.includes(' ')) continue
        const maxDist = e.alias.length >= 8 ? 2 : 1
        if (Math.abs(e.alias.length - w.length) > maxDist) continue
        const d = editDistance(w, e.alias, maxDist)
        if (d >= 0 && (!best || d < best.dist || (d === best.dist && e.alias.length > best.len))) {
          best = { food: e.food, matched: w, dist: d, len: e.alias.length }
        }
      }
    }
    return best ? { food: best.food, matched: best.matched } : null
  }
}

/** Bounded Levenshtein distance; returns -1 when it exceeds maxDist. */
function editDistance(a: string, b: string, maxDist: number): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > maxDist) return -1
    prev = cur
  }
  return prev[n] <= maxDist ? prev[n] : -1
}

function splitSegments(norm: string): string[] {
  return norm
    .split(/,|;|\+|&| en /)
    .map((s) => s.trim())
    .filter(Boolean)
}

interface QtyInfo {
  qty: number
  grams: number | null
  portionAlias: string | null
  modifier: number
  leftovers: string[]
}

/**
 * Pull quantity, gram amounts, size modifiers and a possible portion word out of
 * the words that are not part of the food name itself.
 */
function parseQuantity(words: string[], portionAliases: Set<string>): QtyInfo {
  let qty: number | null = null
  let grams: number | null = null
  let portionAlias: string | null = null
  let modifier = 1
  const leftovers: string[] = []
  let pendingNumber: number | null = null

  for (const w of words) {
    const numeric = w.match(/^(\d+(?:[.,]\d+)?)$/)
    if (numeric) {
      pendingNumber = parseFloat(numeric[1].replace(',', '.'))
      if (qty === null) qty = pendingNumber
      continue
    }
    // "200g" / "200gram" glued together
    const glued = w.match(/^(\d+(?:[.,]\d+)?)(gram|gr|g|ml|kg|l)$/)
    if (glued) {
      const val = parseFloat(glued[1].replace(',', '.'))
      grams = val * GRAM_UNITS[glued[2]]
      continue
    }
    // A food-specific portion word wins over generic number words: for a
    // cucumber "halve" is the half-cucumber portion, not qty 0.5.
    if (portionAliases.has(w)) {
      portionAlias = w
      continue
    }
    if (w in GRAM_UNITS) {
      const base = pendingNumber ?? qty ?? 1
      grams = base * GRAM_UNITS[w]
      if (pendingNumber !== null && qty === pendingNumber) qty = null
      pendingNumber = null
      continue
    }
    if (w in NUMBER_WORDS) {
      const val = NUMBER_WORDS[w]
      if (qty === null) qty = val
      else qty *= val // "twee half(je)s" etc.
      pendingNumber = val
      continue
    }
    if (w in SIZE_MODIFIERS) {
      modifier *= SIZE_MODIFIERS[w]
      continue
    }
    if (!FILLER.has(w)) leftovers.push(w)
  }
  return { qty: qty ?? 1, grams, portionAlias, modifier, leftovers }
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

function buildItem(food: Food, rawText: string, q: QtyInfo): LoggedItem {
  let grams: number
  let portionName: string | null = null
  if (q.grams !== null) {
    grams = q.grams
  } else {
    let portion = food.portions[0]
    if (q.portionAlias) {
      const hit = food.portions.find((p) => p.a.some((a) => normalize(a) === q.portionAlias))
      if (hit) portion = hit
    }
    portionName = portion.n
    grams = q.qty * portion.g * q.modifier
  }
  const factor = grams / 100
  return {
    foodId: food.id,
    name: food.name,
    rawText,
    qty: q.qty,
    portionName,
    grams: Math.round(grams),
    kcal: Math.round(food.per100.kcal * factor),
    p: round1(food.per100.p * factor),
    c: round1(food.per100.c * factor),
    f: round1(food.per100.f * factor),
    resolved: true
  }
}

function unresolvedItem(rawText: string): LoggedItem {
  return {
    foodId: null,
    name: rawText,
    rawText,
    qty: 1,
    portionName: null,
    grams: 0,
    kcal: 0,
    p: 0,
    c: 0,
    f: 0,
    resolved: false
  }
}

function parseSegment(index: FoodIndex, segment: string): LoggedItem[] {
  const hit = index.match(segment)

  // "boterham met pindakaas": no compound in the db → bread + topping.
  if (segment.includes(' met ')) {
    const [left, right] = segment.split(' met ', 2)
    const coversBoth =
      hit && hit.matched.includes(' met ')
    if (!coversBoth) {
      const leftHit = index.match(left)
      const rightHit = index.match(right)
      if (leftHit && rightHit) {
        const leftWords = left.replace(leftHit.matched, ' ').split(' ').filter(Boolean)
        const q = parseQuantity(leftWords, portionAliasSet(leftHit.food))
        const base = buildItem(leftHit.food, left.trim(), q)
        // The topping scales with the number of slices/pieces of the base.
        const rightWords = right.replace(rightHit.matched, ' ').split(' ').filter(Boolean)
        const qr = parseQuantity(rightWords, portionAliasSet(rightHit.food))
        if (qr.grams === null && qr.qty === 1) qr.qty = q.qty
        const topping = buildItem(rightHit.food, right.trim(), qr)
        return [base, topping]
      }
    }
  }

  if (!hit) return [unresolvedItem(segment)]

  const rest = ` ${segment} `.replace(` ${hit.matched} `, ' ').trim()
  const words = rest.split(' ').filter(Boolean)
  const q = parseQuantity(words, portionAliasSet(hit.food))
  return [buildItem(hit.food, segment, q)]
}

function portionAliasSet(food: Food): Set<string> {
  const s = new Set<string>()
  for (const p of food.portions) {
    s.add(normalize(p.n))
    for (const a of p.a) s.add(normalize(a))
  }
  return s
}

/**
 * Split a spoken segment into a quantity and the remaining product words.
 * Used by the branded-products matcher for segments the base parser
 * couldn't resolve ("twee snelle jelles" → qty 2, words ["snelle","jelles"]).
 */
export function stripQuantity(segment: string): { qty: number; grams: number | null; words: string[] } {
  const words = normalize(segment).split(' ').filter(Boolean)
  const q = parseQuantity(words, new Set())
  return { qty: q.qty, grams: q.grams, words: q.leftovers }
}

/** Parse a full spoken phrase into logged items. */
export function parsePhrase(index: FoodIndex, phrase: string): LoggedItem[] {
  const norm = normalize(phrase)
  if (!norm) return []
  const segments = splitSegments(norm)
  const items: LoggedItem[] = []
  for (const seg of segments) {
    // Skip pure filler segments ("en verder niks").
    const words = seg.split(' ').filter((w) => !FILLER.has(w))
    if (words.length === 0) continue
    items.push(...parseSegment(index, seg))
  }
  return items
}
