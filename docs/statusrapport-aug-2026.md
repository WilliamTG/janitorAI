# DocrAI — statusrapport, første del av august 2026

Fra tre innspillsdokumenter til et kjørende produkt med salgsflate, markeds-
liste og pilotklar kjerne — dette er gjort, verifisert og pushet.

## 1. Bygget i produktet (alt live-verifisert)

**Tillitskjeden — produktets ryggrad:**
- **Godkjenningsstempel:** rapporten er et eksplisitt AI-utkast til
  takstpersonen aktivt godkjenner med navn og tidspunkt. Deling er sperret i
  både app og server (409 uten stempel) — ansvarsmodellen håndheves i
  produktet, ikke i avtaletekst.
- **Versjonert AI-utkast med felt-diff:** AI-motorens strukturerte analyse
  (skadested, kilde, årsak, beskrivelse, omfang, tiltak) arkiveres uendret;
  takstpersonen redigerer en egen versjon **direkte i ferdig rapportvisning**
  med «endret»-merker per felt. Rettelse etter godkjenning nullstiller
  stempelet automatisk. Mottakeren ser den godkjente versjonen pluss
  tillitslinjen «N felter faglig korrigert av takstpersonen fra AI-utkastet».
  Diffen er samtidig pilotens kvalitetsmåling av AI-en.
- **Beviskjede:** geo, klokkeslett og SHA-256 settes i fangstøyeblikket;
  PIN-beskyttet deling uten mottakerkonto, med HMAC-tokens og
  forsøksbegrensning.

**Feltopplevelsen:**
- **Befaringsløype rom for rom:** romstripe med standardens taksonomi
  (inkl. «Rom under terreng»), aktivt rom som fangstkontekst og filter,
  og **huskeliste for våtrom** som dukker opp automatisk (sluk/klemring,
  membranovergang, fuktmåling med verdi, oversiktsbilde). Romnavnet følger
  notatet helt inn i AI-analysen.
- **Norsk fagterm-transkripsjon:** prompten er norsk-først med ~50
  byggtekniske termer (klemring, svill, diffusjonssperre …) og ordrett-regler
  for mål og romnavn.
- **Tid-til-godkjent-metrikk:** «Befaring → godkjent rapport: 1 t 19 m» på
  prosjektkort og i godkjenningskortet — casestudie-valutaen, målt fra sak én.

**Saksunderlaget (fra tidligere i perioden, i drift):** adresse inn → kart,
matrikkel, bygningstype, kulturminneflagg, terrenghøyde og vær fra sju åpne
offentlige datalag — uten én avtale. «Se mer»-seksjonen samler alt
vannskaderelevant innsyn (plansaker, NVE, NGU, flyfoto, Boligmappa).

**Salg og kampanjeflater:**
- **Offentlig demo** (`/demo?adresse=…`): kampanjekroken — mottakeren ser
  sitt eget kontor i saksunderlaget på ~2 sekunder, uten innlogging.
  Rate-begrenset, verifisert mot ekte kilder.
- **Salgsside** (`/om`): problem-først, kvantifisert løfte (2 t → 15 min),
  fem grunner, ansvarsseksjon og transparente prisnivåer (pilot gratis /
  990 kr veiledende / foretak) — mønsteret Befar og Wenn har og vi manglet.

**Identitet:** hele opplevelsen (app + alle sider) samlet på én troverdig
palett — varm papirhvit, dempet stålblå, murstensrød, glassmorfisme og
gradienter fjernet. Tre fargealternativer (Stålblå/Granskog/Skifer) bygget
som komplette tokenverdener og vist på kjørende app, med live-velger så
pilotbrukere kan stemme.

**Kvalitetssikring:** 31 grønne e2e-sjekker mot ekte Postgres (delingskjede,
godkjenningsport, versjoner/diff), ren TypeScript og Python, alle flater
pikselverifisert i nettleser (desktop + mobil), ekte app-skjermbilder
produsert fra kjørende bygg.

## 2. Marked, konkurrenter og strategi

- **In4mo (Solera):** feltappen har 1,9★ med tiår gamle feil — anmelderne er
  målgruppen vår, bundet via If/Frende. Strategi: lever inn i deres flyt,
  vinn brukeren på feltopplevelse. Sju konkurrent-erfaringer er formalisert
  som produktprinsipper.
- **Wenn Property:** full gjennomgang — 5,0★, tale→rapport per rom/fag,
  prising 350/999 kr/mnd uten binding (validerer vårt prispunkt), og
  MesterAlliansen-avtalen som mal for vårt Norsk takst-spor.
