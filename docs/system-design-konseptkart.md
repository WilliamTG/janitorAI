# System Design-konseptkart: begrepsindeks for teamet

28. august 2026. En kort begrepsindeks over «System Design Interview: An
Insider's Guide» (Alex Xu) — skrevet med egne ord, som felles vokabular
for teamet og som kart over hvor i boka man slår opp.

**Viktig:** Dette er *ikke* en erstatning for boka, og skal ikke bli det.
Boka er opphavsrettsbeskyttet («All rights reserved»); her ligger kun
konseptnavn og korte egne-ord-forklaringer, samme disiplin som vi holder
for Byggforsk-databladene, NS-standardene og DDIA-boka (metadata og egne
vurderinger i repoet — aldri kildeinnholdet). Kjøp/lån boka for substansen.
Anvendelsen av bokas idéer på vår faktiske kodebase ligger i
`docs/system-design-laerdommer.md` — det er hoveddokumentet; dette er
oppslagskartet. Se også `docs/ddia-konseptkart.md`: DDIA går dypere på
*hvorfor* mekanismene virker; Xu viser *hvordan* de settes sammen til
hele systemer.

## Kap. 1 — Fra null til millioner av brukere

- **Vekstrekkefølgen:** én server → skill database fra web →
  lastbalanserer → databasereplikering (leder/følger) → cache → CDN →
  tilstandsløst web-lag → flere datasentre → meldingskø → sharding.
  Poenget er ikke sluttbildet, men at hvert steg svarer på et *målt*
  problem — ikke et forventet.
- **Tilstandsløst web-lag:** flytt sesjonsdata ut av webserveren (til
  delt lager) så enhver forespørsel kan treffe enhver server —
  forutsetningen for autoskalering og enkel failover.
- **Cache-disipliner:** cache er for data som leses ofte og endres
  sjelden; bestem utløpstid, konsistensstrategi og hva som skjer når
  cachen dør (thundering herd); aldri cache som eneste sannhetskilde.
- **CDN:** statisk innhold nær brukeren; kostnad per GB, TTL-valg,
  fallback når CDN-en feiler, versjonering for invalidering.
- **Sharding:** siste utvei for databasen; velg shard-nøkkel etter
  fordelingen av *faktisk* trafikk; medfører resharding-smerte, hot
  keys og tap av joins på tvers.

## Kap. 2 — Overslagsregning (back-of-envelope)

- **Toerpotenser:** KB/MB/GB/TB som 2^10-trapp — gjør lagringsanslag til
  hoderegning.
- **Latenstall alle bør kunne:** minne er raskt, disk er tregt,
  nettverksrundturer mellom datasentre dominerer; komprimér før du
  sender når det er mulig.
- **Tilgjengelighets-niere:** 99 % ≈ 3,65 døgn nede/år; 99,99 % ≈ 52
  min/år — hver ekstra nier tidobler driftskravet.
- **QPS-metoden:** brukere/dag × handlinger/bruker ÷ 86 400 s ≈ QPS;
  topp ≈ 2× snitt; regn alltid med avrundede tall og skriv ned
  antakelsene — presisjonen ligger i resonnementet, ikke desimalene.

## Kap. 3 — Rammeverk for systemdesign-samtalen

- **Fire steg:** (1) forstå problemet og avgrens omfanget — still
  spørsmål, anta aldri; (2) skisser overordnet design og få buy-in;
  (3) dypdykk i de viktigste komponentene; (4) oppsummer flaskehalser
  og forbedringer.
- **Kjerneholdningen:** riktig prosess slår riktig fasit; å designe for
  krav ingen har stilt er like galt som å overse krav som er stilt.
  (Dette er bokas varige verdi utenfor intervjuer også — se
  laerdommer-dokumentet.)

## Kap. 4 — Rate limiter

- **Algoritmene:** token bucket (påfyll i jevn takt, tillater støt),
  leaky bucket (fast uttaksrate, kø), fast vindu (enkelt, men dobbelt
  støt på vindusgrensen), glidende vindu-logg (presist, minnedyrt),
  glidende vindu-teller (vektet kompromiss).
