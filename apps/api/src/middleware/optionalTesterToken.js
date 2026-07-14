// optionalTesterToken.js
// Like requireTesterToken, but never blocks the request.
// Sets req.testerToken if a valid token is present; otherwise leaves it null.
// Used for log endpoints so unauthenticated sessions still reach the DB.

const { isDbEnabled, lookupToken } = require("../db");
const crypto = require("crypto");

async function optionalTesterToken(req, res, next) {
  const providedToken = req.get("x-tester-token");

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

  // ── Env-var fallback (no DB) ──────────────────────────────────────────────
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
