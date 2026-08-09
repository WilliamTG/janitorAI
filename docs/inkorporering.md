# Sammenstilling: hva DocrAI bør inkorporere

Skrevet august 2026. Destillerer USA-analysen (`analyse-usa-proptech.md`),
konkurrenterfaringene (`erfaringer-konkurrenter.md`) og faseanalysen til én
liste: hva vi tar inn i løsningen, hvorfor, og når. Sortert etter horisont.
Prinsippet bak utvalget: vi kopierer *mønstre som er bevist i markedet*, men
bare der de forsterker kjernen vår (årsak + ansvar + norsk normverk) — aldri
der de gjør oss til enda et måle-/fotoverktøy.

## A. Nå (pre-pilot) — inn i produktet før første eksterne bruker

### A1. Guidet fangstløype per rom (Hover-mønsteret, vår vri)
Hover gjorde fangst til en *gåtur*: appen leder deg gjennom huset og
strukturerer alt underveis. Vi har fri fangst (notat/foto/video hvor som
helst). Inkorporér en lett «befaringsløype»: velg rom → fang bevis knyttet
til rommet → AI-en får romkontekst gratis (bedre årsaksanalyse, bedre
rapportstruktur). Ikke 3D, ikke måling — bare rom-tilknytning på det vi
allerede fanger.
**Status:** ikke bygget. Rom/fuktlogg-skjermen fra backloggen ER dette —
bygg den som løype, ikke som skjema.

### A2. Tale-først i felt (FieldScribe-mønsteret)
Amerikanske adjustere *snakker* rapporten sin; AI-en strukturerer. Vi har
lydnotat + transkripsjon — forsterk til førsteklasses innsatsvei: norsk
fagterm-prompt (allerede planlagt i faseplanen), og la rapportmotoren
eksplisitt bruke tale som primærkilde med foto/video som bevisanker.
**Status:** bygget (aug 2026). Transkripsjonsprompten er norsk-først med ~50
byggtekniske fagtermer og ordrett-regler for mål og romnavn. Gjenstår:
prompt-regel i rapportmotoren om talens rolle som primærkilde.

### A3. Tid som innebygd metrikk (hele det amerikanske markedet)
Alle selger «dager spart» (snittsyklus USA: 32,4 dager). Instrumentér
produktet nå: tidsstempel befaring startet / rapport generert / rapport
godkjent / rapport delt — og vis «tid til godkjent rapport» i appen.
Dette er casestudie-valutaen; den må samles fra sak én.
**Status:** bygget (aug 2026). Beregnes fra tidsstempler sakene allerede
bærer (tidligste bevis → godkjenningsstempel) og vises på prosjektkortet og
i godkjenningskortet: «Befaring → godkjent rapport: 1 t 19 m».

### A4. Demo-modus med adresse-parameter (kampanjekroken + Spectora-lærdom)
Spectora vokste produktledet i et småforetaksmarked. Vår versjon:
`/demo?adresse=` som åpner saksunderlaget for mottakerens egen adresse uten
innlogging.
**Status:** bygget (aug 2026). `/demo?adresse=…` viser kart, matrikkel,
bygning, terreng og vær live uten innlogging; `/api/demo/underlag` er
rate-begrenset og returnerer kun beste treff. Komma i adressen normaliseres
(Geonorge-søket gir ellers null treff). Kampanjen kan rulle.

### A5. Rapportversjoner: AI-utkast ≠ godkjent versjon (faseplanen + Spectora AI)
Spectoras AI-assistent redigerer *per kommentar/felt* — takstpersonen flikker,
ikke omskriver. Forutsetningen er at utkast og endelig versjon er separate
objekter. Lagre AI-utkastet og den godkjente versjonen hver for seg i
Postgres (fjerner samtidig Google Docs-avhengigheten), med felt-nivå-diff.
**Status:** godkjenningsstempelet er bygget (commit 89dcccb); versjonslagring
og diff gjenstår. Diffen er pilotens mest verdifulle data.
**UX-krav (fra Befar-analysen, aug 2026):** redigeringen bygges i den
*ferdige rapportvisningen* — takstpersonen ser rapporten slik mottakeren får
den og redigerer direkte i den, aldri i separate skjemafelter med
eksport-hopping.

## B. Pilotfasen (1–3 mnd) — inn mens pilotene kjører

### B1. In4mo-eksport som «Encircle→Xactimate»-ekvivalent
Encircle bygde selskapet sitt på «felt → skinnens estimat på under 6 timer i
stedet for dager», via dyp Xactimate-integrasjon. Vår skinne er in4mo:
strukturert eksport som speiler feltene, sjekklistene og medieformatene
deres, kartlagt med en pilotbruker som leverer i in4mo i dag. Måltall: «tid
fra befaring ferdig til in4mo levert» før/etter.
**Status:** ikke bygget; strategisk avklart i kampanje- og faseplan.

### B2. Plantegning som underlag — aldri tegneverktøy (DocuSketch-mønsteret, snudd)
DocuSketch auto-genererer plantegninger fra 360-fangst fordi amerikanerne
mangler tegningsarkiv. Norge HAR arkivene (kommunale byggesaksarkiv,
Boligmappa). Vår vri forblir: hent godkjent tegning, la takstpersonen pinne
rom og skader på den. Kombinert med A1 gir det DocuSketch-resultatet uten
kamera-hardware og uten det forhatte tegneprogrammet fra in4mo.
**Status:** ikke bygget; henger på dokumentlag-avklaringene (kommune/Boligmappa).

