import baseDb from '../data/foods.json'
import type { Food, FoodDb } from '../types'
import { FoodIndex } from './parser'
import { deleteLearnedFood, getLearnedFoods, saveLearnedFood } from './store'

let index: FoodIndex | null = null
let foods: Food[] = []

/**
 * Three layers of foods feed the parser index:
 * 1. de basisdatabase in de bundel;
 * 2. `data/foods-extra.json`, door de Claude GitHub Action aangevuld
 *    (network-first, dus zonder volledige redeploy opgepikt);
 * 3. producten die de app zelf heeft geleerd via Open Food Facts.
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
    // Offline of nog niet gepubliceerd — de basisdatabase volstaat.
  }
  const ids = new Set(foods.map((f) => f.id))
  for (const f of getLearnedFoods()) {
    if (!ids.has(f.id)) foods.push(f)
  }
  index = new FoodIndex(foods)
  return index
}

/** Persist a runtime-matched or user-defined product and make it matchable immediately. */
export function registerLearnedFood(food: Food) {
  saveLearnedFood(food)
  if (index) {
    if (foods.some((f) => f.id === food.id)) {
      foods = foods.filter((f) => f.id !== food.id)
      index.removeFood(food.id)
    }
    foods.push(food)
    index.add(food)
  }
}

/** Remove a learned/user-defined product from storage and the live index. */
export function removeLearnedFood(foodId: string) {
  deleteLearnedFood(foodId)
  foods = foods.filter((f) => f.id !== foodId)
  index?.removeFood(foodId)
}

export function allFoods(): Food[] {
  return foods
}
