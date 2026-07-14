// routes/logs.js – client-side error and action timing ingestion.
// Mounted AFTER the global requireTesterToken guard in index.js.

const express = require("express");
const { getPool, requireDb } = require("../db");

const router = express.Router();

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// ── POST /api/logs/error ──────────────────────────────────────────────────────
// Body: { error_message, stack_trace?, action_context?, device_info? }
router.post("/error", requireDb, async (req, res) => {
  const { error_message, stack_trace, action_context, device_info } = req.body || {};

  if (!error_message) {
    return res.status(400).json({ error: "error_message is required" });
  }

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO error_logs (tester_token, error_message, stack_trace, action_context, device_info)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.testerToken || null,
        String(error_message).slice(0, 4000),
        stack_trace ? String(stack_trace).slice(0, 8000) : null,
        action_context ? String(action_context).slice(0, 500) : null,
        device_info ? (typeof device_info === "object" ? device_info : { raw: String(device_info) }) : null,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/logs/error DB error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/logs/action ─────────────────────────────────────────────────────
// Body: { action, duration_ms }
router.post("/action", requireDb, async (req, res) => {
  const { action, duration_ms } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO user_actions (tester_token, action, duration_ms)
       VALUES ($1, $2, $3)`,
      [
        req.testerToken || null,
        String(action).slice(0, 200),
        duration_ms != null ? Math.round(Number(duration_ms)) : null,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/logs/action DB error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
