# Streusalz Großhandel

Deutscher B2B-Webshop mit Next.js, TypeScript, PostgreSQL, SMTP und PDF-Dokumenten.
Die bestehende Domain wird **nicht** durch das Anlegen dieses Projekts verändert.

## Lokale Vorschau

```powershell
npm install
npm run dev
```

- Shop: http://localhost:3000
- Bestellformular: http://localhost:3000/bestellen
- Verwaltung: http://localhost:3000/admin (Anmeldung erforderlich)

Ohne `DATABASE_URL` wird **nur in der Entwicklung** eine persistente PostgreSQL-kompatible
PGlite-Datenbank unter `.local-db` verwendet. In Produktion und auf Vercel ist eine echte
PostgreSQL-Datenbank zwingend erforderlich. Die Live-Bestellung ist standardmäßig gesperrt,
nicht mit Beispielpreisen oder simulierten Routen freigeschaltet.

Kopieren Sie `.env.example` nach `.env.local` und ergänzen Sie die Konfiguration lokal.
Umgebungsdateien, Datenbank und Mailvorschauen werden nicht in Git aufgenommen.

Favicon und Apple-Icon zeigen nur die Schneeflocke, nicht das SG-Logo.
Die PNG- und ICO-Dateien werden mit `node scripts\generate-icons.mjs` aus
`public\snowflake.svg` erzeugt (benoetigt den vorhandenen Playwright-Browser).

### Adminzugang

Eigenes Passwort verdeckt eingeben und direkt im Live-Shop aktivieren:

```powershell
powershell.exe -NoProfile -File scripts\set-admin-password.ps1
```

Die Eingabe wird bestaetigt, nur der Hash als Production-Secret in Vercel
hinterlegt und die aktuelle Production-Bereitstellung neu gestartet. Passwort
und Hash werden nicht ausgegeben. Dafuer muss die Vercel CLI angemeldet sein.

`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` und `SESSION_SECRET` konfigurieren.
`ORDER_NOTIFICATION_EMAIL` erhaelt optional eine zusaetzliche interne Kopie
jeder neuen Bestellung ueber dieselbe Versandwarteschlange mit Wiederholungen.
Identische Empfaenger werden nur einmal benachrichtigt; der Adminlogin bleibt
unveraendert. Es werden keine SMS verschickt.

Fehlt einer Adressantwort des Routendienstes die PLZ, wird sie nur bei genau
einem eindeutigen Treffer mit passender Strasse, Hausnummer und Gemeinde sowie
hoechstens 10 km Abstand zum gebuendelten PLZ-Mittelpunkt akzeptiert. Eine
abweichende vorhandene PLZ wird nicht uebergangen. Anbieter-Sperren oder
erschoepfte Kontingente bleiben sichtbare Servicefehler, keine Adressfehler.
Erfolgreiche Adress- und Lkw-Routenantworten werden im serverseitigen Next.js
Data Cache fuer 24 Stunden wiederverwendet, unabhaengig von Gebinde und Menge.
Bei Kontingent-, Verbindungs- oder Serverfehlern des Matrixdienstes werden die
benoetigten gerichteten Strecken ueber den Directionsdienst mit `driving-hgv`
berechnet. Das nutzt dessen separates Kontingent, keine Luftlinien oder
Pauschalannahmen. Fuer Gemeinschaften bleiben beide Fahrtrichtungen und die
20-km-Grenze verbindlich; eine Rueckfahrt zum Versandort wird nicht berechnet.
Sind beide Dienste nicht verfuegbar, bleibt die Bestellung mit einem
ausdruecklichen Servicehinweis gesperrt; es gibt keinen erfundenen Preis.
Ein Passwort wird über die Standardeingabe an `npm run admin:password -- --stdin`
übergeben, nicht als sichtbares Befehlsargument. Unter Windows PowerShell:

```powershell
$password = Read-Host "Neues Adminpasswort (mindestens 14 Zeichen)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$previousEncoding = $OutputEncoding
try {
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | node scripts\password.mjs --stdin
} finally {
  $OutputEncoding = $previousEncoding
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $password.Dispose()
}
```

Nur den erzeugten Hash als `ADMIN_PASSWORD_HASH` in Vercel hinterlegen; weder Passwort
noch Hash im Chat posten.
Verwenden Sie mindestens 14 Zeichen für das Passwort und mindestens 32 zufällige Zeichen
für `SESSION_SECRET`. Es gibt kein Standardpasswort und keine öffentliche Demo-Hintertür.
Der Adminzugang verwendet ein HttpOnly-/SameSite-Cookie, acht Stunden Sitzungsdauer,
Passwort-Hashing und Anmeldebegrenzung. Ein Passwortwechsel macht alte Sitzungen ungültig.

