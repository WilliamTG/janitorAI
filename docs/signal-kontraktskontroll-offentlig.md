# Markedssignal: overlevering/milepæler i bygg- og anleggskontrakter

26. august 2026, oppdatert samme kveld etter en teamsamtale (William Tobias
Grenersen, Sigurd) som ga signalet betydelig mer tekstur. Historikk:

1. **Første signal:** en person fra Bymiljøetaten (Oslo kommune, ref. Lisa)
   fortalte at de hadde en kontrakt med en entreprenør, dro på befaring, og
   sjekket at utført arbeid var i henhold til kontrakten — nevnt opp mot
   DocrAI som verdifullt.
2. **Teamsamtalen samme kveld** konkretiserte behovet betraktelig — se under.

Fortsatt ikke en pilotforespørsel, men fra ett sekundærutsagn til en aktiv,
navngitt diskusjon blant folk nær prosjektet. Verdt å holde varmt og
dokumentere presist.

## Hva slags behov er dette?

Ikke skadeårsak. Behovet er **verifisering ved overlevering/milepæler i
bygg- og anleggskontrakter**: er arbeidet utført i henhold til kontraktens
spesifikasjon? William formulerte det presist: *«Kan dette brukes ved
overlevering/milepæler i bygg og anleggskontrakter»* — to konkrete
kundesegmenter kom opp:

- **B2B — entreprenør ↔ byggherre:** entreprenøren dokumenterer at arbeidet
  er klart for overlevering; byggherren verifiserer uavhengig. Sigurd:
  «Sjekkliste app er hvertfall salgbar til begge sider av bordet.»
- **B2C — boligkjøper ved overtakelse:** William nevnte «folk som overtar
  nye boliger» som eget bruksområde — dette ligner det etablerte
  overtakelsesbefaring/boligkjøperforsikring-markedet (Anticimex m.fl.),
  men rettet mot NYBYGG-overtakelse spesifikt, ikke bruktboligsalg.

Strukturen som trengs er «kontraktspunkt/arbeidsbeskrivelse → krav →
observasjon → avvik/ikke avvik → frist for retting», ikke «årsak →
akutt/gradvis → tiltak».

