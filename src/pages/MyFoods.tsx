import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { registerLearnedFood, removeLearnedFood } from '../lib/db'
import { useLearnedFoods } from '../lib/store'
import type { Food } from '../types'

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

interface FormState {
  naam: string
  portieNaam: string
  portieGram: string
  kcal: string
  eiwit: string
  koolh: string
  vet: string
  aliassen: string
}

const LEEG: FormState = { naam: '', portieNaam: 'portie', portieGram: '', kcal: '', eiwit: '', koolh: '', vet: '', aliassen: '' }

export default function MyFoods() {
  const [params] = useSearchParams()
  const foods = useLearnedFoods()
  const [form, setForm] = useState<FormState>({ ...LEEG, naam: params.get('naam') ?? '' })
  const [bewaard, setBewaard] = useState<string | null>(null)

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const num = (s: string) => parseFloat(s.replace(',', '.')) || 0

  const opslaan = () => {
    const naam = form.naam.trim()
    const gram = num(form.portieGram) || 100
    const kcal = num(form.kcal)
    if (!naam || kcal <= 0) return
    // Waarden worden per portie ingevuld en per 100 g opgeslagen.
    const factor = 100 / gram
    const aliassen = form.aliassen.split(',').map((a) => a.trim()).filter(Boolean)
    const food: Food = {
      id: `eigen-${slug(naam)}`,
      name: naam,
      cat: 'eigen',
      aliases: aliassen,
      per100: {
        kcal: Math.round(kcal * factor * 10) / 10,
        p: Math.round(num(form.eiwit) * factor * 10) / 10,
        c: Math.round(num(form.koolh) * factor * 10) / 10,
        f: Math.round(num(form.vet) * factor * 10) / 10
      },
      portions: [{ n: form.portieNaam.trim() || 'portie', g: gram, a: ['portie', 'stuk', 'stuks', 'maaltijd', 'verpakking', 'bakje', 'zakje'] }]
    }
    registerLearnedFood(food)
    setForm({ ...LEEG })
    setBewaard(naam)
  }

  const eigen = foods.filter((f) => f.cat === 'eigen')
  const geleerd = foods.filter((f) => f.cat !== 'eigen')

  return (
    <>
      <header className="app-header">
        <h1>Mijn producten</h1>
      </header>

      {bewaard && (
        <div className="card" role="status">
          “{bewaard}” opgeslagen. Zeg of typ voortaan gewoon de naam en ik herken hem.
        </div>
      )}

      <div className="card">
        <div className="veld">
          <label htmlFor="mp-naam">Naam (zoals je het uitspreekt)</label>
          <input id="mp-naam" type="text" placeholder="Muscle Meat gnocchi maaltijd" value={form.naam} onChange={set('naam')} />
        </div>
        <div className="veld-rij">
          <div className="veld">
            <label htmlFor="mp-portienaam">Portienaam</label>
            <input id="mp-portienaam" type="text" placeholder="maaltijd" value={form.portieNaam} onChange={set('portieNaam')} />
          </div>
          <div className="veld">
            <label htmlFor="mp-gram">Portie (gram)</label>
            <input id="mp-gram" type="number" inputMode="decimal" placeholder="450" value={form.portieGram} onChange={set('portieGram')} />
          </div>
        </div>
        <div className="veld-rij">
          <div className="veld">
            <label htmlFor="mp-kcal">kcal per portie</label>
            <input id="mp-kcal" type="number" inputMode="decimal" placeholder="550" value={form.kcal} onChange={set('kcal')} />
          </div>
          <div className="veld">
            <label htmlFor="mp-eiwit">Eiwit (g)</label>
            <input id="mp-eiwit" type="number" inputMode="decimal" placeholder="45" value={form.eiwit} onChange={set('eiwit')} />
          </div>
        </div>
        <div className="veld-rij">
          <div className="veld">
            <label htmlFor="mp-koolh">Koolhydraten (g)</label>
            <input id="mp-koolh" type="number" inputMode="decimal" placeholder="60" value={form.koolh} onChange={set('koolh')} />
          </div>
          <div className="veld">
            <label htmlFor="mp-vet">Vet (g)</label>
            <input id="mp-vet" type="number" inputMode="decimal" placeholder="12" value={form.vet} onChange={set('vet')} />
          </div>
        </div>
        <div className="veld">
          <label htmlFor="mp-alias">Ook herkennen als (komma-gescheiden, optioneel)</label>
          <input id="mp-alias" type="text" placeholder="gnocchi maaltijd, muscle meat gnocchi" value={form.aliassen} onChange={set('aliassen')} />
        </div>
        <button className="knop" onClick={opslaan} disabled={!form.naam.trim() || !num(form.kcal)}>
          Opslaan
        </button>
      </div>

      {eigen.length > 0 && (
        <>
          <h2 className="sectie-kop">Zelf toegevoegd</h2>
          <div className="card" style={{ padding: '6px 16px' }}>
            {eigen.map((f) => (
              <FoodRij key={f.id} food={f} />
            ))}
          </div>
        </>
      )}

      {geleerd.length > 0 && (
        <>
          <h2 className="sectie-kop">Automatisch geleerd (Open Food Facts)</h2>
          <div className="card" style={{ padding: '6px 16px' }}>
            {geleerd.map((f) => (
              <FoodRij key={f.id} food={f} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function FoodRij({ food }: { food: Food }) {
  const portie = food.portions[0]
  const kcalPortie = Math.round((food.per100.kcal * portie.g) / 100)
  return (
    <div className="hist-dag" style={{ gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{food.name}</div>
        <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
          {portie.n} ({portie.g} g) · {kcalPortie} kcal · e {Math.round((food.per100.p * portie.g) / 100)} · k{' '}
          {Math.round((food.per100.c * portie.g) / 100)} · v {Math.round((food.per100.f * portie.g) / 100)}
        </div>
      </div>
      <button
        className="knop gevaar klein"
        onClick={() => {
          if (confirm(`“${food.name}” verwijderen?`)) removeLearnedFood(food.id)
        }}
      >
        Weg
      </button>
    </div>
  )
}
