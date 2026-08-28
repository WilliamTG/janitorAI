# Fagkunnskap: årsaker til vannskader (kunnskapsgrunnlag v1)

28. august 2026. Levert av fageksperten i pilotpartnerskapet (Ocab) som
grunnlag for årsaksanalyse i DocrAI — «2 sider med meget gjennomkokt info
om 98 % av årsakene til vannskader». Et spørretre fra samme ekspert er
under arbeid og blir kunnskapsgrunnlag v2.

**Status:** Ikke ennå integrert i rapportmotoren. Integrasjonen skal skje
som versjonert kunnskap (samme mønster som `PROMPT_VERSION`) og måles mot
valideringscasene før den brukes i ekte rapporter. Se
`docs/produktdesign-aarsaksbildet.md` for produktflatene som bygger på
dette.

**Opphav:** Egenprodusert fagtekst skrevet av eksperten for bruk i
produktet — kan fritt brukes i repo, prompt og kunnskapsbase (i motsetning
til Byggforsk-blad og NS-standarder, som forblir metadata-only).

## Modellens ryggrad: fem kilder, tre skillesignaler

Enhver vannskade har (i ~98 % av tilfellene) én av fem kilder. Kildene
skilles på tre signaler som kan leses ut av vanlig befaringsdokumentasjon:

| Kilde | Hvor viser den seg | Når opptrer den | Nøkkelspor |
|---|---|---|---|
| 1. Nedbør | Klimaskjermen: himling/yttervegg øverste etasje og loft, rundt vinduer/dører, balkong, under terreng | Ved regn/snøsmelting; kjeller ved store nedbørsmengder | Drypp i materialskjøter, svelling, malingslipp/utposing i gips; saltutslag under terreng |
| 2. Trykksatte rør | Innvendige etasjeskillere og delevegger — nesten aldri yttervegg | **Konstant**, uavhengig av bruk | Jevnt utviklende lekkasjepunkt; mugg raskere ved varmtvann |
| 3. Avløpsrør | Langs avløpsstrekk; sluk/vask (blokkasje); kjeller (tilbakeslag) | **Ved bruk** av sanitærutstyr — diffust, «tilfeldig» | Bruksavhengighet er selve indikasjonen |
| 4. Kondens | Kalde flater: vindu, kuldebro, kaldt loft/krypkjeller, uisolerte rør, skjult i vegg | Vinterhalvåret (nesten aldri sommer; unntak rom under bakken) | Fukt uten lekkasjepunkt; drives av fuktproduksjon + svak ventilasjon |
| 5. Utett bad | Dusjsonen — der vannbelastningen på membranen er høyest | Ved bruk av badet, gradvis | Avgrenset oppfukting rundt våtsonen, sjelden rennende vann |

### Byggeår som forhåndssignal (hentes fra saksunderlaget)

- **Før 1970:** avløpsrør i støpejern — korrosjon må undersøkes hvis ikke
  byttet. 70-tallsplast er også svak.
- **Før 1979 (selvbyggere til 1983):** dampsperre under betongplate kan
  mangle → konstant kapillæropptrekk; misfarging/mugg **nederst** på
  materialer i kontakt med betongen.

### Forsikringsgrensene (beslutningene med penger i seg)

- **Akutt vs. gradvis** avgjør dekning — egen, begrunnet vurdering i
  rapporten (finnes allerede i DamageAnalysis).
- **Membran vs. rørdel på bad:** bruddpunkt i eller mellom to rørdeler =
  rørbrudd; lekkasjepunkt mellom membran og rørdel = utett våtrom. Grensen
  fortjener alltid egen dokumentasjon (foto/fuktmåling).
- **Rørbrudd-definisjonen:** brudd i fast rørstrekk, koblinger,
  fordelerkolbe eller overgang til sanitærutstyr regnes som rørbrudd i
  trykksatt rør.

### Ærlig fallback

Modellen dekker ~98 %. Resten skal falle ut som «usikker — fritekst»,
aldri tvinges inn i en kilde. Falsk sikkerhet er farligere enn usikkerhet.

## Kildeteksten (ekspertens to sider, gjengitt som levert)

