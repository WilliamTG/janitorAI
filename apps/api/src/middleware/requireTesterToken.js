// requireTesterToken.js
// Validates the tester token against the tester_tokens DB table.
//
// Token extraction order (first non-empty wins):
//   1. x-tester-token header  (used by the mobile app)
//   2. Authorization: Bearer <token>  (REST clients / tooling)
//
// When DATABASE_URL is configured the token is always checked against the DB.
// When no DB is available (local dev without Postgres) a constant-time
// comparison against the TESTER_TOKEN env var is used as a fallback so smoke
// tests work without a running database.

const crypto = require("crypto");
const { isDbEnabled, lookupToken } = require("../db");

function extractToken(req) {
  const custom = req.get("x-tester-token");
  if (custom) return custom;
  const auth = req.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}

async function requireTesterToken(req, res, next) {
  const providedToken = extractToken(req);

  if (!providedToken) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "A tester token is required. Supply it via the x-tester-token header or Authorization: Bearer <token>.",
    });
  }

  // ── DB-backed path (production) ───────────────────────────────────────────
  if (isDbEnabled()) {
    try {
      const row = await lookupToken(providedToken);
      if (!row) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Token not recognised or has been deactivated. Contact an admin to verify your access.",
        });
      }
      req.testerToken = row.token;
      req.testerEmail = row.email || null;
      return next();
    } catch (err) {
      console.error("Token lookup error:", err && err.message);
      return res.status(503).json({ error: "Auth service unavailable" });
    }
  }

  // ── Env-var fallback (local dev / no DATABASE_URL) ────────────────────────
  const expectedToken = process.env.TESTER_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({
      error: "Server misconfiguration",
      message: "No DATABASE_URL and no TESTER_TOKEN env var — cannot validate token.",
    });
  }

  try {
    const a = Buffer.from(expectedToken);
    const b = Buffer.from(providedToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid token." });
    }
  } catch {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid token." });
  }

  req.testerToken = providedToken;
  req.testerEmail = null;
  next();
}

module.exports = requireTesterToken;
