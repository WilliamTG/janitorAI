# Taleteknologi — lærdommer for DocrAI

Kilde: fagdag i talegjenkjenning 23.09.2026 (professor emeritus Torbjørn
Svendsen, NTNU-miljøet) og politiets erfaringer fra transkripsjonspiloten
med Skriber. Håndnotater fra Fredrik; lysbilder fotografert. Usikre lesninger
er merket `[?]`. Speilet mot DocrAI slik `ddia-laerdommer.md` og
`time100-ai-laerdommer.md` gjør.

## Det viktigste i én setning

Transkripsjonen vår kjører på en generisk modell som er trent på svært lite
norsk, feilene i slike modeller konsentrerer seg i **fagord**, og ingen har
målt hvor god den faktisk er på det takstfolk sier i en kjeller. Nå finnes
verktøyet: `ai-engine/wer_benchmark.py`.

## Fem lærdommer

1. **Norsk er annenrangs i generiske modeller.** Whisper er trent på 266
   timer norsk av 680 000+ timer totalt. Nasjonalbiblioteket har 66 000+ timer
   norsk og publiserer egne NB-Whisper-modeller. Kursets egne tall: engelsk
   ~4 % WER, norsk ~9,5 %; vanlige ord ~5 %, fagord ~7 %. *En femåring har
   hørt ca. 14 600 timer tale — 55 ganger mer norsk enn Whisper.*
2. **Ikke finjuster.** En domenemodell krever 1 000–5 000 timer transkribert
   tale. Vi har det ikke, og vi har ikke rettsgrunnlag for å trene på kundenes
   skadesaker — politiet har det heller ikke («den dagen politiet har hjemler
   til å trene med politidata …»). Velg beste grunnmodell, styr med prompt og
   ordliste, flagg med konfidens.
3. **Politiets beviskjede er vår, ti år eldre.** Krav siden 2013 om at lyd
   kan etterspores; originallydfila ligger alltid der; *human in command*;
   tidsstempel lastes ned med teksten (SRT). Det er godkjenningsporten og
   hash-i-fangstøyeblikket. Bruk setningen mot forsikring: «samme prinsipp
   som politiet har hatt krav om siden 2013.» Det vi mangler: **tidsstempler**
   — klikk på setningen, hør sekundet. Whisper-familien gir det; Gemini gjør
   ikke.
4. **Konfidenskontroll er mekanismen bak «bør kontrolleres».**
   `byggepraksis-2026.md` vedtok flagget; fagdagen ga mekanismen: et ord
   utenfor vokabularet gir *feil gjenkjenning uten konfidens* og *«vennligst
   gjenta» med*. Prompten med ~60 fagtermer er et «reserveleksikon» — riktig
   grep, men det svakeste av tre uten konfidens bak.
5. **Feltlyden vår er verste tilfelle på hver akse** kurset lister: dialekt,
   naturlig (ikke opplest) tale, romklang, telefonmikrofon, nøling. Derfor:
   **test aldri på ren lyd.**

Politiets konklusjon, med to utropstegn på lysbildet: *«Menneskelig
kvalitetssikring er fortsatt avgjørende!!»*

## Politiets feilliste som testplan

Fra piloten med Skriber. Hver feiltype har en feltvariant, og hver skal ha
minst ett klipp i referansesettet.

| Politiet fant | Feltvariant hos oss |
|---|---|
| Norske egennavn gjenkjennes feil | Adresser, produktnavn (Mapei, Litex, Sika), huseiers navn |
| «Ja» blir «Ja. Ja.» | Måleverdier dobles: «fukt 18 … 18» |
| Hull i teksten ved rask tale | Takstperson i flyt |
| **Stillhet gir hallusinert «tulle-tekst»** | Gange mellom rom, måling, leting — feltopptak er fulle av stillhet. **Farligst:** oppdiktet tekst rett inn i en skaderapport |
| «skjønner» → «funny», «bistandsadvokat» → «business-advokat» | «svill», «sluk», «klemring» — fagtermene er nøyaktig denne feilklassen |
| «vitne» → «vittne» (nesten-homofoner) | «råte»/«rote», «membran»/«membrane», «gulv»/«golv» |
| Flere språk i samme opptak | Polske håndverkere på stedet, engelske produktnavn |

## Referansesettet

- **20–30 klipp** fra piloten, med samtykke fra Ocab (Anders). Ekte feltlyd.
- **Fasit skrives av fagperson** (Sigurd). Om det heter «klemring» eller
  «klemmering» avgjør hele fagterm-tallet. Regler i skriptets docstring.
