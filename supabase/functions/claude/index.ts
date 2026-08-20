// FoodTrack — Claude-chat als Supabase Edge Function.
// De Anthropic API-key blijft hier server-side (secret ANTHROPIC_API_KEY);
// de browser praat alleen met deze functie, met een ingelogde Supabase-sessie.
//
// Deploy:  supabase functions deploy claude
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Model:   optioneel CLAUDE_MODEL (standaard claude-opus-5)

import Anthropic from 'npm:@anthropic-ai/sdk'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod'
import { z } from 'npm:zod@3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const Item = z.object({
  name: z.string(),
  grams: z.number(),
  kcal: z.number(),
  eiwit: z.number(),
  koolhydraten: z.number(),
  vet: z.number()
})

const Antwoord = z.object({
  reply: z.string(),
  log: z
    .object({
      when: z.string().nullable(),
      items: z.array(Item)
    })
    .nullable()
})

const SYSTEM = `Je bent de voedingsassistent van FoodTrack, een Nederlandse calorie-tracker.
De gebruiker vertelt in spreektaal wat hij of zij gegeten heeft, stelt vragen over
de dag, of wil iets aanpassen.

Regels:
- Als het bericht (deels) een voedselinvoer is: vul "log" met de items. Schat per
  item het gewicht in grammen op basis van gangbare Nederlandse porties, en de
  kcal/eiwit/koolhydraten/vet voor dat gewicht (NEVO/Voedingscentrum-achtige
  waarden). Herken ook merkproducten en maaltijdboxen.
- "when": ISO 8601-tijdstip als de gebruiker een moment noemt ("gisteren om
  13:00", "vanmorgen"), anders null (= nu). Gebruik de meegegeven lokale tijd
  en tijdzone als referentie.
- Als het bericht geen voedselinvoer is: "log" = null en beantwoord de vraag in
  "reply" op basis van de meegegeven context (doelen, totalen, recente
  loggings).
- "reply" is altijd een kort, vriendelijk Nederlands antwoord. Noem bij een
  logging de belangrijkste getallen (totaal kcal, en hoeveel er vandaag nog te
  gaan is als dat uit de context blijkt).
- Geen medisch advies; verwijs bij gezondheidsvragen naar een professional.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    // Alleen ingelogde gebruikers — het anon-key-JWT alleen is niet genoeg.
    const authHeader = req.headers.get('Authorization') ?? ''
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: userData, error: userError } = await supa.auth.getUser()
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Niet ingelogd' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { messages, context } = await req.json()
    const history = (Array.isArray(messages) ? messages : [])
      .slice(-12)
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const response = await client.messages.parse({
      model: Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5',
      max_tokens: 4096,
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Context van de gebruiker (JSON): ${JSON.stringify(context ?? {})}` }
      ],
      messages: history,
      output_config: { format: zodOutputFormat(Antwoord) }
    })

    const parsed = response.parsed_output
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Geen geldig antwoord van Claude' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
