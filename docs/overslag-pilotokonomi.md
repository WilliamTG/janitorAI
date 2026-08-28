# Overslag: pilotøkonomi per befaring

28. august 2026. Overslagsregning (metoden fra
`docs/systemdesign-handbok.md` §1.1) på hva én befaring koster i
KI-forbruk — med *våre egne* tall fra `cost_events` i stedet for gjetting.
Formålet: et etterprøvbart gulv under kredittprisingen
(`docs/prising-bruksbasert.md`) og et regnestykke i stedet for en
overraskelse når Gemini-kvoten diskuteres.

## Slik hentes tallene (kjøres mot produksjonsbasen)

Gjennomsnitt, p95 og antall per operasjon siste 30 dager:

```sql
SELECT operation,
       count(*)                                  AS antall,
       round(avg(total_tokens))                  AS snitt_tokens,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY total_tokens) AS p95_tokens,
       round(avg(est_cost_usd)::numeric, 5)      AS snitt_usd,
       round(sum(est_cost_usd)::numeric, 2)      AS sum_usd
FROM cost_events
WHERE created_at > now() - interval '30 days'
GROUP BY operation
ORDER BY sum_usd DESC;
```

Kostnad per tester per uke (er forbruket jevnt eller drevet av én?):

```sql
SELECT tester_token,
       date_trunc('week', created_at) AS uke,
       round(sum(est_cost_usd)::numeric, 2) AS usd
FROM cost_events
WHERE created_at > now() - interval '60 days'
GROUP BY 1, 2
ORDER BY uke DESC, usd DESC;
```

Feilede rapportkjøringer koster også (operation `report_failed` føres ved
feil — betalte tokens uten leveranse):

```sql
SELECT count(*) FILTER (WHERE operation = 'report')        AS ok,
       count(*) FILTER (WHERE operation = 'report_failed') AS feilet,
       round(sum(est_cost_usd) FILTER (WHERE operation = 'report_failed')::numeric, 2) AS tapt_usd
FROM cost_events
WHERE created_at > now() - interval '30 days';
```

## Regnestykket (fyll inn målte tall)

Antakelser skrives ved siden av tallene — det er antakelsene som skal
diskuteres, ikke desimalene. En typisk befaring antas å utløse:

| Operasjon | Antall per befaring (antakelse) | Snittkost (målt) | Sum |
|---|---|---|---|
| `transcribe` | ~10 (ett per notat + beskrivelse) | *fyll inn* | |
| `describe_image` | ~15 (ett per foto) | *fyll inn* | |
| `report` | 1–2 (inkl. én regenerering) | *fyll inn* | |
| **Per befaring** | | | **≈ …** |

Deretter: per befaring × 2 befaringer/dag × 20 dager ≈ **kostnad per
tester-måned**, og ×antall testere ≈ pilotens KI-kjørekost. Sunnhetssjekk
mot prisingen: en kreditt må prises over p95-kostnaden for operasjonen
den dekker, ellers subsidierer vi de tyngste befaringene.

## Kvote (samme metode)

Gemini-kvoter er per modell per minutt/dag. Verste-tilfelle-belastningen
vår er ikke snittet, men rapportgenereringen (én kjøring sender video +
alle foto i én forespørsel) pluss en travel befaringsdag med
transkriberinger. Regn: maks samtidige testere × kall/kvarter (nå maks
30 per tester — `HEAVY_RATE_LIMIT`) mot kvoten i konsollen, *før* neste
tester slippes på. Rate limiteren per tester gjør dette regnestykket
deterministisk: n testere kan aldri trekke mer enn n × 30 tunge kall per
kvarter.

## Vedlikehold

Kjør spørringene og oppdater tabellen når (a) prisingen skal settes,
(b) en ny tester slippes på, eller (c) `PROMPT_VERSION` bumpes (endret
prompt = endret tokenforbruk — sammenlign før/etter på `snitt_tokens`).
