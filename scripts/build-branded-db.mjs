#!/usr/bin/env node
/**
 * Haalt de populairste Nederlandse producten (met merknamen) op uit Open Food
 * Facts en schrijft ze als compacte dataset naar public/data/foods-branded.json.
 * De app gebruikt dit als tweede laag naast de basisdatabase; wat hier niet in
 * zit wordt live via de Open Food Facts API opgezocht.
 *
 * Draaien: node scripts/build-branded-db.mjs [aantal-paginas]
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PAGES = Number(process.argv[2] ?? 100)
const PAGE_SIZE = 100
const UA = 'FoodTrack/0.1 (github.com/digitaldedication/foodtrack)'

const FIELDS = [
  'product_name',
  'product_name_nl',
  'brands',
  'nutriments',
  'serving_quantity',
  'serving_size',
  'unique_scans_n'
].join(',')

function searchUrl(page) {
  const p = new URLSearchParams({
    action: 'process',
    tagtype_0: 'countries',
    tag_contains_0: 'contains',
    tag_0: 'netherlands',
    sort_by: 'unique_scans_n',
    page_size: String(PAGE_SIZE),
    page: String(page),
    json: '1',
    fields: FIELDS
  })
  return `https://nl.openfoodfacts.org/cgi/search.pl?${p.toString()}`
}

function round1(x) {
  return Math.round(x * 10) / 10
}

function parseServingGrams(product) {
  const q = Number(product.serving_quantity)
  if (Number.isFinite(q) && q > 0 && q <= 2000) return Math.round(q)
  const m = /([\d.,]+)\s*(g|gr|gram|ml)/i.exec(product.serving_size ?? '')
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'))
    if (Number.isFinite(v) && v > 0 && v <= 2000) return Math.round(v)
  }
  return null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const seen = new Set()
const products = []

for (let page = 1; page <= PAGES; page++) {
  process.stderr.write(`pagina ${page}/${PAGES}…\n`)
  // curl in plaats van fetch: dat respecteert HTTPS_PROXY-omgevingen. Bij een
  // HTML-foutpagina (rate limit) wachten we even en proberen we opnieuw.
  let data = null
  for (let attempt = 1; attempt <= 4 && !data; attempt++) {
    const raw = execFileSync('curl', ['-sS', '-m', '120', '-H', `User-Agent: ${UA}`, searchUrl(page)], {
      maxBuffer: 256 * 1024 * 1024
    }).toString('utf-8')
    try {
      data = JSON.parse(raw)
    } catch {
      process.stderr.write(`  pagina ${page}: geen JSON (poging ${attempt}), wacht 30s…\n`)
      await sleep(30000)
    }
  }
  if (!data) throw new Error(`pagina ${page} bleef falen`)
  for (const prod of data.products ?? []) {
    const name = (prod.product_name_nl || prod.product_name || '').trim()
    if (!name || name.length < 3) continue
    const nut = prod.nutriments ?? {}
    const k = nut['energy-kcal_100g']
    const p = nut.proteins_100g
    const c = nut.carbohydrates_100g
    const f = nut.fat_100g
    if (![k, p, c, f].every((v) => typeof v === 'number' && Number.isFinite(v))) continue
    if (k < 0 || k > 950 || p < 0 || c < 0 || f < 0) continue
    const brand = (prod.brands || '').split(',')[0].trim()
    const key = `${name.toLowerCase()}|${brand.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const entry = { n: name, k: Math.round(k), p: round1(p), c: round1(c), f: round1(f) }
    if (brand) entry.b = brand
    const s = parseServingGrams(prod)
    if (s) entry.s = s
    products.push(entry)
  }
  // Open Food Facts vraagt max ~10 zoekopdrachten per minuut.
  if (page < PAGES) await sleep(12000)
}

const out = {
  version: 1,
  updated: new Date().toISOString().slice(0, 10),
  source: 'Open Food Facts (ODbL) — https://openfoodfacts.org',
  products
}

writeFileSync('public/data/foods-branded.json', JSON.stringify(out))
process.stderr.write(`klaar: ${products.length} producten\n`)
