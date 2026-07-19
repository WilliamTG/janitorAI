// routes/media.js – durable media storage (photos / audio) for projects.
// Files are stored on disk under MEDIA_DIR (attach a Render persistent disk
// and point MEDIA_DIR at its mount path); metadata lives in Postgres.
//
// Auth: accepts the tester token via the x-tester-token header OR a ?token=
// query parameter (needed for <Image>/<audio> tags that cannot set headers).
// Validated against the tester_tokens DB table; falls back to TESTER_TOKEN
// env var when no DB is configured.

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { getPool, requireDb, isDbEnabled, lookupToken } = require("../db");
const {
  getDiskUsage,
  isCritical,
  CRITICAL_PERCENT,
} = require("../diskSpace");

const router = express.Router();

const MEDIA_DIR =
  process.env.MEDIA_DIR || path.join(__dirname, "../../media-uploads");

fs.mkdirSync(MEDIA_DIR, { recursive: true });

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// ── Auth: header or ?token= query ────────────────────────────────────────────
async function requireTokenHeaderOrQuery(req, res, next) {
  const providedToken =
    req.get("x-tester-token") ||
    (typeof req.query.token === "string" ? req.query.token : "");

  if (!providedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // DB-backed validation
  if (isDbEnabled()) {
    try {
      const token = await lookupToken(providedToken);
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.testerToken = token;
      return next();
    } catch (err) {
      console.error("Media token lookup error:", err && err.message);
      return res.status(503).json({ error: "Auth service unavailable" });
    }
  }

  // Env-var fallback (no DB)
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
  next();
}

router.use(requireTokenHeaderOrQuery);
router.use(requireDb);

// ── Upload ────────────────────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
  ".m4a", ".mp3", ".wav", ".aac", ".ogg", ".webm", ".caf", ".mp4", ".3gp",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    let ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) ext = "";
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB cap
});

async function rejectWhenDiskFull(req, res, next) {
  try {
    const usage = await getDiskUsage(MEDIA_DIR);
    if (isCritical(usage)) {
      console.error(
        `POST /api/media rejected: media disk ${usage.usedPercent.toFixed(1)}% full (limit ${CRITICAL_PERCENT}%)`
      );
      return res.status(507).json({
        error:
          "Media storage on the server is full. New photos and recordings can't be uploaded until space is freed or the disk is enlarged. Your data is still saved on this device and will sync once space is available.",
        code: "MEDIA_STORAGE_FULL",
      });
    }
  } catch (err) {
    console.error("Media disk guard error:", sanitizeError(err));
  }
  next();
}

router.post("/", rejectWhenDiskFull, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const id = path.basename(filePath, path.extname(filePath));
    const projectId = req.body && req.body.projectId ? String(req.body.projectId) : null;
    const kind = req.body && req.body.kind ? String(req.body.kind) : null;

    const pool = getPool();
    await pool.query(
      `INSERT INTO media (id, project_id, kind, mime_type, original_name, size_bytes, file_path, tester_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        projectId,
        kind,
        req.file.mimetype || null,
        req.file.originalname || null,
        req.file.size || null,
        filePath,
        req.testerToken,
      ]
    );

    res.json({ id });
  } catch (err) {
    console.error("POST /api/media error:", sanitizeError(err));
    fs.unlink(filePath, () => {});
    res.status(500).json({ error: "Server error" });
  }
});

// ── Multer error handler ─────────────────────────────────────────────────────
// Must be a 4-arg Express error handler. Catches multer's LIMIT_FILE_SIZE error
// (thrown when the uploaded file exceeds the 50 MB cap) and returns a structured
// 413 response so the client can show a specific "file too large" banner instead
// of treating it as a generic upload failure.
router.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error:
        "File is too large. The maximum upload size is 50 MB. Please trim your video or export at a lower resolution.",
      code: "FILE_TOO_LARGE",
      maxBytes: 50 * 1024 * 1024,
    });
  }
  next(err);
});

// ── Download / stream ─────────────────────────────────────────────────────────
// The media ID is a UUID (unguessable); the route is already auth-gated above.
// We intentionally do not scope by tester_token here so the AI engine can
// fetch any media file it has the ID for (it receives the URL from the API).
router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const pool = getPool();
    const result = await pool.query(
      "SELECT file_path, mime_type FROM media WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const { file_path: filePath, mime_type: mimeType } = result.rows[0];

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File missing on server" });
    }

    if (mimeType) res.type(mimeType);
    res.set("Cache-Control", "private, max-age=31536000, immutable");
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error("GET /api/media/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
