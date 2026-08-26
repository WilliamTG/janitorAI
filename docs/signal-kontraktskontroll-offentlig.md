# Markedssignal: kontraktskontroll i offentlig sektor (Bymiljøetaten)

26. august 2026. Uformell samtale: en person fra Bymiljøetaten (Oslo
kommune) fortalte at de hadde en kontrakt med en entreprenør, dro på
befaring, og sjekket at utført arbeid var i henhold til kontrakten — nevnt
opp mot DocrAI. Signalet er tynt (ett sekundærutsagn, ingen forpliktende
forespørsel), men verdt en produktvurdering fordi det peker på en helt
annen vertikal enn forsikringsskade.

## Hva slags behov er dette?

Ikke skadeårsak. Bymiljøetatens behov er **kontraktsoppfølging**: gikk
entreprenøren gjennom jobben som avtalt? Er leveransen i henhold til
kontraktens spesifikasjoner (f.eks. asfaltering, grøntanlegg, drenering,
brøyting, VA-arbeid)? Strukturen som trengs er «kontraktspunkt → krav →
observasjon → avvik/ikke avvik → frist for retting», ikke «årsak →
akutt/gradvis → tiltak».

Dette er en reell og sannsynligvis **stor** kategori: enhver kommune har
løpende entreprenørkontrakter for vei, park, VA, brøyting, bygg- og
anleggsvedlikehold — langt flere kontrakter enn Ocab har skadesaker.

## Arkitekturvurdering: hva er gjenbrukbart, hva må bygges nytt

**Gjenbrukbart uendret:**
- Hele fangstløypen (video/foto/lydnotat, rom-/punkt-tilknytning,
  offline-first synk, IndexedDB-persistens for foto).
- Godkjenningsporten (befaringsansvarlig må lese og stemple før deling —
  samme prinsipp som takstpersonens godkjenning, bare med annen tittel).
- PIN-beskyttet delingslenke (kontrakts-motpart/entreprenør som mottaker
  i stedet for forsikringsselskap).
- Saksunderlag fra åpne kilder (Kartverket/matrikkel) — delvis relevant
  for anleggslokasjon.

**Må bygges nytt (ikke gjenbrukbart fra dagens skjema):**
- Helt ny strukturert utdata-modell (tilsvarende `DamageAnalysis` i
  `ai-engine/models.py`): kontraktspunkt, krav-sitat, observasjon,
  avvik ja/nei, alvorlighet, frist. `cause`/`is_habitable`/
  akutt-gradvis-logikken i dagens prompt er meningsløs her.
- Ny referansekilde. Byggforsk-sitatporten (`byggforsk_index.py`) er
  bygningsskade-spesifikk; kontraktskontroll siterer kontraktsteksten
  selv (evt. NS-standarder for anlegg/vei — helt annen katalog, egen
  lisensvurdering).
- Nytt prompt/system-instruks: modellen må få kontraktens krav som
  kontekst (opplastet PDF/tekst) og matche befaringsbevis mot dem — en
  annen oppgave enn årsaksetterforskning.
- Sannsynligvis annen kjøper/går-til-marked: kommunal anskaffelse
  (Doffin-utlysning) er en helt annen salgsprosess enn forsikring/
  skadesanering.

**Konklusjon:** motoren og appen er en god *plattform* for dette (fangst
→ AI-strukturering → godkjenning → deling er domeneuavhengig), men
rapportskjemaet, sitatkilden og salgskanalen er reelt nytt arbeid — ikke
en konfigurasjonsendring.

## Vurdering mot nei-lista

CLAUDE.md er eksplisitt: «Ny funksjon bygges først når ekte pilotbrukere
har sagt de ikke får verdi uten den — ikke på gründer-entusiasme.» Dette
signalet er ett uformelt utsagn, ikke en uttalt kjøpsintensjon eller
pilotforespørsel. Det kvalifiserer ikke til bygging nå.

## Anbefaling

**Logg, ikke bygg.** Hvis signalet gjentar seg — fra Bymiljøetaten selv,
en annen kommune, eller en etat med tilsvarende kontraktsoppfølging — er
neste steg en samtale for å avklare: hvor mange kontrakter/befaringer i
året, hva bruker de i dag (Excel? eget skjema? ingenting strukturert?),
og hvem tar kjøpsbeslutningen. Først da er det grunnlag for å skissere
et eget rapportskjema.

**Hvorfor verdt å holde varmt likevel:** dette er et konkret datapunkt på
at kjernearkitekturen («strukturert dokumentasjon fra felt-fangst, med
menneskelig godkjenning før deling») generaliserer utover forsikring.
Det er et argument å ha klart til IN-samtaler og investorer — men et
argument, ikke en veikartpost.

**Relatert IN-mulighet:** hvis dette modnes til en reell henvendelse, er
det en nesten idealtypisk kandidat for Innovasjonskontrakt-ordningen
(`docs/soknadsplan-offentlig-finansiering.md`) — en offentlig
pilotkunde med et konkret, avgrenset behov er nøyaktig hva ordningen er
laget for. Ikke relevant før behovet er bekreftet.
