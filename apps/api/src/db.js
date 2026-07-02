// db.js – PostgreSQL connection + schema for project persistence
// Enabled only when DATABASE_URL is set (provision a Postgres instance on Render).

const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let initPromise = null;

function isDbEnabled() {
  return Boolean(DATABASE_URL);
}

function needsSsl() {
  if (!DATABASE_URL) return false;
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return true;
  // Render external URLs and most managed Postgres providers require SSL.
  return (
    DATABASE_URL.includes("render.com") ||
    DATABASE_URL.includes("sslmode=require")
  );
}

function getPool() {
  if (!isDbEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      ssl: needsSsl() ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => {
      console.error("Postgres pool error:", err && err.message);
    });
  }
  return pool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deleted_projects (
  id TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  kind TEXT,
  mime_type TEXT,
  original_name TEXT,
  size_bytes BIGINT,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_project_id_idx ON media (project_id);
`;

async function initDb() {
  if (!isDbEnabled()) return false;
  if (!initPromise) {
    initPromise = (async () => {
      const p = getPool();
      await p.query(SCHEMA_SQL);
      console.log("Postgres schema ready (projects, deleted_projects, media)");
      return true;
    })().catch((err) => {
      console.error("Failed to initialize database schema:", err && err.message);
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/**
 * Express middleware: rejects with 503 when persistence is not configured,
 * and ensures the schema exists before handling the request.
 */
function requireDb(req, res, next) {
  if (!isDbEnabled()) {
    return res.status(503).json({
      error:
        "Persistence not configured. Set DATABASE_URL on the server to enable project sync.",
    });
  }
  initDb()
    .then(() => next())
    .catch(() => {
      res.status(503).json({ error: "Database unavailable" });
    });
}

module.exports = { getPool, initDb, isDbEnabled, requireDb };
