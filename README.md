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

### Adminzugang

`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` und `SESSION_SECRET` konfigurieren.
Einen Passwort-Hash erzeugt `npm run admin:password -- "Ihr-langes-eigenes-Passwort"`.
Verwenden Sie mindestens 14 Zeichen für das Passwort und mindestens 32 zufällige Zeichen
für `SESSION_SECRET`. Es gibt kein Standardpasswort und keine öffentliche Demo-Hintertür.
Der Adminzugang verwendet ein HttpOnly-/SameSite-Cookie, acht Stunden Sitzungsdauer,
Passwort-Hashing und Anmeldebegrenzung. Ein Passwortwechsel macht alte Sitzungen ungültig.

## Geschäftsregeln

- BigBags: 245 €/Tonne netto, ein BigBag pro Tonne.
- Sackware: 255 €/Tonne netto, 40 Säcke à 25 kg je 1-Tonnen-Palette.
- Eine Gebindeart pro Auftrag, nicht mischbar.
- Gesamtmenge 23, 46, 69 … Tonnen; volle Tonnen je Lieferadresse, maximal drei Adressen.
- Alle Adressen müssen **untereinander in beiden Richtungen** höchstens 20 Straßenkilometer
  auseinanderliegen. Nur Deutschland.
- Je 23-Tonnen-Lkw: 2 €/Straßenkilometer netto für die einfache gemeinsame Strecke.
  Die kürzeste offene Lkw-Route über alle Stopps wird gewählt, ohne Rückfahrt.
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
  Die Rechnung nennt zunächst diese Bedingung; die Liefermail nennt das konkrete Datum.

### Bestellablauf

1. Server prüft Mengen und Adressen und berechnet die echte Straßenroute über
   OpenRouteService (Adress-Geocoding und `driving-hgv`-Distanzmatrix).
2. Eine signierte Kalkulation gilt 30 Minuten, nur am Bestelltag und für dieselben
   Mengen/Adressen. Kundenseitig manipulierte Preise werden nicht übernommen.
3. Auftrag, Konditionentexte, Kundenbestätigungen und Adminbenachrichtigung werden atomar gespeichert.
   Wiederholte Anfragen mit derselben Request-ID erzeugen keinen zweiten Auftrag.
4. Admin bestellt **extern/manuell** beim Lieferanten und erfasst dessen Bestätigung.
   Dies löst noch keinen Rechnungsversand aus.
5. Separate manuelle Rechnungsfreigabe erzeugt bis zu drei nummerierte PDF-Rechnungen
   und stellt die E-Mails in die persistente Versandwarteschlange.
6. Nach Lieferung erfasst Admin die tatsächlichen Lieferdaten je Teilnehmer.
   Ein Klick erzeugt und versendet die Lieferscheine und die Fälligkeitsangaben.

Ausgestellte Dokumentdaten sind unveränderliche Snapshots. Die Verwaltung bietet PDF-Downloads,
Suche, Statusfilter, Pagination und ein Auftragsprotokoll. Stornierung, Gutschriften,
Buchhaltungsexport, Zahlungsabgleich und Lieferanten-API sind nicht implementiert.
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

- Bestehende Start-URL `/` bleibt erhalten. Deutscher serverseitig gerenderter Inhalt,
  ein H1, natürliche Keywordverwendung, Canonicals, OpenGraph, Organization-Daten und Sitemap.
- Historische Spezifikation ist ausdrücklich als noch zu bestätigende Lieferantenangabe
  gekennzeichnet; keine erfundenen Gütesiegel oder Bewertungen.
- Bekannte alte Bild-URLs und typische Startdokumente werden permanent weitergeleitet.
- **Vorschau bleibt noindex** und robots-gesperrt. `isLiveReady()` schaltet die öffentliche
  Indexierung erst mit der vollständigen Freischaltung ein; danach neu deployen.
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

Das Startseitenmotiv wurde für dieses Projekt KI-generiert; die SVG-Gebindeillustrationen
sind eigener Code. Beides ist als Illustration gekennzeichnet, nicht als Produktfotografie.
Das Motiv orientiert sich für feine Salzstruktur und BigBag-Ausführung an bereitgestellten
Referenzfotos; die Originalfotos werden nicht als öffentliche Website-Assets übernommen.
Die Sackware wird im Verbund statt in senkrechten Sack-Säulen dargestellt. Die SVG zeichnet
acht wechselnde Lagen mit jeweils fünf Säcken à 25 kg; an der Vorderseite wechseln sich
zwei lange Sackseiten und drei kurze Sackseiten ab. Die dreieckige Schneeflocke wird in Kopf-/Fußzeile
und als Website-Icon verwendet.
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
Browsertests prüfen Desktop und Mobil, Mengenregeln, Navigation, Vorschau-Indexierung
und Adminschutz. Sie führen keine echten Käufe aus.
