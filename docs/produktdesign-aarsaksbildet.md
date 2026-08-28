# Produktdesign: «Årsaksbildet» — årsaksanalyse for vannskader

28. august 2026. Produktplattform-design for hvordan ekspertens
fagkunnskap (`docs/fagkunnskap-vannskadeaarsaker.md`) og det kommende
spørretreet blir produktflater i DocrAI.

**Designkanvas (UI/UX-mockups, deles med teamet):**
https://claude.ai/code/artifact/b5c57291-8998-4b65-bc96-6bee6a5cf96f

**Evidensstatus:** Dette er et ekte pilotsignal — fageksperten lager selv
et spørretre for årsaksanalyse og har levert kunnskapsgrunnlaget uoppfordret.
Nei-lista-disiplinen er dermed oppfylt for retningen; byggerekkefølgen
under holder den oppfylt per steg.

## Konseptet

**Årsaksbildet** er en løpende differensialdiagnose over de fem kildene
(nedbør, trykksatte rør, avløpsrør, kondens, utett bad) som bygges mens
takstpersonen dokumenterer — og kontrolleres før rapporten godkjennes.
AI foreslår med evidens; takstpersonen avgjør. Årsaken låses først ved
godkjenningsstempelet (samme port som i dag).

## De fire produktflatene (se kanvasen)

1. **Befaring — «Neste blikk»** (mobil): Årsaksbildet lytter med på
   notater/foto og viser maks tre stille forslag til neste observasjon,
   kun når to hypoteser faktisk står mot hverandre. Avvisbart, aldri
   blokkerende.
2. **Befaring — Årsaksveiviser** (mobil): Spørretreet som frivillig
   bunnark man åpner ved tvil. Store svarvalg («vet ikke ennå» alltid
   ett av dem), hvert svar forklarer hva det skiller. Svar lagres som
   observasjoner — de mater årsaksbildet, låser aldri konklusjon.
3. **«Før du drar»** (mobil): Dokumentasjonssjekk før befaringen
   avsluttes — hva mangler for å skille topphypotesene. Returbesøk er
   den dyreste feilen; dette er spørretreets største feltverdi.
4. **Kontroll — Årsaksbildet** (desktop): Rangerte hypoteser med
   evidenskjeder (transkripsjonssitater, foto, målinger), «taler imot»,
   utelukkede kilder med begrunnelse, akutt/gradvis-vurdering og
   Byggforsk-henvisning. Handlinger: bekreft / velg annen / usikker.

## Designprinsippene

1. **Aldri blokker fagfolk.** Ekspertens autopilot er kompetanse.
   Veiviseren åpnes ved tvil — aldri en tvungen port.
2. **Evidens foran fasit.** Hver hypotese peker på observasjoner som
   støtter og svekker den. AI velger aldri årsak; «usikker» er et
   fullverdig utfall (falsk sikkerhet er farligere enn usikkerhet).
3. **Fang hullene på stedet.** Vit hvilket bilde som mangler mens du
   fortsatt står i rommet.

## Stille signaler appen allerede har

Byggeår (saksunderlag/Kartverket → støpejern før 1970, dampsperre før
1979), befaringsdato/sesong (kondens er vinterfenomen), romnavn per notat
(våtsone vs. kjeller), værdata. Inn i vurderingen uten ekstra tastetrykk.

## Byggerekkefølge (minste verdifulle steg, validert med eksperten per steg)

| Steg | Hva | Forutsetning |
|---|---|---|
| a | Kunnskapsgrunnlag v1 inn i rapportmotoren som versjonert kunnskap (PROMPT_VERSION-bump) + måling mot valideringscasene | Ingen — kan starte nå |
| b | Årsaksbildet i kontrollflaten (hypoteser med evidens i DamageAnalysis) | a validert |
| c | «Før du drar»-sjekken (manglende-evidens-listen) | b i bruk hos pilot |
| d | Årsaksveiviseren i appen | Spørretreet levert (v2) |

Ikke bygg b–d før forrige steg er validert med eksperten. Terskelen for
når «Neste blikk» sier noe settes sammen med ham — det er hans autopilot
vi utfyller.

## Åpne spørsmål (til eksperten/teamet)

- Hva er en falsk positiv her, konkret? (PMF-regelen: definér før første
  ekte bruk.)
- Hvor mange «Neste blikk»-forslag tåler en befaring før det blir støy?
- Skal akutt/gradvis og membran/rørdel ha egne dokumentasjonskrav i
  «Før du drar» alltid, eller bare når de er avgjørende for dekning?
- Hvordan skal 2 %-tilfellene (utenfor de fem kildene) se ut i rapporten?
