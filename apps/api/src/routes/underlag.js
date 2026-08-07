// routes/underlag.js – saksunderlag fra offentlige API-er (Kartverket, MET).
// Proxyes server-side så mobil/web slipper CORS, og så eventuelle nøkler
// (FROST_CLIENT_ID) aldri når klienten. Mountes bak tester-token-guarden
// slik at endepunktene ikke blir en åpen proxy.

const express = require("express");

const router = express.Router();

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// ── Adressesøk (Kartverket/Geonorge — åpent, uten nøkkel) ────────────────────
async function sokAdresser(sok, treffPerSide = 6) {
  const url =
    `https://ws.geonorge.no/adresser/v1/sok?fuzzy=true&treffPerSide=${treffPerSide}&sok=` +
    encodeURIComponent(sok);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Adressesøket svarte ${response.status}`);
  const data = await response.json();
  return (data.adresser || []).map((a) => ({
    adressetekst: a.adressetekst,
    postnummer: a.postnummer,
    poststed: a.poststed,
    kommunenavn: a.kommunenavn,
    kommunenummer: a.kommunenummer,
    gnr: a.gardsnummer,
    bnr: a.bruksnummer,
    lat: a.representasjonspunkt && a.representasjonspunkt.lat,
    lon: a.representasjonspunkt && a.representasjonspunkt.lon,
  }));
}

router.get("/adresse", async (req, res) => {
  const sok = String(req.query.sok || "").trim();
  if (sok.length < 3) {
    return res.json({ adresser: [] });
  }

  try {
    res.json({ adresser: await sokAdresser(sok) });
  } catch (err) {
    console.error("GET /api/underlag/adresse error:", sanitizeError(err));
    res.status(502).json({ error: "Fikk ikke kontakt med Kartverket" });
  }
});

// ── Nedbørshistorikk rundt skadedato (MET Frost — gratis nøkkel) ─────────────
// Uten FROST_CLIENT_ID svarer vi { configured: false } så appen kan skjule raden
// i stedet for å feile.
router.get("/vaer", async (req, res) => {
  const clientId = process.env.FROST_CLIENT_ID;
  if (!clientId) {
    return res.json({ configured: false });
  }

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const date = String(req.query.date || "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "lat, lon og date (YYYY-MM-DD) kreves" });
  }

  try {
    const auth = "Basic " + Buffer.from(clientId + ":").toString("base64");
    const element = "sum(precipitation_amount P1D)";

    const sourcesResponse = await fetch(
      "https://frost.met.no/sources/v0.jsonld?types=SensorSystem&elements=" +
        encodeURIComponent(element) +
        "&geometry=" +
        encodeURIComponent(`nearest(POINT(${lon} ${lat}))`),
      { headers: { authorization: auth }, signal: AbortSignal.timeout(8000) }
    );
    if (!sourcesResponse.ok) {
      return res.status(502).json({ error: "Fant ingen værstasjon" });
    }
    const sources = await sourcesResponse.json();
    const station = sources.data && sources.data[0];
    if (!station) {
      return res.json({ configured: true, station: null, days: [] });
    }

    const damage = new Date(date + "T00:00:00Z");
    const from = new Date(damage.getTime() - 10 * 86400000).toISOString().slice(0, 10);
    const to = new Date(damage.getTime() + 3 * 86400000).toISOString().slice(0, 10);

    const obsResponse = await fetch(
      "https://frost.met.no/observations/v0.jsonld?sources=" +
        encodeURIComponent(station.id) +
        "&referencetime=" +
        encodeURIComponent(`${from}/${to}`) +
        "&elements=" +
        encodeURIComponent(element),
      { headers: { authorization: auth }, signal: AbortSignal.timeout(10000) }
    );
    if (!obsResponse.ok) {
      return res.json({ configured: true, station: station.name || station.id, days: [] });
    }
    const obs = await obsResponse.json();
    const days = (obs.data || []).map((d) => ({
      date: String(d.referenceTime || "").slice(0, 10),
      mm: d.observations && d.observations[0] ? d.observations[0].value : null,
    }));
    const total = days.reduce((sum, d) => sum + (d.mm || 0), 0);

    res.json({
      configured: true,
      station: station.name || station.id,
      distanceKm: null,
      days,
      totalMm: Math.round(total * 10) / 10,
    });
  } catch (err) {
    console.error("GET /api/underlag/vaer error:", sanitizeError(err));
    res.status(502).json({ error: "Fikk ikke kontakt med MET Frost" });
  }
});

// ── Bygningsdata fra ÅPEN matrikkel (Geonorge WFS, uten avtale) ──────────────
// Datasettet «Matrikkelen – Bygningspunkt» er åpne data og gir bygningstype,
// bygningsstatus og kulturminne-/SEFRAK-flagg. Byggeår ligger IKKE i det åpne
// settet — det krever full Matrikkel-API (gratis avtale med Kartverket) eller
// distributør. Vi henter nærmeste bygning innenfor ~60 m.

const BYGNINGSTYPE = {
  111: "Enebolig", 112: "Enebolig m/hybelleilighet", 113: "Våningshus",
  121: "Tomannsbolig, vertikaldelt", 122: "Tomannsbolig, horisontaldelt",
  124: "Våningshus, tomannsbolig", 131: "Rekkehus", 133: "Kjedehus",
  135: "Terrassehus", 136: "Andre småhus", 141: "Stort boligbygg (2 etg.)",
  142: "Stort boligbygg (3–4 etg.)", 143: "Stort boligbygg (5+ etg.)",
  161: "Fritidsbygg", 181: "Garasje/uthus til bolig", 182: "Garasje/uthus",
};

const BYGNINGSSTATUS = {
  TB: "Tatt i bruk", FA: "Ferdigattest", MB: "Midlertidig brukstillatelse",
  IG: "Igangsettingstillatelse", RA: "Rammetillatelse",
};

async function hentBygg(lat, lon) {
  const d = 0.0006; // ~60 m nord-sør
  const bbox = `${lat - d},${lon - d * 2},${lat + d},${lon + d * 2},urn:ogc:def:crs:EPSG::4258`;
  const url =
    "https://wfs.geonorge.no/skwms1/wfs.matrikkelen-bygningspunkt" +
    "?service=WFS&version=2.0.0&request=GetFeature&typenames=app:Bygning" +
    "&count=20&srsName=urn:ogc:def:crs:EPSG::4258&bbox=" + encodeURIComponent(bbox);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Matrikkel-WFS svarte ${response.status}`);
  const xml = await response.text();

  const buildings = [];
  const blocks = xml.split("<app:Bygning ").slice(1);
  for (const block of blocks) {
    const grab = (tag) => {
      const m = block.match(new RegExp(`<app:${tag}>([^<]*)</app:${tag}>`));
      return m ? m[1] : null;
    };
    const pos = block.match(/<gml:pos[^>]*>([\d.]+)\s+([\d.]+)<\/gml:pos>/);
    if (!pos) continue;
    const bLat = Number(pos[1]);
    const bLon = Number(pos[2]);
    buildings.push({
      bygningsnummer: grab("bygningsnummer"),
      typeKode: grab("bygningstype"),
      statusKode: grab("bygningsstatus"),
      kulturminne: grab("harKulturminne") === "true",
      sefrak: grab("harSefrakminne") === "true",
      distanse: Math.hypot((bLat - lat) * 111320, (bLon - lon) * 55800),
    });
  }

  if (buildings.length === 0) return null;
  buildings.sort((a, b) => a.distanse - b.distanse);
  const nearest = buildings[0];
  return {
    bygningsnummer: nearest.bygningsnummer,
    type: BYGNINGSTYPE[Number(nearest.typeKode)] || `Bygningstype ${nearest.typeKode}`,
    typeKode: nearest.typeKode,
    status: BYGNINGSSTATUS[nearest.statusKode] || nearest.statusKode,
    kulturminne: nearest.kulturminne || nearest.sefrak,
    avstandMeter: Math.round(nearest.distanse),
  };
}