> Vann har hovedsakelig 5 kilder
>
> **1) Nedbør** er fritt regnvann eller snø. Nedbør kommer fra høyden og
> treffer yttertaket på en bygning, samt yttervegger. I tillegg er
> balkonger utsatt for nedbør. Ved skader fra nedbør vil det være synlig
> fukt eller vann i innvendige himlinger, samt yttervegger. Dette gjelder
> i hovedsak bygningens øverste etasje eller loft.
> - Ved vannlekkasje fra utett yttertak er det innvendig himling eller
>   undersiden av takkonstruksjon på loft som først vil vise skadene.
>   Skadene opptrer som drypp i materialskjøter, svelling i materialer,
>   eller malingsslipp/utposing, spesielt i malingen i himling av gips.
> - Vannlekkasje fra utett yttervegg opptrer i hovedsak rundt vinduer og
>   dører i bygningens fasade. Typisk er dårlige løsninger/manglende
>   sikring mellom vindsperresjikt og vindu-/dørkarm. Ofte er det
>   vanskelig å finne punktet hvor vannet trenger inn uten å demontere den
>   ytterste klimaskjermen (utvendig kledning eller sementbaserte plater).
>   Skaden blir oftest synlig på gulv, langs yttervegger, eller direkte
>   under vinduer.
> - Vannlekkasje fra balkong opptrer som oftest ved at sluket på balkongen
>   har tettet seg; nedbør fyller opp balkongen og trenger inn gjennom
>   dårlig sikret overgang mellom balkongelement og yttervegg, typisk
>   under dørkarm.
> - Vanninntrenging gjennom yttervegg under terreng har som regel opphav i
>   nedbør som trenger ned i jorda. Jorda kan mettes ved store
>   nedbørsmengder og legge vanntrykk mot ytterveggene (leca med murpuss/
>   slamming, eller betong med grunnmursplast). Drensrør og drenerende
>   masser skal lede nedbør bort fra bygningen. Saltutslag eller tydelige
>   fuktmerker under terreng betyr at kapillærbrytende sjikt ikke fungerer
>   eller ikke eksisterer; er grunnmursplasten korrekt montert, kan
>   drensrørene ha gått tett — undersøkes med kamerainspeksjon. Bygninger
>   uten grunnmursplast kan ikke forventes å holde tett mot
>   kapillæropptrekk fra jordfuktigheten.
> - Kapillæropptrekk via grunn er konstant oppsug av fuktighet gjennom
>   betongplata. Dampsperre under betongen ble ikke utført før 1979 i
>   Norge (selvbyggerboliger til 1983). Uten dampsperre suger betongen
>   konstant fukt, som transporteres til organiske materialer i direkte
>   kontakt med den. Typisk: misfarging/muggvekst på nedre del av
>   materialer.
>
> **2) Vann fra trykksatte rør** gir en konstant lekkasje. Skaden varierer
> med lekkasjens størrelse og varighet. Typisk for eldre kobberrør er
> lekkasje inni vegger eller etasjeskiller — lite vann, drypp flere ganger
> i minuttet. Trykksatte rør er som regel aldri montert i yttervegg
> (unntak: tilførsel til utekran). Se etter lekkasjepunkter som utvikler
> seg og opptrer konstant. Ved varmtvannslekkasje utvikler mugg seg
> raskere. Enkelt å konstatere ved observasjon så lenge røret ikke er
> støpt inn.
> - Rør-i-rør (PEX) lekker i endene: ved kran eller i fordelerskapet (det
>   er hensikten med rør-i-rør). Spiker/skrue gjennom røret gir lekkasje
>   midt på vegg/gulv/himling.
> - Messingkoblinger er utsatt: gummiforinger og materialer korroderer og
>   degraderer. Rørbrudd = brudd i fast rørstrekk, koblinger,
>   fordelerkolbe eller overgang til sanitærutstyr.
> - Varmtvannsberedere er utsatt ved fordelingsventilen (i eldre bygårder
>   ofte i hjørneskapet på kjøkkenet).
> - Overgangskrana til oppvaskmaskin er utsatt: mange ufaglærte
>   tilkoblinger, og produsentens plastslange er av lavere kvalitet enn
>   røropplegget ellers.
>
> **3) Vannlekkasje fra avløpsrør** er gråvann/svartvann. Lekkasjen
> opptrer ved bruk av sanitærutstyr og kan gi diffuse lekkasjer — ikke
> konstant. Innvendig lekkasje som opptrer «tilfeldig» er en tydelig
> indikasjon på avløpsrør.
> - Støpejern før 1970 er spesielt utsatt for korrosjon; 70-tallsplast er
>   også dårligere og utelukkes ikke.
> - Fraglidning i skjøter skyldes som regel manglende klamring
>   (håndverkerfeil).
> - Nyere avløpsrør som lekker: nesten uten unntak montasjefeil.
> - Utvendig overvann koblet på kloakk kan gi tilbakeslag i kjeller ved
>   styrtregn.
> - Vann opp av sluk/kjøkkenvask = blokkasje i rørene; forbruk andre
>   steder presser vannet opp i laveste sluk over blokkasjen.
> - Bad: bruddpunkt i eller mellom to rørdeler = rørbrudd; lekkasjepunkt
>   mellom membran og rørdel = utett membran på våtrom.
>
> **4) Kondensskader** oppstår når vanndamp felles ut som flytende vann
> mot en flate kaldere enn duggpunktet. Varm luft holder mer damp enn
> kald; møter fuktig luft en kald overflate (vindu, kuldebro, kaldt loft,
> uisolert kaldtvannsrør), kondenserer fuktigheten.
> Steder: vinduer/karmer (dugg vinterstid), kuldebroer (betongbjelker,
> dårlig isolerte hjørner), kalde loft/krypkjellere, rørgjennomføringer i
> fuktige rom, og inne i veggkonstruksjonen bak utett dampsperre — den
> farligste, fordi den skjer skjult.
> Årsaker: høy luftfuktighet inne (dusjing, klestørk, mange beboere,
> manglende avtrekk), dårlig/feilplassert isolasjon, utett/manglende
> dampsperre, utilstrekkelig ventilasjon.
> Forekommer nesten aldri om sommeren (unntak: rom under bakken).
>
> **5) Utett bad.** Bad skal hindre bruksvann i å trenge inn i
> konstruksjonen rundt.
> - Lekkasjen forekommer som regel i dusjsonen — høyest vannbelastning
>   direkte på membranen.
> - Lekkasjepunktet er ofte lite og gir oppfukting i konstruksjonen rundt
>   dusjsonen, snarere enn tydelig rennende vann.
