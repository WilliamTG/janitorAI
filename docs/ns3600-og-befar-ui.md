# Befar-appens UI-håndverk + NS 3600:2025 — analyse

Skrevet august 2026, basert på skjermbilder av Befar-appen (Gulv og
fallforhold / romvelger / Overflater), full gjennomgang av befar.io
(hjelp, prøv gratis, brukeravtale, databehandleravtale) og research på
NS 3600:2025.

## 0. Befars prosess og forretningsmodell (fra sidene deres)

**Prosessen:** be om testkonto (5 dager gratis; testrapporter kan ikke
brukes kommersielt) → søknad og **selskapsgodkjenning** for full tilgang →
befaring rom for rom med forhåndsdefinerte valg («det meste av
rapportarbeidet er allerede gjort» underveis) → kvalitetskontroll og mindre
justeringer → levering. Planlagte integrasjoner: CRM- og meglersystemer.

**Forretningsmodellen (fra brukeravtalen):**
- **500 kr eks. mva. per opprettet rapport** — ren stykkpris, fakturert
  etterskuddsvis per måned. Ingen bindingstid.
- **NS 3600-lisens: 2 000 kr eks. mva. per år** — standardlisensen selges
  som egen linje. Elegant løsning på standardlisens-problemet: kunden
  betaler lisensen eksplisitt i stedet for at den bakes inn.
- Ansvar: «BEFAR foretar ingen faglige vurderinger» — kunden/brukeren står
  fullt faglig ansvarlig, og **brukeravtalen nevner eksplisitt at
  AI-genererte forslag må verifiseres** — de har altså et AI-lag på vei,
  selv om markedsføringen ikke nevner det.
- Ansvarsbegrensning 25 000 kr per hendelse / 50 000 kr per år; 99,5 %
  oppetidsmål; data i EU/EØS; 90 dagers utleveringsfrist etter avslutning.
  Verneting Søndre Østfold (de er Sarpsborg-baserte).

**Hva dette betyr for oss:**
1. **Prisbenchmark:** 500 kr/rapport er markedsvalidert stykkpris i Norge.
   For en takstperson med 10 rapporter/mnd er det 5 000 kr/mnd — vår
   tenkte 990 kr/mnd flat er aggressivt billig ved volum. Vurder hybrid:
   stykkpris som lavterskel inngang (jf. kampanjeplanen §prising), flat
   pris som volumfordel.
2. **Standardlisens-modellen er kopierbar:** SINTEF/Byggforsk-lisensen kan
   selges som egen årlig linje à la Befars NS 3600-lisens — transparent,
   og flytter lisenskostnaden dit den hører hjemme.
3. **Gated onboarding** (søknad + godkjenning) signaliserer faglig
   seriøsitet og kvalitetskontroll — samme grep som vår pilotmodell med
   tak på 8 deltakere.
4. **Ansvarsspråket deres bekrefter vårt:** «ingen faglige vurderinger» +
   verifiseringsplikt for AI-forslag er nøyaktig samme ansvarsmodell som
   godkjenningsflyten vår håndhever — men vi håndhever den i produktet
   (delingsport), ikke bare i avtaleteksten.

## 1. Hva Befar-skjermene faktisk viser (og hvorfor det er smart)

**a) Regelverket i felt, med illustrasjon.** «Gulv og fallforhold»-skjermen
viser selve kravet der vurderingen gjøres: illustrert falloppbygging med
«fall min. 1:100 på hele hovedgulvet», «15 mm oppkant ved dør», «1:50 i
dusjsonen», «høydeforskjell topp sluk til topp membran alltid minst 25 mm».
Takstpersonen slipper å huske standarden — appen bærer den, punkt for punkt.
Dette er det sterkeste enkeltgrepet deres.

**b) Rom-taksonomi som styrer alt.** Romvelgeren har forhåndsdefinerte
rom-chips (Gang, Stue, Bad, Vaskerom, Kjøkken …) pluss tekniske kategorier
som IKKE er rom: «Rom under terreng», «Etasjeskille», «Loft/Takkonstruksjon»,
«Tekniske installasjoner», «Utvendig». Taksonomien speiler standardens
kontrollpunkter — og «Rom under terreng» er nøyaktig kategorien der
vannskader bor.

**c) Strukturerte valg over fritekst.** Overflater velges som chips per
bygningsdel (vegger/himling/gulv: slettmalt, malt trepanel, mur, parkett …)
med tilstandsgrad i nedtrekk og fritekst kun for avvik. Strukturert data
inn = konsistente rapporter ut.

**d) Huskeliste per punkt.** «Gulv: planhet, knirk, skjevheter, slitasje,
fuktindikasjoner» — sjekklisten ligger i synsfeltet mens man vurderer.

**e) Konsistent handlingslinje.** Hvert punkt har samme bunnlinje: Tilbake ·
Notat · Kamera · Tiltak · Nullstill · **Fullfør punkt** — og befaringen
avsluttes med «Fullfør befaring». Kompletthet er en førsteklasses handling.

## 2. NS 3600:2025 — det som betyr noe for oss