router.get("/bygg", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat og lon kreves" });
  }

  try {
    res.json({ bygning: await hentBygg(lat, lon) });
  } catch (err) {
    console.error("GET /api/underlag/bygg error:", sanitizeError(err));
    res.status(502).json({ error: "Fikk ikke kontakt med Geonorge" });
  }
});

// ── Stedsinfo: terrenghøyde (Kartverket) + værvarsel (MET, nøkkelfritt) ──────
// Begge er åpne tjenester; MET krever kun identifiserende User-Agent.

const MET_USER_AGENT = "DocrAI/0.1 github.com/fdalen97-ui/janitorai";

const SYMBOL_NB = {
  clearsky: "klarvær", fair: "lettskyet", partlycloudy: "delvis skyet",
  cloudy: "skyet", fog: "tåke", lightrain: "lett regn", rain: "regn",
  heavyrain: "kraftig regn", lightrainshowers: "lette regnbyger",
  rainshowers: "regnbyger", heavyrainshowers: "kraftige regnbyger",
  sleet: "sludd", snow: "snø", lightsnow: "lett snø",
};

function symbolToNb(code) {
  if (!code) return null;
  const base = String(code).split("_")[0];
  return SYMBOL_NB[base] || base;
}

async function hentStedsinfo(lat, lon) {
  const result = { hoyde: null, vaer: null };

  try {
    const response = await fetch(
      `https://ws.geonorge.no/hoydedata/v1/punkt?nord=${lat}&ost=${lon}&koordsys=4258&geojson=false`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (response.ok) {
      const data = await response.json();
      const punkt = data.punkter && data.punkter[0];
      if (punkt && Number.isFinite(punkt.z)) {
        result.hoyde = {
          moh: Math.round(punkt.z),
          terreng: punkt.terreng || null,
        };
      }
    }
  } catch (err) {
    console.warn("hoydedata error:", sanitizeError(err));
  }

  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
      { headers: { "user-agent": MET_USER_AGENT }, signal: AbortSignal.timeout(8000) }
    );
    if (response.ok) {
      const data = await response.json();
      const series = (data.properties && data.properties.timeseries) || [];
      if (series.length > 0) {
        const now = series[0].data;
        const temp = now.instant && now.instant.details
          ? now.instant.details.air_temperature
          : null;
        let precip = 0;
        for (const entry of series.slice(0, 24)) {
          const next = entry.data && entry.data.next_1_hours;
          if (next && next.details && Number.isFinite(next.details.precipitation_amount)) {
            precip += next.details.precipitation_amount;
          }
        }
        const symbol =
          (now.next_12_hours && now.next_12_hours.summary && now.next_12_hours.summary.symbol_code) ||
          (now.next_1_hours && now.next_1_hours.summary && now.next_1_hours.summary.symbol_code);
        result.vaer = {
          tempC: Number.isFinite(temp) ? Math.round(temp) : null,
          beskrivelse: symbolToNb(symbol),
          nedborNeste24tMm: Math.round(precip * 10) / 10,
        };
      }
    }
  } catch (err) {
    console.warn("locationforecast error:", sanitizeError(err));
  }

  return result;
}

