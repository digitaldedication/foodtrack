import { describe, expect, it } from 'vitest'
import { brandedToItem, searchBranded } from './branded'
import type { BrandedProduct } from './branded'
import { stripQuantity } from './parser'

const PRODUCTS: BrandedProduct[] = [
  { n: 'Kruidkoek', b: 'Snelle Jelle', k: 314, p: 4.5, c: 65, f: 2.5, s: 35 },
  { n: 'Drinkyoghurt framboos', b: 'Optimel', k: 27, p: 3, c: 3.3, f: 0, s: 250 },
  { n: 'Cup-a-Soup tomaat', b: 'Unox', k: 46, p: 0.8, c: 8, f: 1.2, s: 175 },
  { n: 'Pindakaas', b: 'Calvé', k: 617, p: 20, c: 13, f: 51 },
  { n: 'Chocoladereep melk', b: "Tony's Chocolonely", k: 538, p: 7.4, c: 55, f: 31, s: 30 }
]

describe('searchBranded', () => {
  it('vindt een merkproduct op merknaam', () => {
    const hit = searchBranded(PRODUCTS, ['snelle', 'jelle'])
    expect(hit?.n).toBe('Kruidkoek')
  })

  it('vindt met meervoud en deelwoorden', () => {
    const hit = searchBranded(PRODUCTS, ['snelle', 'jelles'])
    expect(hit?.b).toBe('Snelle Jelle')
  })

  it('vindt optimel drinkyoghurt', () => {
    const hit = searchBranded(PRODUCTS, ['optimel'])
    expect(hit?.b).toBe('Optimel')
  })

  it('geeft null bij onzin', () => {
    expect(searchBranded(PRODUCTS, ['gefrituurde', 'maanrots'])).toBeNull()
  })
})

describe('brandedToItem', () => {
  it('gebruikt de portiegrootte en hoeveelheid', () => {
    const prod = PRODUCTS[0]
    const item = brandedToItem(prod, 'twee snelle jelles')
    expect(item.qty).toBe(2)
    expect(item.grams).toBe(70)
    expect(item.kcal).toBe(Math.round(314 * 0.7))
    expect(item.resolved).toBe(true)
  })

  it('gebruikt grammen als die genoemd zijn', () => {
    const prod = PRODUCTS[3]
    const item = brandedToItem(prod, '30 gram pindakaas calve')
    expect(item.grams).toBe(30)
    expect(item.kcal).toBe(Math.round(617 * 0.3))
  })
})

describe('guessServing (heuristiek zonder portiegrootte)', () => {
  it('schat een plak kruidkoek op 35 g', () => {
    const item = brandedToItem({ n: 'Kruidkoek', b: 'Snelle Jelle', k: 305, p: 2.4, c: 69.7, f: 1 }, 'een snelle jelle')
    expect(item.grams).toBe(35)
    expect(item.kcal).toBe(Math.round(305 * 0.35))
    expect(item.portionName).toBe('portie (geschat)')
  })

  it('schat een drinkyoghurt op 250 ml', () => {
    const item = brandedToItem({ n: 'Drinkyoghurt limoen', b: 'Optimel', k: 31, p: 3.2, c: 3.6, f: 0 }, 'een flesje optimel')
    expect(item.grams).toBe(250)
    expect(item.kcal).toBe(Math.round(31 * 2.5))
  })
})

describe('stripQuantity', () => {
  it('haalt hoeveelheid en productwoorden uit een zin', () => {
    const r = stripQuantity('twee snelle jelles')
    expect(r.qty).toBe(2)
    expect(r.words).toEqual(['snelle', 'jelles'])
  })
})
