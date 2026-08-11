# Erfaringer fra konkurrentene — krav til eksisterende løsning

Kilde: App Store-gjennomgang august 2026 av in4mo Task Reporter (Solera, 1,9★)
og Wenn Property (5,0★, 3 vurderinger). Anmeldelsene av in4mo kommer fra
takstpersoner som er bundet til appen gjennom forsikringsselskapene (If, Frende)
— altså akkurat brukerne DocrAI bygges for. Hvert punkt under er formulert som
en læresetning, med status i dagens løsning og hva som gjenstår.

## 1. Hastighet er en funksjon, ikke en optimalisering

**Observasjon:** «Tregeste appen som finnes» er gjennomgangstonen i
1-stjernes-anmeldelsene. Treghet i felt betyr at takstpersonen står i en fuktig
kjeller og venter.

**Prinsipp:** Ingen brukerhandling i feltløypa (foto, video, lydnotat, notat)
skal noen gang vente på nett. Nettverk skjer i bakgrunnen, alltid.

**Status:** Bygget. Offline-first-synk med lokal lagring først og
bakgrunnsopplasting (`projectSync.ts`), synkstatus vises uten å blokkere.

**Gjenstår:** Sett et målbart ytelsesbudsjett for feltløypa (f.eks. foto lagret
lokalt < 500 ms, skjermbytte < 200 ms) og mål det før hver lansering.

## 2. Stabilitet i felt er tillitsgrunnlaget

**Observasjon:** Krasj-klager går igjen. En krasj midt i en befaring kan bety
tapt dokumentasjon og en ny utrykning.

**Prinsipp:** Feltdata skal aldri kunne gå tapt — hver fangst persisteres lokalt
i det øyeblikket den skjer, før noe annet får kjøre.

**Status:** Delvis bygget. Lagring skjer umiddelbart lokalt; hjelpefunksjoner
som geo-oppslag er skrevet så de aldri kaster. Saksunderlag-oppslag feiler
stille uten å påvirke flyten.

**Gjenstår:** Krasjrapportering (f.eks. Sentry) med eksplisitt mål: null
datatap-krasj i feltløypa. Gjenopprettingstest: drep appen midt i opptak og
verifiser at alt fram til da er bevart.

## 3. Aldri be brukeren tegne — hent tegningen

**Observasjon:** Det mest hatede enkeltelementet i in4mo er «tegneprogrammet»
for planskisser («skulle tro det var en 2-åring som har utviklet dette»).

**Prinsipp:** DocrAI skal ikke bygge et bedre tegneverktøy. Behovet fjernes:
godkjente plantegninger hentes fra byggesaksarkivet, og takstpersonen pinner
rom og skader på en ferdig tegning.

**Status:** Strategien ligger i totalbildet (dokumentlaget: kommunalt
byggesaksarkiv / Ambita/Norkart per bestilling, Boligmappa som partnerskap).
Ikke implementert i appen ennå.

**Gjenstår:** Rom/fuktlogg-skjermen bygges med plantegning-som-underlag fra
start — pinning på tegning, aldri frihåndstegning som primærløype.

## 4. Varsler skal lande der handlingen skjer

**Observasjon:** in4mo-brukere har i over ti år fått chat-varsler som ikke
leder til meldingen («brukt appen i over 10 år og denne feilen har enda ikke
blitt rettet»).

**Prinsipp:** Ethvert varsel, enhver feilmelding og enhver «Prøv igjen»-knapp
skal ta brukeren direkte til stedet der handlingen fullføres — aldri bare til
forsiden.

**Status:** Bygget som mønster. «Prøv igjen» på prosjektkortet navigerer til
rapportfanen og utløser regenerering (`?retry=1`), ikke bare til skjermen.

**Gjenstår:** Håndhev mønsteret som sjekklistepunkt for alle fremtidige
varsler/toasts: hver toast med handling skal ha et dypmål.

## 5. Kjøper og bruker er splittet — det er kilen, ikke hindringen

**Observasjon:** Anmelderne («Takst2», «IF Partner», Frende-omtaler) bruker
in4mo fordi forsikringsselskapet krever det, ikke fordi de vil.

**Prinsipp:** DocrAI konkurrerer ikke med in4mo om å være skinnen mot
forsikringsselskapene — vi vinner takstpersonen på feltopplevelse og leverer
strukturert inn i den flyten forsikringsselskapet allerede krever.

**Status:** In4mo-eksport ligger i totalbildet som planlagt integrasjon.
Rapportgenereringen produserer allerede strukturert, forsikringsklart innhold.

**Gjenstår:** Definer eksportformatet mot in4mo (felter, medier, sjekklister)
og bygg eksporten som egen backlogpost.

## 6. Markedet ber eksplisitt om AI-laget

**Observasjon:** Wenn Property holder 5,0★, og anmeldelsen sier: «Ekstremt
tidsbesparende. Link den opp med en AI-agent, så sparer du mye tid.» Brukerne
ber om akkurat det DocrAI er.

