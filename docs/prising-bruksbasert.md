# Bruksbasert prising (kreditter) — anbefaling og konsekvenser

**Anbefaling:** Ja — gå for en **forhåndsbetalt kredittmodell** framfor (eller ved
siden av) flat månedsabonnement. Den matcher kostnadsstrukturen vår (hvert
rapportkall koster oss penger hos Gemini/AI-motoren), de-risker
lav-volum-brukere, og har presedens i akkurat vårt marked: **Befar priser per
rapport (500 kr/rapport)**. Dette er et **beslutningsunderlag til gruppen** —
prising er gruppens valg (jf. `avklaringer-og-roller.md` #4), ikke noe som
endres ensidig i kode.

Forutsetning avklart: **kundene er bedrifter** (takstfolk/proffbrukere), ikke
forbrukere. Det forenkler jussen betydelig og flytter kravene til leverandør-
compliance (DPA/underleverandørliste).

## Anbefalt modell og pris (utgangspunkt — bekreftes mot ekte COGS)

**Kjerneinnsikt: det er ikke prisen folk misliker, det er taksameteret.**
«149 kr per rapport» tvinger en kjøpsbeslutning hver gang verktøyet brukes i
felt — det demper bruk. Løsningen er mobil-taksonomien: **selg «rapporter», vis
alltid «X rapporter igjen», og la kroner-beslutningen tas én gang (ved kjøp) —
aldri i det brukeren lager en rapport.** Økonomien er identisk med per-rapport,
men uten angsten.

**Enhet: rapporter — ikke kroner-per-rapport, og ikke tokens.**
Tokens som kundevendt saldo feiler fordi en takstperson ikke kan forutsi hvor
mange tokens en rapport koster (kort vs. lang video varierer vilt). «Rapporter
igjen» svarer på spørsmålet de faktisk har: *hvor mange befaringer kan jeg gjøre?*
Marginen vår er så stor (COGS ~0,25–3 kr mot pris ~100 kr) at vi har råd til å
prise i den forutsigbare enheten og svelge variasjonen. **Tokens måles kun
internt** (`/api/admin/cost`) — kunden ser aldri et token.

**To produkter, rett fra mobilmarkedet:**

- **Klippekort (kontantkort-modellen)** — for sporadiske brukere. Kjøp en pakke
  rapporter, gyldig 12 mnd, teller ned. Ingen binding.
- **Rapport-abonnement (mobilabonnement-modellen)** — for faste brukere. Et
  antall rapporter/mnd inkludert som fornyes, rimelig påfyll ved tomt, og et
  «fri rapporter»-toppnivå. Gir forutsigbar MRR og capper COGS-risikoen (i
  motsetning til rent ubegrenset abonnement).

**Veiledende tall (eksempler — ikke vedtatt):**

  | Produkt | Inkludert | Pris | Effektiv pr. rapport |
  |---|---|---|---|
  | Gratis start | 5 rapporter | 0 kr | — |
  | Klippekort 10 | 10 rapporter (12 mnd) | 1 490 kr | 149 kr |
  | Klippekort 50 | 50 rapporter (12 mnd) | 5 900 kr | 118 kr |
  | Abonnement Liten | 10 rapp/mnd | 990 kr/mnd | 99 kr |
  | Abonnement Medium | 25 rapp/mnd | 1 990 kr/mnd | 80 kr |
  | Abonnement Fri | ubegrenset (fair-use) | 2 990 kr/mnd | — |
  | Påfyll utover kvote | pr. rapport | 79 kr | 79 kr |

**Den ene UX-regelen:** aldri vis kr i genereringsøyeblikket — bare «18 av 25
rapporter igjen denne måneden». Varsle ved lav saldo, tilby påfyll/oppgradering.

**Hvorfor dette prisnivået — verdibasert, ikke kostnad-pluss:**
- En rapport sparer ~2 timer. Takstpersonens time ~800–1 500 kr →
  **1 600–3 000 kr spart verdi per rapport**. Effektiv pris (80–149 kr) er
  ~5–10 % av verdien.
- **Under Befar (500 kr/rapport)** — vi underbyr etablert per-rapport-pris klart.
- **Marginen er >95 %** over kostnad (se under).

**COGS-gulvet — målt via `GET /api/admin/cost`** (Gemini-tokenforbruk per
operasjon; ~10 kr/USD):

  | Operasjon | Tokens (typisk) | Est. kostnad |
  |---|---|---|
  | Rapport (Gemini 2.5 Flash) | ~55–62k inn / ~2k ut | ~0,20–0,24 kr |
  | Transkripsjon | ~8k inn / 0,4k ut | ~0,01 kr |
  | Bildebeskrivelse ×5 | ~1,3k inn hver | ~0,01 kr |
  | **Sum LLM per rapport** | | **~0,25 kr** |

> ⚠️ **Tallene er estimater basert på realistisk rapportstørrelse — video-tokens
> er jokeren** (lang video kan mangedoble input-tokens). Bekreftes med ekte
> pilotrapporter via `/api/admin/cost` (`maks_total_tokens` = verste-fall).
> Legg til infrastruktur (AI-motor-hosting, Google Docs, lagring) og sett
> **kalkylegulvet til ~2–3 kr/rapport** for margin-trygghet. Selv da er
> effektiv pris ~97–98 % margin.

**Beslutning gruppen må ta:** (1) rapporter som enhet + «rapporter igjen»-framing
(anbefalt), (2) klippekort + abonnement som de to produktene, (3) de veiledende
tallene. Priser på `/om` og `/vilkar` endres først når vedtaket foreligger — og
etter at 10–20 ekte pilotrapporter har bekreftet COGS-gulvet.

## Hvorfor det passer DocrAI

- **Kostnad = bruk.** COGS er per rapport (transkripsjon + rapportgenerering).
  Flat 990 kr/mnd bryter koblingen: en storbruker subsidieres av en småbruker,
  og marginen svinger med Google-priser.
- **Variabelt volum.** Takstfolk gjør ulikt antall befaringer i måneden. Kreditt
  per rapport treffer både den som tar to saker og den som tar seksti.
- **Markedspresedens.** Befar: 500 kr/rapport. Wenn: 350/999 kr/mnd. Markedet
  aksepterer allerede per-enhet-prising.
- **Denial-of-Wallet-vern innebygd.** Forhåndsbetalt saldo betyr at en bruker
  aldri kan brenne mer enn saldoen — komplementerer timeout-/rate-vernet vi
  allerede bygde (`fagkart-lansering.md` §10).

## Arkitekturvalg

**1. Forhåndsbetalt, ikke etterskuddsvis (for de fleste).**
Forhåndskjøpte kredittpakker (med valgfri auto-påfyll) gir pengene før
kostnaden, ingen dunning/inkasso, og er selv et DoW-vern. Etterskuddsvis måling
passer storbrukere gjennom innkjøp — men da med **avtalt tak + varsler** så
ingen får sjokkregning.

**2. Egen enhet («kreditt»), ikke rå LLM-tokens.**
Pris i «1 analyse = N kreditter», ikke i leverandørens tokens. Da:
- frikobles prisen fra Googles prisendringer,
- kan vi bytte modell uten å endre prislisten,
- skjules marginen.
Kalkulér kredittpris mot **verste-falls tokenforbruk per operasjon**, og overvåk
faktisk COGS per funksjon så marginen ikke råtner i stillhet.

**3. Måling blir betalingskritisk infrastruktur.**
I dag har vi `user_actions`-logging (analyse). En kredittmodell krever at dette
oppgraderes til **fakturagrunnlag**:
- **Idempotent** forbruksregistrering (dobbeltklikk/retry trekker aldri dobbelt).
- **Atomisk saldotrekk** uten race conditions ved parallelle kall.
- **Revisjonsspor per trekk** (kunder vil bestride: «jeg brukte ikke 40
  kreditter» — loggen er svaret).
- **Definert oppførsel ved tom saldo** midt i en operasjon.
- **Forbruksdashbord** kunden ser selv.

## B2B-juss: hva forsvinner, hva kommer

**Forsvinner (fordi kundene er bedrifter):** angrerett på kredittkjøp,
«bestill med betalingsplikt»-krav, digitalytelsesloven. Kredittutløp og refusjon
blir ren avtaleregulering — vi bestemmer, så lenge det står tydelig i vilkårene.
Rester som består: påstander må kunne dokumenteres, og **kald e-post til
navngitte jobbadresser** rammes av mfl. § 15 (e-post til `firmapost@` er fritt —
jf. kanalvalget i `kampanje-takstpersoner.md`).

**Kommer i stedet — vi blir leverandør i kundens compliance-kjede:**
- **Databehandleravtale (DPA)** vi tilbyr som standard.
- **Publisert underleverandørliste** (Vercel/Render, Postgres-host, Gemini/EU-
  motor) med varslingsmekanisme.
- Svar på **sikkerhetsskjemaer** fra innkjøp; på sikt ISO 27001-spørsmål.
- Under AI Act er vi **provider**, kundene **deployers** — de vil kreve
  dokumentasjonen fra oss.
> Security-siden og DPA-en er i praksis **salgsmateriell** i B2B. Jo mer av
> sikkerhets-/personvernarbeidet (`sikkerhetsrevisjon-aug-2026.md`,
> `fagkart-lansering.md`) som er på plass, jo raskere lukkes salg.

## Mva og regnskap (to feller)

- **Ettformålsverdibevis:** forhåndsbetalte kreditter til én tjeneste med kjent
  avgiftssats — mva beregnes **ved salg av pakken**, ikke ved forbruk.
- **Uopptjent inntekt:** solgte-men-ubrukte kreditter er **gjeld**, inntektsføres
  ved forbruk; utløpte kreditter («breakage») inntektsføres ved utløp.
  Sett opp riktig i Fiken/Tripletex fra første salg. **Verifiseres med regnskapsfører.**

## Betaling B2B (hybrid)

- **EU-salg B2B = omvendt avgiftsplikt** — ingen OSS, men validér VAT-nr (VIES)
  og riktig fakturamerknad.
- Norske bedrifter forventer **faktura med orgnr, ofte EHF** (obligatorisk mot
  offentlige), 14–30 dagers frist, kanskje PO-nummer — ikke kort.
- **Anbefalt arkitektur:** selvbetjent forhåndskjøp med kort (Stripe/Vipps) for
  små kunder som vil i gang i dag **+** fakturert avtale (større pakker eller
  etterskuddsforbruk med tak) for kunder som må gjennom innkjøp.

## App-butikk

Selges kreditter inne i iOS/Android-app er de **forbruks-IAP med 15–30 %
provisjon**, og saldo må persisteres server-side (ingen «restore»). **Selg
kredittpakker på web (full margin), la appen konsumere saldoen** — men følg
Apples anti-styringsregler utenfor EU/USA-unntakene.

## UX — bekjemp taksameter-angst

Bruksmåling demper bruk hvis folk frykter måleren. Derfor alltid:
- vis **saldo** synlig,
- vis **estimert kostnad før dyre operasjoner** («Denne analysen koster ca. 5
  kreditter»),
- **varsle ved lav saldo**,
- gi **gratis startkreditter** så første verdiøyeblikk koster null.

## Vilkårene blir hovedkontrakten

Uten forbrukervern er avtalen alt. Standardvilkårene må definere:
ansvarsbegrensning (typisk oppad til siste 12 mnd vederlag),
ansvarsfraskrivelse for AI-output med krav om menneskelig kontroll hos kunden
(vi har dette i produktet via godkjenningsporten), oppetids-SLA (formell først
når noen betaler), DPA som bilag, og kreditt-mekanikken (gyldighet, tak,
mislighold). Dagens `/vilkar` er skrevet for pilotfasen — den må utvides til en
B2B-hovedkontrakt før betalt drift. **Jurist-gjennomgang anbefales.**

## Anbefalt rekkefølge

1. **Gruppebeslutning:** kredittmodell ja/nei, og kredittpris per operasjon
   (krever COGS-måling per funksjon først).
2. **Før første pilotkunde:** standardvilkår + DPA + underleverandørliste.
3. **Før første innkjøps-kunde:** EHF/faktureringsløype (Fiken/Tripletex).
4. **Kode når modell er vedtatt:** idempotent + atomisk kredittmåling oppå
   `user_actions`, saldo-API, forbruksdashbord, «estimert kostnad»-visning.
5. La **selvbetjeningssporet være rent Stripe** så lenge det bærer.

## Hva dette IKKE er

Ingen priser er endret i kode. `/om` og `/vilkar` står uendret til gruppen har
vedtatt modell og kredittpris. Mva-/regnskapsbehandling og B2B-vilkår må
kvalitetssikres av regnskapsfører og jurist — dette dokumentet er retning, ikke
juridisk eller regnskapsfaglig rådgivning.
