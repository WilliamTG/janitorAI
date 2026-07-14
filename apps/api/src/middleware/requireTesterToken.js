// requireTesterToken.js
// Validates the x-tester-token header against the tester_tokens DB table.
// Falls back to a constant-time env-var comparison when the DB is not enabled
// (local dev / no DATABASE_URL), so smoke tests work without Postgres.

const crypto = require("crypto");
const { isDbEnabled, lookupToken } = require("../db");

async function requireTesterToken(req, res, next) {
  const providedToken = req.get("x-tester-token");

  if (!providedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── DB-backed path ────────────────────────────────────────────────────────
  if (isDbEnabled()) {
    try {
      const row = await lookupToken(providedToken);
      if (!row) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.testerToken = row.token;
      req.testerEmail = row.email || null;
      return next();
    } catch (err) {
      console.error("Token lookup error:", err && err.message);
      return res.status(503).json({ error: "Auth service unavailable" });
    }
  }

  // ── Env-var fallback (no DB) ───────────────────────────────────────────────
  const expectedToken = process.env.TESTER_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ error: "TESTER_TOKEN not configured" });
  }

  try {
    const a = Buffer.from(expectedToken);
    const b = Buffer.from(providedToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.testerToken = providedToken;
  req.testerEmail = null; // email not available in env-var fallback mode
  next();
}

module.exports = requireTesterToken;
