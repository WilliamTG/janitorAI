# Det amerikanske proptech-markedet for skadedokumentasjon — dybdeanalyse

Skrevet august 2026 for DocrAI. Spørsmålene: hva gjør amerikanerne, finnes
tilsvarende løsninger, og hva betyr det for oss?

## TL;DR

1. USA har et enormt, modent økosystem rundt skadedokumentasjon — men **ingen
   gjør DocrAIs kjerne**: forensisk årsaksvurdering (akutt/gradvis) med
   normverk-forankring og faglig godkjenningsstempel. De amerikanske løsningene
   er bygget for *scope og pris* (hvor mye koster reparasjonen), fordi det
   amerikanske oppgjøret er estimat-drevet. Det norske oppgjøret er
   *årsaks- og ansvarsdrevet* — en strukturelt annerledes jobb, og grunnen til
   at nisjen vår ikke allerede er tatt.
2. Alle vellykkede aktører **kobler seg på skinnen (Xactimate/Verisk) i stedet
   for å erstatte den**. Det validerer in4mo-strategien vår punkt for punkt.
3. Kapitalen flommer: proptech-VC $16,7 mrd i 2025 (+68 % YoY), og AI-andelen
   av investeringene har doblet seg. AI-rapportskriving er 2025/26-bølgen.
4. Prisvalidering: Spectora — USAs dominerende boliginspeksjonsapp — tar
   $99–109/mnd per inspektør. Vår tiltenkte 990 kr/mnd ligger midt i beltet.

## 1. Slik er den amerikanske verdikjeden strukturert

Fire lag, med klare vinnere i hvert:

