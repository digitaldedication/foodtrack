import { brandedToItem, guessServing, loadBranded, searchBranded, searchOpenFoodFacts } from './branded'
import type { BrandedProduct } from './branded'
import { registerLearnedFood } from './db'
import { stripQuantity } from './parser'
import type { Food, LoggedItem } from '../types'

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

/**
 * Remember a runtime-matched product as a regular food, so the next time it is
 * spoken it resolves instantly and offline via the normal parser.
 */
function toLearnedFood(prod: BrandedProduct, spokenWords: string[]): Food {
  const name = prod.b ? `${prod.n} (${prod.b})` : prod.n
  return {
    id: `learned-${slug(name)}`,
    name,
    cat: 'geleerd',
    aliases: [spokenWords.join(' '), prod.n],
    per100: { kcal: prod.k, p: prod.p, c: prod.c, f: prod.f },
    portions: [{ n: prod.s ? 'portie' : 'portie (geschat)', g: guessServing(prod), a: ['portie', 'stuk', 'stuks', 'verpakking', 'zakje', 'flesje', 'blikje'] }]
  }
}

/**
 * Second and third matching layer for items the base parser couldn't resolve:
 * first the bundled Open Food Facts top-list (offline), then the live Open
 * Food Facts API. Successful matches are learned for next time.
 */
export async function resolveUnknowns(items: LoggedItem[]): Promise<LoggedItem[]> {
  if (!items.some((i) => !i.resolved)) return items

  const branded = await loadBranded()
  const out: LoggedItem[] = []
  for (const item of items) {
    if (item.resolved) {
      out.push(item)
      continue
    }
    const { words } = stripQuantity(item.rawText)
    let match = searchBranded(branded, words)
    if (!match && navigator.onLine !== false) {
      match = await searchOpenFoodFacts(words)
    }
    if (match) {
      out.push(brandedToItem(match, item.rawText))
      registerLearnedFood(toLearnedFood(match, words))
    } else {
      out.push(item)
    }
  }
  return out
}
