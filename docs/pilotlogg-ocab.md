# Pilotlogg — Ocab (Sigurd)

Løpende logg over pilotfunn, rotårsaker og hva de førte til. Nyeste øverst.

## 25. august 2026 (kveld) — transkripsjon nede: Gemini-nøkkel/kvote

Skjermbilder fra kveldstest viste «Transkripsjonen feilet», «Medier ikke
synkronisert» og én «Ugyldig tilgangskode». Diagnose mot produksjon:

- **Transkripsjon OG bildebeskrivelse feiler for alle** — begge svarer
  «Gemini error». Medieopplasting og prosjektsynk virker (verifisert
  direkte). Rotårsaken er altså Gemini-API-nøkkelen på serveren: mest
  sannsynlig **brukt opp dagskvote** (fri-nivå; passer med feil på kvelden
  etter en testdag), ellers utløpt/rotert nøkkel eller fakturering.
  Sjekk: Render → janitorai-backend → Logs → «Gemini /transcribe error»
  viser nå status og svarutdrag (429 = kvote, 400/403 = nøkkel). Tiltak:
  sjekk nøkkelen i Google AI Studio; vent på kvotenullstilling, aktiver
  fakturering, eller bytt GEMINI_API_KEY i Render (også ai-engine-tjenesten
  hvis den har egen nøkkel).
- **«Medier ikke synkronisert»** var en rest fra vinduet uten gyldig kode —
  opplasting verifisert OK i produksjon; chippen nullstilles ved neste synk.
- **«Ugyldig tilgangskode» (21:43)**: koden validerer fint i produksjon nå,
  og serveren svarer 503 (ikke 401) ved DB-feil — så dette var etter alt å
  dømme feiltastet/ufullstendig innliming eller en gammel kode på enheten.
  Riktig oppførsel; følg med på gjentakelse.
- Kodeendring: /transcribe og /describe-image logger nå Gemini-status +
  svarutdrag og sender statusen videre (502 med geminiStatus) — neste
  diagnose tar sekunder, ikke en kveldstest.
Disiplin: hvert funn får (1) rotårsak i kode/produkt, (2) fiks eller bevisst
utsettelse, (3) evt. roadmap-signal etter nei-lista-regelen (bygges først når
ekte brukere sier de ikke får verdi uten).

## 25. august 2026 — første skarpe sak (Midtgjerdinga)

Sigurd kjørte samme sak i DocrAI og som ordinær befaring (fysisk oppmøte,
vegg åpnet). Sammenligningen er gull: fasit finnes.

### Funn 1: Modellen adopterte eierens hypotese som årsak

DocrAI konkluderte «lekkasje fra rør i vegg tilknyttet utekran» (akutt).
Fasit fra åpnet vegg: **ingen lekkasje fra rørene** (trykksatt, åpen og
lukket posisjon, null drypp; bunnsvill tørr) — reell årsak var nedbør bak
ubeskyttet grunnmursplast med **kapillæroppsug i betongsåla** (gradvis,
prosjekteringsfeil), pluss kondens mot kalde vinduer for merkene under
vinduene. Modellen fulgte eierens teori («rør til utekran går i veggen»)
i stedet for å teste den.

Tiltak (ai-engine/prompt.py):
- Nytt CoT-steg **differensialdiagnose** — minst to alternative årsaker skal
  testes mot bevisene før konklusjon.
- **Hypotese ≠ konklusjon** — eier-/beboerantakelser omtales som rapportert
  antakelse og krever støttende observasjon.
- **Avkreftende funn er harde bevis** — trykktest uten drypp, tørre målinger
  og åpnet konstruksjon uten funn UTELUKKER årsaken.
- **Uverifisert kilde formuleres som mistenkt** med eksplisitt
  verifiseringsbehov, aldri som fastslått.
- Sjekklisten fikk kapillæroppsug fra såle/grunnmur og kondens som egne
  punkter.

Praksis for testerne: skriv negative funn som notat i saken («rør trykksatt,
ingen drypp», «bunnsvill måler tørt») — det er nøyaktig det modellen trenger
for å forkaste feil spor.

### Funn 2: Rå plassholder `{{damage.cause.picture}}` i ferdig rapport

Bevisbildet hentes kun fra videoframe; i foto-eneste saker sto plassholderen
igjen i dokumentet. Tiltak (ai-engine/main.py): uten video brukes fotoet
modellen selv peker ut som beste bevis (`source_photo_index` — kildekobling,
jf. analyse-ai-skribenter P1), med fallback til første foto og et
sikkerhetsnett som alltid fjerner plassholderen.

### Funn 3: «Bilder av stedet» sto tom / «ikke alle bildene inkludert»

Tiltak: alle inspektørfoto settes nå inn under «Bilder av stedet» i
opptaksrekkefølge med rom/bildetekst — testeren SER hvilke bilder som var
med i grunnlaget. (Bilder som ikke var ferdig synkronisert da rapporten ble
bestilt, kan fortsatt mangle — synkstatusen i appen viser gjenstående.)

### Funn 4: Tom prosjektliste etter ny innlogging («Lagret på enheten»)

Sigurd slettet PWA-en, logget inn med testerkode — lista var tom til han
tilfeldigvis trykket synk-chippen. Tre rotårsaker i appen:
1. Første pull kunne skje før koden var lagret (401 → myk «Lagret på
   enheten» uten retry).
2. 503 fra Render-kaldstart **låste** synken av for hele økten
   (`syncDisabled`-latch) — nå behandles 503 som forbigående.
3. Tokenvalidering tolket kaldstart/nettbrudd som «ugyldig kode» og
   **slettet gyldig kode fra enheten**. Nå skilles 'invalid' (401/403) fra
   'unreachable' — koden beholdes når serveren bare er utilgjengelig.
I tillegg trigges full synk umiddelbart etter vellykket innlogging.

### Spørsmål fra Sigurd: fuktmålerbilder i testene?

Svar: **ja i profesjonell-sporet** — takstpersonen/saneringstekniker ER
brukeren vår (jf. inkorporering.md), og målerverdier er nettopp de
bekreftende/avkreftende funnene modellen skal veie (Midtgjerdinga-fasiten
ble avgjort av fuktmåling). Vil vi også teste et privatperson-scenario, kjør
det som egen sak uten måleutstyr — det tester robusthet uten utstyr, ikke
samme arbeidsflyt.

### Roadmap-signal: planskisse via 3D-skanning (LiDAR)

Sigurd har testet 3D-skanning (telefon-LiDAR) mot lasermåler: avvik ~3 mm på
5 m — «funker veldig bra». Rapportmalen har egen planskisse-seksjon, så
behovet er reelt og brukerbekreftet. MEN: LiDAR/RoomPlan krever **nativ
iOS-app** — PWA-en (dagens distribusjon) har ikke tilgang. Lagt på roadmap
som kandidat for nativ-app-sporet; bygges ikke nå (nei-lista: dette er ett
brukersignal, og distribusjonskanalen mangler). Merk: dette er datafangst
til planskisse, ikke et eget tegneverktøy.

## Tidligere funn (14.–24. august, oppsummert)

- Kamera-app-foto avvist (8 MB-grense uten web-komprimering) → 20 MB +
  nedskalering >4 MB.
- Multivalg av bilder (saker har ~30) → expo-image-picker multi-select.
- «Synk nekter» → session-bundne blob:-URI-er → IndexedDB-persistens +
  'lost'-karantene + gjenoppretting.
- Synkstatus uten fremdrift → «Laster opp X av Y»-teller.
- Lagre-knapp for rapportfelter «glemmes 10/10 ganger» → autolagring
  (debounce 800 ms).
