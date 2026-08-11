# Beslutningsnotat — prismodell (ett møte, ja/nei)

*August 2026. Underlag: `prising-bruksbasert.md` (full analyse) + `sikkerhets-`
og `fagkart`-dokumentene. Målgruppe avklart: bedrifter (takstfolk).*

## Hva gruppen skal bestemme

Tre spørsmål. Anbefaling i **fet**.

1. **Enhet — hva selger vi?**
   - **[A] «Rapporter» med saldo — «X rapporter igjen» (anbefalt)**
   - [B] Per rapport, betal hver gang (kr vises i felt)
   - [C] Kreditter/tokens som kundevendt enhet

2. **Innpakning — hvordan betaler de?**
   - **[A] Klippekort (kontantkort) + rapport-abonnement (mobilabonnement) — begge (anbefalt)**
   - [B] Kun abonnement
   - [C] Kun klippekort

3. **Veiledende tall (start, justeres etter pilot-COGS):**

   | Produkt | Inkludert | Pris | Eff. pr. rapport |
   |---|---|---|---|
   | Gratis start | 5 rapporter | 0 kr | — |
   | Klippekort 10 | 10 (12 mnd) | 1 490 kr | 149 kr |
   | Klippekort 50 | 50 (12 mnd) | 5 900 kr | 118 kr |
   | Abonnement Liten | 10/mnd | 990 kr/mnd | 99 kr |
   | Abonnement Medium | 25/mnd | 1 990 kr/mnd | 80 kr |
   | Abonnement Fri | ubegrenset | 2 990 kr/mnd | — |
   | Påfyll utover kvote | pr. rapport | 79 kr | 79 kr |

## Hvorfor anbefalingen

- **Taksameteret, ikke prisen, dreper bruk.** «149 kr per rapport» tvinger en
  kjøpsbeslutning hver gang i felt. «18 av 25 rapporter igjen» er en kvote de
  allerede har betalt for — som datapakke på mobil. Identisk økonomi, ingen angst.
- **Rapporter slår tokens som enhet** fordi en takstperson ikke kan forutsi
  tokens per rapport (kort vs. lang video). «Rapporter igjen» svarer på det de
  faktisk lurer på: *hvor mange befaringer kan jeg gjøre?* Tokens måles kun
  internt (`/api/admin/cost`).
- **Vi har råd til det.** COGS ~0,25–3 kr/rapport mot pris ~80–149 kr → >95 %
  margin. Vi trenger ikke token-presisjon for å beskytte marginen.
- **Verdibasert:** en rapport sparer ~2 t (1 400–2 600 kr verdi). Prisen er
  5–10 % av verdien, og under Befar (500 kr/rapport).
- **Begge innpakninger** treffer begge kundetyper: klippekort for sporadiske,
  abonnement for faste (gir forutsigbar MRR og capper COGS-risiko).

## UX-regelen som følger med vedtaket
Aldri vis kr i genereringsøyeblikket — kun «rapporter igjen» + varsel ved lav
saldo. (Se mockup: normal + lav-saldo-tilstand.)

## Åpen avhengighet før prisen låses
De veiledende tallene hviler på estimert COGS. **Video-tokens er jokeren.** Kjør
10–20 ekte pilotrapporter, les `maks_total_tokens` i `/api/admin/cost`, og bekreft
gulvet før prisene publiseres på `/om` og `/vilkar`.

## Ved «ja» — neste steg (kode)
1. Saldo-modell på server (rapport-saldo per konto, idempotent trekk pr. godkjent
   rapport, atomisk).
2. «Rapporter igjen»-visning i appen + lav-saldo-varsel + påfyll-flyt.
3. Stripe for klippekort/abonnement (selvbetjening) + EHF-faktura for innkjøp.
4. Oppdater `/om` + `/vilkar` med vedtatt modell.

*Ingenting av dette er bygget eller priset i produktet ennå — det venter på dette
vedtaket. Kun COGS-målingen (`/api/admin/cost`) er på plass.*
