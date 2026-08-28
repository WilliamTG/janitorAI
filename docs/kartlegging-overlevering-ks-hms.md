# Kartlegging: DocrAI for overlevering, milepæler, KS- og HMS-avvik

27. august 2026. Bestilt av Fredrik som oppfølging av
`signal-kontraktskontroll-offentlig.md` — en fullstendig arkitektur- og
markedskartlegging av tre beslektede bruksområder utenfor forsikringsskade:
**overtakelse/milepæler i bygg- og anleggskontrakter**, **KS-avvik**
(kvalitetssikring) og **HMS-avvik** (helse, miljø, sikkerhet). Grunnlag:
tre uavhengige researchpass mot primærkilder (Lovdata, Arbeidstilsynet,
Standard Norge, DiBK) 27.08.2026. Dette er en kartlegging, ikke et
byggevedtak — konklusjonen følger fortsatt nei-lista-disiplinen.

## Presist begrepsapparat — fire forvekslingsfeller å unngå

Research bekrefter at disse begrepene lett blandes, og at feil kobling
ville vært en reell (ikke bare kosmetisk) svakhet i et produkt rettet mot
en fagbransje:

| Begrep | Hva det faktisk er | Feil å unngå |
|---|---|---|
| **NS 3420** | Kodet beskrivelses-/kalkulasjonsspråk for arbeidsoperasjoner, primært anbudsfasen — men fungerer som generell bransjenorm for «normal» kvalitet selv der den ikke er avtalt. Bruker utførelsesklasser **U1–U3** (ikke «toleranseklasser 1–4», som én kilde feilaktig hevdet). | Å tro NS 3420 er kontraktsjussen for overtakelse — det er den ikke. |
| **NS 8405/8406/8407** | Kontraktstandardene som styrer selve **overtakelsesprosedyren**: innkalling (~14 dager), protokoll, mangelklassifisering, frister, reklamasjon (5 år absolutt). NS 8405/8406: kan bare nekte overtakelse ved mangel som hindrer forutsatt bruk. NS 8407: unntar eksplisitt «mindre mangler» fra nektelsesretten. | Å tro dette er det samme som NS 3420. |
| **NS 8430** | **Egen, nyere standard** — «Overtakelse av bygg og anlegg» — med ferdige elektroniske skjemaer (protokoll + mangelliste, næring og forbruker) via «eBlanketter», koblet til Nasjonal database for byggkvalitet. **Dette er et eksisterende digitalt produkt fra Standard Norge selv**, ikke bare en tekststandard. | Å overse at dette allerede er en direkte referanse/konkurrent i overtakelsesrommet. |
| **KS-avvik vs. HMS-avvik vs. uavhengig kontroll (DiBK)** | Tre juridisk atskilte spor. **KS**: kontraktsbasert/ISO 9001-basert, internt kvalitetssystem, lukkes internt. **HMS/internkontroll**: lovpålagt (Internkontrollforskriften, Byggherreforskriften), Arbeidstilsynet-håndhevet. **Uavhengig kontroll**: lovpålagt tredjepartskontroll (plan- og bygningsloven kap. 24 / SAK10 kap. 14) av et **separat kontrollforetak** tiltakshaver må engasjere; ikke-lukket avvik eskaleres til kommunen. God egen KS kan redusere omfanget av den lovpålagte kontrollen, men erstatter den ikke. | Å designe ett felles «avvik»-begrep som slår sammen disse — de har ulike parter, ulike lukkingskriterier og ulike konsekvenser ved manglende lukking. |

## De fire domenene side ved side

| | Skaderapport (i dag) | Overtakelse/milepæl | KS-avvik | HMS-avvik |
|---|---|---|---|---|
| **Hva slags funn** | Årsak til noe som allerede har skjedd | Samsvar/avvik mot kontraktsbeskrivelse+tegning | Avvik mellom definerte krav og utført arbeid/produkt | Årsak til en uønsket hendelse (ikke skaden — **Arbeidstilsynet er eksplisitt**: «Det er ikkje skaden som er avviket – det er årsaka til skaden») |
| **Referanse som siteres** | Byggforsk-datablad (verifisert indeks) | Kontraktsbeskrivelse/tegning; NS 3420-toleranse som teknisk fasit der relevant | KS-rutine, NS 3420-toleranse, generiske rotårsakskategorier (systemfeil/prosedyrefeil/opplæring) | SHA-plan-tiltak, Internkontrollforskriften §5, RUH-avvikstype (fall, stillas, PVU, kjemikalier, elektrisk …) |
| **Alvorlighet** | Akutt/gradvis | Hindrer forutsatt bruk vs. mindre mangel (standardavhengig) | Konfigurerbar 3- eller 5-nivå (ingen bransjenorm) | Observasjon / nesten-ulykke / skade |
| **Hvem godkjenner/lukker** | Takstperson (ett stempel) | **Begge parter** signerer protokollen i fellesskap | Kvalitetsansvarlig (ofte IKKE utførende) | Koordinator/verneombud/ansvarlig, ofte med frist + påminnelse |
| **Livssyklus** | Én rapport, ett stempel, ferdig | Protokoll → utbedringsfrist → **etterbefaring** | Meldt → under arbeid → **verifisert lukket** (kan ha %-effektmåling) | Meldt → tiltak → **verifisert lukket** |
| **Rettslig ramme** | Ingen spesifikk (forsikringsavtale) | NS 8405/8406/8407/8430 | Byggesaksforskriften (SAK10) §10-1 | Byggherreforskriften, Internkontrollforskriften, Arbeidsmiljøloven |

