# DDIA-konseptkart: begrepsindeks for teamet

27. august 2026. En kort begrepsindeks over «Designing Data-Intensive
Applications» (Martin Kleppmann, O'Reilly) — skrevet med egne ord, som
felles vokabular for teamet og som kart over hvor i boka man slår opp.

**Viktig:** Dette er *ikke* en erstatning for boka, og skal ikke bli det.
Boka er opphavsrettsbeskyttet; her ligger kun konseptnavn og korte
egne-ord-forklaringer, samme disiplin som vi holder for
Byggforsk-databladene og NS-standardene (metadata og egne vurderinger i
repoet — aldri kildeinnholdet). Kjøp/lån boka for substansen.
Anvendelsen av bokas idéer på vår faktiske kodebase ligger i
`docs/ddia-laerdommer.md` — det er hoveddokumentet; dette er oppslagskartet.

## Del I — Grunnlag

### Kap. 1 — Pålitelighet, skalerbarhet, vedlikeholdbarhet

- **Feil vs. svikt:** en komponent som avviker fra spec (feil) er ikke det
  samme som at systemet slutter å levere (svikt); målet er å hindre at
  feil blir svikt — toleranse foran forebygging, gjerne testet ved å
  utløse feil med vilje.
- **Tre feilkilder:** maskinvare (tilfeldig, ukorrelert), programvare
  (systematisk, korrelert — rammer mange noder samtidig), mennesker
  (største driftsårsak; svar: gode grensesnitt, sandkasser, rask
  tilbakerulling, telemetri).
- **Last og ytelse:** beskriv last med konkrete parametre; mål ytelse som
  *fordeling*, ikke snitt — persentiler (p50/p95/p99). Halene dominerer
  brukeropplevelsen; kø-effekter (head-of-line blocking) gjør at
  responstid må måles på klientsiden.
- **Skalering:** opp (større maskin) vs. ut (flere maskiner); ingen
  universalarkitektur — en skalerbar arkitektur er bygget rundt antakelser
  om hvilke operasjoner som er vanlige.
- **Vedlikeholdbarhet:** drift (observerbarhet, forutsigbarhet), enkelhet
  (fjern *aksidentell* kompleksitet med gode abstraksjoner), evolverbarhet.

### Kap. 2 — Datamodeller og spørrespråk

- **Relasjon vs. dokument:** dokumentmodellen passer trestrukturer
  (én-til-mange, lokalitet); relasjonsmodellen står sterkere på
  mange-til-mange og joins. Historisk rim: hierarkisk modell og
  nettverksmodell (CODASYL, manuelle aksesstier) tapte for
  relasjonsmodellens automatiske spørringsoptimaliserer.
- **Schema-on-read vs. schema-on-write:** implisitt skjema tolket ved
  lesing vs. håndhevet ved skriving — analogt dynamisk vs. statisk typing.
- **Deklarativt vs. imperativt:** deklarative språk (SQL, CSS) sier *hva*,
  ikke *hvordan* — det gir rom for optimalisering og parallellisering.
- **Grafmodeller:** property-grafer og trippellagre for data der «alt kan
  henge sammen med alt»; spørrespråk som Cypher, SPARQL, Datalog.

### Kap. 3 — Lagring og gjenfinning

- **Loggen som grunnstruktur:** append-only er den enkleste og raskeste
  skrivingen; en indeks er en *avledet* struktur som bytter skrivekost mot
  lesekost.
- **To skoler:** LSM-trær (memtable → sorterte segmentfiler → kompaktering
  i bakgrunnen; Bloom-filtre mot dyre bomlesinger) vs. B-trær (faste
  sider oppdatert på stedet, med WAL for krasjsikkerhet). Tommelregel:
  LSM skriver raskere, B-tre leser mer forutsigbart.
- **Indeksvarianter:** sekundærindekser, clustered/covering-indekser,
  flerkolonne- og fuzzy-indekser; in-memory-databaser.
- **OLTP vs. OLAP:** transaksjonsmønster (få rader via nøkkel) vs.
  analysemønster (skann mange rader, aggreger). Datavarehus mates via
  ETL; stjerneskjema (fakta + dimensjoner); kolonnelagring med
  kompresjon og materialiserte visninger gjør analyse effektiv.

### Kap. 4 — Koding og evolusjon

- **Kompatibilitet begge veier:** bakover (ny kode leser gamle data) og
  forover (gammel kode leser nye data) — forutsetningen for rullerende
  oppgraderinger og sameksisterende versjoner.
- **Formater:** språkspesifikk serialisering (unngå); JSON/XML/CSV
  (allestedsnærværende, men vage på tall og binærdata); Thrift/Protobuf
  (feltnumre som kontrakt); Avro (skriver- og leserskjema forsones ved
  lesing — vennlig mot dynamisk genererte skjemaer).
- **Skjemaets verdi:** dokumentasjon som ikke ruster + mulighet for
  kompatibilitetssjekk før deploy.
- **Tre dataflyter:** via database («data outlives code»), via tjenester
  (REST/RPC — et nettverkskall er *ikke* et funksjonskall), via
  meldingssystemer.

## Del II — Distribuerte data

### Kap. 5 — Replikering

- **Tre topologier:** én leder (skrivinger ett sted, enkel å resonnere
  om), fler-leder (skriv nær brukeren, men konflikter må løses),
  lederløs (quorum-lesing/-skriving).
- **Failover-feller:** asynkron replikering kan miste bekreftede
  skrivinger; split brain; for kort timeout gir unødige failover.
- **Lag-garantier under replication lag:** read-your-writes, monotone
  lesinger, konsistent prefiks — svakere enn linearizability, men ofte
  det appen faktisk trenger.
- **Konflikthåndtering:** last-write-wins er enkel men *mister data*;
  alternativer er eksplisitte versjoner («happened-before» via
  versjonsvektorer), fletting på appnivå, eller CRDT-er.
- **Lederløse detaljer:** w + r > n, read repair og anti-entropi, sloppy
  quorum med hinted handoff (durabilitet ≠ lesegaranti).

### Kap. 6 — Partisjonering

- **To hovedstrategier:** nøkkelområde (bevarer sortering, effektive
  områdespørringer, men fare for hot spots) vs. hash (jevn fordeling,
  mister sortering).
- **Sekundærindekser:** dokument-partisjonert (lokal indeks —
  scatter/gather ved lesing) vs. term-partisjonert (global indeks —
  effektiv lesing, dyrere/asynkron skriving).
- **Rebalansering:** aldri «hash mod N»; fast antall partisjoner eller
  dynamisk splitting; hold gjerne et menneske i løkka.
- **Ruting:** klienten, en rutingtjeneste eller noden selv må vite hvor
  partisjonene bor (ZooKeeper-aktig koordinering eller gossip).

### Kap. 7 — Transaksjoner

- **ACID presist:** atomisitet = abortbarhet; konsistens er egentlig
  *applikasjonens* invariant; isolasjon = samtidighetskontroll;
  durabilitet er alltid et spekter.
- **Svake isolasjonsnivåer og hva de stopper:** read committed (dirty
  reads/writes), snapshot isolation/MVCC (read skew — konsistente
  øyeblikksbilder), deteksjon/låsing/atomiske operasjoner (tapte
  oppdateringer). Write skew og fantomer slipper gjennom alt under
  serialiserbarhet.
- **Tre veier til serialiserbarhet:** faktisk seriell kjøring (én tråd,
  korte transaksjoner i minnet), to-fase-låsing (pessimistisk, med
  predikat-/indeksområdelåser mot fantomer), serializable snapshot
  isolation (optimistisk: kjør, sjekk, abort ved konflikt).

### Kap. 8 — Problemene i distribuerte systemer

- **Delvis svikt:** i et distribuert system kan noe alltid være halvveis
  ødelagt; et ubesvart kall kan bety tapt forespørsel, treg node, død
  node eller tapt svar — og du kan ikke skille dem.
- **Nettverk:** asynkrone pakkenett har ubegrensede forsinkelser
  (kø-effekter); timeouts er et kompromiss, ikke en sannhetsmaskin.
- **Klokker:** time-of-day-klokker hopper og drifter (bruk aldri til
  ordning av hendelser — LWW-datatap); monotone klokker til varigheter;
  klokkelesning er egentlig et *usikkerhetsintervall*.
- **Prosesspauser:** GC, VM-suspensjon m.m. kan fryse en node midt i en
  setning — en «levende» node kan derfor ta feil om sin egen rolle.
- **Sannhet og modeller:** flertallet (quorum) definerer sannheten;
  låser/leases trenger *fencing-tokens*; skill safety- fra
  liveness-egenskaper; vanligste modell er delvis synkron med
  crash-recovery.

### Kap. 9 — Konsistens og konsensus

- **Linearizability:** illusjonen av én kopi med atomiske operasjoner —
  en ferskhetsgaranti. Dyr: koster ytelse alltid, og tilgjengelighet ved
  nettverksbrudd (den nyttige kjernen i CAP).
- **Kausalitet:** partiell orden («hva visste om hva») er billigere enn
  total orden; Lamport-tidsstempler gir total orden konsistent med
  kausalitet, men sier ikke *når* ordenen er endelig.
- **Total order broadcast ≈ konsensus:** samme problem i ulike drakter —
  også lik lineariserbar compare-and-set, ledervalg og
  unikhetsbegrensninger.
- **Atomisk commit:** 2PC med koordinator; «in doubt»-deltakere blokkerer
  med låser til koordinatoren svarer — derav de operasjonelle smertene
  med XA i praksis.
- **Feiltolerant konsensus:** Paxos/Raft/Zab/VSR: epoketall + to
  quorum-runder; krever flertall i live; ZooKeeper/etcd som
  «outsourcet» konsensus-, lås- og medlemskapstjeneste.

## Del III — Avledede data

### Kap. 10 — Batchprosessering

- **Unix-filosofien:** immuterbar input, ett verktøy per jobb, uniform
  grensesnitt (filer/pipes) — samme prinsipper bærer MapReduce og HDFS.
- **MapReduce-mønsteret:** map trekker ut nøkkel/verdi, rammeverket
  partisjonerer og sorterer, reduce fletter — «bring beslektede data til
  samme sted».
- **Join-algoritmer:** sort-merge (reduce-side), broadcast hash (liten
  tabell i minnet hos hver mapper), partitioned hash (samme partisjonering
  på begge sider); skew-håndtering for «linchpin»-nøkler.
- **Output-filosofi:** bygg resultatet (søkeindeks, nøkkelverdi-filer)
  som immuterbare filer; feilslåtte jobber etterlater ingenting — det gir
  menneskelig feiltoleranse (rull tilbake koden, kjør på nytt).
- **Etter MapReduce:** dataflytmotorer (Spark/Flink/Tez) dropper unødig
  materialisering mellom steg; Pregel-modellen for iterative grafjobber;
  deklarative lag gir spørringsoptimalisering også her.

### Kap. 11 — Strømprosessering

- **To meglertyper:** AMQP/JMS-stil (individuell ack, sletting ved
  levering, omlevering kan stokke om) vs. logg-basert (Kafka-stil:
  partisjonert append-only-logg, forbrukeroffsets, replay av historikk —
  fan-out og lastbalanse samtidig).
- **Databaser som strømmer:** change data capture gjør én database til
  leder og alt avledet (indeks, cache, varehus) til følgere; event
  sourcing modellerer selve applikasjonen som en hendelseslogg; tilstand
  er den integrerte strømmen, strømmen er den deriverte tilstanden;
  logg-kompaktering holder loggen proporsjonal med datamengden, ikke
  skrivehistorikken.
- **Dual writes er fella:** to systemer skrevet hver for seg glir fra
  hverandre (kappløp + delvis feil) — én ordnet logg løser det.
- **Tid:** event-tid ≠ prosesseringstid; vinduer (tumbling, hopping,
  sliding, session); etternølere og vannmerker.
- **Stream-joins:** strøm-strøm (vindu), strøm-tabell (berikelse via
  CDC-vedlikeholdt lokal kopi), tabell-tabell (materialisert visning).
- **Feiltoleranse:** mikrobatcher/sjekkpunkter internt; mot omverdenen
  trengs atomisk commit eller idempotens (offset + deterministisk
  behandling) for exactly-once-*semantikk*.

## Slik brukes dette

1. Slå opp begrepet her, les kapitlet i boka for substansen.
2. Se `docs/ddia-laerdommer.md` for hva konseptene betyr *for vår kode* —
   verifiserte funn med fil:linje, prioriterte tiltak og en eksplisitt
   ikke-bygg-liste for pilotskala.
