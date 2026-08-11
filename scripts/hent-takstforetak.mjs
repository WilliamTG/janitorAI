// Henter alle norske takstforetak fra Brønnøysundregistrenes åpne API
// (data.brreg.no, NLOD-lisens) og bygger kampanjelisten fra
// docs/kampanje-takstpersoner.md §2: ett foretak per rad, med kanalvalg
// (mfl. § 15: e-post kun til selskaper, aldri uanmodet til ENK) og en
// score beregnet fra det registeret faktisk kan fortelle oss.
//
// Kjør:  node scripts/hent-takstforetak.mjs
// Ut:    data/takstforetak.csv (alle, sortert på score)
//        data/takstforetak-a-liste.csv (topp 40 i eiendom/skade-segmentet)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://data.brreg.no/enhetsregisteret/api/enheter';
const PAGE_SIZE = 1000;
const QUERIES = ['takst', 'taksering'];

// Foretaksformer vi kan selge til. FLI (foreninger), KBO osv. er ikke kunder.
const ORGFORMER = new Set(['AS', 'ENK', 'DA', 'ANS', 'ASA']);

async function fetchAll(navn) {
  const rows = [];
  for (let page = 0; ; page++) {
    const url = `${API}?navn=${encodeURIComponent(navn)}&size=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Brreg ${res.status} for ${url}`);
    const data = await res.json();
    const enheter = data._embedded?.enheter ?? [];
    rows.push(...enheter);
    const totalPages = data.page?.totalPages ?? 0;
    if (page + 1 >= totalPages) break;
  }
  return rows;
}

const text = (e) => [e.navn, ...(e.aktivitet ?? [])].join(' ').toLowerCase();

// «takstol» = takkonstruksjoner, ikke taksering. Krever ordet takst/taksering
// utenom takstol-treff for å bli med videre.
function erTakstRelevant(e) {
  const t = text(e);
  const utenTakstol = t.replace(/takstol\w*/g, '');
  return /takst|takser/.test(utenTakstol);
}

function segment(e) {
  const t = text(e);
  if (/\b(bil|kjøretøy|motorsykkel|caravan|bobil|båt|marin|maskin)\w*/.test(t)) return 'bil/marine/maskin';
  return 'eiendom';
}

function score(e) {
  const t = text(e);
  let s = 0;
  const reasons = [];
  if (/skade|naturskade|forsikring/.test(t)) { s += 40; reasons.push('skade/forsikring i formål'); }
  const ansatte = e.harRegistrertAntallAnsatte ? (e.antallAnsatte ?? 0) : null;
  if (ansatte !== null && ansatte >= 2 && ansatte <= 10) { s += 25; reasons.push(`${ansatte} ansatte`); }
  if (/bolig|eiendom|verditakst|tilstand|bygg/.test(t)) { s += 10; reasons.push('eiendom i formål'); }
  if (e.organisasjonsform?.kode === 'AS') { s += 10; reasons.push('AS (e-post lovlig)'); }
  if (e.epostadresse) { s += 5; reasons.push('e-post i registeret'); }
  if (e.hjemmeside) { s += 5; reasons.push('hjemmeside'); }
  if (segment(e) !== 'eiendom') { s -= 30; reasons.push('feil segment'); }
  return { score: s, reasons: reasons.join(' + ') };
}

// mfl. § 15: uanmodet e-postmarkedsføring til fysiske personer (inkl. ENK)
// krever samtykke. Kanalvalget bakes derfor inn i selve lista.
const kanal = (e) =>
  e.organisasjonsform?.kode === 'ENK' ? 'telefon/LinkedIn (ENK — ikke uanmodet e-post)' : 'e-post/telefon';

function csvEscape(v) {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  'score', 'segment', 'navn', 'orgnr', 'orgform', 'kanal', 'epost', 'telefon',
  'hjemmeside', 'adresse', 'postnr', 'poststed', 'kommune', 'ansatte',
  'naeringskode', 'registrert', 'formaal', 'score_grunnlag',
];

function toRow(e) {
  const { score: s, reasons } = score(e);
  const adr = e.forretningsadresse ?? {};
  return {
    score: s,
    segment: segment(e),
    navn: e.navn,
    orgnr: e.organisasjonsnummer,
    orgform: e.organisasjonsform?.kode ?? '',
    kanal: kanal(e),
    epost: e.epostadresse ?? '',
    telefon: e.telefon ?? e.mobil ?? '',
    hjemmeside: e.hjemmeside ?? '',
    adresse: (adr.adresse ?? []).join(', '),
    postnr: adr.postnummer ?? '',
    poststed: adr.poststed ?? '',
    kommune: adr.kommune ?? '',
    ansatte: e.harRegistrertAntallAnsatte ? (e.antallAnsatte ?? 0) : '',
    naeringskode: e.naeringskode1 ? `${e.naeringskode1.kode} ${e.naeringskode1.beskrivelse}` : '',
    registrert: e.registreringsdatoEnhetsregisteret ?? '',
    formaal: (e.aktivitet ?? []).join(' '),
    score_grunnlag: reasons,
  };
}

function writeCsv(path, rows) {
  const lines = [HEADERS.join(';'), ...rows.map((r) => HEADERS.map((h) => csvEscape(r[h])).join(';'))];
  writeFileSync(path, '﻿' + lines.join('\n'), 'utf8'); // BOM for norsk Excel
}

const byOrgnr = new Map();
for (const q of QUERIES) {
  const enheter = await fetchAll(q);
  console.log(`«${q}»: ${enheter.length} enheter fra Brreg`);
  for (const e of enheter) byOrgnr.set(e.organisasjonsnummer, e);
}

const alle = [...byOrgnr.values()];
const aktive = alle.filter(
  (e) =>
    !e.konkurs &&
    !e.underAvvikling &&
    !e.underTvangsavviklingEllerTvangsopplosning &&
    !e.slettedato &&
    ORGFORMER.has(e.organisasjonsform?.kode)
);
const relevante = aktive.filter(erTakstRelevant);

const rows = relevante.map(toRow).sort((a, b) => b.score - a.score || a.navn.localeCompare(b.navn, 'no'));
const aListe = rows.filter((r) => r.segment === 'eiendom').slice(0, 40);

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeCsv(join(ROOT, 'data', 'takstforetak.csv'), rows);
writeCsv(join(ROOT, 'data', 'takstforetak-a-liste.csv'), aListe);

const n = (f) => rows.filter(f).length;
console.log(`\nTotalt unike: ${alle.length} → aktive salgbare orgformer: ${aktive.length} → takst-relevante: ${rows.length}`);
console.log(`  eiendom-segment: ${n((r) => r.segment === 'eiendom')} (derav AS: ${n((r) => r.segment === 'eiendom' && r.orgform === 'AS')}, ENK: ${n((r) => r.segment === 'eiendom' && r.orgform === 'ENK')})`);
console.log(`  bil/marine/maskin: ${n((r) => r.segment !== 'eiendom')}`);
console.log(`  med skade/forsikring i formålet: ${n((r) => /skade\/forsikring/.test(r.score_grunnlag))}`);
console.log(`  med e-postadresse i registeret: ${n((r) => r.epost)}`);
console.log(`  med 2–10 ansatte: ${n((r) => r.ansatte !== '' && r.ansatte >= 2 && r.ansatte <= 10)}`);
console.log(`\nSkrev data/takstforetak.csv (${rows.length} rader) og data/takstforetak-a-liste.csv (${aListe.length} rader).`);
