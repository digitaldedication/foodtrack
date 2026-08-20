# FoodTrack 🎙️🥗

Eten loggen met je stem. Je zegt tegen Siri wat je gegeten hebt — *"twee
bitterkoekjes en een boterham met pindakaas"* — en FoodTrack rekent uit hoeveel
calorieën, eiwitten, koolhydraten en vetten dat zijn en telt het bij je dag op.

- **PWA op GitHub Pages** — geen server, geen kosten. Je gegevens staan alleen
  op je eigen telefoon (localStorage).
- **Nederlandse voedingsdatabase** — ±200 basisproducten met NEVO-achtige
  waarden, porties ("handje", "opscheplepel", "flesje") en spreektaal-aliassen.
- **Merkproducten via Open Food Facts** — de top ±10.000 Nederlandse producten
  (Unox, Optimel, Calvé, AH-huismerk, …) zitten gebundeld in de app; alles wat
  daar niet in zit wordt live opgezocht in de volledige Open Food
  Facts-database (2M+ producten) en daarna lokaal onthouden.
- **Slimme parser** — begrijpt telwoorden ("twee", "anderhalve"), grammen
  ("200 gram kwark"), porties ("een halve zak chips") en samenstellingen
  ("boterham met pindakaas" = brood + beleg).
- **Zelflerend via Claude** — een onbekend product wordt met één tik een
  GitHub-issue; Claude zoekt de voedingswaarden op en voegt het product
  automatisch toe aan de database.