## Geschäftsregeln

- Im Einzelbestellformular wird je Gebindeart die ganzzahlige Anzahl der
  23-t-Ladungen gewaehlt; 0 waehlt die Gebindeart ab. Es gibt kein separates
  Mischprodukt. E-Mail ist der einzige veroeffentlichte Anbieter-Kontaktkanal;
  die Kunden-Telefonnummer bleibt fuer die Lieferabstimmung erforderlich.
- Verkauf nur an Gewerbetreibende und oeffentliche Auftraggeber, einschliesslich
  Staedten und Gemeinden; keine Privatkunden. Das Pflichtfeld `company` erfasst
  sowohl Unternehmens- als auch Einrichtungsnamen. Die Pflichtbestaetigung
  `businessAccepted` gilt fuer beide zugelassenen Kundengruppen.
- Interne Warenbasis BigBags: 169 €/Tonne netto, ein BigBag pro Tonne.
- Interne Warenbasis Sackware: 153 €/Tonne netto, 40 Säcke à 25 kg je 1-Tonnen-Palette.
- Warenpreisaenderungen gelten fuer neue Preisabrufe. Noch gueltige signierte
  PLZ-Preise behalten Gesamt- und Positionsbetraege bis zum urspruenglichen Ablauf;
  gespeicherte Auftraege und ausgestellte Rechnungen werden nicht neu berechnet.
- Kunden sehen Gesamtpreise inklusive Lieferung, netto plus 19 % MwSt.
  und brutto, ohne gesonderte Waren-/Frachtpositionen. Die Preisuebersicht zeigt
  immer auch den Nettopreis pro Tonne, bei Sackware zusaetzlich pro 25-kg-Sack
  (40 Saecke je Tonne). Einzelpreise werden aus dem Gesamtpreis inklusive Lieferung
  abgeleitet und auf Cent gerundet; vor dem Preisabruf bleibt eine Eingabeaufforderung
  statt eines unbelegten Betrags sichtbar.
- Eine Gebindeart je 23-Tonnen-Lkw. Einzelbestellungen an eine Lieferadresse
  koennen mehrere Gebindearten in getrennten vollen Lkw-Ladungen enthalten:
  Beispiel: 23 t BigBags + 23 t Sackware = 46 t, zwei Lkw, eine Rechnung.
  Optionale `items` speichern Mengen und inklusive Positionspreise; alte
  Ein-Gebinde-Snapshots bleiben ohne diese Erweiterung lesbar.
- Einzelbestellungen: je Gebindeart 23, 46, 69 … Tonnen.
  Gemeinschaften: genau eine 23-Tonnen-Ladung einer Gebindeart, maximal drei
  Lieferadressen; der Kunde gibt positive Teilmengen in vollen Tonnen selbst an.
- Alle Adressen müssen **untereinander in beiden Richtungen** höchstens 20 Straßenkilometer
  auseinanderliegen. Nur Deutschland.
- Je 23-Tonnen-Lkw: 2 €/Straßenkilometer netto für die einfache gemeinsame Strecke.
  Bei einem Unternehmen ist der Ortspunkt der Liefer-PLZ die verbindliche Preisbasis.
  Bei Gemeinschaften wird die kürzeste offene Lkw-Route über alle Stopps gewählt,
  ohne Rückfahrt.
- Der interne Routenstart ist das Stadtzentrum von Dej (23.8787° E, 47.1425° N),
  nicht eine bekannte Lageradresse. Für eine exakt ab Lager gerechnete Strecke müssen
  die Koordinaten vor Inbetriebnahme mit dem Lieferanten abgestimmt werden.
  Abfahrtsort und Routing-Matrix erscheinen weder im Browser noch in Kundendokumenten.
- Fracht auf bis zu drei Teilrechnungen proportional nach Tonnen; Rundungsreste werden
  centgenau verteilt. 19 % MwSt. werden je Rechnung gerundet; der Bestellgesamtbetrag
  ist die Summe dieser Rechnungen.
- Voraussichtliche Lieferung: Bestelltag in Europe/Berlin plus fünf Werktage,
  Mo–Fr ohne öffentliche Feiertage des Bundeslandes. Lokale Sonderfeiertage werden
  wie vereinbart bei der Auftragsfreigabe manuell geprüft.