**Den viktigste strukturelle innsikten:** skaderapporten er *ett skudd* —
befaring → utkast → godkjenning → deling, ferdig. Alle de tre nye domenene
har en **lukkingssløyfe**: et funn er ikke ferdig når det er dokumentert,
det er ferdig når det er *utbedret og verifisert lukket*, ofte av en annen
person enn den som meldte det, med en frist og noen ganger en
etterbefaring. Dette er en reell arkitekturutvidelse, ikke en
skjemaendring.

## Generalisert datamodell — hva må endres i grunnen

Dagens `DamageAnalysis` (`ai-engine/models.py`) er skadedomene-spesifikk
(`cause`, `is_habitable`, `extent_description`). Den bør **ikke** endres —
den fungerer og er pilotert. Riktig generalisering er en **parallell,
konfigurerbar «Funn»-modell** brukt av de tre nye domenene, med samme
mønster som Byggforsk-sitatporten (verifisert metadata-indeks + funksjon
som forkaster uverifiserte referanser):

- **Lokasjon** — gjenbruker eksisterende rom-/punkt-tilknytning uendret.
- **Referanse** — domenespesifikk verifisert indeks (samme mønster som
  `byggforsk_index.py`): en NS 8430/kontraktsbeskrivelse-indeks for
  overtakelse, en SHA-plan/Internkontroll-kategoriindeks for HMS, en
  KS-rutine/NS 3420-toleranseindeks for KS. Hver domeneindeks er en egen
  lisens-/kildevurdering (kontraktsdokumentet selv er kunde-eiet og
  krever ingen tredjepartslisens, i motsetning til Byggforsk/NS-tekst).
- **Observasjon** — gjenbruker `Evidence`-mønsteret uendret, inkludert
  `source_photo_index` for kildekobling.
- **Vurdering: samsvar/avvik** — erstatter akutt/gradvis-logikken, som er
  meningsløs utenfor skadedomenet.
- **Rotårsak** — nytt felt, påkrevd for HMS/KS per Arbeidstilsynets egen
  definisjon (årsak, ikke symptom).
- **Alvorlighet** — konfigurerbar taksonomi per domene (ikke hardkodet
  akutt/gradvis).
- **Tiltak + frist + ansvarlig** — nytt, strukturert (i dag kun fritekst
  i `repairs_description`).
- **Livssyklustilstand** — nytt: åpen → tiltak igangsatt → lukket →
  verifisert. Krever en gjenåpningsmekanisme appen i dag ikke har.
- **Godkjenningsmodell** — må generalisere fra ett stempel (takstperson)
  til **fler-parts signering** for overtakelse (byggherre + entreprenør)
  og **rollebasert lukking** for KS/HMS (annen person lukker enn den som
  melder). Dette rører selve godkjenningsport-invarianten i CLAUDE.md —
  prinsippet («ingen deling uten godkjenning, håndhevet i server») består,
  men «hvem kan godkjenne hva» må utvides.

## Konkurranselandskap per domene (bekreftet via research)

**Overtakelse:** NS 8430 med eBlanketter (Standard Norge selv — direkte
referansepunkt), Dalux Field Basic (BIM/tegning-basert punch list,
markedsført spesifikt mot closeout), Red-Flag App (avviks-«pins» på
tegninger, eksplisitt for overtakelser og 1-års/5-års-befaringer), Digital
Agreements/Visma Sign (digital signering av protokoll).

**HMS-avvik:** SmartDok (markedsleder, 81 000+ daglige brukere — har
**allerede AI-drevet RUH-analyse** som oppsummerer innsendte avvik),
Ditio (offline sjekklister, Sikker Jobb-Analyse med digital signatur),
HMS Nova, PlanRadar, EG HoltePortalen, MA Apps, Duett Prosjekt.