router.get("/stedsinfo", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat og lon kreves" });
  }
  res.json(await hentStedsinfo(lat, lon));
});

// ── Demo-underlag (offentlig, mountes med heavyLimiter) ──────────────────────
// Kampanjekroken (inkorporering A4): «se din egen adresse på 30 sekunder».
// Én adressestreng inn → beste treff + bygning + terreng + vær ut, uten
// innlogging. Kun beste treff returneres og raten begrenses av mounten, så
// endepunktet ikke kan brukes som generell oppslagsproxy.
async function demoHandler(req, res) {
  // Geonorge-søket gir null treff når strengen inneholder komma
  // («Solbergliveien 8, Oslo») — normaliser før oppslag.
  const sok = String(req.query.adresse || "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (sok.length < 3) {
    return res.status(400).json({ error: "adresse kreves (minst 3 tegn)" });
  }

  try {
    const adresser = await sokAdresser(sok, 1);
    const treff = adresser[0];
    if (!treff || !Number.isFinite(treff.lat) || !Number.isFinite(treff.lon)) {
      return res.status(404).json({ error: "Fant ingen adresse hos Kartverket" });
    }

    const [bygning, sted] = await Promise.all([
      hentBygg(treff.lat, treff.lon).catch((err) => {
        console.warn("demo bygg error:", sanitizeError(err));
        return null;
      }),
      hentStedsinfo(treff.lat, treff.lon),
    ]);

    res.json({ adresse: treff, bygning, hoyde: sted.hoyde, vaer: sted.vaer });
  } catch (err) {
    console.error("GET /api/demo/underlag error:", sanitizeError(err));
    res.status(502).json({ error: "Fikk ikke kontakt med de åpne kildene" });
  }
}

// ── Kartflis-proxy (Kartverket åpen WMTS) ────────────────────────────────────
// Egen handler som mountes UTEN tester-token: <img>-elementer kan ikke sette
// headere, og flisene er åpne data. Streng validering hindrer misbruk som
// generell proxy; zoom er avgrenset og målet er låst til Kartverkets cache.
async function tileHandler(req, res) {
  const z = Number(req.params.z);
  const y = Number(req.params.y);
  const x = Number(req.params.x);
  const max = 2 ** z;
  if (
    !Number.isInteger(z) || !Number.isInteger(y) || !Number.isInteger(x) ||
    z < 3 || z > 18 || y < 0 || x < 0 || y >= max || x >= max
  ) {
    return res.status(400).json({ error: "Ugyldig flis" });
  }

  try {
    const response = await fetch(
      `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${z}/${y}/${x}.png`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) {
      return res.status(502).json({ error: "Kartverket svarte ikke" });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.type("png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    console.error("GET /api/flis error:", sanitizeError(err));
    res.status(502).json({ error: "Fikk ikke kontakt med Kartverket" });
  }
}

module.exports = router;
module.exports.tileHandler = tileHandler;
module.exports.demoHandler = demoHandler;
