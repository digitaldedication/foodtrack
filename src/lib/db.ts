import baseDb from '../data/foods.json'
import type { Food, FoodDb } from '../types'
import { FoodIndex } from './parser'

let index: FoodIndex | null = null
let foods: Food[] = []

/**
 * The base database ships with the app bundle. `data/foods-extra.json` is a
 * separate asset that the Claude GitHub Action extends with newly learned
 * foods, so the app picks those up without a full redeploy (network-first).
 */
export async function loadFoodIndex(): Promise<FoodIndex> {
  if (index) return index
  foods = [...(baseDb as FoodDb).foods]
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/foods-extra.json`, { cache: 'no-cache' })
    if (res.ok) {
      const extra = (await res.json()) as FoodDb
      const known = new Set(foods.map((f) => f.id))
      for (const f of extra.foods) {
        if (!known.has(f.id)) foods.push(f)
      }
    }
  } catch {
    // Offline or not yet published — the base database is enough.
  }
  index = new FoodIndex(foods)
  return index
}

export function allFoods(): Food[] {
  return foods
}
