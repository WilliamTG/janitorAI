# Kampanje: DocrAI mot norske takstpersoner

Skrevet august 2026, pre-pilot. Grunnlag: Norsk takst organiserer ~1 300
sertifiserte takstingeniører fordelt på ~700 medlemsforetak; i tillegg finnes
nettverk som Takstnett. Hele det adresserbare markedet er altså i størrelsesorden
1 500–2 000 personer.

## 0. Markedsmatta som styrer alt annet

Betalt annonsering er matematisk feil verktøy for denne målgruppen:

- LinkedIn-målgrupper under ~50 000 personer underleverer systematisk
  (sporadisk visning, CPM-hopp på 60–80 % over prognose). Vår målgruppe er
  ~1 500. Smal B2B-targeting koster dessuten $18–35 per klikk.
- Med pris 990 kr/mnd og en målgruppe der én person kan nås direkte for
  kostnaden av tre klikk, er 1:1-kanaler alltid billigere enn media.
- Konklusjon: **dette er en listekampanje (ABM), ikke en annonsekampanje.**
  Hele markedet får plass i ett regneark. Kampanjens jobb er å flytte navn
  nedover en tilstandsmaskin — ikke å kjøpe rekkevidde.

Budsjettprofil: 90 % tid, 10 % penger (reise til fagdager + ev. småskala
retargeting). Mediekjøp skaleres først når produktet selges utenfor
førstehåndsnettverket.

## 1. Mål og baklengs-regning

Mål (fra faseplanen): 5–8 signerte pilotavtaler innen 3 måneder; 3 betalende
foretak innen 12.

Antatt trakt (kalibreres ukentlig mot faktiske tall):

| Steg | Antatt rate | Volum for 8 piloter |
|---|---|---|
| Kontaktet (1:1, personalisert) | — | ~120 foretak |
| Svar | 25 % | 30 |
| Demo aktivert (åpner demolenken) | 60 % av svar | 18 |
| 15-min møte | 60 % av demo | 11 |
| Pilotavtale | 70 % av møte | 8 |

120 kontakter over 8–10 uker = 12–15 nye per uke. Det er gjennomførbart for én
person ved siden av utvikling (50/50-regelen) — men bare med sekvensen i §5
som gjør hver kontakt gjenbrukbar.

## 2. Listen: bygg hele markedet som datasett

1. **Kilder:** Norsk taksts «finn takstmann»-register, Takstnett-oversikten,
   Proff.no (bransjekode + tekstsøk «takst», filtrer på tjenester
   forsikringsskade/naturskade), foretakenes egne nettsider.
2. **Felt per foretak:** navn, kontaktperson(er), størrelse (antall
   takstpersoner), tjenester, forsikringsoppdrag (ja/nei — se etter «skade»,
   «naturskade», selskapsnavn på referanselista), fylke, e-post (foretak),
   telefon, org.form (AS vs. ENK — avgjør lovlig kanal, se §8).
3. **Scoringsmodell (prioritering, 0–100):**
   - Forsikringsoppdrag: +40 (in4mo-smerten finnes bare her)
   - 2–10 takstpersoner: +25 (eieren bestemmer selv og bruker appen selv)
   - Geografisk klynge vi kan besøke/ride-alonge: +15
   - Digitale spor (aktiv nettside, sosiale medier): +10
   - Synlig frustrasjon (omtaler, innlegg om verktøy): +10
4. **Output:** A-liste (score ≥ 60, ~30 foretak — håndarbeid, maksimal
   personalisering), B-liste (~100, sekvens med lettere personalisering),
   C-liste (resten — nås via fagmiljø/innhold, ikke direkte).

## 3. Kroken: demoen er kampanjemotoren

Det sterkeste virkemiddelet vi har er ikke en tekst — det er saksunderlaget.
Demolenke som viser **mottakerens egen adresse**:

- `docrai.no/demo?adresse=<foretakets kontoradresse>` → siden åpner rett i
  saksunderlaget for adressen: kart, matrikkel, bygningstype, terrenghøyde,
  vær. Null innlogging (demo-modus fra faseplanen — denne kampanjen er
  grunnen til å bygge den).
- Førstemelding kan da si: *«Trykk her — dette er kontoret deres, hentet fra
  åpne kilder på 2 sekunder. Tenk deg det samme før hver befaring.»*
  Personalisering som er umulig å ignorere, og som demonstrerer produktet
  i stedet for å beskrive det.
- Hver lenke er unik per mottaker → åpning og aktivering måles uten
  tredjeparts sporing (vår egen server logger).

## 4. Budskapsarkitektur: tre varianter, testet sekvensielt

Alle bygget på dokumentert smerte (App Store-analysen, `erfaringer-konkurrenter.md`):

- **T (Tid):** «Rapporten er ferdig når du setter deg i bilen.» Kvantifiser:
  2 timer skrivetid → 15 min godkjenning. For eieren: fakturerbar tid.
- **V (Verktøysmerten):** «Feltverktøyene dere er pålagt å bruke er laget for
  forsikringsselskapet — ikke for deg i kjelleren med våte hansker. Vi bygger
  motsatt.» (Aldri nevn in4mo nedsettende ved navn i skrift — bransjen er
  liten, og vi skal integrere mot dem senere.)
- **A (Ansvar/trygghet):** «AI-en skriver utkastet. Du kontrollerer, korrigerer
  og stempler. Byggforsk-henvisninger følger med — og ingenting deles før du
  har godkjent.» Treffer skepsisen mot AI direkte.