- **HTTP-kontrakten:** 429 + `Retry-After`/`RateLimit-*`-headere så
  klienten kan oppføre seg pent i stedet for å gjette.
- **Distribuert telling:** tellere i delt lager (Redis-aktig) har
  kappløp; løsninger er atomiske operasjoner eller aksept av litt
  slark. Bestem om limiteren skal feile åpent eller lukket.
- **Nøkkelvalg:** per IP, per bruker eller per API-nøkkel — valget er
  et produktvalg, ikke bare et teknisk valg.

## Kap. 5 — Konsistent hashing

- **Problemet:** `hash mod N` flytter nesten alle nøkler når N endres.
- **Ringen:** servere og nøkler hashes til samme sirkel; en nøkkel
  eies av første server medurs — bare naboens nøkler flytter ved
  endring.
- **Virtuelle noder:** hver fysisk server får mange punkter på ringen
  for jevnere fordeling; flere virtuelle noder = jevnere, men mer
  metadata.

## Kap. 6 — Nøkkelverdi-lager

- **CAP i praksis:** ved nettverksbrudd må du velge konsistens eller
  tilgjengelighet — valget skal følge av produktkravet.
- **Quorum:** N replikaer, W skrive- og R lese-bekreftelser;
  W + R > N gir overlapp (les DDIA kap. 5 for dybden).
- **Vektorklokker:** versjonshistorikk per nøkkel som avslører
  samtidige (konflikterende) skrivinger i stedet for å miste dem.
- **Feilhåndtering:** gossip for medlemskap, sloppy quorum + hinted
  handoff for midlertidige brudd, anti-entropi med Merkle-trær for
  varige avvik.
- **Skrivesti:** commit-logg → memtable → SSTable-er (LSM) — samme
  lagringsmotor-fundament som DDIA kap. 3.

## Kap. 7 — Unik ID-generator

- **Alternativene:** flernode auto-increment (skjøre hull), UUID (128
  bit, usortert), billettserver (sentralt SPOF), Snowflake-mønsteret.
- **Snowflake-oppskriften:** 64 bit = tidsstempel (41) + datasenter-id
  (5) + maskin-id (5) + sekvens (12) — tidsordnede, distribuert
  genererte id-er; akilleshælen er klokkesynk (jf. DDIA kap. 8).

## Kap. 8 — URL-forkorter

- **Kjernevalget:** hash + kollisjonshåndtering vs. base62 av en unik
  id (kort, men forutsigbar/enumererbar).
- **301 vs. 302:** permanent redirect caches av nettleseren (mindre
  last, men mister analytikk); temporary treffer tjenesten hver gang.
- **Lesetungt mønster:** cache foran databasen; rate limiting mot
  misbruk av skriving.

## Kap. 9 — Web-crawler

- **Arkitekturen:** seed-URL-er → URL-frontier (kø med prioritet,
  ferskhet og *politeness* — aldri hamre ett vertsnavn) → nedlasting →
  parsing → innholdsdeduplisering (sjekksum) → nye lenker inn igjen.
- **Fellene:** spider traps (uendelige URL-rom — dybdegrense),
  robots.txt respekteres, blokkliste, DNS-cache fordi oppslag blir
  flaskehals.

## Kap. 10 — Varslingssystem

- **Kanalene:** push (APNs/FCM), SMS og e-post har hver sin
  tredjepartsleverandør, kontrakt og feilmodus — koble dem løst med
  meldingskøer så én treg kanal ikke stopper de andre.
- **Påliteligheten:** retry ved leverandørfeil, deduplisering så
  samme hendelse ikke varsler to ganger, per-bruker rate limiting så
  varsling ikke blir plaging, opt-in/samtykke som førsteklasses krav,
  og sporing (sendt/levert/åpnet) for å vite at systemet virker.

## Kap. 11 — Nyhetsstrøm

