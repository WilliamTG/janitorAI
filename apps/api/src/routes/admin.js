// routes/admin.js – token provisioning / revocation for admins.
// Protected by x-admin-secret header checked against ADMIN_SECRET env var.
// Mount BEFORE the global requireTesterToken guard in index.js.

const express = require("express");
const { getPool, requireDb } = require("../db");

const router = express.Router();

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// ── Admin secret guard ────────────────────────────────────────────────────────
function requireAdminSecret(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "ADMIN_SECRET not configured on server" });
  }
  if (req.headers["x-admin-secret"] !== secret) {
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
