// routes/projects.js – project persistence CRUD (behind tester token + requireDb)

const express = require("express");
const fs = require("fs");
const { getPool, requireDb } = require("../db");
const { reconcileAfterUpsert } = require("../mediaCleanup");

const router = express.Router();

router.use(requireDb);

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

function toIsoOrNow(value) {
  const d = value ? new Date(value) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// List all projects + tombstones (deleted project ids)
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const [projectsResult, deletedResult] = await Promise.all([
      pool.query("SELECT data, updated_at FROM projects ORDER BY updated_at DESC"),
      pool.query("SELECT id, deleted_at FROM deleted_projects"),
    ]);

    res.json({
      projects: projectsResult.rows.map((row) => ({
        ...row.data,
        updatedAt: toIsoOrNow(row.data.updatedAt || row.updated_at),
      })),
      deleted: deletedResult.rows.map((row) => ({
        id: row.id,
        deletedAt: row.deleted_at,
      })),
    });
  } catch (err) {
    console.error("GET /api/projects error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch single project
router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT data FROM projects WHERE id = $1", [
      String(req.params.id),
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ project: result.rows[0].data });
  } catch (err) {
    console.error("GET /api/projects/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// Upsert project (last-write-wins by updatedAt)
router.put("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = req.body && req.body.project;

    if (!project || typeof project !== "object" || String(project.id) !== id) {
      return res.status(400).json({ error: "Missing or mismatched project" });
    }

    const updatedAt = toIsoOrNow(project.updatedAt);
    const normalized = { ...project, id, updatedAt };
    const pool = getPool();

    // Respect tombstones: if deleted more recently than this update, reject.
    const tombstone = await pool.query(
      "SELECT deleted_at FROM deleted_projects WHERE id = $1",
      [id]
    );
    if (
      tombstone.rows.length > 0 &&
      new Date(tombstone.rows[0].deleted_at) >= new Date(updatedAt)
    ) {
      return res.json({ deleted: true });
    }
    if (tombstone.rows.length > 0) {
      // Project was re-created/updated after deletion: clear tombstone.
      await pool.query("DELETE FROM deleted_projects WHERE id = $1", [id]);
    }

    const result = await pool.query(
      `INSERT INTO projects (id, data, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (id) DO UPDATE
         SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
         WHERE projects.updated_at <= EXCLUDED.updated_at
       RETURNING data`,
      [id, JSON.stringify(normalized), updatedAt]
    );

    if (result.rows.length === 0) {
      // Stored version is newer – return it so the client can merge.
      const current = await pool.query(
        "SELECT data FROM projects WHERE id = $1",
        [id]
      );
      return res.json({
        stale: true,
        project: current.rows.length > 0 ? current.rows[0].data : null,
      });
    }

    // Fire-and-forget: mark media that is no longer referenced by any
    // project (actual file deletion happens after a grace period).
    reconcileAfterUpsert();

    res.json({ project: result.rows[0].data });
  } catch (err) {
    console.error("PUT /api/projects/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// Delete project (tombstoned) + its media files
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const pool = getPool();

    const mediaRows = await pool.query(
      "SELECT file_path FROM media WHERE project_id = $1",
      [id]
    );

    await pool.query("DELETE FROM projects WHERE id = $1", [id]);
    await pool.query("DELETE FROM media WHERE project_id = $1", [id]);
    await pool.query(
      `INSERT INTO deleted_projects (id, deleted_at) VALUES ($1, now())
       ON CONFLICT (id) DO UPDATE SET deleted_at = now()`,
      [id]
    );

    for (const row of mediaRows.rows) {
      fs.unlink(row.file_path, () => {});
    }

    // Also catch media rows whose project_id didn't match (e.g. uploads made
    // without a projectId) but that were only referenced by this project.
    reconcileAfterUpsert();

    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /api/projects/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
