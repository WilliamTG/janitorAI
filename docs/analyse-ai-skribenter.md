# AI-skribenter for fagfolk — Noteless og tilsvarende i andre markeder

Skrevet august 2026. Tre uavhengige research-runder med kildekrav (URL per
påstand): Noteless i dybden, de globale ambient-skribentene i helse (Abridge,
Microsoft/Nuance, Nabla, Heidi, Corti, Tandem), og naboprofesjonene (Axon
Draft One for politi, Legora/Harvey i jus, FieldScribe i forsikring,
RICS-verktøyene i UK, InspectAndGo i Australia). Alle tall/kilder er
verifisert live; leverandørhevdede tall er merket i teksten der de står.

## TL;DR — hva dette betyr for DocrAI

1. **DocrAI er en AI-skribent for fagfolk med dokumentasjonsplikt** — samme
   kategori som Noteless (lege), Abridge (kliniker) og Axon Draft One
   (politi). Helse er 2–3 år foran; politi og jus viser bevis- og
   ansvarsmekanismene. Mønstrene er direkte overførbare.
2. **Kategorien er massivt kapitalvalidert:** Abridge $5,3 mrd. verdsettelse,
   sektoren hentet ~$1 mrd. i 2025 — og i Norge: Noteless til ~600 MNOK
   verdsettelse på 41,5 MNOK-emisjon, 2 000+ betalende leger (~20 % av
   fastlegene), etter ~2 år. Dette er også DocrAIs fundinghistorie.
3. **Kategoriens sterkeste enkeltmekanisme er kildekobling** (Abridge
   «Linked Evidence»): klikk på en setning i utkastet → se/hør beviset den
   bygger på. Det er både verifiserings-UX, anti-«rubber stamping» og
   auditerbarhet i ett. Ingen i bygg/skade har det — og kombinert med
   SHA-256-beviskjeden er det DocrAIs naturlige signaturtrekk.
4. **«Utkast-for-godkjenning» er et regulatorisk skjold:** MHRA (UK) har
   fastslått at verktøy som kun lager utkast en fagperson gjennomgår, havner
   i en lettere regulatorisk klasse enn verktøy som konkluderer selv.
   Godkjenningsporten er altså jus, ikke bare etikk.
5. **To dokumenterte katastrofe-moduser å designe mot:** mottaker-veto (én
   aktor nektet AI-rapporter etter én feil — for oss: forsikringsselskapene)
   og sletting/skjuling av AI-utkast (Axons omdømmesmell, nå lovforbudt i
   California). DocrAI har allerede motsatsen bygget (utkastet arkiveres
   uendret med diff) — det skal *frontes*, ikke bare finnes.

## Kategorikartet (kort)

| Aktør | Domene | Nøkkelfakta (kilde-verifisert aug 2026) |
|---|---|---|
| **Noteless** (org 932 320 061, Oslo, 2023) | Helse, Norge | 2 000+ betalende, 700+ maler, 790–1 090 kr/mnd + Flex 40 kr/mnd+10 kr/kons., CE + ISO 27001, sletter alt etter 24 t, 35,5 MNOK oms. 2025 (−30 MNOK), ~600 MNOK verdsettelse |
| **Abridge** | Helse, USA | «Linked Evidence» (setning→lyd), $5,3 mrd. verdsettelse, ~$100M ARR, Epic-innebygd |
| **Tandem Health** | Helse, EU/NHS | Speiler kundens egne maler; CE klasse IIa som *valgt* differensiator; «Nothing enters the record without clinician approval» |
| **Heidi / Nabla / Dragon Copilot** | Helse | Freemium bottom-up (Heidi: 2 mill. klinikere), maler per spesialitet, lær-av-rettelser, $39–150/bruker/mnd selvbetjent |
| **Axon Draft One** | Politi, USA | Tvungne [insert]-plassholdere, signert attestasjon, supervisor-ledd — men sletter førsteutkast (EFF-skandale → California SB 524 lovkrav om utkast-retensjon) |
| **Legora/Harvey** | Jus | Setningsnivå-siteringer til underlagsdokumenter; bransjenorm: AI-sitat erstatter aldri menneskelig kildekontroll |
| **FieldScribe AI** | Forsikring, USA/India | Talenotater+foto → «claim-ready» rapport med kildehenvisning per setning, konfliktdeteksjon, missing-field-flagg |
| **RICS-økosystemet (UK)** | Takst/survey | Otto/SurveyorSuite m.fl.; RICS fikk verdens første AI-profesjonsstandard for faget (mars 2026): klient-disclosure før arbeid, signerende surveyor bærer alt ansvar |

