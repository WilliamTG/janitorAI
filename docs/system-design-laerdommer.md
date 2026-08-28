# System Design-gjennomgang: hva Alex Xus bok lærer oss om DocrAI

28. august 2026. Gjennomgang av «System Design Interview: An Insider's
Guide» (Alex Xu) holdt opp mot vår faktiske kodebase — samme øvelse som
`docs/ddia-laerdommer.md` (27. aug), og et bevisst komplement til den:
DDIA ga oss *pålitelighetsmekanikkene* (fletting, idempotens, timeouts,
sveip-sikkerhet); Xu handler om *systemsammensetning og skalering*.
Begrepsindeksen med egne ord ligger i `docs/system-design-konseptkart.md`;
det selvstendige oppslagsverket over fagområdet (egne ord, DocrAI som
eksempel) ligger i `docs/systemdesign-handbok.md`.

Boka er skrevet for hyperskala-intervjuer (millioner av brukere). DocrAI
er et pilotprodukt med én partner og en håndfull testere. Hovedverdien av
boka for oss er derfor **(a)** disiplinen i hva vi *ikke* skal bygge ennå,
**(b)** noen få konkrete forbedringer der bokas mønstre treffer reelle
pilotrisikoer, og **(c)** overslagsregning som vane før pris- og
kapasitetsvalg.

## Hovedbildet

Xus gjennomgående metode er: start minimalt, og la hvert skaleringssteg
svare på et *målt* problem (kap. 1). Det er nøyaktig playbookens «valider
før du bygger» og nei-lista vår, formulert som arkitekturprinsipp. Vår
arkitektur i dag — én Express-server, én Postgres, én AI-motor, statisk
web-eksport — ligger der boka sier et system på vår skala *skal* ligge.
Ingen av funnene under er «bygg mer infrastruktur»; de er «stram til
kontrakter og mål før du velger».

## Del 1 — Det som allerede står Xu-riktig (bevar dette)

- **Tilstandsløst API-lag (kap. 1):** hver forespørsel autentiseres med
  `tester_token`, all tilstand bor i Postgres/JSONB — ingen
  server-sesjoner. Serveren kan restartes/reprovisjoneres fritt (Render
  gjør det alt), og en fremtidig andre instans krever ingen omskriving.
- **CDN for statisk innhold (kap. 1):** docrai.io er en statisk eksport
  på Renders static hosting, som serveres via CDN med global cache.
  Punktet på Xus sjekkliste er altså allerede dekket av plattformvalget —
  ikke bygg noe her.
