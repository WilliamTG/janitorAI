// routes/logs.js – client-side error and action timing ingestion.
// Mounted AFTER the global requireTesterToken guard in index.js.

const express = require("express");
const { getPool, requireDb } = require("../db");

const router = express.Router();

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// ── POST /api/logs/error ──────────────────────────────────────────────────────
// Body: { error_message, stack_trace?, action_context?, device_info?, device_id? }
// No valid tester token is required — anonymous sessions are accepted so that
// upload errors before login are visible in the admin Logs tab.
router.post("/error", requireDb, async (req, res) => {
  const { error_message, stack_trace, action_context, device_info, device_id } = req.body || {};

  if (!error_message) {
    return res.status(400).json({ error: "error_message is required" });
  }

  // Merge device_id into device_info so anonymous sessions are attributable.
  const enrichedDeviceInfo = {
    ...(device_info && typeof device_info === "object" ? device_info : device_info ? { raw: String(device_info) } : {}),
    ...(device_id ? { device_id: String(device_id).slice(0, 128) } : {}),
  };

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
        Object.keys(enrichedDeviceInfo).length > 0 ? enrichedDeviceInfo : null,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/logs/error DB error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/logs/action ─────────────────────────────────────────────────────
// Body: { action, duration_ms, device_id? }
// No valid tester token is required — anonymous sessions are accepted.
router.post("/action", requireDb, async (req, res) => {
  const { action, duration_ms, device_id } = req.body || {};

  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }

  const deviceInfo = device_id ? { device_id: String(device_id).slice(0, 128) } : null;

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO user_actions (tester_token, action, duration_ms, device_info)
       VALUES ($1, $2, $3, $4)`,
      [
        req.testerToken || null,
        String(action).slice(0, 200),
        duration_ms != null ? Math.round(Number(duration_ms)) : null,
        deviceInfo,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /api/logs/action DB error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
