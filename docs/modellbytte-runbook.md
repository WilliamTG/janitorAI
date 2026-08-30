# Runbook: bytte av KI-modell i rapportmotoren

28. august 2026. Beredskapsnotat fra TIME100-gjennomgangen
(`docs/time100-ai-laerdommer.md`, punkt 3 — Pineau/Cohere:
modellavhengighet er en forretningsrisiko). Hele motoren står i dag på
én modell hos én leverandør (`gemini-2.5-flash`, Google) — dette
dokumentet gjør et påtvunget eller ønsket bytte til en prosedyre i
stedet for en krise.

**Dette er en runbook, ikke et byggeprosjekt.** Multi-modell-abstraksjon
bygges ikke (nei-lista: infrastruktur uten evidens). Forsikringen er at
byttet er dokumentert, testbart og reverserbart.

## Utløsere (når runbooken tas frem)

- Kvote/rate-grenser som faktisk stopper pilotbruk (jf. det åpne
  Gemini-kvotespørsmålet i pilotloggen) og ikke løses med kvoteøkning.
- Prisøkning som velter COGS-regnestykket (`/api/admin/cost` +
  `docs/overslag-pilotokonomi.md` gir tallene).
- Modellen depreseres/trekkes tilbake, eller vilkårsendringer
  (personvern, dataresidens) som bryter med våre forpliktelser.
- Kvalitetsfall målt av valideringsbatteriet etter en stille
  modelloppdatering hos leverandøren.

## Hva som er modellnøytralt i dag (og skal forbli det)

- **Prompten** (`ai-engine/prompt.py`): ren tekst med `PROMPT_VERSION`.
  Ingen Gemini-spesifikk syntaks i selve instruksene.
- **Kunnskapsgrunnlaget**: PDF-er i Drive-mappen + fagkunnskapen i
  `docs/fagkunnskap-vannskadeaarsaker.md` — filer og tekst, ikke
  leverandørformat.
- **Kontrakten**: strukturert `DamageAnalysis`-JSON. Enhver kandidat må
  levere samme skjema (JSON-modus/structured output er standardvare hos
  alle frontier-leverandører).
- **Resten av kjeden**: Google Docs-generering, eksport, deling — berører
  ikke analysemodellen.

## Integrasjonsflaten (alt som faktisk må endres)

Alle modellkall bor i `ai-engine/` — appen og API-et kjenner ikke
modellen (API-et proxyer bare, og `/transcribe`/`/describe-image` i
`apps/api/src/index.js` bruker samme nøkkel/SDK — de følger med i
byttet):

| Sted | Hva |
|---|---|
| `ai-engine/main.py` | `genai.Client`, `files.upload` (video/foto/kunnskap), `generate_content` med `model="gemini-2.5-flash"`, token-usage-lesing |
| `ai-engine/server.py` | `GEMINI_API_KEY` fra env |
| `apps/api/src/index.js` | transkribering + bildebeskrivelse (samme SDK/nøkkel), COGS-modellnavnet i `recordCost` |
| Render env | `GEMINI_API_KEY` (motor + backend) |

Kandidatens krav: multimodal inn (video + bilder + lang tekst),
strukturert JSON ut, filopplasting eller inline media, norsk språkstøtte.

## Bytteprosedyren

1. **Frys målestokken:** kjør valideringscasene
   (`docs/valideringscaser.md`) på dagens modell og arkiver resultatet
   (dette er baseline).
2. **Grenkode:** bytt SDK/modellnavn på integrasjonsflaten over, i egen
   gren. Bump `PROMPT_VERSION` (f.eks. `2026-XX-YY.1-<modellnavn>`) —
   proveniensen i rapportene skiller da modellene automatisk.
3. **Byttetesten:** kjør samme valideringscaser på kandidaten.
   Sammenlign per case: årsak riktig? akutt/gradvis riktig?
   Byggforsk-henvisninger reelle? Norsk fagspråk? Deretter: kjør 3–5
   ekte (anonymiserte) befaringer parallelt og mål draft-vs-godkjent-
   diffen mot baseline.
4. **Kostnadssjekk:** token-forbruk × kandidatens pris mot
   `/api/admin/cost`-tallene — kredittprisingen må fortsatt ha gulv.
5. **Beslutning med eksperten:** takstpersonen vurderer blindt 2–3
   rapportpar (dagens vs. kandidat). Kvalitet avgjøres av fagfolk, ikke
   benchmarks.
6. **Utrulling:** merge + Manual Deploy (motor + backend). Gammel nøkkel
   beholdes i env til kandidaten har levert en uke feilfritt.
7. **Rollback:** revert av grenen + deploy. Fordi prompten og kunnskapen
   er uendret, er rollback rent mekanisk.

## Vedlikehold

Oppdater tabellen over hvis integrasjonsflaten flytter seg (nye
KI-endepunkter, ny SDK). Runbooken testes i praksis første gang en
modelloppgradering *innen* Gemini-familien gjøres — samme prosedyre,
lavere innsats.
