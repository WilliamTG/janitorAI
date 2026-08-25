# Byggforsk-integrasjon — lisensfri fase

August 2026. Bakgrunn: Byggforvaltning 700.305 («Tilstandsanalyse av bygninger
og bygningsdeler») ble vurdert som datagrunnlag for modellen. Innholdsmessig er
det riktig — metodikken (NS 3424: TG/KG, referansenivå, årsak → konsekvens →
tiltak) og tabell 55 a/b (hvilke datablad som dekker hvilke bygningsdeler) er
nøyaktig det motoren trenger. Men databladene er SINTEF-lisensiert per bruker
(«Ettertrykk forbudt»), så **fulltekst kan ikke mates inn i produktet uten
avtale**. Beslutning: kjør lisensfri fase nå; SINTEF-kontakt er bevisst utsatt.

## Lisensgrensen vi opererer innenfor

- **Ingen SINTEF-tekst** gjengis i kode, prompt, kunnskapsbase eller rapport.
  (`ai-engine/knowlegde/` er gitignorert og skal forbli tom for lisensiert
  materiale.)
- **Nummer og titler er faktaopplysninger** fra seriens offentlige katalog —
  de kan brukes som metadata. Emneord/rutingshint i indeksen er våre egne.
- **Takstpersonens eget Byggforsk-abonnement** er lesekilden: rapporten siterer
  verifiserte datablad-numre, oppslaget skjer i abonnentens egen tilgang.

## Hva som er bygget (ai-engine)

1. **`byggforsk_index.py`** — verifisert metadata-indeks: 33 datablad
   (nummer + tittel + egne emneord), avgrenset til referanser kryssjekket mot
   700.305 tabell 55 a/b. Utvides kun med numre/titler verifisert mot
   katalogen.
2. **Sitatport i `main.py`:** alt modellen siterer valideres mot indeksen;
   uverifiserte referanser forkastes (logges) i stedet for å nå rapporten.
   Punkt-/avsnittsnumre strippes bevisst — de kan ikke verifiseres uten
   fulltekst. Dette gjør løftet «Byggforsk-henvisninger vises kun med
   verifisert punktnummer» håndhevet, ikke bare lovet.
3. **Promptdisiplin:** modellen får kun den godkjente listen å sitere fra
   («siter ALDRI numre utenfor listen»), og oppdraget er strukturert etter
   NS 3424-rammen (avvik fra referansenivå, årsak → konsekvens → tiltak).
   Samtidig ryddet: den gamle prompten refererte «700.115» (finnes ikke i det
   verifiserte registeret — 720.115 er trevirke-databladet) og bar
   `[cite: N]`-artefakter fra et tidligere utkast.

## Veien videre (når SINTEF-kontakt gjenopptas)

- **Alternativ A — digital bruksrett:** lisens for fulltekst-RAG med
  siterbare utdrag. Befar-modellen (standardlisens som egen prislinje) er
  malen for prisingen.
- **Alternativ B — dyplenking:** rapport-referansene lenker til byggforsk.no,
  der takstpersonens abonnement åpner artikkelen. Krever ingen avtale, kan
  bygges når som helst.
- **Alternativ C — FoU-partnerskap:** presedens finnes (SINTEF deltar i Wenns
  CliVa-prosjekt) — som også er konkurransegrunnen til at avklaringen ikke
  bør hvile for lenge.
- «Regelverket i felt»-mønsteret (Befar-inspirasjonen: kravet vist ved
  fangstpunktet) krever fulltekst-avtale og ligger bak A/C.
