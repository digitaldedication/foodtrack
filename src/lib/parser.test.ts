import { describe, expect, it } from 'vitest'
import db from '../data/foods.json'
import type { FoodDb } from '../types'
import { FoodIndex, parsePhrase } from './parser'

const index = new FoodIndex((db as FoodDb).foods)

describe('parsePhrase', () => {
  it('parst "twee bitterkoekjes en een boterham met pindakaas"', () => {
    const items = parsePhrase(index, 'Twee bitterkoekjes en een boterham met pindakaas')
    expect(items).toHaveLength(3)

    const [koek, brood, pk] = items
    expect(koek.foodId).toBe('bitterkoekje')
    expect(koek.qty).toBe(2)
    expect(koek.grams).toBe(20)
    expect(koek.kcal).toBe(80)

    expect(brood.foodId).toBe('volkorenbrood')
    expect(brood.grams).toBe(35)

    expect(pk.foodId).toBe('pindakaas')
    expect(pk.grams).toBe(15)
    expect(pk.kcal).toBe(93)
  })

  it('schaalt beleg mee met het aantal boterhammen', () => {
    const items = parsePhrase(index, 'drie boterhammen met kaas')
    expect(items).toHaveLength(2)
    expect(items[0].grams).toBe(105)
    expect(items[1].foodId).toBe('kaas48')
    expect(items[1].qty).toBe(3)
    expect(items[1].grams).toBe(60)
  })

  it('begrijpt grammen', () => {
    const [kwark] = parsePhrase(index, '200 gram magere kwark')
    expect(kwark.foodId).toBe('kwark')
    expect(kwark.grams).toBe(200)
    expect(kwark.kcal).toBe(114)
    expect(kwark.p).toBe(20)
  })

  it('begrijpt voedingsspecifieke porties', () => {
    const [bier] = parsePhrase(index, 'een flesje bier')
    expect(bier.foodId).toBe('bier')
    expect(bier.grams).toBe(300)

    const [chips] = parsePhrase(index, 'een handje chips')
    expect(chips.foodId).toBe('chips')
    expect(chips.grams).toBe(25)
  })

  it('begrijpt halve porties', () => {
    const [komkommer] = parsePhrase(index, 'een halve komkommer')
    expect(komkommer.foodId).toBe('komkommer')
    expect(komkommer.grams).toBe(150)

    const [melk] = parsePhrase(index, 'een half glas melk')
    expect(melk.foodId).toBe('halfvollemelk')
    expect(melk.grams).toBe(100)
  })

  it('splitst op komma en "en"', () => {
    const items = parsePhrase(index, 'een appel, een banaan en een kop koffie')
    expect(items.map((i) => i.foodId)).toEqual(['appel', 'banaan', 'koffiezwart'])
  })

  it('negeert vulwoorden', () => {
    const items = parsePhrase(index, 'ik heb vanmorgen nog een appel gegeten')
    expect(items).toHaveLength(1)
    expect(items[0].foodId).toBe('appel')
    expect(items[0].qty).toBe(1)
  })

  it('markeert onbekende producten als niet-herkend', () => {
    const items = parsePhrase(index, 'een bord bhorta')
    expect(items).toHaveLength(1)
    expect(items[0].resolved).toBe(false)
    expect(items[0].kcal).toBe(0)
  })

  it('herkent kleine spraakfouten (fuzzy)', () => {
    const items = parsePhrase(index, 'twee bitterkoekje')
    expect(items[0].foodId).toBe('bitterkoekje')
    expect(items[0].qty).toBe(2)
  })

  it('herkent samengestelde aliassen boven losse woorden', () => {
    const [tosti] = parsePhrase(index, 'een tosti ham kaas')
    expect(tosti.foodId).toBe('tostihamkaas')
  })

  it('waterijsje en een latte', () => {
    const items = parsePhrase(index, 'een waterijsje en een latte')
    expect(items.map((i) => i.foodId)).toEqual(['waterijsje', 'lattemacchiato'])
  })
})
