// routes/admin.js – token provisioning / revocation for admins.
// Protected by x-admin-secret header checked against ADMIN_SECRET env var.
// Mount BEFORE the global requireTesterToken guard in index.js.

const express = require("express");
const crypto = require("crypto");
const { getPool, requireDb } = require("../db");

const router = express.Router();

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// Timing-sikker strengsammenligning (S11): unngår at responstid lekker hvor
// mange tegn av hemmeligheten som stemmer.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── Admin secret guard ────────────────────────────────────────────────────────
function requireAdminSecret(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "ADMIN_SECRET not configured on server" });
  }
  const provided = req.headers["x-admin-secret"];
  if (typeof provided !== "string" || !safeEqual(provided, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(requireAdminSecret);
router.use(requireDb);

// ── POST /api/admin/tokens – provision a new tester token ────────────────────
router.post("/tokens", async (req, res) => {
  const { token, tester_name, email } = req.body || {};

  if (!token || typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ error: "token is required" });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO tester_tokens (token, tester_name, email, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (token) DO UPDATE
         SET tester_name = EXCLUDED.tester_name, email = EXCLUDED.email, is_active = TRUE
       RETURNING token, tester_name, email, is_active, created_at`,
      [token.trim(), tester_name ? String(tester_name).trim() : null, email ? String(email).trim() : null]
    );
    res.status(201).json({ token: result.rows[0] });
  } catch (err) {
    console.error("POST /api/admin/tokens error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/admin/tokens/:token – revoke a tester token ──────────────────
router.delete("/tokens/:token", async (req, res) => {
  const token = String(req.params.token);

  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE tester_tokens SET is_active = FALSE WHERE token = $1 RETURNING token, tester_name`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Token not found" });
    }
    res.json({ revoked: true, token: result.rows[0] });
  } catch (err) {
    console.error("DELETE /api/admin/tokens/:token error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/admin/tokens – list all tokens (handy when on vacation) ──────────
router.get("/tokens", async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      "SELECT token, tester_name, email, is_active, created_at FROM tester_tokens ORDER BY created_at DESC"
    );
    res.json({ tokens: result.rows });
  } catch (err) {
    console.error("GET /api/admin/tokens error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/admin/cost – COGS-aggregat per operasjon ────────────────────────
// Grunnlaget for å sette en kredittpris (docs/prising-bruksbasert.md): faktisk
// tokenforbruk og estimert kostnad per operasjonstype. ?days=N (standard 30).
router.get("/cost", async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         operation,
         COUNT(*)::int                             AS antall,
         ROUND(AVG(input_tokens))::int             AS snitt_input_tokens,
         ROUND(AVG(output_tokens))::int            AS snitt_output_tokens,
         ROUND(AVG(total_tokens))::int             AS snitt_total_tokens,
         (percentile_cont(0.95) WITHIN GROUP (ORDER BY total_tokens))::int AS p95_total_tokens,
         MAX(total_tokens)::int                    AS maks_total_tokens,
         ROUND(AVG(est_cost_usd)::numeric, 6)      AS snitt_kostnad_usd,
         ROUND(SUM(est_cost_usd)::numeric, 4)      AS sum_kostnad_usd,
         ROUND(AVG(duration_ms))::int              AS snitt_ms
       FROM cost_events
       WHERE created_at >= now() - ($1 || ' days')::interval
       GROUP BY operation
       ORDER BY sum_kostnad_usd DESC NULLS LAST`,
      [String(days)]
    );
    // Overslagsregningen (docs/overslag-pilotokonomi.md) selvbetjent: fordeling
    // per tester/uke (er forbruket jevnt eller drevet av én?) og tapt kostnad
    // på feilede rapportkjøringer (betalte tokens uten leveranse).
    const perTester = await pool.query(
      `SELECT COALESCE(t.tester_name, LEFT(c.tester_token, 8) || '…') AS tester,
              date_trunc('week', c.created_at)::date AS uke,
              COUNT(*)::int                          AS antall,
              ROUND(SUM(c.est_cost_usd)::numeric, 4) AS sum_kostnad_usd
       FROM cost_events c
       LEFT JOIN tester_tokens t ON t.token = c.tester_token
       WHERE c.created_at >= now() - ($1 || ' days')::interval
       GROUP BY 1, 2
       ORDER BY uke DESC, sum_kostnad_usd DESC NULLS LAST`,
      [String(days)]
    );
    const rapportSvinn = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE operation = 'report')::int        AS rapporter_ok,
              COUNT(*) FILTER (WHERE operation = 'report_failed')::int AS rapporter_feilet,
              ROUND(COALESCE(SUM(est_cost_usd) FILTER (WHERE operation = 'report_failed'), 0)::numeric, 4) AS tapt_kostnad_usd
       FROM cost_events
       WHERE created_at >= now() - ($1 || ' days')::interval`,
      [String(days)]
    );

    res.json({
      windowDays: days,
      note: "Kostnad er ESTIMAT (verifiser priser mot Google før kredittpris settes).",
      operations: result.rows,
      perTester: perTester.rows,
      rapportSvinn: rapportSvinn.rows[0],
    });
  } catch (err) {
    console.error("GET /api/admin/cost error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/admin/logs – 200 most recent errors + actions ───────────────────
router.get("/logs", async (req, res) => {
  try {
    const pool = getPool();

    const [errResult, actResult] = await Promise.all([
      pool.query(
        `SELECT id, tester_token, error_message, stack_trace, action_context, device_info, created_at
         FROM error_logs
         ORDER BY created_at DESC
         LIMIT 200`
      ),
      pool.query(
        `SELECT id, tester_token, action, duration_ms, created_at
         FROM user_actions
         ORDER BY created_at DESC
         LIMIT 200`
      ),
    ]);

    res.json({
      errors: errResult.rows,
      actions: actResult.rows,
    });
  } catch (err) {
    console.error("GET /api/admin/logs error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
