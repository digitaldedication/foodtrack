# FoodTrack 🎙️🥗

Eten loggen met je stem. Je zegt tegen Siri wat je gegeten hebt — *"twee
bitterkoekjes en een boterham met pindakaas"* — en FoodTrack rekent uit hoeveel
calorieën, eiwitten, koolhydraten en vetten dat zijn en telt het bij je dag op.

- **PWA op GitHub Pages** — geen server, geen kosten. Je gegevens staan alleen
  op je eigen telefoon (localStorage).
- **Nederlandse voedingsdatabase** — ±200 producten met NEVO-achtige waarden,
  porties ("handje", "opscheplepel", "flesje") en spreektaal-aliassen.
- **Slimme parser** — begrijpt telwoorden ("twee", "anderhalve"), grammen
  ("200 gram kwark"), porties ("een halve zak chips") en samenstellingen
  ("boterham met pindakaas" = brood + beleg).
- **Zelflerend via Claude** — een onbekend product wordt met één tik een
  GitHub-issue; Claude zoekt de voedingswaarden op en voegt het product
  automatisch toe aan de database.
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

## Privacy

Er is geen backend: loggings staan uitsluitend in de browseropslag van je
telefoon. Alleen de tekst van een *onbekend* product komt (via een issue) op
GitHub terecht.