**Prinsipp:** AI-dybden er differensieringen — årsaksvurdering
(akutt/gradvis), Byggforsk-forankring og forsikringsklar rapport, ikke bare
raskere dokumentasjon. Wenn er produktkonkurrenten å slå på dette; god
feltopplevelse er inngangsbilletten, ikke målet.

**Status:** Rapportmotoren med årsak/omfang er kjernen i dagens løsning.
Byggforsk-RAG og godkjenningsstempel ligger i planen.

**Gjenstår:** Byggforsk-RAG med siterbare referanser i rapporten, og
godkjenningsflyt der takstpersonen står faglig ansvarlig for AI-utkastet.

## 7. Feltfeil rettes først — alltid

**Observasjon:** At en kjent feil kan stå urettet i ti år viser hva som skjer
når feltappen er en bigeskjeft for leverandøren. Det er in4mos strukturelle
svakhet — og den blir DocrAIs hvis vi arver holdningen.

**Prinsipp:** Feil som rammer feltløypa (fangst, lagring, synk, rapport)
prioriteres foran all funksjonsutvikling. Ingen kjent feltfeil skal overleve
mer enn én utviklingssyklus.

**Status:** Praktisert i denne fasen (feillisten fra gjennomgangen ble rettet
før nye funksjoner). Må formaliseres når flere bidrar.

## Ny konkurrent oppdaget august 2026: Befar (befar.io)

Norsk befaringsapp for takstmenn, bygget «av fagfolk som selv står ute på
befaring» (utviklet med byrået Hellevang & Co). Viktig presisering: Befar er
et **bolighandel-verktøy** — tilstandsrapporter etter NS 3600:2025 og
forskrift til avhendingslova — ikke et skadeverktøy. De er Norges svar på
Spectora. Ingen video/lyd-fangst, ingen beviskjede, ingen saksunderlag fra
offentlige kilder; motoren er et regelstyrt faglig rammeverk. (Merk:
markedsføringen nevner ikke AI, men brukeravtalen deres krever verifisering
av «AI-genererte forslag» — et AI-lag er på vei. Forretningsmodell: 500 kr
per rapport + 2 000 kr/år NS 3600-lisens — se `ns3600-og-befar-ui.md`.)

**Validering (deres pitch speiler våre veddemål):**
- «Rapporten bygges opp mens du jobber» ↔ vårt AI-utkast fra fangsten.
- Adaptiv struktur («alt du ikke trenger, forsvinner») ↔ romløypa vår.
- «Det er alltid takstmannens vurderinger som gjelder» ↔ godkjenningsflyten.
- Standard-forankring (NS 3600) ↔ Byggforsk-forankringen vår.
Markedet konvergerer mot de samme sannhetene — veddemålene våre er riktige,
og de haster mer.

**Forskjellen som beskytter oss:** Befar selger *uavhengighet fra
forsikringsselskaper* som verdi — riktig i bolighandel, der habilitet er
poenget. Vårt marked er det motsatte: skadesaker der oppgjøret SKJER i
forsikringsflyten, og årsak/akutt-gradvis, beviskjede og in4mo-leveranse er
kjernen. Segmentene er naboer med samme bruker, ikke samme jobb.

**Trusler å ta på alvor:**
1. Samme brukerrelasjon — de kan ekspandere fra tilstand til skade senere.
2. Samme oppmerksomhetskanaler (Norsk takst-miljøet): kampanjebudskapet vårt
   må alltid si «skadesak/forsikring» eksplisitt, så vi ikke høres ut som
   «enda en befaringsapp».
3. Fagfolk-bygget gir dem domenetroverdighet — vår motsvarighet er faglig
   råd + ride-alongs (kapabilitet 1 i faseplanen), ikke markedsføringsspråk.

**Å lære av dem (inn i løsningen):**
- «Arbeid direkte i den ferdige rapportvisningen» — ingen eksport-hopping,
  ingen separate skrivevinduer. Dette er riktig UX for A5: når rapporten
  flyttes til Postgres, bygges redigeringen i ferdig rapportvisning med
  felt-diff — ikke som skjema.
- Deres uavhengighets-posisjonering tvinger frem vår: «uavhengig av
  forsikringsselskapene — men leverer rett inn i flyten deres.»

## Oppsummert kobling til backlog

| Erfaring | Dekkes av | Nytt/utestående |
|---|---|---|
| 1 Hastighet | B14/B15 offline-synk (bygget) | Ytelsesbudsjett + måling |
| 2 Stabilitet | Lokal-først-lagring (bygget) | Krasjrapportering, gjenopprettingstest |
| 3 Ikke tegn — hent | Dokumentlaget i totalbildet | Rom/fuktlogg på plantegning |
| 4 Varsler med dypmål | `?retry=1`-mønsteret (bygget) | Sjekklistepunkt for alle varsler |
| 5 Kjøper ≠ bruker | Totalbildet (In4mo-eksport) | Eksportformat + implementasjon |
| 6 AI-laget | Rapportmotoren (bygget) | Byggforsk-RAG, godkjenningsstempel |
| 7 Feltfeil først | Praktisert | Formaliseres som arbeidsregel |