- **Fanout on write:** dytt innlegget inn i alle følgeres
  forhåndsbygde strøm ved publisering — rask lesing, dyr skriving,
  «kjendisproblemet» (millioner av følgere).
- **Fanout on read:** bygg strømmen ved henting — billig skriving,
  treg lesing.
- **Hybrid:** push for folk flest, pull for kontoer med enorme
  følgerskarer; cache i flere lag (strøm-id-er, innhold, sosial graf).

## Kap. 12 — Chat-system

- **Sanntidskanalen:** WebSocket (varig toveiskanal) vs. polling og
  long polling; servere med varige tilkoblinger er *tilstandsfulle* —
  service discovery (ZooKeeper-aktig) ruter brukeren til riktig server.
- **Meldingssynk:** per-samtale sekvensnummer + klientcursor gjør
  «hva har jeg ikke sett» til et intervallspørsmål; skill
  én-til-én-flyt fra gruppeflyt (liten gruppe = skriv til hver
  mottakers innboks).
- **Presence:** heartbeat med terskel — kort frafall skal ikke blinke
  «offline»; statusendringer fan-outes bare til relevante venner.

## Kap. 13 — Søke-autocomplete

- **Datastrukturen:** trie med cached topp-k i hver node — oppslag
  blir O(prefikslengde) i stedet for full sortering per tastetrykk.
- **Pipelinen:** analyser søkelogger i batch (sampling holder) →
  bygg/oppdater trie offline → server den fra cache; trie-en er en
  *avledet* struktur som gjenbygges, aldri sannhetskilden.
- **Skalering:** shard på prefiks; filtrér uønskede forslag i et eget
  lag foran.

## Kap. 14 — YouTube (video)

- **Transkoding som DAG:** del video i deler, kjør inspeksjon,
  transkoding per format, vannmerke m.m. som en rettet asyklisk graf
  av jobber med egne køer og workere — feil ett sted rerunner bare den
  grenen.
- **Opplastingsoptimalisering:** last opp i biter (chunks) parallelt og
  gjenopptakbart; pre-signerte URL-er lar klienten laste rett til
  lagring uten å gå via API-serveren.
- **CDN-økonomi:** bare de mest sette videoene fra CDN, langhalen fra
  eget lager — popularitet er ekstremt skjevfordelt.
- **Beskyttelse:** signerte/tidsbegrensede URL-er, DRM ved behov.

## Kap. 15 — Google Drive (fillagring/synk)

- **Blokkservere:** filer deles i blokker (à la 4 MB), komprimeres og
  krypteres; kun *endrede* blokker lastes opp ved endring
  (delta-synk).
- **Sterk konsistens som krav:** en fildeling kan ikke vise ulike
  versjoner til ulike enheter — metadata i transaksjonell database,
  cache holdes konsistent med den.
- **Varsling om endring:** long polling mot varslingstjeneste (ikke
  WebSocket — filsynk er ikke chat: lav frekvens, ingen toveisstrøm).
- **Lagringsøkonomi:** deduplisering på blokknivå, grense på antall
  versjoner, kalde versjoner til billigere lager.
- **Bokas eget motargument:** å flytte chunking/kompresjon/kryptering
  til klienten er betydelig kompleksitet — for mindre systemer er
  server-mediert opplasting et legitimt valg. (Direkte relevant for
  oss — se laerdommer-dokumentet.)

## Kap. 16 — Læringen fortsetter

- Ikke fagstoff, men en lesehenvisningsliste: gå til virkelige
  arkitekturblogger og praksisrapporter for å se mønstrene brukt i
  produksjon.

## Slik brukes dette

1. Slå opp begrepet her, les kapitlet i boka for substansen.
2. Se `docs/system-design-laerdommer.md` for hva konseptene betyr *for
   vår kode* — verifiserte observasjoner med fil:linje, prioriterte
   forslag og en eksplisitt ikke-bygg-liste for pilotskala.
3. For mekanikkene bak (replikering, quorum, LSM, klokker): se
   `docs/ddia-konseptkart.md` og `docs/ddia-laerdommer.md`.
