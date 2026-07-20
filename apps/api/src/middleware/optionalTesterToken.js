// optionalTesterToken.js
// Like requireTesterToken, but never blocks the request.
// Sets req.testerToken / req.testerEmail if a valid token is present;
// otherwise leaves them null. Used for log endpoints so unauthenticated
// sessions still reach the DB.
//
// Token extraction order (first non-empty wins):
//   1. x-tester-token header
//   2. Authorization: Bearer <token>

const { isDbEnabled, lookupToken } = require("../db");
const crypto = require("crypto");

function extractToken(req) {
  const custom = req.get("x-tester-token");
  if (custom) return custom;
  const auth = req.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}

async function optionalTesterToken(req, res, next) {
  const providedToken = extractToken(req);

  // No token at all — proceed anonymously.
  if (!providedToken) {
    req.testerToken = null;
    req.testerEmail = null;
    return next();
  }

  // ── DB-backed path ────────────────────────────────────────────────────────
  if (isDbEnabled()) {
    try {
      const row = await lookupToken(providedToken);
      if (row) {
        req.testerToken = row.token;
        req.testerEmail = row.email || null;
      } else {
        req.testerToken = null;
        req.testerEmail = null;
      }
    } catch {
      // Token lookup failed — treat as anonymous rather than blocking.
      req.testerToken = null;
      req.testerEmail = null;
    }
    return next();
  }

  // ── Env-var fallback (local dev / no DATABASE_URL) ────────────────────────
  const expectedToken = process.env.TESTER_TOKEN;
  if (expectedToken) {
    try {
      const a = Buffer.from(expectedToken);
      const b = Buffer.from(providedToken);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        req.testerToken = providedToken;
        req.testerEmail = null;
        return next();
      }
    } catch {
      // fall through to anonymous
    }
  }

  req.testerToken = null;
  req.testerEmail = null;
  next();
}

module.exports = optionalTesterToken;