### B3. Risikoflagg i saksunderlaget (CAPE-mønsteret)
CAPE selger *flagg* («utsatt for X»), ikke lenker. Vi har lenkene (NVE flom/
skred, NGU løsmasser) — løft de viktigste til automatiske flagg i sakskortet:
«Eiendommen ligger i NVE aktsomhetsområde for flom» rett i underlaget, med
lenken som dokumentasjon. Ett API-kall per lag, stor opplevd intelligens.
**Status:** delvis (lenker finnes; NVE punkt-API var utilgjengelig fra
sandkassen — verifiser fra produksjonsmiljø).

## C. Etter pilot (3–12 mnd) — produktlinjer amerikanerne har bevist

### C1. Selvbetjent kundefangst (Flyreel-mønsteret)
LexisNexis lanserte «huseieren filmer selv, AI-en strukturerer» som svar på
fagfolk-mangel — samme demografi treffer norske takstmiljøer. Vår versjon:
takstpersonen sender en lenke, kunden filmer guidet, saken ligger
forhåndsdokumentert når takstpersonen tar over. Samme motor, ny inngang —
og en naturlig oppsalgs-SKU.

### C2. Godkjenningsstempel → revisjonslogg → «bevispakke» (Verisk-nivået)
USA-oppkjøperne betalte for dokumentert integritet. Utvid stempelet vårt til
full audit-logg (hvem opprettet/redigerte/godkjente/delte, når) og pakk
sha256 + geo + tid + stempel som en synlig «bevispakke»-side i delte
rapporter. Er allerede skissert i tillitsanalysen; timing etter pilot.

### C3. Sketch/mål der det gir mening (Hover-mønsteret, kjøpt ikke bygget)
Hvis piloten viser behov for arealmål: lisensiér/integrér (magicplan-typen)
i stedet for å bygge — fangst-teknologi er råvare, og nei-lista vår forbyr
eget tegne-/måleverktøy.

## Fra Befar-analysen (aug 2026) — fire mønstre til

Befar (befar.io, bolighandel/NS 3600) er fagfolk-bygget, og de smarteste
grepene deres forsterker kjernen vår direkte:

1. **Redigering i ferdig rapportvisning** — allerede innarbeidet som UX-krav
   i A5: takstpersonen redigerer i rapporten slik mottakeren får den, aldri
   i skjemafelter med eksport-hopping.
2. **Adaptiv sjekkliste per rom** («alt du ikke trenger, forsvinner»): når
   rommet er et bad, vises våtromssjekkpunktene — sluk/klemring, membran,
   fuktmåling — og ingenting annet. Inn i A1 romløypa.
3. **Levende rapportkompletthet**: fangstskjermen viser hvor komplett saken
   er og hva som mangler *før takstpersonen forlater stedet* («mangler:
   oversiktsbilde · fuktmåling punkt A»). Dreper retur-befaringer — inn i
   A1/A5. Kompletthetskravene per skadetype defineres med faglig råd.
4. **Faglig formuleringsbibliotek**: observasjoner kobles til kuraterte,
   gjennomarbeidede formuleringer. For oss: AI-en formulerer *fra*
   biblioteket i stedet for fritt — mindre diktning, konsistente rapporter.
   Bygges som del av Byggforsk-RAG-arbeidet.
5. **Regelverket i felt** (fra app-skjermbildene, aug 2026): Befar viser
   selve kravet med illustrasjon der vurderingen gjøres (fall 1:100, 15 mm
   oppkant, membran 25 mm over topp sluk). Vår versjon: Byggforsk-kravet
   vises ved fangstpunktet — står du i våtrom ved sluk, ser du 727.121-kravet
   før du dokumenterer. RAG-en blir feltveiledning, ikke bare rapportsitater.
   Samme SINTEF-avklaring gjelder. I tillegg overtas rom-taksonomien deres
   («Rom under terreng», «Etasjeskille», «Loft/takkonstruksjon», «Utvendig»)
   i A1 — det er standardens eget språk og vannskadenes faktiske geografi.
   Se `docs/ns3600-og-befar-ui.md` for full analyse, inkl. at NS 3600:2025
   nå krever årsak/konsekvens/tiltak for alle TG2/TG3-avvik — strukturen
   motoren vår allerede produserer (styrker vekstflate C4).

**Vekstflate C4 — NS 3600:2025-tilstandsrapport** (etter pilot): fangst,
romløype og godkjenningsflyt gjenbrukes; rapporttypen er en regelverkspakke.
Standarden blir obligatorisk 1. juli 2026 — markedet Befar har åpnet kan nås
med vår motor når skade-sporet er vunnet. Nei-lista gjelder til da.

## Det vi bevisst IKKE inkorporerer

- **Estimat-/prismotor** (Xactimate-sporet): norsk oppgjør er årsaksdrevet;
  pris eies av forsikringsselskap/håndverker. Feil kjerne for oss.
- **360-kamera-hardware** (DocuSketch): hardware-avhengighet dreper
  «appen i lomma»-fordelen mot in4mo.
- **3D-tvillinger** (Matterport): imponerende, men bevisverdien per krone er
  lav i norsk oppgjør; sha256-forseglet video+foto dekker behovet.
- **Egen skinne mot forsikringsselskapene**: står allerede på nei-lista —
  USA-analysen bekrefter at alle som prøvde å gå utenom skinnen tapte.

## Anbefalt byggerekkefølge (flettet med faseplanen)

Ferdig: A2 fagterm-transkripsjon, A3 tidsmetrikk, A4 demo-modus (alle
aug 2026, i tillegg til godkjenningsflyten). Gjenstående rekkefølge:

1. **A5 versjonslagring** (bygger videre på godkjenningsflyten; flytter
   rapporten ut av Google Docs og inn i Postgres) → 2. **A1 romløype** →
   3. **B1 in4mo-eksport** (med pilotbruker) → 4. **B3 risikoflagg** →
   5. **B2 plantegning** (når dokumentlaget er avklart).
