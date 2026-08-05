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
router.get("/adresse", async (req, res) => {
  const sok = String(req.query.sok || "").trim();
  if (sok.length < 3) {
    return res.json({ adresser: [] });
  }

  try {
    const url =
      "https://ws.geonorge.no/adresser/v1/sok?fuzzy=true&treffPerSide=6&sok=" +
      encodeURIComponent(sok);
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Adressesøket svarte ikke" });
    }
    const data = await response.json();
    const adresser = (data.adresser || []).map((a) => ({
      adressetekst: a.adressetekst,
      postnummer: a.postnummer,
      poststed: a.poststed,
      kommunenavn: a.kommunenavn,
      gnr: a.gardsnummer,
      bnr: a.bruksnummer,
      lat: a.representasjonspunkt && a.representasjonspunkt.lat,
      lon: a.representasjonspunkt && a.representasjonspunkt.lon,
    }));
    res.json({ adresser });
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