### Lag 1 — Eiendomsdata *før* befaringen («property intelligence»)
- **CAPE Analytics** (grunnlagt 2014, kjøpt av Moody's): dyplæring på
  flyfoto gir forsikringsselskap eiendomsattributter «med nøyaktigheten til en
  fysisk inspeksjon, men farten til et registeroppslag» — brukt i tegning og
  fornyelse hos ledende selskaper.
- **ZestyAI**: klimarisiko-scoring per eiendom (brann, hagl, flom).
- **Nearmap/Betterview**: eget flyfoto + AI-attributter i én plattform.

**Norsk parallell:** dette er saksunderlaget vårt. USA bygger det på flyfoto
og forsikringsdata; vi bygger det på Kartverket/Matrikkelen/MET — åpne kilder
amerikanerne ikke har maken til. Kategorien er bevist verdifull.

### Lag 2 — Fangst i felt
- **Hover** (300 000+ brukere, 9 av 10 største forsikringsselskap): telefon-
  skann av eksteriør → målsatt 3D-modell. April 2025: **komplett
  interiørløsning med Virtual Walkthrough** — gåtur med mobilen gir mål,
  standardiserte foto og en fotorealistisk modell som «hub» for hele saken.
- **DocuSketch** (restaureringsbransjen; Paul Davis/Servpro standardiserer på
  den): 360°-kamera (20 sek per rom) → **360AI**-motoren lager plantegning,
  scope og estimat automatisk.
- **Encircle** (Kitchener, Canada — «in4mo-feltappen gjort riktig»): foto,
  video, notater, fuktlogger fra felt.
- **CompanyCam**: fotodokumentasjon for håndverkere, bygget på fart og deling.
- **Matterport**: 3D-tvillinger; kjøpt av CoStar for ~$1,6 mrd (feb 2025).
- **LexisNexis Flyreel**: **selvbetjent** AI-video-inspeksjon — huseieren
  filmer selv med guidet app, AI-en strukturerer. «Flyreel for Claims»
  lansert feb 2025, eksplisitt begrunnet i takstmann-mangel og
  skadevolum-vekst.

### Lag 3 — Rapport/estimat-motoren (skinnen)
- **Verisk Xactimate**: de facto-monopolet på skadeestimering — hele bransjen
  priser reparasjoner i Xactimate-koder. **Cotality (tidl. CoreLogic)
  Claims Connect/Symbility** er utfordreren. Alle i lag 2 lever av å levere
  *inn* hit: Encircle → auto-generert Xactimate-sketch («felt til estimat på
  under 6 timer»), Hover Inspections ligger nå *inne i* Xactimate,
  DocuSketch synker direkte.
- **Spectora**: dominerer den tilgrensende boliginspeksjonsnisjen (10 000+
  inspektører, $99–109/mnd) — mobil rapportskriver + booking + betaling +
  markedsføring i én pakke, nå med AI-kommentarassistent som «kutter felttid
  25 %».

### Lag 4 — Oppgjørsflyt og AI-agenter
- **Tractable**: computer vision på bil- og eiendomsskade, opptil 10x raskere
  saksavslutning.
- **Liberate** ($300M verdsettelse, okt 2025): stemme-AI som håndterer
  skademelding ende-til-ende.
- **FieldScribe-typene**: takstpersonen *snakker* observasjonene sine, AI-en
  transkriberer og strukturerer til saksnotater — nærmest DocrAIs
  fangstfilosofi av alle.

## 2. Finnes DocrAI der borte?

Nærmeste naboer, og hva de mangler:

| Aktør | Ligner på DocrAI ved | Mangler |
|---|---|---|
| Hover interiør (2025) | gåtur-fangst → strukturert dokumentasjon | årsak, klassifisering, normverk — output er mål og foto |
| DocuSketch 360AI | felt → automatisk rapport/estimat | estimat ≠ årsaksvurdering; krever 360-kamera |
| Flyreel for Claims | AI tolker video av skade | selvbetjening for huseier, ikke fagverktøy; ingen faglig konklusjon |
| Spectora AI | AI-assistert rapportskriving for inspektør | tilstandsrapport (bolighandel), ikke skade/forsikring |
| FieldScribe | tale i felt → strukturert tekst | notatverktøy, ikke forsikringsklar rapport |
| Encircle | feltdokumentasjon → skinne-integrasjon | ingen AI-analyse av innholdet |

**Konklusjonen:** alle byggeklossene finnes i USA, men ingen har satt sammen
*video/lyd i felt → AI-utkast med årsak og akutt/gradvis-klassifisering →
normverk-sitater → menneskelig godkjenningsstempel → forsikringsklar rapport*.
Grunnen er strukturell: i USA avgjøres oppgjøret av scope × Xactimate-pris;
årsaksspørsmålet («dekkes dette?») håndteres av adjusteren, ikke av
dokumentasjonsverktøyet. I Norge/Norden ER årsaksvurderingen rapportens kjerne
(gradvis skade dekkes ofte ikke), og normverket (Byggforsk) er nasjonalt.
Nisjen vår er beskyttet av jus, språk og normverk — ikke av teknologi.

## 3. Mønstre å lære av

1. **Ingen slåss mot skinnen.** Encircle, Hover og DocuSketch bygde alle
   dyp Xactimate-integrasjon i stedet for å utfordre Verisk — og vokste
   gjennom den. Vår in4mo-eksportstrategi er samme spill: «lever inn i flyten
   forsikringsselskapet krever, vinn brukeren på feltopplevelsen.»
2. **Fangst er blitt råvare; verdien sitter i strukturert output.** Kameraet/
   telefonen er gratis — betalingsviljen ligger i det som kommer *ut*
   (plantegning, estimat, rapport). DocrAIs verdi må måles i «godkjent rapport
   levert», aldri i «opptak lagret».
3. **Selvbetjening vokser drevet av fagfolk-mangel.** Flyreel lar huseieren
   filme selv fordi det ikke finnes nok adjustere. Samme demografi treffer
   norske takstmiljøer — en fremtidig DocrAI-produktlinje («send lenke til
   kunden, få forhåndsdokumentert sak») ligger klar når fagverktøyet sitter.
4. **AI-rapportskriving er den pågående bølgen** (Spectora Comment Assist,
   FieldScribe, DocuSketch 360AI, alle lansert/skalert 2024–2026). Vi er ikke
   tidlige globalt — vi er tidlige *i Norden*, med et normverk-forsprang.
5. **Tid er salgsmetrikken.** J.D. Power 2025: snittsyklus 32,4 dager fra
   melding til ferdig reparasjon. Alle amerikanske aktører selger «dager
   spart» — vår casestudie-metrikk («2 timer → 15 minutter per rapport») er
   riktig valuta.
6. **Konsolidering = exit-landskapet.** LexisNexis kjøpte Flyreel, CoStar
   kjøpte Matterport ($1,6 mrd), Moody's kjøpte CAPE, Verisk integrerer alle.
   Kjøperne av «vår» kategori er data-/skinneeiere — i Norden: Solera (in4mo),
   Cotality, forsikringsselskapene selv, eller nordiske proptech-konsolidatorer.

## 4. Kapitalbildet

- Proptech-VC 2025: **$16,7 mrd globalt, +68 % fra 2024** (CRETI); AI-selskaper
  tok 30–50 % av kapitalen og vokste dobbelt så fort som ikke-AI.
- Insurtech: ~$3,9 mrd i 2025; AI-fokuserte avtaler dominerer, og januar 2026
  alene så ~$1,7 mrd inn i proptech (+176 % YoY).
- Betydning for DocrAI: kategorien «AI i skadeflyt» er investerbar akkurat nå.
  En norsk pilot med målte tall (tid spart, godkjenningsgrad) i en beskyttet
  nisje er en fundingbar historie — men vinduet belønner de som kan vise
  *drift*, ikke demo.

## 5. Trusselvurdering: kommer de hit?

- **Lav direkte trussel på kort sikt.** De amerikanske aktørene står på to
  bein som ikke finnes i Norge: US-flyfotodata (CAPE/Nearmap) og
  Xactimate-prisdatabasen. Ingen av delene overføres til det norske markedet,
  som dessuten er lite (1 000–1 500 takstpersoner) — under radaren for
  aktører som jager 300 000 brukere.
- **Reell trussel 1: Solera/in4mo kopierer.** De eier skinnen i Norden og kan
  legge AI-funksjoner i Task Reporter. Forsvar: feltopplevelsen deres har
  1,9★ og tiår gamle feil — kulturen som skapte det snur ikke fort. Vår fart
  og norske normverk-dybde er forspranget.
- **Reell trussel 2: Wenn tar AI-posisjonen.** Norsk, 5,0★, brukere som ber
  om AI. De er nærmere oss enn noen amerikaner. Forsvar: årsaks-/ansvarslaget
  og Byggforsk-forankringen — dokumentasjonsfart alene vinner ikke oppgjøret.
- **Mulighet:** amerikanske mønstre som ennå ikke finnes i Norden
  (selvbetjent forhåndsdokumentasjon à la Flyreel, sketch-automatikk à la
  Encircle→Xactimate) kan vi innføre først — mot in4mo-skinnen.

## 6. Konkrete konsekvenser for DocrAI

1. **Hold på årsak + ansvar som kjerne.** Det er den ene tingen amerikanerne
   ikke bygger, og den norske betalingsgrunnen. Alt annet (mål, foto,
   plantegning) blir råvare.
2. **Bygg in4mo-eksporten som vår «Encircle→Xactimate-sketch».** Amerikansk
   presedens viser at «felt → skinne på timer i stedet for dager» er nok til
   å bygge et selskap på.
3. **Prising bekreftet:** 990–1 490 kr/mnd per takstperson speiler Spectora
   ($99–109) — markedets beviste prispunkt for «rapportverktøy som sparer
   felttid» hos små fagforetak.
4. **Selg tid, dokumenter tid.** Pilotmetrikken «minutter fra befaring til
   godkjent rapport» er samme valuta som hele det amerikanske markedet
   allerede har lært kjøperne å forstå.
5. **Fremtidslinje (etter pilot):** selvbetjent kundefangst (Flyreel-mønsteret)
   oppå samme motor — takstpersonen sender lenke, kunden filmer, saken kommer
   forhåndsdokumentert.
6. **Exit-kartet:** dyp integrasjon mot skinnen + dokumentert AI-kvalitet er
   det oppkjøperne (Solera, Cotality, nordiske forsikringsselskap) faktisk
   har betalt for i USA.
