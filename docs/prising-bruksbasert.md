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

## Anbefalt pris (utgangspunkt — bekreftes mot ekte COGS)

**TL;DR: 149 kr per rapport (B2B, eks. mva), forhåndsbetalt i kredittpakker,
med volumrabatt og gratis startkreditter. Behold 990 kr/mnd flat som alternativ
for storbrukere.**

- **Enhet:** 1 rapport = 10 kreditter. Transkripsjon og bildebeskrivelse er
  *inkludert* i rapporten — de er små, og separat måling skaper taksameter-angst.
- **Veiledende pris og pakker:**

  | Pakke | Rapporter | Pris | Per rapport |
  |---|---|---|---|
  | Start (gratis) | 5 | 0 kr | — |
  | Liten | 10 | 1 490 kr | 149 kr |
  | Medium | 50 | 5 900 kr | 118 kr |
  | Stor | 100 | 9 900 kr | 99 kr |
  | Flat abonnement | ubegrenset | 990 kr/mnd | break-even ~7/mnd |

**Hvorfor 149 kr — verdibasert, ikke kostnad-pluss:**
- En rapport sparer ~2 timer. Takstpersonens time ~800–1 500 kr →
  **1 400–2 600 kr spart verdi per rapport**. 149 kr er ~6–10 % av verdien.
- **Under Befar (500 kr/rapport)** — vi underbyr etablert per-rapport-pris klart,
  med bedre feltopplevelse.
- **Marginen er >95 %** over kostnad (se under). Prisen begrenses av verdi og
  konkurranse, ikke av COGS.

**COGS-gulvet — målt via `GET /api/admin/cost`** (Gemini-tokenforbruk per
operasjon; ~10 kr/USD):

  | Operasjon | Tokens (typisk) | Est. kostnad |
  |---|---|---|
  | Rapport (Gemini 2.5 Flash) | ~55–62k inn / ~2k ut | ~0,20–0,24 kr |
  | Transkripsjon | ~8k inn / 0,4k ut | ~0,01 kr |
  | Bildebeskrivelse ×5 | ~1,3k inn hver | ~0,01 kr |
  | **Sum LLM per rapport** | | **~0,25 kr** |

> ⚠️ **Tallene er estimater basert på realistisk rapportstørrelse — video-tokens
> er jokeren** (lang video kan mangedoble input-tokens). De bekreftes med ekte
> pilotrapporter via `/api/admin/cost` (`maks_total_tokens` gir verste-falls-
> grunnlaget). Legg til infrastruktur (AI-motor-hosting, Google Docs, lagring) og
> sett **kalkylegulvet til ~2–3 kr/rapport** for margin-trygghet. Selv da er 149 kr
> ~98 % margin.

**Beslutning gruppen må ta:** godkjenne 149 kr/rapport som veiledende startpris
(eller justere), og pakkestrukturen over. Priser på `/om` og `/vilkar` endres
først når vedtaket foreligger — og etter at 10–20 ekte pilotrapporter har
bekreftet COGS-gulvet.

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