**KS-avvik:** SmartDok, Sikri Samsvar (generisk virksomhetsløsning —
HR/HMS/personvern/informasjonssikkerhet, **ikke** byggfagspesifikk),
Kvalitetskontroll AS (dedikert norsk KS-leverandør siden 2016), Bygglet,
PlanRadar.

**Den samlede differensieringstesen, bekreftet uavhengig i alle tre
researchpass:** *ingen* av de undersøkte verktøyene tilbyr video-/lyd-basert
automatisert strukturering — alle er manuell skjema-/sjekkliste-/
pin-på-tegning-registrering. SmartDoks RUH-AI oppsummerer tekst som
allerede er tastet inn; den erstatter ikke innsatsveien. DocrAIs
kjernemekanikk (snakk deg gjennom befaringen, AI strukturerer) er en reell,
uprøvd fordel i alle tre domener — **hvis** den valideres mot ekte behov.

**Et konkret funn som forsterker denne tesen:** Kvalitetskontroll AS
(KS-leverandør) sier rett ut at «de fleste avvik på en byggeplass blir
aldri skrevet ned» fordi melding oppleves tungvint/flaut/nytteløst i
øyeblikket. Dette er nøyaktig det samme underrapporterings-problemet
DocrAIs «tale-først»-mekanikk (A2 i `inkorporering.md`, allerede bygget)
løser for skaderapportering — samme UX-innsikt, ubrukt friksjonspunkt i et
tilstøtende marked.

## Sensitivitet — flagget, ikke utredet

HMS- og KS-avvik kan i noen tilfeller navngi en konkret person som
ansvarlig for en feil eller en hendelse (personopplysninger, i verste
fall helseopplysninger ved personskade — særlig kategori under GDPR
artikkel 9). Arbeidsmiljølovens varslingsvern (§§ 2-4/2-5) kan også være
relevant avhengig av hvordan et avvik meldes og av hvem. **Dette er
ikke juridisk utredet** — kun identifisert som et område som krever egen
vurdering (trolig med samme disiplin som databehandleravtale-arbeidet for
skadedomenet) før et HMS/KS-produkt kan bygges, uavhengig av teknisk
løsning.

## Vurdering mot nei-lista

Kartleggingen er nå fullstendig og presis nok til å handle raskt **den
dagen** en ekte pilotforespørsel kommer — men det finnes fortsatt ingen
slik forespørsel. CLAUDE.md: «Ny funksjon bygges først når ekte
pilotbrukere har sagt de ikke får verdi uten den.» Ingenting i denne
kartleggingen endrer det. De to tidligere signalene (Bymiljøetaten,
William/Sigurd-samtalen) er fortsatt uformelle.

## Hvis dette bygges — rekkefølge og avveining

Ikke en anbefaling om å starte, men et faktagrunnlag for *den dagen*
beslutningen tas:

- **Overtakelse/milepæl** er arkitektonisk nærmest dagens produkt: én
  befaring, én protokoll, fler-parts signering i stedet for ett stempel.
  Ingen lukkingssløyfe nødvendig for selve overtakelsesøyeblikket (kun for
  eventuelle noterte mangler). Sannsynlig raskeste vei til en MVP.
- **HMS-avvik** har det klareste, mest kvantifiserte markedsbeviset
  (underrapportering er dokumentert, tale-først-UX er en direkte
  friksjonsløser) og en markedsleder (SmartDok) som allerede beveger seg
  mot AI — men krever full livssyklus/lukkingssløyfe og har høyest
  sensitivitet (personskade, varslingsvern).
- **KS-avvik** har svakest bevist etterspørsel i researchen (generiske
  verktøy dominerer, ingen NS 3420-postkobling funnet i markedet) og
  krever samme livssyklus-arkitektur som HMS — sannsynlig lavest
  prioritet av de tre isolert sett, men kunne deles arkitektonisk med
  HMS-sporet hvis begge bygges.

Alle tre er reelt nytt produktarbeid — ikke konfigurasjon av
skaderapport-motoren — men de kan dele samme underliggende
«Funn»-livssyklusarkitektur hvis mer enn ett bygges.

## Sammenligning med tilstøtende praksis: internt Power Apps-verktøy («ark 49»)

Fredrik delte et internt dokument («ark 49» i et «tjenester-powerapps»-sett
for en eiendomsforvaltningsorganisasjon) som uavhengig løser en beslektet,
men ikke identisk, problemstilling: vernerunder, brannvernrunder og
overtakelses-/garantibefaringer for **intern** bruk (vaktmestere/
driftsledere), bygget på Power Apps + SharePoint Lists + Power Automate —
ikke som et eksternt produkt. Verdt å sammenligne fordi to helt uavhengige
tilnærminger lander på flere av de samme konklusjonene.

