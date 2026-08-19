import { normalize, stripQuantity } from './parser'
import type { LoggedItem } from '../types'

/** Compact product record from Open Food Facts (see scripts/build-branded-db.mjs). */
export interface BrandedProduct {
  n: string
  b?: string
  k: number
  p: number
  c: number
  f: number
  /** serving size in grams, when known */
  s?: number
}

interface BrandedDb {
  version: number
  products: BrandedProduct[]
}

let cached: BrandedProduct[] | null = null
let loading: Promise<BrandedProduct[]> | null = null

/** Lazy-loads the bundled branded-products dataset (~10k Dutch products). */
export function loadBranded(): Promise<BrandedProduct[]> {
  if (cached) return Promise.resolve(cached)
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/foods-branded.json`)
      .then((res) => (res.ok ? (res.json() as Promise<BrandedDb>) : Promise.reject(new Error(String(res.status)))))
      .then((db) => {
        cached = db.products
        return cached
      })
      .catch(() => {
        loading = null
        return []
      })
  }
  return loading
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 1)
}

function singular(w: string): string {
  return w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w
}

function tokenMatches(query: string, target: string): boolean {
  const q = singular(query)
  const t = singular(target)
  if (q === t) return true
  if (q.length >= 4 && t.startsWith(q)) return true
  if (t.length >= 4 && q.startsWith(t)) return true
  return false
}

/**
 * Score-based lookup: every content word of the spoken segment must appear in
 * the product's name or brand. Products are popularity-ordered, so the first
 * sufficient match among equally-precise candidates is the most-scanned one.
 */
export function searchBranded(products: BrandedProduct[], queryWords: string[]): BrandedProduct | null {
  const query = queryWords.map((w) => w.toLowerCase()).filter((w) => w.length > 1)
  if (query.length === 0) return null

  let best: { prod: BrandedProduct; score: number; size: number; idx: number } | null = null
  for (let idx = 0; idx < products.length; idx++) {
    const prod = products[idx]
    const target = tokens(`${prod.n} ${prod.b ?? ''}`)
    if (target.length === 0) continue
    let matched = 0
    for (const qw of query) {
      if (target.some((tw) => tokenMatches(qw, tw))) matched++
    }
    const needed = query.length <= 2 ? query.length : Math.ceil(query.length * 0.75)
    if (matched < needed) continue
    const score = matched / query.length
    if (!best || score > best.score || (score === best.score && target.length < best.size)) {
      best = { prod, score, size: target.length, idx }
    }
  }
  return best ? best.prod : null
}

/** Live fallback: search the full Open Food Facts database (needs internet). */
export async function searchOpenFoodFacts(queryWords: string[]): Promise<BrandedProduct | null> {
  const terms = queryWords.join(' ')
  if (!terms) return null
  const params = new URLSearchParams({
    action: 'process',
    search_terms: terms,
    search_simple: '1',
    json: '1',
    page_size: '10',
    fields: 'product_name,product_name_nl,brands,nutriments,serving_quantity,serving_size'
  })
  try {
    const res = await fetch(`https://nl.openfoodfacts.org/cgi/search.pl?${params.toString()}`)
    if (!res.ok) return null
    const data = await res.json()
    const candidates: BrandedProduct[] = []
    for (const prod of data.products ?? []) {
      const name = (prod.product_name_nl || prod.product_name || '').trim()
      const nut = prod.nutriments ?? {}
      const k = nut['energy-kcal_100g']
      if (!name || typeof k !== 'number' || k < 0 || k > 950) continue
      const entry: BrandedProduct = {
        n: name,
        k: Math.round(k),
        p: Number(nut.proteins_100g) || 0,
        c: Number(nut.carbohydrates_100g) || 0,
        f: Number(nut.fat_100g) || 0
      }
      const brand = (prod.brands || '').split(',')[0].trim()
      if (brand) entry.b = brand
      const sq = Number(prod.serving_quantity)
      if (Number.isFinite(sq) && sq > 0 && sq <= 2000) entry.s = Math.round(sq)
      candidates.push(entry)
    }
    return searchBranded(candidates, queryWords) ?? candidates[0] ?? null
  } catch {
    return null
  }
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

// Veel Open Food Facts-producten missen een portiegrootte. Deze heuristiek
// schat er dan één op basis van het producttype, zodat "een snelle jelle"
// als één plak kruidkoek telt en niet als 100 gram.
const SERVING_GUESSES: Array<[RegExp, number]> = [
  [/drink|melk|sap|juice|cola|limonade|frisdrank|ice\s?tea|smoothie|energy|bier|water|zero|light/, 250],
  [/soep|soup|noodles/, 250],
  [/pizza/, 320],
  [/yoghurt|kwark|vla|skyr|pap|dessert/, 150],
  [/chips|borrelnoot|noten|nootjes|popcorn/, 25],
  [/chocolade|bonbon|praline/, 25],
  [/pindakaas|jam|stroop|smeer|spread|hummus|houmous|saus|mayo|ketchup/, 15],
  [/koek|cake|wafel|reep|bar|biscuit|cracker|beschuit/, 35],
  [/kaas/, 30],
  [/brood|bol|croissant/, 50]
]

export function guessServing(prod: BrandedProduct): number {
  if (prod.s) return prod.s
  const haystack = `${prod.n} ${prod.b ?? ''}`.toLowerCase()
  for (const [re, grams] of SERVING_GUESSES) {
    if (re.test(haystack)) return grams
  }
  return 100
}

/** Turn a matched branded product into a logged item for the spoken segment. */
export function brandedToItem(prod: BrandedProduct, segment: string): LoggedItem {
  const { qty, grams } = stripQuantity(segment)
  const portionGrams = guessServing(prod)
  const totalGrams = grams ?? qty * portionGrams
  const factor = totalGrams / 100
  return {
    foodId: null,
    name: prod.b ? `${prod.n} (${prod.b})` : prod.n,
    rawText: segment,
    qty,
    portionName: grams ? null : prod.s ? 'portie' : 'portie (geschat)',
    grams: Math.round(totalGrams),
    kcal: Math.round(prod.k * factor),
    p: round1(prod.p * factor),
    c: round1(prod.c * factor),
    f: round1(prod.f * factor),
    resolved: true
  }
}