- Rechnungskauf, Zahlung 14 **Kalendertage nach tatsächlicher Lieferung**.
  Zahlung ohne Abzug; kein Skonto. Neue Bestellungen und Dokumente speichern diese
  Bedingung mit `paymentWithoutDiscount`, damit historische Rechnungen unveraendert
  bleiben. Die Rechnung nennt zunaechst die Frist; die Liefermail nennt das konkrete Datum.

### Bestellablauf

Kundenkommunikation auf Website, in E-Mails und neuen Vertragstexten spricht
von uns als Lieferant. Externe Beschaffung und Lieferantenbestaetigungen
bleiben ausschliesslich im internen Verwaltungsablauf.

Neue Rechnungssnapshots tragen `invoiceDesign: "brand-v1"` und verwenden das
SG-Logo, Markenfarben, inklusive Positionspreise sowie einen hervorgehobenen
Gesamtbetrag und Zahlungsbereich. Logo und Unicode-Schriften werden fuer die
Serverfunktionen mitgebuendelt. Ausgestellte Rechnungen ohne diese Version
sowie historische Preis- und Zahlungsbedingungen behalten ihre bisherige
Darstellung; Lieferscheine bleiben unveraendert. Das PDF wird weiterhin vor
dem Speichern einer Bestellung bzw. Rechnung vollstaendig erzeugt und geprueft.

Standard ist eine Bestellung fuer ein Unternehmen mit einem Rechnungsempfaenger
und einer Lieferadresse; eine abweichende Rechnungsanschrift ist optional.
Weitere Unternehmen werden nur im aufklappbaren Sonderfall
Gemeinschaftsbestellung hinzugefuegt. Der ausdrueckliche Einstieg
`/bestellen?gemeinschaft=1` oeffnet weiterhin die Gemeinschaftsplanung.

Im Standardablauf liefert `/api/postcode-price` nach Eingabe von Gebinde,
23-Tonnen-Menge und deutscher Liefer-PLZ automatisch den aktuellen Gesamtpreis
inklusive Lieferung. Die Antwort enthaelt nur Netto, MwSt., Brutto, die
Preisauswahl, Gueltigkeitsdaten und einen signierten `postcode-price`-Token,
keine gesonderten Waren- oder Frachtbetraege.
Bei mehreren Gebindearten enthaelt die Preisauswahl optional `items` mit
`product` und `tonnes` je Gebindeart; jede Menge ist ein Vielfaches von 23.
Die Antwort enthaelt dafuer ebenfalls `items` mit dem jeweiligen Nettopreis
inklusive Lieferung. Diese Aufteilung wird im signierten Preis mitgebunden
und unveraendert in die gemeinsame Rechnung und den Lieferschein uebernommen.
Der Preis gilt 30 Minuten, laengstens bis zum Tageswechsel in Europe/Berlin,
fuer dieselbe PLZ, Menge und Gebindeart. Strasse und Hausnummer aendern ihn nicht.
`/api/quote` prueft die vollstaendige Lieferadresse und uebernimmt mit
`postcodePriceToken` exakt den zuvor angezeigten Preis. Die Adresspruefung
verlaengert dessen Gueltigkeit nicht. Ohne vorherigen Preisabruf berechnet
`/api/quote` dieselbe PLZ-basierte Preisgrundlage selbst.
Der PLZ-Token allein erlaubt keine Bestellung; dafuer bleibt der an die
vollstaendige Adresse gebundene `quote`-Token erforderlich.
Gemeinschaftsbestellungen verwenden weiterhin alle vollstaendigen Lieferadressen
und die 20-km-Regel; auch hier werden nur Preise inklusive Lieferung angezeigt.