**Uavhengig bekreftede innsikter (samme konklusjon fra to retninger):**
- Samme kjernediagnose: «problemet er at resultatet ikke blir data» —
  matcher KS-forskningens funn om at avvik sjelden skrives ned.
- Samme «bilde koblet til punkt er selve gevinsten» — matcher
  `source_photo_index`-mønsteret DocrAI allerede har.
- Samme «én datamodell, flere maler» — matcher den anbefalte parallelle
  «Funn»-modellen per domene over.
- Samme prioritering: overtakelse er den strategisk viktigste
  underkategorien.
- Samme uløste spørsmål (ekstern parts tilgang): ark 49 løser det
  midlertidig med PDF-eksport til entreprenøren; DocrAIs eksisterende
  PIN-delingslenke er trolig en bedre løsning på nøyaktig samme problem.

**Der de peker i ulik retning:**
1. **Byggfilosofi.** Ark 49 er en manuell avkrysning-i-Power-Apps-løsning
   — samme kategori som SmartDok/Ditio/PlanRadar fra konkurranselandskapet
   over, ikke tale-/video-AI. Bekrefter at «bygg det selv i Power
   Platform» er et reelt tredje konkurransealternativ ved siden av kjøpte
   verktøy.
2. **Kostnadsbarriere.** SharePoint Lists er E3-dekket — marginalkost
   ~0 kr utover 15–40 timeverk. Dette er terskelen et betalt DocrAI-
   produkt må slå for den delen av markedet som allerede har M365 og bare
   trenger periodiske interne rutinesjekker — tøffere enn navngitte
   SaaS-konkurrenter fordi den ikke koster noe i lisens.
3. **Rundetype-skille.** Vernerunde/brannvernrunde er periodiske,
   kalenderstyrte rutinesjekker (egen «neste runde»-påminnelse) — en
   annen produktform enn DocrAIs ad hoc-hendelsesfangst under aktivt
   feltarbeid. Overtakelse er derimot hendelsesstyrt og passer DocrAIs
   arbeidsflyt direkte.
4. **Skarpere scope-grense (mangler i kartleggingen over — lagt til her):**
   ark 49 trekker en eksplisitt grense mot vedlikeholdssystemet (IFS):
   funn om planlagt vedlikehold hører der, ikke i befaringsverktøyet. Et
   fremtidig DocrAI-spor for overtakelse/KS/HMS er tilsvarende **ikke**
   en erstatning for et forvaltnings-/vedlikeholdssystem (IFS, Plania,
   Public 360 e.l.) — det dekker befaring/dokumentasjon, ikke
   driftsplanlegging.
5. **Rulleprosess-modenhet.** Ark 49s 5-stegs, tidsbudsjetterte,
   eier-navngitte plan (manuell pilot først; app bygges kun hvis
   Lists-skjemaet viser seg utilstrekkelig i felt) er en skarpere
   operasjonalisering av nei-lista-disiplinen enn «bygging venter på
   pilotforespørsel». Formen (navngitt eier, timeestimat, eksplisitt
   bygg-kun-hvis-gate) bør gjenbrukes den dagen DocrAI beveger seg mot
   denne vertikalen.

**Der DocrAI allerede har et forsprang:** offline-fangst er ark 49s
eksplisitt uløste risiko («må testes tidlig … faller kravet tungt, aksepter
'noter nå, registrer ved dekning'»). DocrAI har allerede løst nøyaktig
dette — offline-first synk og IndexedDB-persistens, pilotert og herdet
gjennom Sigurds test i august 2026.

**Konklusjon:** ikke motstridende dokumenter — komplementære. Ark 49 er
tungt på rulleprosess/organisasjon og lett på juridisk/standardgrunnlag;
denne kartleggingen er omvendt. Konklusjonen står uendret: fortsatt
kartlegg, ikke bygg — men rulleprosess-mønsteret gjenbrukes, og
IFS-grensen er nå eksplisitt en del av scope-avklaringen.

## Referanser

Alle fakta i denne kartleggingen er verifisert via live søk 27.08.2026 mot
Lovdata, Arbeidstilsynet, DiBK, Standard Norge og leverandørenes egne
produktsider. Nøkkelkilder: lovdata.no (Byggherreforskriften,
Internkontrollforskriften), arbeidstilsynet.no (SHA-plan, avvik, RUH,
Kompass-rapport 2025), dibk.no (SAK10 §10-1, uavhengig kontroll kap. 14),
standard.no (NS 3420, NS 8430), berngaard.no og cms.law (praktisk
entrepriserett/overtakelse), samt produktsider for SmartDok, Ditio, Sikri,
PlanRadar, Dalux og Red-Flag App. Se
`docs/signal-kontraktskontroll-offentlig.md` for opprinnelig signal og
Sigurds BIM/LiDAR-forslag.