**Navngitt standard — viktig, ikke forveksle med NS 3424:** Sigurd pekte på
**NS 3420** — «regler for hvilken tilstand de forskjellige arbeidene skal
utføres etter». Verifisert: NS 3420 «Beskrivelsestekster for bygg, anlegg
og installasjoner» er Standard Norges kodede beskrivelses- og
kalkulasjonssystem for bygg- og anleggsarbeider — kalt «byggebransjens
bibel», brukt i anbud, mengdebeskrivelser og under utførelse/oppgjør.
Kilde: [standard.no — NS 3420](https://standard.no/fagomrader/ns-3420-/),
[standard.no — 1976-milepæl](https://standard.no/om-oss/standard-norge/standard-norge-100-ar/milepaler/1976-ns-3420-beskrivelsestekster-for-bygg-og-anlegg).
**Dette er en annen standard enn NS 3424** (tilstandsanalyse — TG/KG,
referansenivå), som allerede er rammen for dagens skaderapport-prompt
(`ai-engine/prompt.py`, jf. `docs/byggforsk-integrasjon.md`). NS 3420
beskriver *hvordan arbeid skal utføres*; NS 3424 vurderer *tilstanden på
noe som allerede finnes*. Et fremtidig overleveringsprodukt siterer NS
3420-poster, ikke Byggforsk-databladene — egen katalog, egen
lisensvurdering (NS-standarder er også opphavsrettslig beskyttet av
Standard Norge, tilsvarende SINTEF/Byggforsk-situasjonen).

Dette er en reell og sannsynligvis **stor** kategori: enhver kommune har
løpende entreprenørkontrakter for vei, park, VA, brøyting, bygg- og
anleggsvedlikehold, og hvert nybygg har en overleveringsbefaring.

## Sigurds tilleggsidé: BIM + telefon-LiDAR for fremdriftsverifisering

Sigurd foreslo å knytte konseptet opp mot **BIM-modellen** og telefonens
**LiDAR-sensor**, for å skanne bygget og bekrefte/avkrefte fremdrift mot
modellen. Dette bygger direkte videre på det allerede loggede
roadmap-signalet i `docs/pilotlogg-ocab.md` («Roadmap-signal: planskisse
via 3D-skanning (LiDAR)» — Sigurds egen test målte ~3 mm avvik mot
lasermåler på 5 m). Der var bruksområdet planskisse; her er ambisjonen
høyere: sammenligne en skanning mot en BIM-modell for å verifisere fysisk
fremdrift automatisk.

Williams vurdering (uoppfordret, i samme samtale) er edruelig og treffer
nøyaktig nei-lista-logikken: *«Hvis den har nok data til å bekrefte eller
avkrefte skal det være noe mulig. Men krever endel testing og prøving før
det gir kvalitet.»* Samme begrensning som LiDAR-planskissen: krever nativ
app-tilgang (RoomPlan/ARKit), ikke tilgjengelig fra dagens PWA-distribusjon.
BIM-sammenligning er et betydelig teknisk løft utover ren skanning —
geometrisk registrering (skann → BIM-koordinatsystem), toleransehåndtering,
og en kilde til BIM-modellen i utgangspunktet (IFC-import). Ikke vurdert
nærmere nå; loggført som forlengelse av eksisterende LiDAR-signal.

## Williams vurdering av dagens AI-modenhet (direkte relevant for oss)

William, som kjenner både byggfag og KI-verktøy, ga en treffende vurdering
av GENERISK AI (Claude) på denne oppgaven i dag: *«Dette er teknisk mulig
allerede med Claude i dag, men den er ikke integrert godt nok mot byggfag,
eller pre definert nok. Og heller ikke godkjent sikkerhetsmessig.»* Tre
presise mangler — som er nøyaktig det DocrAI-arkitekturen allerede løser
for skaderapporter, og må løse på nytt for denne vertikalen:

1. **Byggfag-integrasjon** — vårt svar for skade er Byggforsk-sitatporten
   (verifisert metadata-indeks + forkastelse av uverifiserte referanser).
   Ekvivalenten her er en NS 3420-postindeks.
2. **Pre-definert struktur** — vårt svar er den strukturerte
   `DamageAnalysis`-modellen (pydantic-skjema); ekvivalenten her er et nytt
   skjema for kontraktspunkt/krav/avvik/frist.
3. **Sikkerhetsgodkjenning** — vårt svar for skade er tenant-isolasjon,
   signerte medie-URL-er og godkjenningsporten (CLAUDE.md-invarianter).
   For kommunal bruk kommer trolig krav utover dette (databehandleravtale,
   norsk/EØS-lagring — allerede løftet i om-siden — og muligens Datatilsyn-
   relevante vurderinger avhengig av persondata i kontraktsdokumentasjon).

William nevner også at arbeidsgiveren hans har et eksisterende
**styringssystem** for dette («Kan nesten bare mate Claude gode med
styringssystemet») — en potensiell kilde til domenekunnskap/prompt-kontekst
hvis samarbeid blir aktuelt, på samme måte som Byggforsk-databladet var for
skadedomenet. Ikke hentet inn eller brukt noe sted — kun notert som mulig
fremtidig kilde, med samme lisens-/samtykkedisiplin som Byggforsk-saken.

## Arkitekturvurdering: hva er gjenbrukbart, hva må bygges nytt

**Gjenbrukbart uendret:**
- Hele fangstløypen (video/foto/lydnotat, rom-/punkt-tilknytning,
  offline-first synk, IndexedDB-persistens for foto).
- Godkjenningsporten (befaringsansvarlig må lese og stemple før deling —
  samme prinsipp som takstpersonens godkjenning, bare med annen tittel).
- PIN-beskyttet delingslenke (kontrakts-motpart/entreprenør/byggherre som
  mottaker i stedet for forsikringsselskap).
- Saksunderlag fra åpne kilder (Kartverket/matrikkel) — delvis relevant
  for anleggslokasjon.

**Må bygges nytt (ikke gjenbrukbart fra dagens skjema):**
- Helt ny strukturert utdata-modell (tilsvarende `DamageAnalysis` i
  `ai-engine/models.py`): kontraktspunkt/NS 3420-post, krav-sitat,
  observasjon, avvik ja/nei, alvorlighet, frist. `cause`/`is_habitable`/
  akutt-gradvis-logikken i dagens prompt er meningsløs her.
- Ny referansekilde og sitatport: NS 3420-postindeks (Byggforsk-mønsteret
  gjenbrukes strukturelt — metadata-indeks + forkastelse av uverifiserte
  poster), ikke Byggforsk-databladene. Egen lisensvurdering mot Standard
  Norge.
- Nytt prompt/system-instruks: modellen må få kontraktens/NS
  3420-postenes krav som kontekst og matche befaringsbevis mot dem — en
  annen oppgave enn årsaksetterforskning.
- Sannsynligvis to ulike salgskanaler: kommunal/B2B anskaffelse (Doffin)
  for entreprenør-byggherre-sporet, og et forbrukerrettet spor for
  boligkjøper-overtakelse (nærmere dagens forbrukermarked for
  boligkjøperforsikring).

**Konklusjon:** motoren og appen er en god *plattform* for dette (fangst
→ AI-strukturering → godkjenning → deling er domeneuavhengig), men
rapportskjemaet, sitatkilden (NS 3420 i stedet for Byggforsk) og
salgskanalen er reelt nytt arbeid — ikke en konfigurasjonsendring. LiDAR/
BIM-utvidelsen er et eget, betydelig større løft (nativ app + geometrisk
registrering) og ligger lenger unna.

## Vurdering mot nei-lista

CLAUDE.md er eksplisitt: «Ny funksjon bygges først når ekte pilotbrukere
har sagt de ikke får verdi uten den — ikke på gründer-entusiasme.» Selv med
den rikere teamsamtalen er dette fortsatt en intern diskusjon, ikke en
uttalt kjøpsintensjon eller pilotforespørsel fra en ekstern kunde. Det
kvalifiserer ikke til bygging nå — og William selv sier det samme
(«krever endel testing og prøving før det gir kvalitet»).

## Anbefaling

**Logg, ikke bygg.** Neste steg hvis dette skal forfølges videre:
1. William spurte om å sjekke ut «hvordan vi gjør det» og styringssystemet
   på jobb — følg opp resultatet av den samtalen når den foreligger.
2. Hvis en ekstern part (Bymiljøetaten, en byggherre, en entreprenør)
   uttrykker en konkret forespørsel: avklar volum (hvor mange
   overleveringer/milepæler i året), dagens verktøy (Excel? eget skjema?
   ingenting strukturert?), og hvem som tar kjøpsbeslutningen — B2B
   (entreprenør/byggherre) og B2C (boligkjøper) er trolig ulike produkter
   med ulik salgsvei, selv om de kan dele arkitektur.
3. Først da er det grunnlag for å skissere et NS 3420-basert rapportskjema.

**Hvorfor verdt å holde varmt:** dette er nå et konkret, flerkilde-datapunkt
(ekstern kommuneansatt + to interne/nære personer, uavhengig av hverandre)
på at kjernearkitekturen («strukturert dokumentasjon fra felt-fangst, med
menneskelig godkjenning før deling») generaliserer utover forsikringsskade
til hele bygg-/anleggsbransjens kontroll-behov. Sterkt argument for IN-
samtaler og investorer — men fortsatt et argument, ikke en veikartpost.

**Relatert IN-mulighet:** hvis dette modnes til en reell henvendelse (særlig
det kommunale/B2B-sporet), er det en nesten idealtypisk kandidat for
Innovasjonskontrakt-ordningen (`docs/soknadsplan-offentlig-finansiering.md`)
— en pilotkunde med et konkret, avgrenset behov er nøyaktig hva ordningen
er laget for. Ikke relevant før behovet er bekreftet.
