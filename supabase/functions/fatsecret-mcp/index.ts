// FoodTrack — FatSecret-connector voor de Claude-app (MCP over Streamable HTTP).
//
// Voeg deze functie in de Claude-app toe als custom connector; daarna kun je
// tegen Claude zeggen wat je gegeten hebt en schrijft Claude het rechtstreeks
// in je FatSecret-dagboek. Draait volledig op je Claude-abonnement.
//
// Vereiste secrets (Supabase → Edge Functions → Secrets):
//   FATSECRET_CONSUMER_KEY     – OAuth 1.0 Consumer Key
//   FATSECRET_CONSUMER_SECRET  – OAuth 1.0 Consumer/Shared Secret
//   FATSECRET_ACCESS_TOKEN     – gebruikers-token uit de eenmalige koppeling
//   FATSECRET_ACCESS_SECRET    – bijbehorend token-secret
//   MCP_KEY                    – zelfgekozen lange willekeurige sleutel; de
//                                connector-URL wordt …/fatsecret-mcp?key=<MCP_KEY>
//
// Belangrijk: zet bij deze functie "Enforce JWT verification" UIT (de
// Claude-app heeft geen Supabase-login); de MCP_KEY beschermt de endpoint.

const API_URL = 'https://platform.fatsecret.com/rest/server.api'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, mcp-protocol-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

// ---------- OAuth 1.0-signing (HMAC-SHA1) ----------

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

