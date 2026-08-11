# Sikkerhets- og troverdighetsrevisjon — august 2026

Revisjon av DocrAI mot to bransjesjekklister: 20 «slik hackes en vibe-kodet app»
og 20 «slik ser en useriøs KI-side ut». Seks parallelle agenter gikk gjennom
kodebasen, og hvert sårbart funn ble adversarielt etterprøvd før fiks. Ingen
funn ble avvist i etterprøvingen. Dette dokumentet er sannhetskilden for hva som
er tettet og hva som bevisst er utsatt.

## Sammendrag

- **Ingen kritiske hull.** Grunnmodellen var solid: all SQL er parametrisert,
  delings-PIN hashes med scrypt+salt, share-IDer/PIN er kryptografisk tilfeldige,
  ingen hemmeligheter i frontend eller git.
- **9 bekreftede funn tettet** (alle middels alvor), pluss 10 herdingspunkter.
- **Alt verifisert:** 31 e2e-sjekker, tenant-skoping, MIME-whitelist, signerte
  URL-er, ren TypeScript, web-eksport bygger.

## Tettet — bekreftede funn

| Punkt | Hva | Fiks | Fil |
|---|---|---|---|
| S3 | Media kunne hentes på tvers av testere med kjent UUID | `GET /api/media/:id` skopet på `tester_token`; delingens medieliste + strøm skopet; opplasting avviser planting i annens eksisterende prosjekt | `routes/media.js`, `routes/share.js` |
| S7 | Klientens `Content-Type` lagret rått → lagret XSS ved inline-visning | MIME avledes fra whitelistet filendelse; all servering setter `X-Content-Type-Options: nosniff` | `mediaTypes.js`, `routes/media.js`, `routes/share.js` |
| S4 | Nedlastingsproxy stolte på `?doc_url` fra klient | Dokument-ID hentes fra prosjektets lagrede `reportUrl`, skopet på token; rapportgenerering verifiserer videoeierskap | `index.js` |
| S10 | Tester-token lekket i `?token=` til AI-motoren (motorens/edge-logger) | Kortlevde, signerte medie-URL-er (HMAC, 15 min) — tokenet forlater aldri serveren | `mediaSign.js`, `routes/media.js`, `index.js` |
| S14 | App-IDer var `Date.now()` (forutsigbare mot global primærnøkkel) | UUID-er (`src/lib/ids.ts`); tombstone-upsert kan ikke lenger kapre eierskap | `app/**`, `routes/projects.js` |
| S17 | Stacktrace kunne lekke uten `NODE_ENV=production` | Global feilhåndterer fanger JSON-parse-/multer-feil, generisk svar uansett miljø | `index.js` |
| S18 | 3 høye sårbarheter i api-treet | `multer`→2.2.0, ubrukt `form-data` fjernet → **0 sårbarheter**; ikke-brytende `npm audit fix` i appen | `package.json` |
| S1 | `.env` matchet aldri i `.gitignore` (kommentar på mønsterlinjen); testvideo innsjekket | `.env` matcher nå på alle nivåer; `media-uploads/` ignorert; videoen fjernet | `.gitignore` |

## Tettet — herding (lav alvor)

- **S5** media-opplasting bak `heavyLimiter`; publikum-telleren prunes så den ikke vokser.
- **S8** admin-dashboardets `escHtml` escaper også apostrof (lukker selv-XSS i `onclick`).
- **S11** admin-hemmelighet sammenlignes timing-sikkert (`timingSafeEqual`).
- **S12** CORS kan låses via `CORS_ORIGINS` (åpen som standard — auth er header-token, ikke cookies).
- **S15** eksplisitt body-tak 300 kb på JSON.
- **S2** Gemini-nøkkel sendes nå i header (`x-goog-api-key`), ikke i URL.

## Trygt fra før (ingen endring nødvendig)

S6 (all SQL parametrisert), S9 (scrypt+salt på PIN), S16 (ingen innkommende
webhooks i arkitekturen), S19 (6-sifret server-PIN, 5 forsøk/15 min + utløp).

## Bevisst utsatt — med begrunnelse

- **S10-rest (app-visning):** appens egen `?token=`-visning av eget media er
  same-origin ressurslasting; API-loggene redakterer `?token=`. Lav risiko.
  Kan flyttes til signerte URL-er også på klienten etter pilot.
- **S14 sammensatt primærnøkkel:** `projects`/`deleted_projects` har global PK
  på `id` alene. UUID-ene fjerner kollisjonsrisikoen i praksis; å endre PK til
  `(id, tester_token)` er en skjemamigrasjon som tas når pilotdata finnes.
- **S19 persistert lockout:** PIN-forsøksteller er i minnet (nullstilles ved
  omstart). Akseptabelt nå; persister på `shares`-raden hvis piloten skalerer.
- **S13 e-postverifisering:** tester-e-post (som gir Google-Doc-lesetilgang)
  bør bekreftes før `share_doc_with_email`. Tas med i onboarding-flyten.

## Troverdighet (W-lista)

Siden var allerede uvanlig ærlig: ingen falske anmeldelser, kundetall, emojis,
lilla gradienter eller «made with»-badge; priser merket «veiledende». Fikset:

- **W9** favicon i tre størrelser koblet på alle sider (+ `/favicon.ico`).
- **W12** vilkårsside (`/vilkar`) lenket fra footere.
- **W20** alle lange tankestreker (—) byttet til korte (–) på salgsflatene.
- **W8** «D»-merke i logoen så den matcher favicon og delingsbilde.
- **W5** retur-lenke i kundereisen (ingen navigasjonsblindvei).
- **W15** udokumenterbar «ingen andre i Norden»-påstand myknet.
- Delingsbildet: en-dash + ærlig stempel «Du godkjenner, ikke AI-en».

Bevisst ikke gjort: ekte anmeldelser, kundetall, teamfoto og casestudier kan
ikke fabrikkeres — de kommer fra piloten.

## Driftsanbefalinger (utenfor kode)

1. Sett `NODE_ENV=production`, `MEDIA_URL_SECRET` og `CORS_ORIGINS` i miljøet.
2. Verifiser at `MEDIA_DIR` peker på persistent disk utenfor repoet i drift.
3. Vurder secret-scanning i CI som ekstra sikring mot lekket `.env`.