- **Eigen producten & maaltijden** — voeg zelf een maaltijd toe (bijv.
  "Muscle Meat gnocchi maaltijd" met kcal en macro's per portie); de app
  onthoudt hem en herkent hem voortaan ook via Siri en chat.
- **Chat-invoer** — typ of praat in een chatscherm: loggen met tijd ("gisteren
  om 13:00 een muscle meat gnocchi"), status opvragen ("hoeveel kcal heb ik
  nog?"), dagoverzicht en ongedaan maken. Ook te openen via een eigen
  Shortcut met gedicteerde tekst (`#/chat?text=…`).
- **Doelen** — caloriedoel en macroverdeling (eiwit/koolhydraten/vet) instelbaar.
- **Apple Health** — optioneel worden loggings via een Shortcut ook in de
  Gezondheid-app gezet.

## Eenmalige installatie

### 1. GitHub Pages aanzetten

Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Daarna deployt elke push automatisch (workflow `deploy.yml`); de app komt op
`https://<gebruiker>.github.io/foodtrack/`.

> De app gaat uit van het pad `/foodtrack/`. Heet je repo anders of gebruik je
> een eigen domein, zet dan `BASE_PATH` als omgevingsvariabele bij de buildstap.

### 2. Claude-koppeling (onbekende producten)

De workflow `claude-food.yml` gebruikt je Claude-abonnement via een OAuth-token:

1. Draai lokaal `claude setup-token` (vereist Claude Pro/Max) en kopieer het token.
2. Repo → **Settings → Secrets and variables → Actions → New repository secret**:
   naam `CLAUDE_CODE_OAUTH_TOKEN`, waarde het token.
3. Maak eenmalig het issue-label `food-request` aan (Issues → Labels).

Vanaf dan: onbekend product → tik in de app op *"laat Claude dit toevoegen"* →
issue wordt aangemaakt → Claude vult `public/data/foods-extra.json` aan, sluit
het issue en de app kent het product na de volgende deploy.

### 3. Siri-shortcuts op je iPhone

Open de app en volg het tabblad **Uitleg** — daar staat het stappenplan voor:

- de opdracht **"Eten loggen"** (dicteren → loggen), te koppelen aan
  *"Hey Siri, eten loggen"*, de actieknop of dubbeltik op de achterkant;
- de opdracht **"FoodTrack Health"** die kcal en macro's in Apple Health zet.

## Cloud & AI met Supabase (optioneel)

Zonder configuratie blijft alles lokaal op je telefoon. Met een (gratis)
Supabase-project krijg je: **sync over apparaten, back-up van je loggings, en
echte Claude-AI in de chat** met je API-key veilig server-side.

### Stap 1 · Supabase-project

1. Maak een project op [supabase.com](https://supabase.com) (gratis tier volstaat).
2. Voer `supabase/schema.sql` uit in de **SQL Editor** (tabellen + row level security).
3. Zet in **Authentication → URL Configuration** je app-URL
   (`https://<gebruiker>.github.io/foodtrack/`) als *Site URL* en bij
   *Redirect URLs*.
4. Open in de app **Doelen → Cloud & AI**, vul de *Project URL* en *anon key*
   in (Settings → API in Supabase) en log in via de magic link.

Daarna synchroniseert de app automatisch: loggings, eigen producten en
instellingen. Offline wijzigingen komen in een wachtrij en worden verstuurd
zodra je weer online bent; per logging wint de server bij conflicten.

### Stap 2 · Claude AI in de chat

1. Maak een API-key aan op [console.anthropic.com](https://console.anthropic.com).
2. Installeer de [Supabase CLI](https://supabase.com/docs/guides/cli) en deploy
   de Edge Function:

   ```bash
   supabase link --project-ref <jouw-project-ref>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy claude
   ```

3. Zet in de app **Doelen → Cloud & AI → "Claude AI in de chat"** aan.

De chat stuurt dan je bericht + dagcontext naar de Edge Function; Claude
parst maaltijden (incl. tijdstip), beantwoordt vrije vragen en de app logt het
resultaat. De API-key staat alleen in Supabase-secrets, nooit in de browser.
Standaardmodel is `claude-opus-5`; zuiniger kan met
`supabase secrets set CLAUDE_MODEL=claude-haiku-4-5`. Valt de functie uit of
ben je offline, dan neemt de lokale parser het naadloos over.

## FatSecret loggen via de Claude-app (optioneel, subscription-only)

Met de connector `supabase/functions/fatsecret-mcp` log je eten door gewoon
tegen de **Claude-app** te praten; Claude schrijft het via de FatSecret-API in
je FatSecret-dagboek (en FatSecret synct met Apple Health). Kost niets extra:
Claude draait op je abonnement, FatSecret is gratis (Basic API: 5.000
calls/dag).

1. Vraag een gratis developer-key aan op
   [platform.fatsecret.com](https://platform.fatsecret.com). Voor
   dagboek-schrijven heb je de **OAuth 1.0 Consumer Key + Shared Secret**
   nodig (de OAuth 2.0 Client ID/Secret is niet genoeg).
2. Doorloop eenmalig de OAuth 1.0-koppeling met je FatSecret-account
   (request token → autoriseren op fatsecret.com → PIN → access token).
3. Deploy de functie (dashboard-editor of CLI) met **JWT-verificatie uit** en
   zet de secrets: `FATSECRET_CONSUMER_KEY`, `FATSECRET_CONSUMER_SECRET`,
   `FATSECRET_ACCESS_TOKEN`, `FATSECRET_ACCESS_SECRET` en een zelfgekozen
   lange `MCP_KEY`.
4. Voeg in de Claude-app een custom connector toe met URL:
   `https://<ref>.functions.supabase.co/fatsecret-mcp?key=<MCP_KEY>`

Tools voor Claude: `log_eten`, `dag_overzicht`, `verwijder_entry`,
`zoek_product`, `mijn_producten`.

### Loggen met je stem (iPhone)

Drie manieren, van snel naar snelst:

1. **Widget op je beginscherm** — houd het beginscherm ingedrukt → **+** →
   Claude → de widget met de drie knoppen. De microfoonknop opent Claude
   direct in dicteermodus: één tik, inspreken, klaar.
2. **Eigen Siri-opdracht** (Opdrachten-app):
   - Actie **Dicteer tekst** — taal op **Nederlands**, stop na pauze
   - Actie **Ask Claude** — als prompt de *Gedicteerde tekst*
   - Noem de opdracht bijv. **Eten loggen** → werkt met "Hey Siri, eten loggen"
   - Koppel hem daarna aan de **actieknop** (Instellingen → Actieknop →
     Opdracht) of aan **dubbeltik op de achterkant** (Instellingen →
     Toegankelijkheid → Aanraken → Tik op achterkant)
3. **Spraakmodus** in de Claude-app voor een gesproken gesprek heen en weer
   ("wat heb ik vandaag gegeten?").

Zorg dat de connector aan staat en zet in **Instellingen → Profiel** een
voorkeursregel dat Claude bij eten altijd direct de connector gebruikt,
zonder om bevestiging te vragen.

## Ontwikkelen

```bash
npm install
npm run dev      # lokale dev-server
npm test         # parser-tests (vitest)
npm run build    # typecheck + productie-build in dist/
```

### Structuur

| Pad | Wat |
| --- | --- |
| `src/data/foods.json` | Basisvoedingsdatabase (per 100 g + porties + aliassen) |
| `public/data/foods-branded.json` | Top-10.000 NL-merkproducten uit Open Food Facts |
| `scripts/build-branded-db.mjs` | Bouwt/ververst de merkenlijst (maandelijks via Action) |
| `public/data/foods-extra.json` | Door Claude aangeleerde producten |
| `src/lib/parser.ts` | Nederlandse spraakparser (hoeveelheden, porties, fuzzy matching) |
| `src/lib/store.ts` | Opslag in localStorage + React-hooks |
| `src/pages/` | Vandaag, Loggen, Historie, Doelen, Uitleg |
| `.github/workflows/` | Pages-deploy en Claude-workflow |

### Deep link

De Siri-shortcut opent
`https://<gebruiker>.github.io/foodtrack/#/log?text=<gedicteerde tekst>` —
de app parst, logt en toont een bevestiging. Dubbel afvuren binnen 90 seconden
wordt genegeerd.

### Hoe een gesproken zin wordt opgelost

0. **Eigen producten** (offline, direct): zelf toegevoegde maaltijden en
   eerder geleerde producten.
1. **Basisdatabase** (offline, direct): generieke producten en porties.
2. **Gebundelde merkenlijst** (offline, direct): top-10.000 NL-producten uit
   Open Food Facts, gerangschikt op populariteit.
3. **Live Open Food Facts** (online): de volledige database van 2M+ producten.
4. **Claude** (via issue): voor alles wat nergens gevonden wordt, zoals
   snackbar- en restaurantgerechten.

Wat laag 2–3 vindt, wordt lokaal onthouden en werkt daarna offline.

## Privacy

Er is geen backend: loggings staan uitsluitend in de browseropslag van je
telefoon. Alleen de tekst van een *onbekend* product verlaat je telefoon: als
zoekopdracht naar Open Food Facts en eventueel (via een issue) naar GitHub.

Productdata: © Open Food Facts-bijdragers, beschikbaar onder de
[Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