Regel: én variant per kontakt, aldri miks. Med N≈1 500 er parallelle A/B-tester
underpowered — bruk **sekvensiell omfordeling** (bandit-logikk): start uke 1
med T/V/A fordelt 40/30/30, mål svarrate per variant ukentlig, flytt fordelingen
mot vinneren, men behold alltid ≥15 % på utfordrerne.

## 5. Sekvensen: tilstandsmaskin per kontakt

```
NY → KONTAKTET → SVART → DEMO_AKTIVERT → MØTE_BOOKET → PILOT → BETALENDE
        │           │            │
        │           │            └─ ikke møte etter 7 d → påminnelse med
        │           │               nytt vinkel-budskap (én gang)
        │           └─ svart nei → NEI-liste (kontaktes ikke igjen;
        │              spør om én henvisning: «hvem burde sett dette?»)
        └─ ikke svar etter 5 d → oppfølger 1 (kort, ny detalj)
           ikke svar etter 12 d → oppfølger 2 (siste, del casestudie/demo)
           ikke svar etter 20 d → PARKERT (reaktiveres kun av trigger)
```

- **Maks 3 berøringer** uten svar, deretter parkert. Små bransjer straffer mas.
- **Triggere som reaktiverer parkerte:** ny casestudie publisert, fagdag i
  deres region, henvisning fra kollega, nyhet (f.eks. Boligmappa-integrasjon).
- **Kanal per org.form (jf. §8):** AS → e-post til foretaksadresse + telefon.
  ENK → telefon eller LinkedIn-melding (ikke uanmodet e-post).
- Alt logges i regnearket/CRM med dato, variant (T/V/A), utfall. Regnearket
  ER kampanjen; ratene i §1 oppdateres fra det hver fredag.

## 6. Fagmiljø-kanalen: autoritet slår annonser

- **Norsk takst-økosystemet:** lokallag og fagdager (NEAK arrangerer, f.eks.
  fagdager i Bergen i august). Mål: faglig innlegg — «AI i skaderapporten:
  hva takstpersonen må kontrollere» — ikke stand. Autoritet + ansvarsbudskapet
  i én pakke, foran nøyaktig riktig publikum.
- **NEAK/kursleverandør-sporet:** DocrAI som verktøy-demo i etterutdanning når
  produktet er modent; start dialogen tidlig.
- **Faglig råd (fra faseplanen):** 1–2 navngitte, respekterte takstpersoner som
  vurderer AI-rapportene — navnene deres i casestudien er verdt mer enn
  ethvert annonsebudsjett i en bransje der alle kjenner alle.

## 7. Forsterkere (små, billige, valgfrie)

- **Referral-mekanikk:** hver pilotdeltaker får en delbar demolenke
  («vis en kollega») med sporing. Målet er at trakta i §1 fylles av
  henvisninger fra uke 6.
- **SEO/innhold (langsiktig):** 3–5 artikler på høyintensjonssøk med lite
  konkurranse: «skaderapport mal», «akutt eller gradvis vannskade»,
  «Byggforsk våtrom sluk» — fanger takstpersoner i arbeidsmodus. Kompounder
  i månedsvis; skriv én per uke etter pilotstart, ikke før.
- **Retargeting (eneste betalte flate):** Meta custom audience av
  nettstedsbesøkende (demolenke-trafikken). Budsjett 2–3 000 kr/mnd, kun
  påminnelse («casestudie: 2 t → 15 min») — aldri kald prospektering.
- **Facebook-tilstedeværelse:** bransjesidene (Norsk takst 3 400+ følgere,
  Takstnett, regionale takstforum) viser at målgruppen er der — men som
  følgere av *organisasjoner*. Delta med fag, ikke annonser: kommentér,
  del casestudien når den finnes.

## 8. Lovlighet (Norge) — innebygd i kanalvalget

- **Markedsføringsloven § 15:** uanmodet e-post-markedsføring til fysiske
  personer krever forhåndssamtykke — og **enkeltpersonforetak regnes som
  fysisk person**. Derfor styrer org.form kanalvalget i §5: ENK nås via
  telefon (lov for næringsdrivende, sjekk reservasjon) eller sosiale medier,
  AS via e-post til foretaksadressen (lovlig B2B).
- **GDPR:** listen inneholder kun offentlig tilgjengelige yrkesdata; lagres
  med formål dokumentert, slettes på forespørsel; demolenkene sporer uten
  tredjepartscookies (egen serverlogg).
- **Ærlighet i personalisering:** demolenken viser kun åpne offentlige data
  om *foretakets* adresse — aldri privatadresser.

## 9. 90-dagers kjøreplan

| Uke | Gjør |
|---|---|
| 1–2 | Bygg listen (§2) + demo-modus med adresse-parameter (§3). Skriv de tre budskapsvariantene. |
| 3 | A-lista (30): håndskrevne 1:1-henvendelser, 10/uke. Meld inn foredragsforslag til lokallag/fagdager. |
| 4–6 | B-lista i sekvens (12–15/uke). Fredags-review: rater per variant, omfordel (§4). |
| 6 | Første piloter i gang → be om henvisninger, start referral-løkken (§7). |
| 7–9 | Fagdag-innlegg om mulig. Første casestudie med tall + navn. Reaktiver parkerte med den. |
| 10–12 | Runde 2 mot ikke-svar med casestudien. Retargeting på. Evaluer: traktrater vs. §1, juster mål eller budskap. |

## 10. Målinger som faktisk styrer noe

Ukentlig (fredag): kontaktet / svar% / demoaktivering% / møter / piloter,
brutt ned på budskapsvariant og listesegment. Månedlig: kost per pilot
(timer × timepris + utlegg), henvisningsandel av nye leads (målet er > 30 %
innen uke 12 — i en bransje på 1 500 personer er munn-til-munn den eneste
kanalen som skalerer).