- Minst ett klipp per feiltype over; **ett rent stillhetsklipp** (30 s
  fottrinn og måling, tom fasit).
- `fagtermer.txt` seedes fra prompten; Ocabs egne produktnavn legges til.

## Verktøyet

```
python3 ai-engine/wer_benchmark.py --selftest          # regnestykket
python3 ai-engine/wer_benchmark.py --init ai-engine/wer # mapper + eksempler
DOCRAI_API_URL=… TESTER_TOKEN=… \
  python3 ai-engine/wer_benchmark.py ai-engine/wer/manifest.json --engine docrai
python3 ai-engine/wer_benchmark.py ai-engine/wer/manifest.json --engine nb-whisper
python3 ai-engine/wer_benchmark.py ai-engine/wer/manifest.json --engine file --label azure
```

`docrai` kaller det kjørende API-ets `/transcribe` — samme prompt, modell og
etterbehandling som appen. Vi måler produktet, ikke en kopi. `file` leser
hypoteser fra `hyp/<label>/<id>.txt`, så enhver leverandør (Azure, Dictus,
Speechmatics …) kan sammenlignes uten kode. Rapporten viser WER, fagterm-
gjenfinning, hallusinerte ord på stillhet, tapte fagtermer og de vanligste
forvekslingene (fasit → hypotese) — direkte sammenlignbart med politiets liste.

**Beslutningsregel, skrevet før tallet finnes:** likt resultat → behold
Gemini, spar kompleksitet. NB-Whisper klart bedre på fagord → modellbytte
etter `modellbytte-runbook.md`, med tidsstempler og konfidens på kjøpet.

## Endringer i pipelinen (samme commit)

- **Vakt mot tom analyse** (`ai-engine/main.py`): `gemini_response.parsed`
  kan være `None`; før krasjet flettingen på `analysis.area` etter at
  dokumentkopien var laget og analysen fakturert. Nå stoppes kjøringen før
  kopien, med statisk melding og `token_usage` bevart (bokføres som
  `report_failed`).
- **Sitatportens telling**: `citation_stats {proposed, verified, rejected}`
  returneres fra motoren og lagres per kjøring i `report_generations`
  sammen med `prompt_version`. Forkastes 80 % av Byggforsk-referansene, er
  «Byggforsk-henvisninger» i salgsflaten en påstand uten dekning — samme
  feilklasse som slettepåstanden i personvernteksten, bare flyttet til
  produktet. Nå kan det leses ut med én SQL.

## Landskapet (lysbilde 64)

Komplette systemer i helse — Journalia, Medbric, Stenoly — er «DocrAI for
leger»: domenetranskripsjon → strukturert dokument → fagperson godkjenner.
Mønsteret er bevist i én sektor. Plattformer: Deepgram, Speechmatics, Google,
Microsoft (Azure — politiet), Amazon, ElevenLabs, Omilon, Amberscript. Lokalt:
Whisper, self-hosted-varianter. Vi står på «plattform» via Googles forbruker-
endepunkt; lista over EU-alternativer er der den dagen en forsikringskunde spør.

Dictus (dansk): Stortinget og politiet. Leverandørtall fra foredraget, ikke
verifisert: 1 time opptak = 3–4 timer manuelt; krimteknisk 55 % av tiden på
rapport; 150 000 avhør i året; 50–80 % tidsbesparing.

## Åpne oppgaver

| Oppgave | Eier | Status |
|---|---|---|
| Samtykke fra Ocab til feltopptak i referansesett | Anders | åpen |
| 20–30 klipp + fasit, med politiets feiltyper dekket | Sigurd (fasit), Fredrik (utvalg) | åpen |
| Kjøre benchmark docrai vs nb-whisper, beslutte etter regelen over | Fredrik | venter på klipp |
| SQL-uttrekk av sitatport-telling per `prompt_version` etter pilot | William | etter 30.11 |
| Konfidensflagg («bør kontrolleres») — kun hvis modellvalget gir konfidens | — | betinget |
| Ordliste per foretak inn i prompten | — | når pilot nr. 2 ber om det |

## Usikre lesninger fra notatene

`[?] «82 % … large-v3»`, `[?] «Hyde's lov»`, `[?] «Figur-Schultz 2007,
speaker characteristics»` (trolig en oversiktsartikkel om talevariasjon),
`[?] «PU — 1 overlevert + 1 akseptert»`. Rettet: notatene skrev
WER = (S+D+I)/feil; nevneren er **N, antall ord i fasit**.