Die PLZ-Koordinaten werden lokal aus `src/lib/data/german-postcodes.json`
gelesen, nicht ueber die lueckenhafte reine PLZ-Suche des Geocoders.
Quelle: [GeoNames Deutschland-Postleitzahlen](https://download.geonames.org/export/zip/DE.zip),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Die abgeleitete Tabelle enthaelt je PLZ den ersten Ortspunkt mit der hoechsten
in der Quelldatei angegebenen Genauigkeit, nicht die genaue Kundenanschrift.
Die PLZ-Preisberechnung verwendet direkt eine echte gerichtete HGV-Directionsroute,
nicht das separate Matrixkontingent. Nur der ungefaehre PLZ-Zielpunkt darf
innerhalb von maximal 5.000 Metern an eine Lkw-befahrbare Strasse angebunden
werden; der interne Startpunkt behaelt 350 Meter. So scheitern laendliche
PLZ-Ortspunkte nicht am normalen 350-Meter-Suchradius. Exakte Lieferadressen
und die beidseitige 20-km-Grenze fuer Gemeinschaften werden nicht aufgeweicht.
Kann der Anbieter fuer ein Ziel keine Route oder Strassenanbindung finden
(Directions 2009/2010, Matrix 6010 oder nicht erreichbare Matrix-Ziele), bietet
der Checkout ein persoenliches Lieferangebot per E-Mail an. Die Antwort enthaelt
`code: "manual_quote_required"` und keinen erfundenen Preis oder Bestelltoken.
Die E-Mail wird mit Gebinde, Tonnen und Liefer-PLZ vorbereitet, aber erst durch
den Kunden versendet. Echte Kontingent-, Verbindungs- und Serverfehler bleiben
davon getrennte, sichtbare Servicefehler. Es wird keine PLZ pauschal gesperrt.
Die Namensnennung steht auch direkt am PLZ-Rechner. Es findet keine Anfrage
an GeoNames beim Seitenaufruf oder bei der Berechnung statt.
Zur Aktualisierung DE.zip herunterladen, DE.txt entpacken und
`node scripts\import-postcodes.mjs <Pfad-zur-DE.txt>` ausfuehren.
Fehlende PLZ werden ausdruecklich gemeldet; bei einer Einzelbestellung wird
kein abweichender, adressbasierter Preis stillschweigend eingesetzt.

1. Server prüft Mengen und Adressen und berechnet die echte Straßenroute über
   OpenRouteService (Adress-Geocoding und `driving-hgv`-Distanzmatrix).
2. Der signierte Gesamtpreis gilt 30 Minuten, nur am Bestelltag und für dieselbe
   Preisauswahl. Der abschliessende Quote-Token bindet auch die Lieferadresse.
   Kundenseitig manipulierte Preise werden nicht übernommen.
3. Auftrag, Konditionentexte, Kundenbestätigungen und Adminbenachrichtigung werden atomar gespeichert.
   Wiederholte Anfragen mit derselben Request-ID erzeugen keinen zweiten Auftrag.
4. Admin bestellt **extern/manuell** beim Lieferanten und erfasst dessen Bestätigung.
   Dies löst noch keinen Rechnungsversand aus.
5. Separate manuelle Rechnungsfreigabe erzeugt bis zu drei nummerierte PDF-Rechnungen
   und stellt die E-Mails in die persistente Versandwarteschlange.
6. Nach Lieferung erfasst Admin die tatsächlichen Lieferdaten je Teilnehmer.
   Ein Klick erzeugt und versendet die Lieferscheine und die Fälligkeitsangaben.

Neue Rechnungszeilen tragen `deliveryIncluded: true` und weisen ausschliesslich
den Gesamtpreis inklusive Lieferung aus. Alte Rechnungssnapshots ohne diese
Markierung behalten ihre bisherige Darstellung mit separaten Positionen.
Danke-Mails nennen ebenfalls nur den Gesamtpreis inklusive Lieferung.
Ausgestellte Dokumentdaten sind unveränderliche Snapshots. Die Verwaltung bietet PDF-Downloads,
Suche, Statusfilter, Pagination und ein Auftragsprotokoll. Stornierung, Gutschriften,
Buchhaltungsexport, Zahlungsabgleich und Lieferanten-API sind nicht implementiert.

Kundentexte beschreiben Lieferabstimmung, anschliessende Auftragsbestaetigung
mit Rechnung sowie Lieferschein und Zahlungsziel nach Lieferung. Beschaffung
und manuelle Rechnungsfreigabe bleiben interne Verwaltungsablaeufe. Die erste
Eingangsbestaetigung ist weiterhin keine Auftragsannahme.
Ein erzeugter Lieferschein ist **keine unterschriebene Empfangsquittung**.

## E-Mail und Zuverlässigkeit

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` und `MAIL_FROM` konfigurieren.
Absender ist `info@streusalz-grosshandel.de`. Port 587 erfordert STARTTLS, 465 verwendet TLS.
SPF, DKIM und DMARC müssen für die Domain beim tatsächlichen Mailanbieter eingerichtet werden.

Ein SMTP-Fehler löscht weder Auftrag noch Dokument. Admin sieht den Fehler und kann erneut
senden. Eine feste Message-ID erleichtert Deduplizierung. Die Warteschlange verhindert, dass
ein Teilnehmer seine Liefermail vor seiner noch ausstehenden Rechnung erhält.
Der SMTP-Server bestätigt nur die Annahme, nicht den tatsächlichen Posteingang.
Bei einem Prozessabbruch direkt nach SMTP-Annahme ist erneuter Versand möglich
(at-least-once, keine Garantie für exactly-once). Nach fünf Fehlern ist manuelle Intervention nötig.

Mit `MAIL_MODE=preview` werden `.eml`-Dateien inklusive PDF-Anhängen lokal unter `.mail-preview`
geschrieben, **nicht** an Empfänger versendet. Dieser Modus ist in Produktion verboten und
kann den Live-Shop nicht freischalten.

Der geschützte Endpunkt `/api/cron/mail` arbeitet die Warteschlange ab und entfernt abgelaufene
Rate-Limit-Schlüssel nach einem Tag. `CRON_SECRET` benötigt mindestens 32 zufällige Zeichen.
`vercel.json` enthält einen täglichen Wiederholungsjob. Für diesen gewerblichen Shop ist
ein gewerblich geeigneter Tarif mit passendem AV-Vertrag einzurichten (z. B. Vercel Pro,
nicht ungeprüft Hobby). Für häufigere Wiederholungen z. B. `*/5 * * * *` konfigurieren.
Der normale Erstversand erfolgt unmittelbar nach der Kunden-/Adminaktion.

## Vercel und Live-Freischaltung

1. Projekt mit Vercel verbinden, Node-Runtime verwenden und PostgreSQL bereitstellen.
   `DATABASE_URL` als gepoolte TLS-Verbindungs-URL des Anbieters hinterlegen.
2. Schema auf der Zieldatenbank installieren: `npm run db:migrate`.
   Das Skript verwendet `.env.local`, sofern vorhanden. Keine Produktionsdaten löschen.
3. OpenRouteService-Key für Geocoding und HGV-Matrix beschaffen, Tarif/Quoten prüfen,
   und `ORS_API_KEY` **serverseitig** hinterlegen. Kein `NEXT_PUBLIC_` für Geheimnisse.
   Es gibt keine Luftlinien-Fallbacks und keine erfundenen Frachtpreise.
4. SMTP und echten Versand testen. Steuerangabe, vollständigen Bankdatenblock,
   aktuelle Anbieter-/Produktdaten und rechtlich geprüfte Texte vervollständigen.
5. `SITE_URL=https://www.streusalz-grosshandel.de`, sichere Adminvariablen,
   vollständige Datenschutzkonfiguration, `LEGAL_READY=true`, `SHOP_ENABLED=true`,
   `MAIL_MODE=smtp` setzen und erneut deployen.
6. `isLiveReady()` verhindert Bestellungen bis die Mindestkonfiguration vollständig ist.
   Das ist **keine** rechtliche Prüfung der Texte oder technische Zustellgarantie.

Die Suchmaschinenfreigabe kann unabhängig erfolgen: In Vercel **nur für Production**
`SITE_INDEXING_ENABLED=true` und `SITE_URL=https://www.streusalz-grosshandel.de` setzen,
anschließend ein neues Produktionsdeployment erstellen. `VERCEL_ENV=production`
wird von Vercel gesetzt; lokale Builds und Preview-Deployments bleiben gesperrt.
`SHOP_ENABLED` und `LEGAL_READY` dadurch nicht vorzeitig einschalten.
Ohne explizite SEO-Einstellung bleibt die bisherige vollständige Shopfreigabe Voraussetzung;
`SITE_INDEXING_ENABLED=false` sperrt die Indexierung ausdrücklich auch beim fertigen Shop.
Nach dem Deployment auf der echten Domain Robots-Metadaten, `robots.txt` und Canonical
prüfen. Der deaktivierte Checkout bleibt `noindex` und fehlt in der Sitemap.

### Produktionsprofil: Artfiles und Neon

`.env.production.example` enthält die vorbereiteten Production-Einstellungen.
In **Vercel > Project > Settings > Environment Variables** übernehmen, echte Geheimnisse
nur dort eintragen und nur Production auswählen. Die Datei enthält keine echten
Passwörter, Schlüssel, Bankdaten oder Datenbank-Verbindungsstrings.

- **Artfiles:** `smtp.artfiles.de`, Port `587`, STARTTLS. `SMTP_USER` ist die vollständige
  Adresse des Versandpostfachs, `SMTP_PASSWORD` dessen Postfachpasswort, nicht das
  DCP-Passwort. Falls `info@streusalz-grosshandel.de` nur eine Weiterleitung ist, ein
  echtes Versandpostfach verwenden und die zulässige Absenderadresse prüfen.
  `datenschutz@streusalz-grosshandel.de` als erreichbares Postfach/Weiterleitung anlegen.
  SPF/DKIM und DMARC für den Versand mit Artfiles prüfen.
- **Neon:** Im Projekt unter **Connect** die gepoolte URL mit `-pooler` für `DATABASE_URL`
  und die direkte URL für `DIRECT_DATABASE_URL` kopieren, inklusive TLS-Parameter.
  Die direkte Verbindung wird für Schema-Migrationen bevorzugt; ohne sie bleibt
  `DATABASE_URL` aus Kompatibilitätsgründen der bisherige Migrationsweg.
  Die tatsächliche Region bestätigen; Frankfurt ist `aws-eu-central-1`, kein automatischer
  Standard. Die Region eines bestehenden Projekts lässt sich nicht einfach umstellen.
  EU-Datenbankstandort bedeutet nicht automatisch ausschließlich EU-Verarbeitung.
- **Admin/Sicherheit:** Hash wie oben erzeugen. Für `SESSION_SECRET` und `CRON_SECRET`
  unabhängig jeweils `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`
  lokal ausführen und das Ergebnis direkt in Vercel eintragen.
- **Routing:** Eigenen OpenRouteService-Schlüssel als `ORS_API_KEY` hinterlegen und
  Geocoding sowie `driving-hgv` praktisch testen. Lagerkoordinaten beim Lieferanten
  bestätigen; eine Stadtmitte ist keine bestätigte Lagerzufahrt.
- **Rechnungen:** Echte Steuer-/Umsatzsteuerkennung sowie Bankname, IBAN und gegebenenfalls
  BIC eintragen. Die private Steuernummer bleibt ausschließlich in Rechnungen.
- **Rechtliches:** Tatsächliche Verarbeitungsorte, Vercel-Protokollfrist und geprüfte
  AV-/Drittlandvereinbarungen ergänzen. Die Provider-Namen fließen über diese Variablen
  in die vorhandenen Datenschutztexte ein. `TERMS_TEXT` und `PRIVACY_TEXT` dürfen leer
  bleiben: dann gelten die eingebauten Texte, nicht fehlende AGB/Datenschutzseiten.

Falls die Vercel CLI bereits eingerichtet ist, Production-Variablen für eine lokale
Migration in die git-ignorierte `.env.production.local` übernehmen:

```powershell
vercel env pull .env.production.local --environment=production
npm run db:migrate:production
```

Danach neu deployen und Adminanmeldung, Danke-Mail, manuelle Rechnungsfreigabe,
PDF-Bankdaten und Lieferschein tatsächlich testen. `SHOP_ENABLED=false` und
`LEGAL_READY=false` bleiben bis zu den erforderlichen Prüfungen unverändert.
Es wurden keine Mailboxen, Neon-Projekte oder Bankverbindungen automatisch angelegt.

Offizielle Quellen: [Artfiles SMTP-Einrichtung](https://www.artfiles.de/support/E-Mail-Einrichtung:_Alle_Clients_im_%C3%9Cberblick),
[Neon Pooling](https://neon.com/docs/connect/connection-pooling),
[Neon Regionen](https://neon.com/docs/introduction/regions),
[Neon Vertrags-/Datenschutzbedingungen](https://neon.com/platform-terms#3.4).

### Rechtstexte und Datenschutzfreigabe

Ausgearbeitete AGB und Datenschutztexte liegen in `src/lib/legal.ts`; Seiten und
auftragsbezogene Textkopien nutzen dieselbe Quelle. `TERMS_TEXT` und `PRIVACY_TEXT`
bleiben als optionale fachlich geprüfte Volltext-Overrides erhalten.
Das Formular übermittelt einen Hash der angezeigten Fassung. Änderungen vor Bestellabschluss
erfordern erneute Prüfung; die akzeptierten Texte werden beim Auftrag gespeichert.
Die Kundenmails enthalten die geltenden AGB. Die Rechnungsfreigabe versendet zusätzlich
die ausdrückliche Auftragsannahme; ein interner Status ist noch kein Nachweis des E-Mail-Zugangs.

Vor Freischaltung sind die **tatsächlichen** Datenbank- und Mailanbieter samt Verarbeitungsland,
Hosting-Protokollfrist und konkrete Drittland-Garantien in den `PRIVACY_*`-Variablen
einzutragen. Das Postfach `datenschutz@streusalz-grosshandel.de` muss erreichbar sein;
die Angabe im Quellcode legt kein Postfach an. Eine gesonderte Datenschutz-Adresse ist
keine automatische Bestellung eines Datenschutzbeauftragten.

`SELLER_TAX_ID` bleibt privat für Rechnungen. Nur zugeteilte `SELLER_VAT_ID` und `SELLER_WID`
werden im Impressum veröffentlicht. Der bestätigte Anbieter ist ein nicht im Handelsregister
eingetragener Einzelunternehmer. Änderungen dieser Angaben erfordern Anpassung des Impressums.

Der öffentliche Shop verwendet keine Analyse-/Marketing-Cookies; der Adminbereich nutzt
ein notwendiges Sitzungscookie und der Bestellabschluss funktionalen sessionStorage.
Deshalb wird derzeit kein Einwilligungsbanner eingesetzt (§ 25 Abs. 2 Nr. 2 TDDDG), nicht
weil überhaupt kein Endgerätespeicher verwendet würde. Neue Trackingdienste dürfen
nicht ungeprüft ergänzt werden.

Die Texte sind eine auf den bestätigten Ablauf zugeschnittene Fassung, **keine anwaltliche
Prüfung oder Garantie**. Vor Livebetrieb sind Rechtstexte, AV-Verträge, Aufbewahrung/Löschung,
Rechnungsarchiv und gegebenenfalls strukturierte E-Rechnungen fachlich zu prüfen.
Quellen: [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html),
[§ 25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html),
[§ 147 AO](https://www.gesetze-im-internet.de/ao_1977/__147.html),
[§ 14b UStG](https://www.gesetze-im-internet.de/ustg_1980/__14b.html)
und [Vercel DPA](https://vercel.com/legal/dpa).

Vor dem Echtbetrieb besonders prüfen: Vertragsschluss/Vertretung bei drei Rechnungsempfängern,
Entladung, Lkw-Zufahrt, Umsatzsteuer, Pflichtangaben im Impressum und auf Rechnungen,
Rechnungsarchivierung, Datenschutz/AV-Verträge und deutsche E-Rechnungsanforderungen
(XRechnung/ZUGFeRD bzw. zulässige Übergangsregelungen). Die implementierte Rechnung ist
eine PDF-Rechnung, keine strukturierte E-Rechnung. Vollständige rechtskonforme Archivierung
und Backups sind beim Betreiber einzurichten; dieses Projekt ist kein Buchhaltungssystem.

## SEO: bestehende Position schützen

- Der Startseitentitel bleibt `Streusalz Großhandel`, wie im bisherigen Suchergebnis.
  Die neue Description beginnt mit dem belegten Thema „Streusalz für Wege, Einfahrten
  und Straßen“ und nennt die aktuellen Gebinde und B2B-Bedingungen. Sie ist keine
  behauptete identische Kopie der alten Description: Google-Snippets und Screenshots
  der sichtbaren Seite belegen deren ursprüngliches HTML-Tag nicht.
- Die frühere Themenüberschrift und Erklärung zur Auftauwirkung bleiben erhalten.
  Veraltete Preise, 24-Tonnen-Mengen und „inklusive Lieferung“ werden nicht übernommen.
- Bestehende Start-URL `/` bleibt erhalten. Deutscher serverseitig gerenderter Inhalt,
  ein H1, natürliche Keywordverwendung, Canonicals, OpenGraph, Organization-Daten und Sitemap.
- Mindestens 96 % NaCl und 0,1–5 mm Körnung sind als aktuelle Lieferantenangaben bestätigt.
  Daraus wird keine unbestätigte TL-Streu-Konformität, kein Gütesiegel und keine Bewertung abgeleitet.
- Bekannte alte Bild-URLs und typische Startdokumente werden permanent weitergeleitet.
- **Vorschau bleibt noindex** und robots-gesperrt. `isSiteIndexable()` erlaubt nur die
  kanonische HTTPS-WWW-Domain in Vercel Production. Die explizite SEO-Freigabe ist von
  `isLiveReady()` getrennt; Änderungen der Einstellungen erfordern ein neues Deployment.
- **Keine gesperrte Vorschau auf der bestehenden Produktionsdomain betreiben.**
  Öffentliche Hostvarianten und die tatsächlich ausgelieferte `robots.txt` sowie
  Robots-Metadaten separat prüfen; eine funktionierende lokale Fassung reicht nicht.
- Vor DNS-Umstellung: vollständige Bestandsaufnahme aus Search Console und Serverdaten,
  bestehende indexierte URLs/Backlinks/Canonical-Host/Metadaten sichern und fehlende
  URLs gezielt weiterleiten. Nicht alle unbekannten URLs pauschal zur Startseite umleiten.
- Erst nach Tests produktive Domain/WWW-Weiterleitung und HTTPS auf Vercel umstellen.
  Alte Website bis dahin unverändert erreichbar lassen. Neue Sitemap einreichen und
  Crawling, 404s, Core Web Vitals und Rankings nach dem Wechsel überwachen.
- Ein Erhalt von Platz 1 bei Google kann nicht garantiert werden. Die bestehende
  HTTPS-Verbindung zeigte beim initialen Abruf einen TLS-Fehler; HTTP war erreichbar.
  Zertifikat, Hostvarianten und tatsächliche Redirect-Kette vor dem Umzug prüfen.

## Bilder und Schriften

Das Startseitenmotiv wurde für dieses Projekt KI-generiert und ist als Illustration
gekennzeichnet, nicht als Produktfotografie. Die SVG-Gebindegrafiken sind eigener Code
und als technische Illustrationen mit blauem Linienraster, Nähten und Hinweislinien
gestaltet, ohne fotorealistische Texturen oder Schatten.
Das Motiv orientiert sich für feine Salzstruktur und BigBag-Ausführung an bereitgestellten
Referenzfotos; die Originalfotos werden nicht als öffentliche Website-Assets übernommen.
Die BigBag-Zeichnung kennzeichnet das Füllgewicht von 1.000 kg. Die Sackware wird als
schematische Vorderansicht einer Palette mit versetzten Sacklagen dargestellt; hintere
Säcke sind verdeckt. Die Beschriftung erklärt 40 Säcke à 25 kg, insgesamt 1.000 kg.
Die Zeichnungen sind nicht maßstabsgetreu und enthalten keine unbestätigten Abmessungen.
Das bereitgestellte SG-Logo mit gelber Schneeflocke wird in Kopf- und Fußzeile verwendet.
Die kräftige, nicht kursive Wortmarke ergänzt die Domain `STREUSALZ-GROSSHANDEL.DE`.
Der Header nennt die Gebindearten und bündelt Großhandel, Lieferung und Preise in der
vorhandenen oberen Leiste; der Hero wiederholt diesen Slogan nicht.
Die transparente PNG wurde ohne Farbänderungen zugeschnitten. Im dunklen Footer sorgt
ein heller Hintergrund für Kontrast. Browser- und Apple-Icons werden aus demselben Logo
abgeleitet; das ICO enthält Größen von 16, 32, 48 und 64 Pixeln.
Es werden keine fremden Produktfotos oder Bewertungen verwendet. Eine pauschale Garantie
der rechtlichen Schutzfreiheit KI-generierter Inhalte ist nicht möglich.
Noto Sans für die PDFs ist unter SIL Open Font License lizenziert; die Lizenz liegt unter
`assets/fonts/LICENSE.txt`. Die Schrift wird lokal eingebettet, nicht extern geladen.

## Validierung

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Wenn Playwright einen fehlenden Browser meldet: `npx playwright install chromium`.
Geschäftsabläufe werden gegen eine echte PGlite/PostgreSQL-Engine getestet, PDFs tatsächlich
erzeugt und geladen. Routing/SMTP werden in Tests isoliert simuliert; produktive Schlüssel,
echte Straßendistanzen und Zustellung müssen zusätzlich mit den realen Anbietern geprüft werden.
Der PLZ-Preistest durchlaeuft alle gebuendelten PLZ mit BigBags, Sackware,
zwei Ladungen und einer Mischbestellung: Koordinaten, begrenztes Road-Snapping,
Centbetraege, MwSt. und signierte Preise werden vollstaendig geprueft.
Diese Vollpruefung verwendet ausdruecklich simulierte Routen. Sie ersetzt
keinen Live-Routentest aller Zielpunkte. Ein solcher Test muss das verfuegbare
Anbieterkontingent und dessen Rate-Limits beachten, ohne das fuer Kunden
benoetigte Kontingent zu erschoepfen oder den Shop-Anfrageschutz aufzuweichen.
Browsertests prüfen Desktop und Mobil, Mengenregeln, Navigation, Vorschau-Indexierung
und Adminschutz. Sie führen keine echten Käufe aus.
