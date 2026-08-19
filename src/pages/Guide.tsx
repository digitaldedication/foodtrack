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

      <h2 className="sectie-kop">Stap 2 · Apple Health (optioneel)</h2>
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
            <li>Zet in de app bij <strong>Doelen</strong> de schakelaar “Doorzetten naar Health” aan.</li>
          </ol>
        </div>
      </div>

      <h2 className="sectie-kop">Tips</h2>
      <div className="card">
        <div className="uitleg-stap">
          <ul>
            <li>Gebruik de app in <strong>Safari</strong> (zet een bladwijzer of een tweede opdracht “Open FoodTrack”).
              Als je de app op je beginscherm installeert, gebruikt iOS daarvoor een aparte opslag en zie je
              Siri-loggings daar niet terug.</li>
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
          </ul>
        </div>
      </div>
    </>
  )
}
