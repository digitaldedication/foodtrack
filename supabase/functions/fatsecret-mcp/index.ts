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
}

async function logItem(item: LogItem, datumDagen: number): Promise<string> {
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
      'Schrijf een of meer gegeten producten in het FatSecret-dagboek van de gebruiker. ' +
      'Splits een maaltijd in losse producten. BELANGRIJK: de database is Engelstalig — vertaal Nederlandse ' +
      'producten naar Engelse zoektermen ("hagelslag" → "chocolate sprinkles", "boterham volkoren" → ' +
      '"whole wheat bread", "kwark" → "quark"); merknamen onvertaald laten ("stroopwafel" en merken als ' +
      '"Daelmans" werken wel). Controleer bij twijfel eerst met zoek_product. ' +
      'Geef gram op als de gebruiker een hoeveelheid noemt, anders aantal (standaard 1).',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              zoekterm: { type: 'string', description: 'productnaam om op te zoeken' },
              gram: { type: 'number', description: 'gewicht in grammen (optioneel)' },
              aantal: { type: 'number', description: 'aantal porties/stuks (standaard 1)' },
              maaltijd: { type: 'string', enum: ['ontbijt', 'lunch', 'diner', 'snack'] }
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
    const resultaten: string[] = []
    for (const item of items) {
      try {
        resultaten.push(await logItem(item, d))
      } catch (err) {
        resultaten.push(`"${item.zoekterm}": mislukt — ${String(err)}`)
      }
    }
    return `Gelogd in FatSecret:\n${resultaten.map((r) => `• ${r}`).join('\n')}`
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  const mcpKey = Deno.env.get('MCP_KEY') ?? ''
  const geleverd = url.searchParams.get('key') ?? (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!mcpKey || geleverd !== mcpKey) {
    return new Response(JSON.stringify({ error: 'ongeldige sleutel' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  if (req.method === 'GET') {
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