**Hull bekreftet av alle tre rundene:** ingen aktør i noe marked kombinerer
(a) kryptografisk beviskjede i fangstleddet, (b) kildekobling i rapporten og
(c) eksternt fagreferanseverk (à la Byggforsk) sitert i utkastet. Nærmeste er
Harvey/LexisNexis i jus. Dette er DocrAIs åpne terreng.

## Inkorporeringsliste — prioritert

### P1 — inn i produktet nå (pilotfasen)

1. **Kildekobling i rapporten («Linked Evidence»).** Hvert felt/hver påstand
   i AI-utkastet peker på beviset: tidsstempel i video/lyd eller konkret
   foto. Krever at AI-motoren returnerer kildereferanser per felt i
   `DamageAnalysis` og at rapportvisningen gjør dem klikkbare. Dette er
   samtidig motgiften mot «rubber stamping»: gjennomgangen blir aktiv fordi
   verifisering er billig. *Kategoriens viktigste lærdom.*
2. **[SETT INN]-plassholdere som blokkerer godkjenning** (Axon-mønsteret).
   Der AI-en mangler sikker informasjon (fuktverdi ikke lest høyt, alder på
   røranlegg ukjent) settes en obligatorisk plassholder som må fylles eller
   aktivt fjernes før stempelet kan settes. Markedsføres som
   anti-hallusineringsmekanisme.
3. **Skjerpet attestasjon ved godkjenning.** Dagens bekreftelsesdialog
   utvides med eksplisitt erklæring (Axons formulering som mal): «Jeg har
   gjennomgått rapporten i detalj, gjort nødvendige endringer, og innholdet
   samsvarer med mine observasjoner fra befaringen.» Signering = attestasjon.
4. **Vis det som IKKE er dekket** (omisjoner er vanligste AI-feiltype — 18 %
   i helsestudiene, mot 11,5 % hallusinasjoner). Ved rapportgenerering:
   varsle om rom som ikke er markert «ferdig befart» og huskelistepunkter
   uten medier. Bygger direkte på romløypa som allerede er ute.
5. **Front utkast-arkivet som tillitsargument.** reportDraft/reportFinal-
   diffen finnes allerede — den er nå *lovpålagt praksis* for politi-AI i
   California (SB 524). Inn i salgsflater og IN-søknad: «AI-utkastet
   arkiveres uendret ved siden av den godkjente rapporten — hele diffen er
   etterprøvbar.»
6. **Én-setnings garantien** (Noteless-mønsteret) på alle flater: «DocrAI
   deler aldri en rapport uten takstpersonens stempel — håndhevet av
   serveren.» Pluss ansvarslinjen: «AI er et verktøy, ikke en stedfortreder.»
7. **Samtykke/informasjon ved opptak — avklar FØR pilot med ekte saker.**
   Søksmålene i USA gjaldt lyd sendt til tredjepart uten informert samtykke.
   Befaringsvideo fanger beboere/skadelidte: definer informasjonsplikten
   (skriv i pilotavtalen + i appen), jf. Datatilsynets krav om
   forhåndsinformasjon som Noteless følger.

### P2 — etter pilot-evidens

8. **Maler per skadetype + takstpersonens egne formuleringer** (Noteless
   700+ maler; Tandem speiler kundens eksisterende maler). Vår variant:
   vannskade/brann/sopp-maler + personlige standardfraser, så rapporten
   «høres ut som meg».
9. **Lær av rettelser.** Diff-dataene (utkast vs. godkjent) brukes aktivt:
   per-bruker stilpreferanser og systematisk kvalitetsforbedring — standard
   hos Nabla/Abridge/Dragon, og dere sitter allerede på dataene.