async function hmacSha1(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function fatsecret(params: Record<string, string>): Promise<Record<string, unknown>> {
  const p: Record<string, string> = {
    ...params,
    format: 'json',
    oauth_consumer_key: Deno.env.get('FATSECRET_CONSUMER_KEY') ?? '',
    oauth_token: Deno.env.get('FATSECRET_ACCESS_TOKEN') ?? '',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_nonce: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    oauth_version: '1.0'
  }
  const paramString = Object.keys(p).sort().map((k) => `${pct(k)}=${pct(p[k])}`).join('&')
  const base = ['GET', pct(API_URL), pct(paramString)].join('&')
  const key = `${pct(Deno.env.get('FATSECRET_CONSUMER_SECRET') ?? '')}&${pct(Deno.env.get('FATSECRET_ACCESS_SECRET') ?? '')}`
  const signature = await hmacSha1(key, base)
  const url = `${API_URL}?${paramString}&oauth_signature=${pct(signature)}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) throw new Error(`FatSecret-fout ${data.error.code}: ${data.error.message}`)
  return data
}

// ---------- FatSecret-hulpjes ----------

/** FatSecret gebruikt dagen sinds 1 jan 1970 als datum. */
function dagen(datum?: string): number {
  if (datum && /^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    const [y, m, d] = datum.split('-').map(Number)
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
  }
  // "vandaag" in Nederlandse tijd
  const nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  return Math.floor(Date.UTC(nu.getFullYear(), nu.getMonth(), nu.getDate()) / 86400000)
}

const MAALTIJD: Record<string, string> = { ontbijt: 'breakfast', lunch: 'lunch', diner: 'dinner', snack: 'other' }

interface Serving {
  serving_id: string
  serving_description?: string
  metric_serving_amount?: string
  metric_serving_unit?: string
  calories?: string
}

function servings(food: Record<string, unknown>): Serving[] {
  const s = (food as { servings?: { serving: Serving | Serving[] } }).servings?.serving
  return Array.isArray(s) ? s : s ? [s] : []
}

async function zoekEten(zoekterm: string): Promise<Array<Record<string, unknown>>> {
  let data: Record<string, unknown>
  try {
    data = await fatsecret({ method: 'foods.search', search_expression: zoekterm, max_results: '5', region: 'NL', language: 'nl' })
  } catch {
    // localization-scope kan ontbreken — probeer zonder regiofilter
    data = await fatsecret({ method: 'foods.search', search_expression: zoekterm, max_results: '5' })
  }
  const foods = (data as { foods?: { food?: unknown } }).foods?.food
  return (Array.isArray(foods) ? foods : foods ? [foods] : []) as Array<Record<string, unknown>>
}

interface LogItem {
  zoekterm: string
  gram?: number
  aantal?: number
  maaltijd: string
  /** Alleen true als de gebruiker expliciet akkoord is met een database-product. */
  sta_database_toe?: boolean
}

// ---------- eigen producten (recent gegeten + favorieten) ----------
// De gratis API-editie zoekt alleen in de wereldwijde database, maar de
// producten die de gebruiker zelf in de FatSecret-app gebruikt (incl. NL-
// merken als AH en Zuivelhoeve) zijn wél bereikbaar via deze user-scoped
// endpoints — inclusief food_id + serving_id om direct mee te loggen.

interface EigenProduct {
  food_id: string
  serving_id: string
  food_name: string
  brand_name?: string
  food_url?: string
  /** De portie die de gebruiker zelf bij dit product heeft ingesteld. */
  number_of_units?: string
  favoriet?: boolean
}

interface Catalogus {
  favorieten: EigenProduct[]
  recent: EigenProduct[]
}

async function haalLijst(methode: string): Promise<EigenProduct[]> {
  try {
    const data = await fatsecret({ method: methode })
    const raw = (data as { foods?: { food?: unknown } }).foods?.food
    const lijst = (Array.isArray(raw) ? raw : raw ? [raw] : []) as EigenProduct[]
    return lijst.filter((f) => f.food_id && f.serving_id)
  } catch {
    return []
  }
}

/**
 * Favorieten zijn de betrouwbare bron: die heeft de gebruiker zelf gekozen,
 * met de juiste portie. "Recent gegeten" is afgeleid van het dagboek en kan
 * dus ook eerdere misgrepen bevatten — daarom een aparte, lagere laag.
 */
async function eigenProducten(): Promise<Catalogus> {
  const [fav, rec] = await Promise.all([haalLijst('foods.get_favorites'), haalLijst('foods.get_recently_eaten')])
  const favIds = new Set(fav.map((f) => f.food_id))
  return {
    favorieten: fav.map((f) => ({ ...f, favoriet: true })),
    recent: rec.filter((f) => !favIds.has(f.food_id))
  }
}

function normTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1)
}

function matchEigen(producten: EigenProduct[], zoekterm: string): EigenProduct | null {
  const query = normTokens(zoekterm)
  if (query.length === 0) return null
  let best: { p: EigenProduct; score: number; size: number } | null = null
  for (const p of producten) {
    const doel = normTokens(`${p.food_name} ${p.brand_name ?? ''}`)
    let geraakt = 0
    let score = 0
    for (const q of query) {
      // Exacte woordmatch weegt zwaarder dan een gedeeltelijke ("chocomel"
      // moet Chocomel verslaan, niet blijven hangen op "choco…" in een reep).
      if (doel.includes(q)) {
        geraakt++
        score += 2
      } else if (doel.some((d) => (q.length >= 4 && d.startsWith(q)) || (d.length >= 4 && q.startsWith(d)))) {
        geraakt++
        score += 1
      }
    }
    const nodig = query.length <= 2 ? query.length : Math.ceil(query.length * 0.6)
    if (geraakt < nodig) continue
    if (!best || score > best.score || (score === best.score && doel.length < best.size)) {
      best = { p, score, size: doel.length }
    }
  }
  return best?.p ?? null
}

/** Zoek de kcal van een zojuist aangemaakte entry op (voor de bevestiging). */
async function entryKcal(entryId: string, datumDagen: number): Promise<number | null> {
  try {
    const data = await fatsecret({ method: 'food_entries.get.v2', date: String(datumDagen) })
    const raw = (data as { food_entries?: { food_entry?: unknown } }).food_entries?.food_entry
    const entries = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Array<Record<string, string>>
    const eigen = entries.find((e) => e.food_entry_id === entryId)
    return eigen ? Math.round(Number(eigen.calories)) : null
  } catch {
    return null
  }
}

async function logItem(item: LogItem, datumDagen: number, catalogus: Catalogus): Promise<string> {
  // Laag 1: favorieten (door de gebruiker zelf ingesteld, mét juiste portie),
  // pas daarna de recent-gegeten lijst.
  const eigen = matchEigen(catalogus.favorieten, item.zoekterm) ?? matchEigen(catalogus.recent, item.zoekterm)
  if (eigen) {
    // De opgeslagen portie van de gebruiker is de standaard — die wordt nooit
    // "opnieuw verzonnen". Alleen een expliciet aantal of gewicht wijkt af.
    const eigenPortie = Number(eigen.number_of_units)
    const basis = Number.isFinite(eigenPortie) && eigenPortie > 0 ? eigenPortie : 1
    let units = basis * (item.aantal ?? 1)
    let portieUitleg = item.aantal && item.aantal !== 1 ? `${item.aantal} × jouw portie` : 'jouw ingestelde portie'
    if (item.gram && item.gram > 0 && (eigen.food_url ?? '').endsWith('/100g')) {
      units = item.gram / 100
      portieUitleg = `${item.gram} g`
    }
    units = Math.round(units * 1000) / 1000

    const naam = eigen.brand_name ? `${eigen.brand_name} ${eigen.food_name}` : eigen.food_name
    const made = await fatsecret({
      method: 'food_entry.create',
      food_id: eigen.food_id,
      food_entry_name: naam.slice(0, 120),
      serving_id: eigen.serving_id,
      number_of_units: String(units),
      meal: MAALTIJD[item.maaltijd] ?? 'other',
      date: String(datumDagen)
    })
    const entryId = ((made as { food_entry_id?: { value?: string } }).food_entry_id ?? {}).value
    const kcal = entryId ? await entryKcal(entryId, datumDagen) : null
    const bron = eigen.favoriet ? 'favoriet' : 'recent gegeten'
    return `${naam} — ${portieUitleg}${kcal !== null ? ` = ${kcal} kcal` : ''} [${bron}]`
  }

  // Geen eigen product: NIET blind iets uit de Engelstalige database loggen.
  // Eerst terugmelden, zodat de gebruiker kan kiezen of bevestigen.
  if (!item.sta_database_toe) {
    const suggesties = await zoekEten(item.zoekterm)
    const opties = suggesties
      .slice(0, 3)
      .map((f) => {
        const x = f as { food_name: string; brand_name?: string }
        return `${x.brand_name ? `${x.brand_name} ` : ''}${x.food_name}`
      })
      .join('; ')
    return (
      `"${item.zoekterm}": NIET gelogd — staat niet bij je eigen producten. ` +
      (opties
        ? `Uit de (Engelstalige) database zou dit passen: ${opties}. Vraag de gebruiker of dat klopt, en log ` +
          `dan opnieuw met sta_database_toe=true. `
        : 'Ook niets gevonden in de database. ') +
      'Beter: laat de gebruiker dit product één keer in de FatSecret-app loggen en op favoriet zetten.'
    )
  }

  // Laag 2: wereldwijde database (alleen na expliciete toestemming)
  const kandidaten = await zoekEten(item.zoekterm)
  if (kandidaten.length === 0) return `"${item.zoekterm}": niets gevonden in FatSecret`

  const gekozen = kandidaten[0] as { food_id: string; food_name: string; brand_name?: string }
  const detail = await fatsecret({ method: 'food.get.v4', food_id: gekozen.food_id })
  const alleServings = servings((detail as { food: Record<string, unknown> }).food)
  if (alleServings.length === 0) return `"${item.zoekterm}": geen portie-informatie`

  // Bij grammen: reken via de 100g-portie als die er is; anders eerste portie × aantal.
  let serving = alleServings[0]
  let units = item.aantal ?? 1
  if (item.gram && item.gram > 0) {
    const per100 = alleServings.find((s) => s.metric_serving_unit === 'g' && Number(s.metric_serving_amount) === 100)
    if (per100) {
      serving = per100
      units = item.gram / 100
    } else if (serving.metric_serving_unit === 'g' && Number(serving.metric_serving_amount) > 0) {
      units = item.gram / Number(serving.metric_serving_amount)
    }
  }
  units = Math.round(units * 100) / 100

  await fatsecret({
    method: 'food_entry.create',
    food_id: gekozen.food_id,
    food_entry_name: `${gekozen.food_name}`.slice(0, 120),
    serving_id: serving.serving_id,
    number_of_units: String(units),
    meal: MAALTIJD[item.maaltijd] ?? 'other',
    date: String(datumDagen)
  })

  const kcal = serving.calories ? Math.round(Number(serving.calories) * units) : null
  const naam = gekozen.brand_name ? `${gekozen.food_name} (${gekozen.brand_name})` : gekozen.food_name
  return `${naam}: ${units} × ${serving.serving_description ?? 'portie'}${kcal !== null ? ` ≈ ${kcal} kcal` : ''}`
}

// ---------- MCP-tools ----------

const TOOLS = [
  {
    name: 'log_eten',
    description:
      'Schrijf gegeten producten in het FatSecret-dagboek. Splits een maaltijd in losse producten en ' +
      'gebruik als zoekterm de naam zoals de gebruiker hem zegt, in het Nederlands ("AH eiwitrijk ' +
      'flatbread", "zuivelhoeve yoghurt") — laat vulwoorden weg. ' +
      'PORTIES: laat "aantal" leeg tenzij de gebruiker een aantal noemt; de eigen standaardportie van de ' +
      'gebruiker wordt dan automatisch gebruikt. Verzin NOOIT zelf grammen — geef "gram" alleen door als ' +
      'de gebruiker dat letterlijk zegt. ' +
      'Producten die niet bij de eigen producten van de gebruiker staan worden NIET gelogd; je krijgt dan ' +
      'suggesties terug. Leg die aan de gebruiker voor en log pas opnieuw met sta_database_toe=true als ' +
      'die akkoord is (die producten komen uit een Engelstalige database en kunnen afwijken).',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              zoekterm: { type: 'string', description: 'productnaam zoals de gebruiker hem noemt (Nederlands)' },
              gram: { type: 'number', description: 'ALLEEN als de gebruiker zelf grammen noemt' },
              aantal: { type: 'number', description: 'aantal keer de eigen standaardportie; weglaten = 1' },
              maaltijd: { type: 'string', enum: ['ontbijt', 'lunch', 'diner', 'snack'] },
              sta_database_toe: {
                type: 'boolean',
                description: 'alleen true na expliciet akkoord van de gebruiker op een database-suggestie'
              }
            },
            required: ['zoekterm', 'maaltijd']
          }
        },
        datum: { type: 'string', description: 'YYYY-MM-DD; weglaten voor vandaag' }
      },
      required: ['items']
    }
  },
  {
    name: 'dag_overzicht',
    description: 'Haal alle dagboek-items en het calorietotaal van een dag op uit FatSecret.',
    inputSchema: {
      type: 'object',
      properties: { datum: { type: 'string', description: 'YYYY-MM-DD; weglaten voor vandaag' } }
    }
  },
  {
    name: 'verwijder_entry',
    description: 'Verwijder één dagboek-item uit FatSecret (food_entry_id uit dag_overzicht).',
    inputSchema: {
      type: 'object',
      properties: { food_entry_id: { type: 'string' } },
      required: ['food_entry_id']
    }
  },
  {
    name: 'mijn_producten',
    description:
      'Toon de eigen producten van de gebruiker met hun ingestelde standaardporties: eerst de favorieten ' +
      '(betrouwbaar), daarna recent gegeten. Raadpleeg dit bij twijfel over welk product bedoeld wordt.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'zoek_product',
    description: 'Zoek producten in de FatSecret-database zonder te loggen (om een match te controleren).',
    inputSchema: {
      type: 'object',
      properties: { zoekterm: { type: 'string' } },
      required: ['zoekterm']
    }
  }
]

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === 'log_eten') {
    const items = (args.items ?? []) as LogItem[]
    const d = dagen(args.datum as string | undefined)
    const catalogus = await eigenProducten()
    const resultaten: string[] = []
    for (const item of items) {
      try {
        resultaten.push(await logItem(item, d, catalogus))
      } catch (err) {
        resultaten.push(`"${item.zoekterm}": mislukt — ${String(err)}`)
      }
    }
    return `Gelogd in FatSecret:\n${resultaten.map((r) => `• ${r}`).join('\n')}`
  }

  if (name === 'mijn_producten') {
    const { favorieten, recent } = await eigenProducten()
    if (favorieten.length === 0 && recent.length === 0) return 'Nog geen eigen producten gevonden.'
    const toon = (p: EigenProduct) => {
      const portie = Number(p.number_of_units)
      const per100 = (p.food_url ?? '').endsWith('/100g')
      const eenheid = Number.isFinite(portie) && portie > 0 ? (per100 ? `${Math.round(portie * 100)} g` : `${portie} portie(s)`) : 'onbekend'
      return `• ${p.brand_name ? `${p.brand_name} ` : ''}${p.food_name} — standaardportie: ${eenheid}`
    }
    const delen = [`FAVORIETEN (betrouwbaar, met jouw eigen porties):\n${favorieten.map(toon).join('\n')}`]
    if (recent.length > 0) {
      delen.push(`\nRECENT GEGETEN (kan onjuiste eerdere keuzes bevatten):\n${recent.map(toon).join('\n')}`)
    }
    return delen.join('\n')
  }

  if (name === 'dag_overzicht') {
    const data = await fatsecret({ method: 'food_entries.get.v2', date: String(dagen(args.datum as string | undefined)) })
    const raw = (data as { food_entries?: { food_entry?: unknown } }).food_entries?.food_entry
    const entries = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Array<Record<string, string>>
    if (entries.length === 0) return 'Geen dagboek-items op deze dag.'
    let totaal = 0
    const regels = entries.map((e) => {
      totaal += Number(e.calories) || 0
      return `• [${e.meal}] ${e.food_entry_name} — ${e.calories} kcal (id ${e.food_entry_id})`
    })
    return `${regels.join('\n')}\nTotaal: ${Math.round(totaal)} kcal`
  }

  if (name === 'verwijder_entry') {
    await fatsecret({ method: 'food_entry.delete', food_entry_id: String(args.food_entry_id) })
    return 'Item verwijderd.'
  }

  if (name === 'zoek_product') {
    const gevonden = await zoekEten(String(args.zoekterm))
    if (gevonden.length === 0) return 'Niets gevonden.'
    return gevonden
      .map((f) => {
        const x = f as { food_id: string; food_name: string; brand_name?: string; food_description?: string }
        return `• ${x.food_name}${x.brand_name ? ` (${x.brand_name})` : ''} [id ${x.food_id}] — ${x.food_description ?? ''}`
      })
      .join('\n')
  }

  throw new Error(`Onbekende tool: ${name}`)
}

// ---------- MCP over Streamable HTTP (stateless) ----------

function rpcResult(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}

function rpcError(id: unknown, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}


// ---------- Snel loggen via Siri (GET ?tekst=...) ----------
// Een Opdracht op de iPhone dicteert een zin en stuurt die hierheen. De zin
// wordt tegen de eigen producten gematcht en direct gelogd — zonder AI, dus
// altijd hetzelfde resultaat en met de porties van de gebruiker.

const TELWOORDEN: Record<string, number> = {
  een: 1, één: 1, eentje: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6,
  zeven: 7, acht: 8, negen: 9, tien: 10, half: 0.5, halve: 0.5, anderhalf: 1.5,
  anderhalve: 1.5, kwart: 0.25, paar: 2
}

const VULWOORDEN = new Set([
  'ik', 'heb', 'net', 'zojuist', 'gegeten', 'gedronken', 'gehad', 'genomen',
  'op', 'een', 'nog', 'ook', 'wat', 'van', 'de', 'het', 'mijn', 'normaal',
  'normale', 'gewoon', 'gewone', 'lekker', 'lekkere', 'stuks', 'stuk', 'x',
  'keer', 'portie', 'porties', 'vandaag', 'vanmorgen', 'vanmiddag', 'vanavond'
])

/** Bepaalt de maaltijd op basis van het huidige tijdstip in Nederland. */
function huidigeMaaltijd(): string {
  const uurTekst = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: 'numeric',
    hour12: false
  }).format(new Date())
  const uur = Number(uurTekst)
  if (uur < 11) return 'ontbijt'
  if (uur < 15) return 'lunch'
  if (uur >= 17 && uur < 22) return 'diner'
  return 'snack'
}

function parseZin(tekst: string): LogItem[] {
  const maaltijd = huidigeMaaltijd()
  const segmenten = tekst
    .toLowerCase()
    .split(/,| en | plus |\+/)
    .map((x) => x.trim())
    .filter(Boolean)

  const items: LogItem[] = []
  for (const seg of segmenten) {
    let aantal: number | undefined
    let gram: number | undefined
    const woorden: string[] = []

    for (const woord of seg.split(/\s+/)) {
      const gewicht = woord.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|gram|ml)$/)
      if (gewicht) {
        gram = parseFloat(gewicht[1].replace(',', '.'))
        continue
      }
      const getal = woord.match(/^(\d+(?:[.,]\d+)?)x?$/)
      if (getal) {
        aantal = parseFloat(getal[1].replace(',', '.'))
        continue
      }
      const kaal = woord.replace(/[^a-zà-ÿ0-9]/g, '')
      if (kaal in TELWOORDEN) {
        // "een" telt alleen als aantal wanneer er nog geen aantal staat.
        if (aantal === undefined) aantal = TELWOORDEN[kaal]
        continue
      }
      if (!VULWOORDEN.has(kaal) && kaal.length > 1) woorden.push(kaal)
    }

    const zoekterm = woorden.join(' ')
    if (zoekterm) items.push({ zoekterm, aantal, gram, maaltijd })
  }
  return items
}

async function snelLoggen(tekst: string): Promise<string> {
  const items = parseZin(tekst)
  if (items.length === 0) return 'Niets herkend om te loggen.'
  const catalogus = await eigenProducten()
  const d = dagen()
  const regels: string[] = []
  for (const item of items) {
    try {
      regels.push(await logItem(item, d, catalogus))
    } catch (err) {
      regels.push(`"${item.zoekterm}": mislukt — ${String(err)}`)
    }
  }
  const totaal = await dagTotaal(d)
  return `${regels.join('\n')}${totaal !== null ? `\n\nVandaag totaal: ${totaal} kcal` : ''}`
}

/** Calorietotaal van een dag (voor de bevestiging in de Opdracht). */
async function dagTotaal(datumDagen: number): Promise<number | null> {
  try {
    const data = await fatsecret({ method: 'food_entries.get.v2', date: String(datumDagen) })
    const raw = (data as { food_entries?: { food_entry?: unknown } }).food_entries?.food_entry
    const entries = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Array<Record<string, string>>
    return Math.round(entries.reduce((s, e) => s + (Number(e.calories) || 0), 0))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const mcpKey = Deno.env.get('MCP_KEY') ?? ''
  const geleverd = url.searchParams.get('key') ?? (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!mcpKey || geleverd !== mcpKey) {
    return new Response(JSON.stringify({ error: 'ongeldige sleutel' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (req.method === 'GET') {
    // Snel loggen vanuit een iPhone-opdracht: ?tekst=twee%20flatbread
    const tekst = url.searchParams.get('tekst')
    if (tekst) {
      try {
        const antwoord = await snelLoggen(tekst)
        return new Response(antwoord, { headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } })
      } catch (err) {
        return new Response(`Mislukt: ${String(err)}`, {
          status: 500,
          headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' }
        })
      }
    }
    // Geen server-initiated stream nodig; de spec staat 405 toe.
    return new Response(null, { status: 405, headers: CORS })
  }

  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }
  try {
    msg = await req.json()
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  const { id, method, params } = msg

  // Notificaties (geen id) → 202 zonder body
  if (id === undefined || id === null) {
    return new Response(null, { status: 202, headers: CORS })
  }

  try {
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: (params?.protocolVersion as string) ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'foodtrack-fatsecret', version: '1.0.0' }
        })
      case 'ping':
        return rpcResult(id, {})
      case 'tools/list':
        return rpcResult(id, { tools: TOOLS })
      case 'tools/call': {
        const name = params?.name as string
        const args = (params?.arguments ?? {}) as Record<string, unknown>
        try {
          const tekst = await runTool(name, args)
          return rpcResult(id, { content: [{ type: 'text', text: tekst }], isError: false })
        } catch (err) {
          return rpcResult(id, { content: [{ type: 'text', text: String(err) }], isError: true })
        }
      }
      default:
        return rpcError(id, -32601, `Methode niet ondersteund: ${method}`)
    }
  } catch (err) {
    return rpcError(id, -32603, String(err))
  }
})
