import { describe, expect, it } from 'vitest'
import db from '../../public/data/foods-branded.json'
import { searchBranded } from './branded'
import type { BrandedProduct } from './branded'
import { stripQuantity } from './parser'

// Bewaakt de kwaliteit van de gegenereerde Open Food Facts-dataset, zodat een
// maandelijkse verversing nooit een lege of kapotte lijst kan deployen.
const products = (db as { products: BrandedProduct[] }).products

describe('foods-branded.json', () => {
  it('bevat een substantiële productlijst', () => {
    expect(products.length).toBeGreaterThan(3000)
  })

  it('heeft geldige voedingswaarden', () => {
    for (const p of products) {
      expect(p.k).toBeGreaterThanOrEqual(0)
      expect(p.k).toBeLessThanOrEqual(950)
      expect(p.n.length).toBeGreaterThanOrEqual(3)
    }
  })

  it.each([
    ['een snelle jelle', 'Snelle Jelle'],
    ['een flesje optimel', 'Optimel'],
    ['een cup a soup', 'Cup'],
    ['een blikje red bull', 'Red Bull']
  ])('herkent "%s"', (spoken, expected) => {
    const { words } = stripQuantity(spoken)
    const hit = searchBranded(products, words)
    expect(hit, spoken).not.toBeNull()
    expect(`${hit!.n} ${hit!.b ?? ''}`.toLowerCase()).toContain(expected.toLowerCase())
  })
})