10. **Flex-prisnivå** (Noteless: 40 kr/mnd + 10 kr/konsultasjon) som
    lavterskel inngang ved siden av klippekort/abonnement — validerer og
    utfyller `beslutningsnotat-prising.md`.
11. **Forbund som distribusjonskanal** (Noteless × Fysioterapeutforbundet:
    medlemsrabatt + medlemsverifisering) → Norsk takst-sporet.
12. **Integrasjonstrapp i stedet for dyp integrasjon først** (Noteless:
    kopier/lim → utvidelse som fyller felter → partnerintegrasjon). Vår
    in4mo/MEPS-vei uten å bryte nei-lista: få rapporten *inn* med minst
    mulig friksjon, dyp integrasjon etter bevist verdi.
13. **Publisert pilotstudie** (Kaiser/Helse MR-mønsteret): definerte måltall
    fra Ocab (minutter til godkjent rapport, redigeringsgrad per felt,
    aksept hos forsikringsselskap) publisert som case — kategoriens
    gullstandard for enterprise-salg. Vær ærlig: uavhengige studier viser
    alltid lavere gevinst enn leverandørtall (16 min/8 t i helse), og
    verktøy brukes i bare ~30 % av tilfellene uten aktiv vane-bygging — mål
    faktisk bruk, ikke entusiasme.

### P3 — beredskap/vakt

14. **Regulatorisk beredskap:** RICS-standarden (klient-disclosure før
    arbeid, signerende fagperson bærer alt) og de amerikanske lovene
    (utkast-retensjon, AI-merking per side) er malen for hva norsk
    regulering kan kreve. Bygg for morgendagens krav — dere oppfyller det
    meste allerede. Sertifiseringsstigen (ISO 27001) tas når kapitalen
    tillater; Noteless viser at «regulatorisk mest moden» er en
    vinnerposisjon — og at et manglende anbudsvedlegg kan koste en
    halv-milliard-avtale uansett kvalitet.
15. **C2PA-signering ved fangst** (Truepic-mønsteret i US-forsikring) som
    fremtidig påbygg på SHA-256/geo/tid-kjeden.
16. **Datasletting som feature:** definer og publiser råmedia-policy (hva
    lagres, hvor, hvor lenge) — «sletter etter X» er Noteless' enkleste
    tillitssetning.

## Fallgruvene (dokumenterte, ikke teoretiske)

- **Mottaker-veto:** King County-aktoren nektet AI-politirapporter etter én
  dokumentert feil. Valider aksept hos Ocabs oppdragsgivere
  (forsikringsselskapene) tidlig i piloten — før skalering.
- **Fabrikkerte observasjoner:** helsekategoriens verste feilmodus er
  «undersøkelser som aldri fant sted». Mål hallusinasjonsrate på egne
  rapporter; alvorlighet teller mer enn antall. Kildekobling (P1-1) er
  strukturell motgift.
- **Incentivnøytralitet:** i helse advares det mot AI som vrir koding mot
  høyere fakturering. Vår ekvivalent: AI-en må aldri systematisk vri
  akutt/gradvis i noens økonomiske favør — nøytraliteten ER produktet
  overfor forsikringsselskapene.
- **Plattformskvis:** Epic bygde egen skribent og truet hele kategorien.
  In4mo/MEPS kan gjøre det samme — forsvarets navn er fart, norsk
  normverk-dybde og beviskjeden de ikke har.

## Kilder
Hoveddokumentasjon per aktør ligger i research-rundene (URL per påstand er
arkivert i analysegrunnlaget). Sentrale primærkilder: abridge.com/support
(Linked Evidence), axon.com (Draft One-sperrene), eff.org (utkast-sletting,
SB 524), gov.uk/MHRA (regulatorisk grense), rics.org (AI-standarden),
noteless.com + data.brreg.no (Noteless produkt/selskap), helse-mr.no
(pilotevaluering), catalyst.nejm.org (Kaiser-studien), ai.nejm.org (RCT).
