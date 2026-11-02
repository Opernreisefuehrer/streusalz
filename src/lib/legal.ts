import "server-only";
import { createHash } from "node:crypto";
import { seller, privacySettings, legalConfigurationComplete } from "./config";

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
  links?: { label: string; href: string }[];
}
export interface LegalDocument {
  title: string;
  date: string;
  sections: LegalSection[];
}
const date = () => process.env.LEGAL_VERSION || "2026-11-02";
const section = (id: string, heading: string, ...paragraphs: string[]): LegalSection => ({ id, heading, paragraphs });
export function legalReleasePending() {
  return process.env.LEGAL_READY !== "true" || !legalConfigurationComplete();
}
export function termsDocument(): LegalDocument {
  const company = seller();
  if (process.env.TERMS_TEXT) return { title: "Allgemeine Geschäftsbedingungen", date: date(), sections: [section("bedingungen", "Vertragsbedingungen", process.env.TERMS_TEXT)] };
  return {
    title: "Allgemeine Geschäftsbedingungen",
    date: date(),
    sections: [
      section("geltung", "1. Anbieter und Geltungsbereich",
        `Diese Allgemeinen Geschäftsbedingungen gelten für Bestellungen bei Streusalz Großhandel, Inhaber ${company.name}, ${company.street}, ${company.postcode} ${company.city}, Deutschland. Kontakt: ${company.email}.`,
        "Unser Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB, die bei der Bestellung in Ausübung ihrer gewerblichen oder selbstständigen beruflichen Tätigkeit handeln, sowie an öffentliche Auftraggeber, insbesondere Städte, Gemeinden und kommunale Einrichtungen. Kein Verkauf an Privatkunden. Bestellungen von Verbrauchern nehmen wir nicht an. Ein gesetzliches Verbraucherwiderrufsrecht besteht für diesen Kundenkreis nicht.",
        "Abweichende Geschäftsbedingungen des Kunden gelten nur, wenn wir ihrer Geltung ausdrücklich zugestimmt haben. Individuelle Vereinbarungen haben Vorrang."),
      section("produkte", "2. Produkte, Gebinde und Beschaffenheit",
        "Wir bieten Streusalz im 1-Tonnen-BigBag sowie Sackware an. Eine Palette Sackware enthält 40 Säcke à 25 kg, insgesamt 1.000 kg. Der aktuelle Gesamtpreis inklusive Lieferung wird für die gewählte Gebindeart und Menge im Bestellformular ermittelt.",
        "Je Lkw-Ladung (23 t) wird eine Gebindeart gewählt. Eine Bestellung an eine Lieferadresse kann mehrere Ladungen mit unterschiedlichen Gebindearten enthalten. Beispiel: 23 t BigBags und 23 t 25-kg-Sackware ergeben 46 t in einer Bestellung mit zwei Lkw und einer gemeinsamen Rechnung. Die Menge je Gebindeart muss ein ganzzahliges Vielfaches von 23 Tonnen sein.",
        "Für die vereinbarte Beschaffenheit sind die Produktbeschreibung und die Angaben in unserer Auftragsannahme maßgeblich. Als historisch gekennzeichnete Spezifikationen werden vor der Annahme mit dem Lieferanten abgeglichen. Illustrationen und KI-generierte Bilder dienen der Veranschaulichung und sind keine Zusicherung bestimmter Verpackungsdetails oder eine Qualitätsgarantie."),
      section("vertrag", "3. Bestellung und Vertragsschluss",
        "Die Produktdarstellung und die Preisberechnung sind noch kein verbindliches Verkaufsangebot. Der angezeigte aktuelle PLZ-Preis ist während seiner Gültigkeit die verbindliche Preisgrundlage Ihrer Bestellung. Sie können Eingaben im Bestellformular vor dem Absenden korrigieren. Mit dem Button „Zahlungspflichtig bestellen“ geben Sie ein verbindliches Angebot zum Abschluss des jeweils angezeigten Kaufvertrags ab.",
        "Die unmittelbar nach Bestellung versandte Danke-Mail bestätigt nur den Eingang der Bestellung. Sie stellt weder eine Auftragsannahme noch eine Rechnung oder eine verbindliche Lieferzusage dar.",
        "Wir stimmen die Lieferung mit Ihnen ab. Anschließend erhalten Sie eine ausdrückliche Auftragsannahme in Form Ihrer Auftragsbestätigung zusammen mit Ihrer Rechnung per E-Mail. Der Vertrag kommt durch diese ausdrückliche Annahmeerklärung zustande; eine bloße technische Bestätigung oder ein interner Statuswechsel genügt nicht.",
        "Sollten wir den Auftrag nicht oder nur zu geänderten Bedingungen annehmen können, informieren wir Sie. Änderungen von Menge, Preis, Fracht oder vereinbarter Leistung bedürfen Ihrer Zustimmung; sie werden nicht stillschweigend übernommen. Die gesetzlichen Regeln zu Angebot und Annahme bleiben unberührt.",
        "Vertragssprache ist Deutsch. Wir speichern die auftragsbezogenen Daten und die bei Bestellung geltenden Bedingungen. Die AGB erhalten Sie mit der Eingangsbestätigung und erneut mit der Auftragsannahme auf einem dauerhaften Datenträger per E-Mail."),
      section("gemeinschaft", "4. Gemeinschaftsbestellungen und Vertretung",
        "Bis zu drei Unternehmen oder öffentliche Auftraggeber können genau eine 23-Tonnen-Ladung einer Gebindeart teilen. Der Kunde gibt die Teilmenge je Teilnehmer in vollen Tonnen an; zusammen müssen die Teilmengen genau 23 Tonnen ergeben. Alle angegebenen Lieferadressen müssen untereinander in beiden Fahrtrichtungen höchstens 20 Straßenkilometer auseinanderliegen. Lieferungen sind nur innerhalb Deutschlands möglich.",
        "Der Besteller muss zur Abgabe der jeweiligen Angebote und zur Übermittlung der Angaben für alle angegebenen Auftraggeber berechtigt sein. Er bestätigt, dass Mengen, Lieferanschriften und die Teilnahme mit den vertretenen Auftraggebern abgestimmt sind. Jeder Teilnehmer wird mit eigenem Namen, Kontakt, Lieferanschrift und Rechnungsanschrift angegeben.",
        "Jeder teilnehmende Auftraggeber erhält eine eigene Auftragsannahme und Teilrechnung über seinen Gesamtpreis inklusive Lieferung. Er schuldet nur seinen eigenen Teilbetrag, nicht automatisch die Beträge anderer Teilnehmer. Durch die Gemeinschaftsbestellung wird keine gesamtschuldnerische Zahlungspflicht vereinbart.",
        "Die gemeinsame Kalkulation setzt die angegebenen Teilnehmer, Mengen und Lieferadressen voraus. Änderungswünsche nach Bestellabgabe werden individuell abgestimmt. Eine daraus folgende neue Gesamtmenge oder Frachtverteilung wird nur mit entsprechender Vereinbarung Vertragsbestandteil."),
      section("preise", "5. Preise inklusive Lieferung und Umsatzsteuer",
        "Der angezeigte aktuelle Preis enthält die Lieferung. Es werden keine zusätzlichen Lieferkosten aufgeschlagen oder als eigene Rechnungsposition berechnet. Nettobetrag inklusive Lieferung, gesetzliche Umsatzsteuer von derzeit 19 % und Bruttobetrag werden vor Absenden der Bestellung angezeigt.",
        "Bei einer Bestellung für einen Auftraggeber wird der Gesamtpreis anhand der Liefer-Postleitzahl und der gewählten Mengen je Gebindeart bestimmt. Bei unterschiedlichen Gebindearten enthält die gemeinsame Rechnung eine Position je Gebindeart. Straße und Hausnummer innerhalb derselben Liefer-PLZ verändern diesen Preis nicht. Die vollständige Lieferadresse wird vor Bestellabschluss auf eindeutige Zuordnung und Erreichbarkeit geprüft.",
        "Bei Gemeinschaftsbestellungen wird der Gesamtpreis inklusive Lieferung anhand aller vollständigen Lieferadressen und der Gesamtmenge ermittelt. Die interne Lieferkalkulation wird nach den Tonnenanteilen verteilt; Rundungsreste werden centgenau zugeordnet. Jeder Auftraggeber sieht seinen eigenen Gesamtpreis inklusive Lieferung. Die Umsatzsteuer wird auf jeder Teilrechnung separat berechnet und gerundet; der angezeigte Gesamtbetrag ist die Summe der Teilrechnungen.",
        "Der aktuelle PLZ-Preis gilt für die angegebene Liefer-PLZ, Menge und Gebindeart 30 Minuten ab Berechnung, längstens bis zum Tageswechsel. Die anschließende Adressprüfung verlängert diese Preisgültigkeit nicht. Eine Änderung von PLZ, Menge oder Gebindeart erfordert einen neuen Preisabruf. Bei Gemeinschaftsbestellungen gilt die Kalkulation für die angegebenen Mengen und vollständigen Lieferadressen 30 Minuten, längstens bis zum Tageswechsel. Bereits angenommene Preise werden nicht einseitig geändert."),
      section("zahlung", "6. Rechnungskauf und Zahlungsziel",
        "Die Zahlung erfolgt auf Rechnung. Der jeweilige Rechnungsbetrag ist 14 Kalendertage nach der tatsächlichen Lieferung an den betreffenden Auftraggeber fällig. Der Rechnungsbetrag ist vollständig ohne Abzug zu zahlen. Skonto wird nicht gewährt. Die Frist beginnt nicht mit dem Rechnungsdatum und nicht mit einem nur voraussichtlichen Liefertermin.",
        "Die Rechnung benennt zunächst diese Zahlungsbedingung. Nach Erfassung der tatsächlichen Lieferung teilen wir das konkrete Fälligkeitsdatum mit dem Lieferschein per E-Mail mit. Eine bereits geleistete Zahlung wird dadurch nicht erneut fällig.",
        "Bitte überweisen Sie auf die in Ihrer Rechnung genannte Bankverbindung und geben Sie die Rechnungsnummer als Verwendungszweck an. Verzugsfolgen richten sich nach den gesetzlichen Vorschriften. Gesetzliche Einreden und sonstige Zahlungsrechte bleiben unberührt.",
        "Mit Ihrer Bestellung stimmen Sie dem Versand von Rechnungen und Lieferscheinen per E-Mail als PDF zu, soweit diese Rechnungsform gesetzlich zulässig ist. Gesetzliche Pflichten und Rechte hinsichtlich strukturierter E-Rechnungen werden durch diese Zustimmung nicht eingeschränkt."),
      section("lieferung", "7. Liefergebiet und Liefertermine",
        "Wir liefern innerhalb Deutschlands. Der bei Bestellung genannte voraussichtliche Liefertermin wird als Bestelltag plus fünf Werktage berechnet. Als Werktage zählen hier Montag bis Freitag ohne gesetzliche Feiertage des Bundeslandes der Lieferadresse. Lokale Sonderfeiertage prüfen wir bei der Auftragsfreigabe manuell.",
        "Der so angezeigte Termin ist eine Prognose, keine garantierte Fixfrist. Ein verbindlicher Liefertermin bedarf einer ausdrücklichen Vereinbarung. Erkennbare Änderungen teilen wir Ihnen mit und stimmen die Anlieferung mit Ihnen ab. Ihre gesetzlichen Rechte bei Lieferverzögerungen bleiben unberührt.",
        "Bei mehreren Lieferadressen kann das tatsächliche Lieferdatum je Teilnehmer unterschiedlich sein. Zahlungsfristen werden deshalb je Teilnehmer anhand seiner tatsächlichen Lieferung bestimmt."),
      section("entladung", "8. Zufahrt, Ansprechpartner und Entladung",
        "Der Kunde stellt eine sichere, für schwere Lkw geeignete und rechtlich zulässige Zufahrt sowie eine geeignete Anlieferstelle bereit. Beschränkungen wie Gewichtslimits, enge Zufahrten, fehlende Durchfahrtshöhen oder feste Zeitfenster sind vor Auftragsannahme mitzuteilen.",
        "Der Kunde organisiert die geeignete und sichere Entladung, insbesondere erforderliche Geräte und entsprechend befugte beziehungsweise geschulte Personen. Die Lieferung beinhaltet nicht ohne besondere Vereinbarung eine Kran-, Hebebühnen- oder andere Entladeleistung.",
        "Sonderleistungen sowie deren Kosten werden vorab ausdrücklich vereinbart. Bei Problemen mit Zufahrt oder Entladung kontaktieren Sie uns unverzüglich. Zusätzliche Kosten entstehen nur, soweit sie vereinbart oder nach den gesetzlichen Vorschriften geschuldet sind."),
      section("nachweise", "9. Lieferung, Gefahrübergang und Nachweise",
        "Der Gefahrübergang richtet sich nach den gesetzlichen Vorschriften für den betreffenden Kaufvertrag. Eine abweichende Vereinbarung bedarf einer ausdrücklichen Abstimmung.",
        "Der nach Lieferung per E-Mail bereitgestellte Lieferschein dokumentiert die von uns erfasste Lieferung und die zugehörige Warenmenge. Er ist keine unterschriebene Empfangsquittung und ersetzt keinen vom Empfänger bestätigten Transportnachweis. Bei Abweichungen nehmen Sie bitte umgehend Kontakt mit uns auf."),
      section("maengel", "10. Mängelrechte und Produkteinsatz",
        "Die gesetzlichen Mängelrechte gelten. Soweit es sich um ein beiderseitiges Handelsgeschäft handelt, gelten insbesondere die gesetzlichen Untersuchungs- und Rügepflichten nach § 377 HGB. Für andere Kunden, insbesondere öffentliche Auftraggeber ohne Kaufmannseigenschaft, werden dadurch keine zusätzlichen kaufmännischen Rügepflichten geschaffen.",
        "Bitte lagern Sie Streusalz trocken und geschützt und beachten Sie die geltenden örtlichen Regelungen für dessen Einsatz. Die Wirkung hängt unter anderem von Temperatur, Witterung und Dosierung ab. Dies beschränkt keine gesetzlich bestehenden Mängelrechte."),
      section("haftung", "11. Haftung",
        "Unsere Haftung richtet sich nach den gesetzlichen Vorschriften. Diese AGB enthalten keinen pauschalen Haftungsausschluss, insbesondere nicht für Schäden an Leben, Körper oder Gesundheit, für Vorsatz oder für gesetzlich zwingende Haftung."),
      section("eigentum", "12. Eigentumsvorbehalt",
        "Die gelieferte Ware bleibt bis zur vollständigen Bezahlung des auf sie entfallenden Rechnungsbetrags unser Eigentum. Bei Gemeinschaftsbestellungen bezieht sich dieser Vorbehalt auf die jeweils an den einzelnen Teilnehmer gelieferte Ware."),
      section("datenschutz", "13. Datenschutz und Kommunikation",
        "Personenbezogene Kontakt- und Bestelldaten werden für Anfrage, Vertragsschluss, Lieferung, Rechnungsstellung und erforderliche Nachweise verarbeitet. Die Routenberechnung benötigt die Lieferanschriften. Einzelheiten, Empfänger und Ihre Rechte sind in unserer Datenschutzerklärung beschrieben.",
        "Die Zustimmung zum Vertrags- und Dokumentversand per E-Mail ist keine Einwilligung in Werbung oder Analyse. Es wird dadurch kein Newsletter abonniert."),
      section("schluss", "14. Schlussbestimmungen",
        "Es gilt deutsches Recht. Für die gerichtliche Zuständigkeit gelten die gesetzlichen Regelungen. Individuelle Vereinbarungen und zwingende gesetzliche Vorschriften gehen diesen Bedingungen vor."),
    ],
  };
}
export function privacyDocument(): LegalDocument {
  const company = seller();
  const privacy = privacySettings();
  if (process.env.PRIVACY_TEXT) return { title: "Datenschutzerklärung", date: date(), sections: [section("hinweise", "Datenschutzhinweise", process.env.PRIVACY_TEXT)] };
  const missing = "Noch nicht festgelegt – vor der Live-Freischaltung zu ergänzen";
  return {
    title: "Datenschutzerklärung",
    date: date(),
    sections: [
      section("verantwortlicher", "1. Verantwortlicher und Datenschutzkontakt",
        `Verantwortlich für die Verarbeitung personenbezogener Daten ist ${company.name}, Einzelunternehmer und Inhaber von Streusalz Großhandel, ${company.street}, ${company.postcode} ${company.city}, Deutschland. Allgemeiner Kontakt: ${company.email}.`,
        `Datenschutzanfragen richten Sie bitte an ${privacy.contactEmail}. Diese Adresse ist ein Kontakt für Datenschutzanliegen; sie bezeichnet nicht automatisch einen förmlich bestellten Datenschutzbeauftragten.`),
      section("daten", "2. Datenarten und Herkunft",
        "Beim Besuch können technische Zugriffsdaten wie IP-Adresse, Zeitpunkt, angeforderte Seite, Browser-/Geräteinformationen und technische Fehler anfallen. Für eine Frachtanfrage verarbeiten wir Gebindeart, Mengen sowie Straße, Hausnummer, Postleitzahl und Ort der Lieferadressen.",
        "Bei einer Bestellung kommen Firmenname, Ansprechperson, E-Mail-Adresse, Telefon, gegebenenfalls USt-IdNr., Rechnungsanschrift, Bestellnummer, Bestell- und Lieferdaten, Preisbestandteile sowie Rechnungs- und Lieferscheindaten hinzu. Zahlungshinweise und geschäftliche Korrespondenz können zur Abwicklung hinzukommen.",
        "Diese Angaben erhalten wir von Ihnen. Bei Gemeinschaftsbestellungen können Kontakt- und Lieferdaten anderer Teilnehmer von dem berechtigten Besteller stammen. In diesem Fall erfolgen diese Hinweise auch nach Art. 14 DSGVO; die betroffenen Teilnehmer erhalten bei unserer ersten Kommunikation einen Hinweis auf die Datenschutzerklärung."),
      section("zwecke", "3. Zwecke und Rechtsgrundlagen",
        "Preisanfragen und die Abwicklung eines Vertrags mit einer natürlichen Person als Unternehmer erfolgen auf Grundlage von Art. 6 Abs. 1 Buchst. b DSGVO. Bei Beschäftigten, Ansprechpartnern und Vertretern eines Unternehmens oder eines öffentlichen Auftraggebers ist Art. 6 Abs. 1 Buchst. f DSGVO Grundlage; unser berechtigtes Interesse ist die Vorbereitung und Durchführung der Geschäftsbeziehung.",
        "Buchführung, steuerliche Nachweise und gesetzliche Aufbewahrung beruhen auf Art. 6 Abs. 1 Buchst. c DSGVO. Die sichere Bereitstellung der Website, Adminauthentifizierung, Missbrauchsabwehr und Nachvollziehbarkeit von Freigaben beruhen auf Art. 6 Abs. 1 Buchst. f DSGVO. Unsere Interessen sind IT-Sicherheit und eine zuverlässige Auftragsabwicklung.",
        "Die Datenschutzerklärung ist eine Information, keine pauschale Einwilligung. Für Vertragsabwicklung oder notwendige Sicherheitsfunktionen wird keine zusätzliche Werbeeinwilligung verlangt."),
      {
        ...section("hosting", "4. Hosting und Zugriffsdaten",
          "Für den vorgesehenen Produktionsbetrieb nutzen wir Vercel Inc., USA, als Hostinganbieter. Beim Aufruf werden die für die Übertragung und den sicheren Betrieb nötigen Zugriffsdaten durch die Hostinginfrastruktur verarbeitet. In der lokalen Entwicklung läuft die Vorschau auf dem Entwicklungsrechner statt im produktiven Vercel-Hosting.",
          privacy.hostingLogDays === null ? `Aufbewahrungsdauer der produktiven Hosting-Zugriffsprotokolle: ${missing}.` : `Für produktive Hosting-Zugriffsprotokolle ist eine Aufbewahrungsdauer von ${privacy.hostingLogDays} Tagen festgelegt. Abweichende, notwendige Sicherung konkreter Vorfälle erfolgt nur im erforderlichen Umfang.`,
          "Der Betreiber muss vor Produktionsstart den passenden Auftragsverarbeitungsvertrag und die tatsächlichen Protokoll-, Regionen- und Zugriffseinstellungen einrichten. Eine ausgewählte EU-Region schließt mögliche Drittlandzugriffe nicht automatisch aus."),
        links: [{ label: "Vercel: Auftragsverarbeitungsvertrag", href: "https://vercel.com/legal/dpa" }, { label: "Vercel: Datenschutzinformationen", href: "https://vercel.com/legal/privacy-policy" }],
      },
      {
        ...section("routing", "5. Adressprüfung und Lieferkostenberechnung",
          "Wenn Sie die Lieferkostenberechnung ausdrücklich anfordern, prüft unser Server die Lieferadressen und ermittelt die Straßenstrecke über OpenRouteService, angeboten von HeiGIT gGmbH, Deutschland.",
          "Hierfür werden die eingegebenen Lieferanschriften zur Geocodierung sowie anschließend die für die Route benötigten Koordinaten an den Dienst übermittelt. Firmenname, Ansprechperson, E-Mail-Adresse und Telefonnummer werden für diese API-Anfragen nicht mitgesendet. Die Anfrage erfolgt über unseren Server, nicht durch ein eingebettetes Tracking-Skript im Browser.",
          "Rechtsgrundlage ist die Bearbeitung der von Ihnen angeforderten vorvertraglichen Frachtanfrage nach Art. 6 Abs. 1 Buchst. b DSGVO beziehungsweise bei Unternehmensvertretern das berechtigte Interesse nach Art. 6 Abs. 1 Buchst. f DSGVO. Die Verarbeitung durch den Anbieter und dessen Aufbewahrung sind zusätzlich anhand seiner aktuellen Dienstbedingungen zu prüfen."),
        links: [{ label: "HeiGIT: Datenschutzinformationen", href: "https://heigit.org/privacy-policy/" }],
      },
      section("empfaenger", "6. Datenbank, E-Mail und weitere Empfänger",
        `Produktive Datenbank: ${privacy.databaseProvider || missing}. Verarbeitungsland beziehungsweise vereinbarte Region: ${privacy.databaseCountry || missing}.`,
        `E-Mail-/SMTP-Dienst: ${privacy.mailProvider || missing}. Verarbeitungsland beziehungsweise vereinbarte Region: ${privacy.mailCountry || missing}.`,
        "Über den E-Mail-Dienst versenden wir Eingangsbestätigungen, Auftragsannahmen, Rechnungen und Lieferscheine. Diese Nachrichten enthalten die für den jeweiligen Teilnehmer nötigen Bestell- und Vertragsangaben. Wir bauen keine Öffnungs- oder Marketing-Trackingpixel in diese Nachrichten ein.",
        "Soweit für die Lieferung erforderlich, erhalten der beauftragte Lieferant und Transportdienstleister Lieferadresse, Ansprechpartner, Erreichbarkeit und Warenmenge. Weitere Empfänger können Banken, Steuerberatung, rechtliche Beratung und zuständige Behörden sein, soweit dies zur Zahlung, zur Erfüllung rechtlicher Pflichten oder zur Rechtsverfolgung erforderlich ist.",
        "Auftragsverarbeiter werden im Rahmen der gesetzlich erforderlichen Vereinbarungen eingesetzt. Andere Empfänger können für ihre jeweiligen Aufgaben eigenständig Verantwortliche sein. Es erfolgt kein Verkauf von Kundendaten zu Werbezwecken."),
      section("drittland", "7. Übermittlungen in Drittländer",
        "Bei Vercel und gegebenenfalls weiteren eingesetzten Diensten können Verarbeitungen oder Zugriffe außerhalb des Europäischen Wirtschaftsraums, insbesondere in den USA, stattfinden.",
        privacy.transferDetails || "Der konkret eingesetzte Übermittlungsmechanismus und die Prüfung der Anbieter sind noch offen. Vor Live-Freischaltung müssen die tatsächlichen Garantien nach Art. 44 ff. DSGVO dokumentiert sein. Mögliche Mechanismen sind ein anwendbarer Angemessenheitsbeschluss bei einem erfassten und gültig zertifizierten Anbieter oder vereinbarte Standardvertragsklauseln mit erforderlichen ergänzenden Maßnahmen; ihr Vorliegen wird hier nicht ungeprüft behauptet.",
        `Informationen und gegebenenfalls eine Kopie der einschlägigen Garantien können Sie unter ${privacy.contactEmail} anfordern.`),
      section("speicherfristen", "8. Aufbewahrung und Löschung",
        "Wir speichern Daten nur so lange, wie sie für den jeweiligen Zweck oder eine gesetzliche Pflicht erforderlich sind. Rechnungen und Buchungsbelege sind grundsätzlich acht Jahre, Handels- und Geschäftsbriefe grundsätzlich sechs Jahre und bestimmte Bücher beziehungsweise andere gesetzlich erfasste Unterlagen zehn Jahre aufzubewahren. Maßgeblich sind die jeweils geltenden gesetzlichen Vorschriften und der gesetzliche Fristbeginn.",
        "Andere Anfrage-, Kontakt- und Auftragsdaten werden gelöscht, wenn sie für Anfrage, Vertragsabwicklung, Nachweise und die Bearbeitung möglicher Ansprüche nicht mehr benötigt werden und keine vorrangige Aufbewahrungspflicht besteht. Nicht jede Kontaktangabe darf allein wegen einer Rechnung pauschal unbegrenzt gespeichert werden.",
        "Die Auftragsverwaltung enthält gespeicherte Dokumentstände und Freigabeprotokolle. Ihre Aufbewahrung, Zugriffsbegrenzung, Datensicherung und fristgerechte Löschung sind vom Betreiber sicherzustellen; die bloße Bereitstellung des Shops ersetzt kein rechtskonformes Archivierungskonzept."),
      section("cookies", "9. Cookies und notwendiger Sitzungsspeicher – kein Einwilligungsbanner",
        "Der öffentliche Shop setzt derzeit keine Analyse-, Werbe- oder Marketing-Cookies ein. Es werden keine externen Analysewerkzeuge, Werbenetzwerke oder Social-Media-Trackingmodule eingebunden. Externe Schriftarten werden nicht aus dem Browser nachgeladen.",
        "Der geschützte Adminbereich setzt nach ausdrücklicher Anmeldung das technisch notwendige Cookie „streusalz-admin“. Es dient ausschließlich der Authentifizierung, gilt höchstens acht Stunden und wird bei Abmeldung gelöscht. Es ist HttpOnly und SameSite geschützt und wird in Produktion nur über HTTPS übertragen.",
        "Nach einer Bestellabgabe nutzt der Shop sessionStorage: „streusalz-pending-request“ enthält eine Anfrage-ID und einen Hash der Eingaben zur Vermeidung von Doppelbestellungen; „streusalz-receipt“ enthält die Bestellnummer und den Hinweis auf den E-Mail-Versand für die Danke-Seite. Vollständige Bestelladressen werden dort nicht gespeichert. Der Anfrageeintrag wird bei erfolgreichem Abschluss entfernt; der übrige Speicher ist an die Browsersitzung gebunden.",
        "Diese Funktionen dienen den ausdrücklich angeforderten Diensten Anmeldung beziehungsweise Bestellabschluss. Soweit die Speicherung hierfür unbedingt erforderlich ist, ist nach § 25 Abs. 2 Nr. 2 TDDDG keine Einwilligung erforderlich. Deshalb wird derzeit kein Cookie-Einwilligungsbanner angezeigt. Das bedeutet nicht, dass überhaupt keine Informationen auf Endgeräten gespeichert werden.",
        "Sollten später nicht notwendige Analyse- oder Marketingtechnologien hinzukommen, müssen diese vor Aktivierung gesondert geprüft und gegebenenfalls erst nach Einwilligung eingesetzt werden."),
      section("sicherheit", "10. Sicherheit und Missbrauchsabwehr",
        "Der produktive Betrieb verwendet HTTPS. Administrative Funktionen sind zugangsgeschützt; Passwörter werden nicht als Klartext gespeichert. Freigaben und Dokumentversand werden für die Auftragsabwicklung protokolliert.",
        "Für die Begrenzung missbräuchlicher Anfragen werden serverseitig gehashte, zweckgebundene Zugriffsschlüssel und zeitlich begrenzte Zähler verarbeitet. Diese Schlüssel sind pseudonymisierte, nicht zwingend anonyme Daten. Abgelaufene Datensätze werden beim täglichen Bereinigungslauf entfernt, sobald sie seit mehr als einem Tag abgelaufen sind.",
        "Eine Frachtberechnung basiert auf Gebinde, Menge und Straßenroute, nicht auf Werbeprofilen. Erfolgreiche Antworten zur Adress- und Routenprüfung werden serverseitig für bis zu 24 Stunden zwischengespeichert, um wiederholte Übermittlungen zu vermeiden und den Dienst zuverlässig bereitzustellen. Die Auftragsannahme und Rechnungsfreigabe erfolgen manuell."),
      {
        ...section("rechte", "11. Ihre Rechte",
          "Sie haben nach Maßgabe der DSGVO Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Gesetzliche Aufbewahrungspflichten können einer sofortigen Löschung entgegenstehen.",
          "Soweit die Verarbeitung auf Art. 6 Abs. 1 Buchst. f DSGVO beruht, können Sie aus Gründen Ihrer besonderen Situation nach Art. 21 DSGVO widersprechen. Gegen Direktwerbung besteht ein jederzeitiges Widerspruchsrecht; der Shop führt derzeit keine entsprechende Werbeverarbeitung durch.",
          "Soweit im Einzelfall eine Verarbeitung auf gesonderter Einwilligung beruht, können Sie diese jederzeit mit Wirkung für die Zukunft widerrufen. Die Rechtmäßigkeit der vorherigen Verarbeitung bleibt unberührt.",
          `Zur Ausübung Ihrer Rechte wenden Sie sich an ${privacy.contactEmail}. Sie können sich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere am Ort Ihres Aufenthalts, Arbeitsplatzes oder des vermuteten Verstoßes. Für den Sitz des Anbieters ist der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz zuständig.`),
        links: [{ label: "Datenschutzaufsicht Rheinland-Pfalz", href: "https://www.datenschutz.rlp.de/" }],
      },
      section("pflichtangaben", "12. Erforderlichkeit der Angaben und Änderungen",
        "Die im Bestellformular als erforderlich gekennzeichneten Angaben benötigen wir für eindeutige Kalkulation, Vertragsschluss, Rechnung und Lieferung. Ohne sie kann die jeweilige Anfrage oder Bestellung nicht bearbeitet werden. Eine USt-IdNr. des Kunden ist im Formular optional.",
        "Bei Änderungen von Diensten, Verfahren oder rechtlichen Vorgaben passen wir diese Hinweise an. Die jeweils bei einer Bestellung gültige Fassung wird zusammen mit dem Auftrag gespeichert."),
    ],
  };
}
export function documentText(document: LegalDocument) {
  return `${document.title}\nStand: ${document.date}\n\n${document.sections.map(section =>
    `${section.heading}\n${section.paragraphs.join("\n\n")}${section.links?.length ? `\n\n${section.links.map(link => `${link.label}: ${link.href}`).join("\n")}` : ""}`,
  ).join("\n\n")}`;
}
export function legalTexts() {
  const terms = documentText(termsDocument());
  const privacy = documentText(privacyDocument());
  return { terms, privacy, version: createHash("sha256").update(JSON.stringify({ terms, privacy })).digest("hex") };
}