- **Befar (ny konkurrent oppdaget og dybdeanalysert):** fagfolk-bygget
  NS 3600-app for bolighandel; 500 kr/rapport + 2 000 kr/år standardlisens.
  De smarteste grepene deres er inkorporert: redigering i ferdig
  rapportvisning, adaptiv sjekkliste, regelverk-i-felt, formuleringsbibliotek.
  Grensen som beskytter oss: de selger uavhengighet fra forsikring — vårt
  marked ER forsikringsflyten.
- **NS 3600:2025-funnet:** standarden krever nå årsak/konsekvens/tiltak for
  alle TG2/TG3-avvik — strukturen motoren vår produserer. Tilstandsrapport
  er en naturlig vekstflate etter pilot.
- **USA-dybdeanalyse:** fire lag i verdikjeden; ingen bygger forensisk
  årsaksrapportering (beskyttet nisje); Encircle→Xactimate-presedensen for
  in4mo-eksporten; prising validert mot Spectora; alle som gikk utenom
  skinnen, tapte.
- **Kampanje (ABM, ikke annonser):** hele markedet er ~1 300 sertifiserte i
  ~700 foretak — under terskelen der betalt sosialt virker. Markedslisten er
  **hentet: 1 049 foretak fra Brreg** (704 AS i eiendomssegmentet, 299 med
  e-post), scoret etter kampanjemodellen, med lovlig kanalvalg per orgform
  (mfl. § 15). Tilstandsmaskin for kontakt, tre budskapsvarianter, 90-dagers
  kjøreplan.
- **Navn:** tre kriteriebaserte kandidater utredet med domenesjekk —
  anbefaling **Påvist** (paavist.no/.com ser ledige ut), foran Årsak og
  Skadeklar.

## 3. Presentasjonsmateriell (alle publisert og à jour)

Produktflaten (16 skjermer med ærlige statuser), løsningsskissen (posisjon,
sprinter, økosystem), totalbildet (flyt + kostnadsstack), kundereisen
(animert, mobilstøtte), saksunderlag-demo, UI-endringer før/etter, og
fargealternativene — alt synkronisert med samme status og identitet.

## 4. Sikkerhet, lansering og herding (siste uke)

- **Lanseringssjekkliste (20 punkter):** FAQ, personvern, vilkår, takk- og
  merkevare-404-sider; pilotskjema med honeypot; cookiefri førstepartstelling
  (ingen samtykkebanner); robots.txt, sitemap.xml, favicon i tre størrelser,
  Open Graph + schema.org, sticky mobil-CTA.
- **Sikkerhetsrevisjon (42 funn, alle adversarielt etterprøvd):** 9 bekreftede
  hull tettet — tenant-skoping på media, MIME-whitelist mot lagret XSS, eierskap
  på nedlasting/rapport, signerte kortlevde medie-URL-er (token forlater aldri
  serveren), uforutsigbare UUID-er, global feilhåndterer, 0 sårbarheter i
  api-treet. Full oversikt: `sikkerhetsrevisjon-aug-2026.md`.
- **Fagkart for lansering:** status per 15 fagområder med launch-gate —
  `fagkart-lansering.md`. Denial-of-Wallet-vern (timeouts), sikkerhets-headere,
  fokusmarkering (WCAG) og CI (e2e + audit + Dependabot) er bygget.
- **Kvalitetssikring i CI:** GitHub Actions kjører delings-e2e mot ekte Postgres,
  typesjekk og `npm audit` på hver push; Dependabot holder avhengigheter oppdatert.

**Compliance er blindsonen, ikke koden.** Det som gjenstår før pilot med ekte
persondata er avtaler og beslutninger, ikke bygging: databehandleravtaler,
EU/EØS-flytting av AI-prosessering + TIA, DPIA, og driftsoppsett (Sentry, testet
backup-restore). Se launch-gaten i fagkartet.

## 5. Status og neste steg

**11 av 16 skjermer i produktmodellen er bygget.** Gjenstående byggetrinn er
avtale-avhengige: in4mo-eksport (trenger feltkartlegging med pilotbruker),
NVE-risikoflagg (API må verifiseres fra produksjonsmiljø), plantegning
(kommune/Boligmappa), SINTEF-lisens (kritisk sti for Byggforsk-RAG), og
Vertex/EU-flytting med Google Docs-utfasing før pilotdata.

**Neste flaskehals er ikke kode — det er pilotrekruttering.** Kampanjen har
alt: liste, krok (/demo), salgsside (/om), lovlig kanalvalg og måltall.
Målet står: 5–8 pilotforetak, og en pilot som måler seg selv (tid, diff,
leveranse).
