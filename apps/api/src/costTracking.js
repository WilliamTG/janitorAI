// costTracking.js – COGS-måling per KI-operasjon.
//
// Fanger faktisk tokenforbruk fra Gemini-/AI-motor-svarene og estimerer kostnad,
// så en kredittpris kan settes på reelle tall (docs/prising-bruksbasert.md).
// Alt er fire-and-forget: måling skal ALDRI blokkere eller feile brukerens svar.
//
// NB: prisene under er ESTIMATER og MÅ verifiseres mot Googles gjeldende
// prisliste før de brukes til å sette en faktisk kredittpris. De er her for
// kostnadssynlighet, ikke fakturering.

const { getPool, isDbEnabled } = require("./db");

// USD per 1 million tokens (input/output). Oppdater ved prisendring.
const PRICES = {
  "gemini-2.0-flash": { inPerM: 0.10, outPerM: 0.40 },
  "gemini-2.5-flash": { inPerM: 0.30, outPerM: 2.50 },
};

// Trekk ut tokenforbruk fra et Gemini REST-svar (usageMetadata).
function extractGeminiUsage(data) {
  const u = data && data.usageMetadata;
  if (!u) return null;
  const input = u.promptTokenCount || 0;
  const output = u.candidatesTokenCount || 0;
  return {
    input,
    output,
    total: u.totalTokenCount || input + output,
  };
}

// Estimert kostnad i USD for en (model, usage). null hvis ukjent modell.
function estimateCost(model, usage) {
  const p = PRICES[model];
  if (!p || !usage) return null;
  return (usage.input / 1e6) * p.inPerM + (usage.output / 1e6) * p.outPerM;
}

// Logg ett kostnadsevent. Fire-and-forget: fanger alle feil selv, returnerer en
// promise som aldri rejecter — kall uten await i responsstien.
async function recordCost({ testerToken, operation, model, usage, durationMs }) {
  if (!isDbEnabled()) return;
  const pool = getPool();
  if (!pool) return;
  const cost = estimateCost(model, usage);
  try {
    await pool.query(
      `INSERT INTO cost_events
         (tester_token, operation, model, input_tokens, output_tokens, total_tokens, est_cost_usd, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        testerToken || null,
        operation,
        model || null,
        usage ? usage.input : null,
        usage ? usage.output : null,
        usage ? usage.total : null,
        cost,
        durationMs != null ? Math.round(durationMs) : null,
      ]
    );
  } catch (err) {
    console.warn("recordCost error:", err && err.message);
  }
}

module.exports = { PRICES, extractGeminiUsage, estimateCost, recordCost };