- **Årsak, konsekvens og anbefalt tiltak er nå PÅKREVD for alle TG2- og
  TG3-avvik.** Standarden flytter tilstandsrapporten fra beskrivelse mot
  årsaksanalyse — nøyaktig strukturen DocrAI-motoren produserer for
  skadesaker (årsak → konsekvens → tiltak).
- HMS-farlige forhold skal rapporteres samlet; nye krav til hvordan tiltak
  vurderes og beskrives.
- **Tilstandsgrad skal settes på dokumentasjon for våtrom**, og
  aldersvurdering tillates for utvalgte bygningsdeler (TG basert på alder).
- Nye krav til kompetanse og uavhengighet, og til sammenstilling av
  dokumentasjonen som legges frem.
- Grensen TG1/TG2 er nyansert; bærekraftsvurderinger er tatt inn i
  TG-kriteriene.
- **Overgang:** frem til 1. juli 2026 kan 2018- eller 2025-utgaven brukes;
  deretter kun NS 3600:2025 (forskrift til avhendingslova ligger bak).

## 3. Konsekvenser for DocrAI

1. **«Regelverket i felt» blir inkorporeringsmønster #5 fra Befar:** vår
   versjon er Byggforsk-kravet vist ved fangstpunktet — står du i «Kjeller
   bad» ved sluk, viser appen membran/klemring-kravet fra 727.121 med
   illustrasjon, før du dokumenterer. RAG-en blir feltveiledning, ikke bare
   rapportsitater. (Krever samme SINTEF-avklaring som sitatene.)
2. **Rom-taksonomien i romløypa (A1) utvides** med Befars tekniske
   kategorier: «Rom under terreng», «Etasjeskille», «Loft/takkonstruksjon»,
   «Utvendig» — vannskadenes faktiske geografi, og samme språk som
   standarden bruker.
3. **Strukturerte valg der det er mulig:** skadetype, berørte bygningsdeler
   og materialer som chips — fritekst er unntaket. Gir konsistent data til
   både rapport og evalsett.
4. **Årsak/konsekvens/tiltak-strukturen er nå standardspråk.** Vårt
   rapportformat for skade (årsak → klassifisering → tiltak) er samme
   struktur NS 3600:2025 krever for TG2/TG3 — det gjør (a) skaderapportene
   gjenkjennelige for alle som leser tilstandsrapporter, og (b) vekstflaten
   C4 (NS 3600-rapporttype) til en naturlig utvidelse av motoren vi uansett
   bygger: Befar har strukturen, vi har årsaksmotoren som 2025-utgaven
   faktisk etterspør.

## 4. Wenn Property — samme dybdebehandling (aug 2026)

Full gjennomgang av wennproperty.no. Wenn er befaringsappen for
**håndverkere** (tilbudsfasen): LiDAR-skann av rom på ~5 min → 3D-modell med
mengdedata, AI-assistent som gjør talenotater til strukturert
arbeidsbeskrivelse **per rom og fag** (matrise: rader = rom, kolonner = fag),
deling via sikker lenke med PIN, PDF/IFC-eksport. Løfte: «spar 30 %+ av
prosjekttiden». 50+ kundelogoer, distribusjonsavtale med MesterAlliansen.

**Prising (transparent på siden, ingen binding):** Basis 350 kr/mnd ·
Max 999 kr/mnd (LiDAR + mengdeberegning) · Enterprise i dialog.

**Hva dette validerer hos oss:**
- Tale-først + romstruktur er nøyaktig Wenns vinnermønster — vi bygger rett.
- Automatisk dokumentasjon fra adresseoppslag (plantegning/tak/fasademål) —
  de gjør allerede saksunderlag-trikset i sitt segment.
- PIN-beskyttet lenkedeling uten mottakerkonto — paritet med vår delingsflyt.
- **999 kr/mnd er markedsprisen** for feltverktøy-toppnivået i Norge — vår
  tenkte 990 ligger på øret riktig.

**Hva vi tar fra dem:**
1. **Salgsflate med transparent prising og prøv-selv.** Både Wenn og Befar
   har landingsside med prisnivåer, kvantifisert løfte og gratis prøving —
   vi har bare demoen. Bygges som /om-side koblet til /demo.
2. **Matrise-tenkningen:** deres rom × fag er vår rom × skadetype/bygningsdel
   — strukturen AI-utkastet organiseres etter (styrker A1/A5).
3. **Kvantifisert løfte på forsiden:** «2 timer rapportskriving → 15
   minutter godkjenning» (og tidsmetrikken vår beviser det per sak).
4. **Alliansedistribusjon:** MesterAlliansen-avtalen deres er malen for vårt
   Norsk takst-spor — én avtale gir mange medlemmer.
5. **Kjøp-ikke-bygg bekreftet:** LiDAR/mengder er Wenns kjerne, ikke vår —
   ved behov lisensieres det (nei-lista står).

Kilder: standard.no (NS 3600:2025-lansering), DiBK-nyhet om ny utgave,
Byggkeramikkforeningen om 2025-endringene, takstmann.net om overgangen,
wennproperty.no (produkt, prising, blogg om arbeidsbeskrivelse fra befaring),
VVS Aktuelt om MesterAlliansen-avtalen.
