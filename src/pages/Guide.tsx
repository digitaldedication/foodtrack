import { useSettings } from '../lib/store'
import { REPO } from '../lib/github'

export default function Guide() {
  const settings = useSettings()
  const appUrl = `${window.location.origin}${window.location.pathname}`
  const logUrl = `${appUrl}#/log?text=`

  return (
    <>
      <header className="app-header">
        <h1>Uitleg</h1>
      </header>

      <div className="card">
        <div className="uitleg-stap">
          <h3>Zo werkt het</h3>
          <ul>
            <li>Je zegt <em>“Hey Siri, eten loggen”</em> en dicteert wat je at.</li>
            <li>De app herkent producten, porties en hoeveelheden en telt calorieën en macro’s bij vandaag op.</li>
            <li>Alles wordt alleen op dit apparaat bewaard — er is geen server met jouw gegevens.</li>
          </ul>
        </div>
      </div>

      <h2 className="sectie-kop">Stap 1 · Siri-shortcut “Eten loggen”</h2>
      <div className="card">
        <div className="uitleg-stap">
          <ol>
            <li>Open de app <strong>Opdrachten</strong> op je iPhone en tik op <strong>+</strong>.</li>
            <li>Noem de opdracht <strong>Eten loggen</strong> (die naam wordt je Siri-zin).</li>
            <li>Voeg de actie <strong>Dicteer tekst</strong> toe. Zet <em>Taal</em> op Nederlands en <em>Stop luisteren</em> op “Na pauze”.</li>
            <li>Voeg de actie <strong>Codeer URL</strong> toe (invoer: Gedicteerde tekst).</li>
            <li>Voeg de actie <strong>URL</strong> toe en plak daarin:<br />
              <code>{logUrl}</code><br />
              en zet direct daarachter de variabele <em>URL-gecodeerde tekst</em>.</li>
            <li>Voeg de actie <strong>Open URL’s</strong> toe.</li>
          </ol>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Vanaf nu werkt “Hey Siri, eten loggen”. Je kunt de opdracht ook aan de <strong>actieknop</strong> koppelen
            (Instellingen → Actieknop) of aan <strong>dubbel tikken op de achterkant</strong> (Instellingen →
            Toegankelijkheid → Aanraken → Tik op achterkant).
          </p>
        </div>
      </div>

      <h2 className="sectie-kop">Stap 2 · Chat-shortcut (optioneel)</h2>
      <div className="card">
        <div className="uitleg-stap">
          <p style={{ marginBottom: 8 }}>
            Naast snel loggen is er een <strong>chat</strong> waarin je kunt typen of praten, met tijd erbij
            (“gisteren om 13:00 een muscle meat gnocchi”) en vragen (“hoeveel kcal heb ik nog?”). Maak er een tweede
            opdracht voor, bijvoorbeeld <strong>FoodTrack chat</strong>:
          </p>
          <ol>
            <li>Actie <strong>Dicteer tekst</strong> (Nederlands) — of sla deze stap over om alleen de chat te openen.</li>
            <li>Actie <strong>Codeer URL</strong> (invoer: Gedicteerde tekst).</li>
            <li>Actie <strong>URL</strong>:<br />
              <code>{`${appUrl}#/chat?text=`}</code> + variabele <em>URL-gecodeerde tekst</em>.</li>
            <li>Actie <strong>Open URL’s</strong>.</li>
          </ol>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            In de chat zelf zit ook een microfoonknop (of gebruik de dicteerknop op je toetsenbord).
          </p>
        </div>
      </div>

      <h2 className="sectie-kop">Stap 3 · Zet FoodTrack als app op je iPhone</h2>
      <div className="card">
        <div className="uitleg-stap">
          <ol>
            <li>Open deze pagina in <strong>Safari</strong>.</li>
            <li>Tik op de <strong>deelknop</strong> (vierkant met pijl) → <strong>Zet op beginscherm</strong>.</li>
            <li>FoodTrack staat nu als app-icoon tussen je andere apps, volledig schermvullend.</li>
          </ol>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Belangrijk: koppel eerst <strong>Doelen → Cloud &amp; AI</strong> (Supabase) en log in — zowel in Safari als
            in de geïnstalleerde app. iOS geeft die twee namelijk aparte opslag; via de cloud-sync zie je Siri-loggings
            (die via Safari binnenkomen) automatisch in de app zodra je hem opent.
          </p>
        </div>
      </div>

      <h2 className="sectie-kop">Stap 4 · Apple Health (automatisch)</h2>
      <div className="card">
        <div className="uitleg-stap">
          <p style={{ marginBottom: 8 }}>
            Maak een tweede opdracht met precies de naam <strong>{settings.healthShortcutName}</strong>:
          </p>
          <ol>
            <li>Nieuwe opdracht → naam <strong>{settings.healthShortcutName}</strong>.</li>
            <li>Actie <strong>Haal woordenboek uit invoer</strong> (invoer: Opdrachtinvoer).</li>
            <li>Actie <strong>Haal waarde uit woordenboek</strong> voor sleutel <code>kcal</code>, gevolgd door actie{' '}
              <strong>Registreer gezondheidsmonster</strong> → type <em>Voedingsenergie</em> (kcal).</li>
            <li>Herhaal dat voor <code>eiwit</code> → <em>Eiwit</em> (g), <code>koolhydraten</code> → <em>Koolhydraten</em> (g)
              en <code>vet</code> → <em>Vet</em> (g).</li>
          </ol>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
            Vanaf dan gaat elke logging <strong>automatisch</strong> naar Apple Health — de app opent de opdracht direct
            na het loggen, zonder knop (dit staat standaard aan; uitzetten kan bij <strong>Doelen</strong>). iOS staat
            webapps geen rechtstreekse Health-toegang toe; deze opdracht is de officiële route.
          </p>
        </div>
      </div>

      <h2 className="sectie-kop">Tips</h2>
      <div className="card">
        <div className="uitleg-stap">
          <ul>
            <li>Doet de microfoonknop in de chat niets? iOS beperkt spraakherkenning in webapps geregeld — gebruik dan
              de <strong>dicteerknop (🎤) op je toetsenbord</strong>; die werkt altijd en typt direct in het chatveld.</li>
            <li>Zeg hoeveelheden gewoon zoals je praat: <em>“twee bitterkoekjes”</em>, <em>“een handje noten”</em>,{' '}
              <em>“200 gram kwark”</em>, <em>“een halve zak chips”</em>.</li>
            <li>Merkproducten werken ook: <em>“een snelle jelle”</em>, <em>“een flesje optimel”</em> — de app kent de
              10.000 populairste Nederlandse producten en zoekt de rest live op in Open Food Facts (2M+ producten).</li>
            <li>Wordt een product nérgens gevonden? Tik dan op <em>“laat Claude dit toevoegen”</em> bij de logging —
              Claude zoekt de voedingswaarden op en de app kent het product daarna voorgoed.</li>
          </ul>
        </div>
      </div>

      <h2 className="sectie-kop">Voor de beheerder</h2>
      <div className="card">
        <div className="uitleg-stap">
          <ul>
            <li>Broncode en installatie-instructies: <code>github.com/{REPO}</code></li>
            <li>De Claude-koppeling voor onbekende producten draait via GitHub Actions met je Claude-abonnement — zie de
              README (<code>claude setup-token</code>).</li>
            <li>Sync over apparaten + echte Claude-AI in de chat: koppel een gratis Supabase-project via{' '}
              <strong>Doelen → Cloud &amp; AI</strong> — installatiestappen staan in de README.</li>
          </ul>
        </div>
      </div>
    </>
  )
}
