# Kampanjedata: takstforetak

Kilde: Brønnøysundregistrenes åpne enhetsregister-API (data.brreg.no),
åpne offentlige foretaksdata under NLOD-lisens. Hentet 2026-08-06.
Oppfrisk med: `node scripts/hent-takstforetak.mjs`

- `takstforetak.csv` — alle aktive foretak med takst/taksering i navn eller
  formål (1 049 rader), sortert på kampanjescore (se
  `docs/kampanje-takstpersoner.md` §2). Semikolonseparert, UTF-8 med BOM
  (åpner riktig i norsk Excel).
- `takstforetak-a-liste.csv` — topp 40 i eiendomssegmentet, kandidater til
  A-lista (håndplukkes videre manuelt).

Kolonnen `kanal` koder lovvalget fra markedsføringsloven § 15: ENK er
fysiske personer og skal aldri ha uanmodet e-post — de nås via telefon
eller sosiale medier. Kolonnen `score_grunnlag` viser hvorfor raden fikk
poengene sine.

Det registeret IKKE kan fortelle: hvem som faktisk tar forsikringsoppdrag
(bare 166 nevner skade/forsikring i formålet — resten må berikes manuelt
via nettsider/Proff), og hvem som er sertifisert i Norsk takst (sjekkes
mot norsktakst.no sitt «finn takstmann»-søk ved håndplukking av A-lista).