- **Deduplisering av media (kap. 15 «save storage space»):** sha256-basert
  gjenbruk ved opplasting (`apps/api/src/routes/media.js`, atomisk
  claim fra PR #15) er bokas dedupliseringsråd, på filnivå — riktig
  granularitet for oss (bevisfiler endres ikke; blokknivå er for
  filer som *redigeres*).
- **Kostnadssynlighet før prising (kap. 2):** `cost_events`-tabellen
  (`apps/api/src/db.js:142-154`) logger faktisk tokenforbruk per
  KI-operasjon — det er grunnlaget bokas overslagsregning trenger for å
  bli etterprøvbar i stedet for gjetting.
- **Varslingssystem-påliteligheten uten varslingssystemet (kap. 10):**
  bokas kjernekrav — retry, deduplisering, hovedbok over hva som faktisk
  skjedde — er allerede på plass for rapportkjøringen
  (`report_generations`-hovedboka, in-flight-vakt, ledger-rad også ved
  feil; PR #15). Det som *ikke* er bygget (kanaler, kø) skal heller ikke
  bygges nå — se del 3.
- **Delings-URL-ene (kap. 8):** PIN-beskyttede, utløpende delingslenker
  med revokering (`apps/api/src/routes/share.js`) dekker behovet en
  URL-forkorter-arkitektur løser — kort, kontrollert tilgang til én
  ressurs — med sterkere tilgangsstyring enn bokas design trenger.

## Del 2 — Forslag som gjør løsningen bedre (prioritert)

### 1. Rate limiting per tester, ikke bare per IP — og 429-håndtering i appen

**Observasjon (verifisert):** begge limiterne våre nøkler på IP-adresse
(`apps/api/src/middleware/rateLimiters.js:12-31` bruker standard
keyGenerator): `generalLimiter` 300 kall/15 min, `heavyLimiter` 30
kall/15 min på `/transcribe`, `/describe-image` og `/report/google-doc`
(`apps/api/src/index.js:384,499,586`). Og appen har **ingen**
429-håndtering — `grep 429 apps/mobile/src` gir null treff; et
ratebegrenset kall vises som en generisk feil.

**Hvorfor det er en reell pilotrisiko, ikke teori:** Ocab-kontoret deler
én offentlig IP. To–tre takstpersoner som transkriberer notater og
beskriver bilder samtidig deler dermed én pott på 30 tunge kall per
kvarter — en travel befaringsdag kan treffe taket, og feilen brukeren
ser vil ligne på transkriberingsfeilen Sigurd allerede har rapportert
(én feilkilde til i samme symptom). Speilvendt gir per-IP alene svak
beskyttelse mot en aktør som roterer IP-er.

**Forslag (kap. 4):** nøkle `heavyLimiter` på `tester_token` når
forespørselen er autentisert (fall tilbake til IP ellers), behold
`standardHeaders` slik at `RetryAfter`/`RateLimit-*` følger med, og la
appen behandle 429 som «vent og prøv igjen»-toast med tidspunkt i stedet
for generisk feil. Lite inngrep, fjerner en hel klasse
pilotforvirring før den oppstår. Dette er det ene kodeendringsforslaget
i dokumentet jeg mener har evidens nok *nå* (kjent kontor-oppsett hos
pilotpartneren + kjent symptomforveksling).

### 2. Overslagsregning på pilotøkonomien — med våre egne tall

**Observasjon:** `cost_events` har ekte tall per operasjon, men vi har
ingen samlet «hva koster én befaring»-regning, og prisdokumentet
(`docs/prising-bruksbasert.md`) trenger den.

**Forslag (kap. 2):** én side i `docs/`: gjennomsnittlig tokenforbruk og
kostnad per transkribering, per bildebeskrivelse og per rapport (hentes
med tre SQL-spørringer mot `cost_events`), ganget opp til «én typisk
befaring» og «én tester-måned». Skriv ned antakelsene ved siden av
tallene, bokas metode. Det gir kredittprisingen et etterprøvbart gulv og
gjør Gemini-kvotespørsmålet (fortsatt åpent fra pilotloggen) til et
regnestykke i stedet for en overraskelse. Ingen kode kreves.

### 3. Mål videoopplastingsfeil før noe bygges på opplasting

**Observasjon (verifisert):** video lastes opp som ett enkelt
XHR/FormData-kall på inntil 500 MB (`apps/api/src/routes/media.js:143`,
`apps/mobile/src/sync/projectSync.ts:211-242`). Ryker forbindelsen på 95
% starter overføringen fra null (sha256-dedup redder lagringen, ikke
overføringen). Bokas svar er chunket/gjenopptakbar opplasting (kap. 14)
eller blokkservere (kap. 15).

**Forslag:** ikke bygg noen av delene ennå — *mål først*. Logg
opplastingsfeil (størrelse, hvor langt den kom via XHR-progress, nett-
type) til `error_logs`/`user_actions` og se på tallene etter noen ukers
pilotbruk. Hvis store opplastinger faktisk feiler i felt, er gjenopptakbar
opplasting (f.eks. tus-protokollen fremfor egenutviklet) neste steg —
med evidens i hånda. Hvis ikke, har vi spart oss kompleksiteten. Dette
er bokas egen metode brukt mot bokas egen løsning.

### 4. Veikart, betinget: rapportgenerering som jobb med varsling

I dag holder appen en forespørsel åpen i inntil 10 minutter mens
motoren jobber (proxy-timeouten fra PR #15). Det er riktig enkelt nå.
*Hvis* generereringstiden vokser (flere Byggforsk-oppslag, lengre
videoer), er bokas mønster (kap. 10/15) neste form: registrer jobb →
svar med jobb-id → appen poller eller long-poller status →
`report_generations` er allerede hovedboka en slik jobbstatus kan leses
fra. Ikke bygg før 10-minuttersgrensen faktisk trues; da er
migrasjonsstien kort fordi hovedboka finnes.

### 5. Veikart, betinget: per-note-PUT hvis prosjekt-JSON vokser

Per-note-flettingen vår er allerede delta-synk på notat-granularitet
(kap. 15-mønsteret) — men transporten er fortsatt hele prosjekt-JSON-en
per PUT. 413-håndteringen fra PR #15 gjør taket synlig når det treffes.
Hvis 413-banneret faktisk dukker opp hos pilotbrukere, er neste steg å
sende bare endrede notater per PUT (transport følger allerede
flettegranulariteten, så serverlogikken er forberedt). Evidenskrav: minst
ett reelt 413-tilfelle.

## Del 3 — Bokas idéer vi bevisst IKKE bygger (nei-lista, kapittelfestet)

Samme disiplin som DDIA-dokumentets del 5; på vår skala er dette støy:

- **Sharding/konsistent hashing (kap. 1, 5, 6):** én Postgres med
  JSONB per `tester_token` er riktig til langt forbi pilotskala.
  Skaleringssteget før sharding er uansett større instans + replika.
- **Egen nøkkelverdi-butikk, quorum, vektorklokker (kap. 6):** Postgres
  + per-notat-fletting med tombstones løser vårt konfliktbilde.
- **Snowflake-ID-er (kap. 7):** CSPRNG-UUID-er er riktige for oss; vi
  trenger ikke tidsordnede id-er, og vi slipper klokkeavhengigheten.
- **Meldingskø-infrastruktur (kap. 1, 10):** in-flight-vakt + hovedbok
  dekker behovet; en kø uten flere produsenter/konsumenter er ren drift.
- **Fanout/nyhetsstrøm (kap. 11), chat/WebSocket/presence (kap. 12),
  autocomplete-trie (kap. 13):** ingen av produktflatene våre er i
  nærheten; chat i delingsvisningen står allerede på nei-lista til
  ekte brukere ber om det.
- **Transkodings-DAG (kap. 14):** vi analyserer video, vi strømmer den
  ikke; Gemini tar filene våre som de er.
- **Pre-signerte opplastings-URL-er rett til lagring (kap. 14/15):**
  boka selv påpeker motargumentet — å flytte logikk til klienten er
  betydelig kompleksitet. Vår server-medierte opplasting er dessuten
  der tenant-isolasjonen, størrelsestakene og sha256-beregningen
  håndheves; å flytte den ville svekket sikkerhetsinvariantene for å
  løse et båndbreddeproblem vi ikke har. Revurderes kun hvis Render-
  disken/båndbredden blir målt flaskehals.
- **Web-crawler (kap. 9):** står her kun for ordens skyld — og som
  påminnelse om at *hvis* vi en dag indekserer offentlige byggforskrifter,
  er politeness/robots.txt/dedup sjekklista. Ikke nå.

## Del 4 — Intervjurammeverket som arbeidsdisiplin

Kap. 3 er bokas mest overførbare kapittel utenfor intervjuer: (1) forstå
og avgrens før du foreslår, (2) få enighet om det overordnede før
dypdykk, (3) dypdykk der det gjør vondt, (4) navngi flaskehalsene selv.
Det er samme form som playbookens «valider før du bygger» og
`/steelman`-/`/gaps`-kommandoene våre — og en god mal for hvordan vi
svarer Ocab når de ber om en ny funksjon: still avgrensningsspørsmålene
først, foreslå minste løsning, navngi selv hva som vil knirke.

## Status og forbehold

- Kodeobservasjonene i del 1–2 er verifisert mot arbeidstreet på
  `main` (e001591) i dag; fil:linje-referanser gjelder den revisjonen.
- Ingen kodeendringer følger med dette dokumentet. Forslag 1 (per-tester
  rate limiting + 429 i appen) er det eneste jeg anbefaler å bygge uten
  ytterligere evidens; 2 er ren analyse; 3–5 har eksplisitte evidenskrav
  før bygging, i tråd med nei-lista.
- Render-deployene av PR #15 (backend, ai-engine, docrai.io-eksport) er
  fortsatt utestående brukerhandling og påvirkes ikke av dette dokumentet.
