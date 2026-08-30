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
const { safeMimeForExt, applySafeMediaHeaders } = require("../mediaTypes");
const { heavyLimiter } = require("../middleware/rateLimiters");
const { verifyMedia } = require("../mediaSign");

const router = express.Router();

const MEDIA_DIR =
  process.env.MEDIA_DIR || path.join(__dirname, "../../media-uploads");

fs.mkdirSync(MEDIA_DIR, { recursive: true });

function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// ── Auth: x-tester-token header, Authorization: Bearer, or ?token= query ─────
// Media URLs are embedded directly in <Image> / <audio> tags which cannot set
// custom headers, so the ?token= query param is the fallback for those cases.
function extractToken(req) {
  const custom = req.get("x-tester-token");
  if (custom) return custom;
  const auth = req.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  if (typeof req.query.token === "string" && req.query.token) return req.query.token;
  return null;
}

async function requireTokenHeaderOrQuery(req, res, next) {
  // S10: en gyldig kortlevd signatur autoriserer henting av ÉN bestemt medie-ID
  // (GET /:id) uten token — brukt av AI-motoren så tester-tokenet aldri legges i
  // URL-en. Signaturen er bundet til medie-ID-en, så den gir ikke bredere tilgang.
  if (req.method === "GET") {
    // decodeURIComponent kaster URIError på ugyldig prosentkoding (f.eks. %ZZ);
    // fang det og fall gjennom til normal token-vakt i stedet for en generisk 500.
    let signedId = null;
    try {
      signedId = decodeURIComponent(req.path.replace(/^\//, ""));
    } catch {
      signedId = null;
    }
    if (signedId && verifyMedia(signedId, req.query.exp, req.query.sig)) {
      req.signedMediaId = signedId;
      return next();
    }
  }

  const providedToken = extractToken(req);

  if (!providedToken) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "A tester token is required via x-tester-token, Authorization: Bearer, or ?token=.",
    });
  }

  // ── DB-backed validation (production) ────────────────────────────────────
  if (isDbEnabled()) {
    try {
      const row = await lookupToken(providedToken);
      if (!row) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Token not recognised or has been deactivated.",
        });
      }
      // Store the token string (not the full row object) so downstream
      // handlers can use req.testerToken as a plain string in SQL queries.
      req.testerToken = row.token;
      req.testerEmail = row.email || null;
      return next();
    } catch (err) {
      console.error("Media token lookup error:", err && err.message);
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

router.use(requireTokenHeaderOrQuery);
router.use(requireDb);

// ── Upload ────────────────────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
  ".m4a", ".mp3", ".wav", ".aac", ".ogg", ".webm", ".caf", ".mp4", ".3gp",
  ".mov", ".qt", ".quicktime", ".m4v",
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

// Videoes can be large, while photos stay capped at 50 MB. The Multer cap is
// the global ceiling; the per-kind check below enforces the photo limit too.
const MAX_PHOTO_MB = 50;
const MAX_VIDEO_MB = 500;
const MAX_UPLOAD_MB = MAX_VIDEO_MB;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
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

// Stream-hash the uploaded file (B11: tamper-evident media). Never buffers the
// whole file — videos can be 500 MB. Returns null instead of failing the
// upload if hashing goes wrong; the checksum is provenance, not a gate.
function sha256OfFile(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => {
      console.error("media sha256 error:", sanitizeError(err));
      resolve(null);
    });
  });
}

router.post("/", heavyLimiter, rejectWhenDiskFull, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const id = path.basename(filePath, path.extname(filePath));
    const projectId = req.body && req.body.projectId ? String(req.body.projectId) : null;
    const kind = req.body && req.body.kind ? String(req.body.kind) : null;
    // Derive the type from the whitelisted extension rather than trusting the
    // client-provided kind, so an image cannot bypass its 50 MB cap.
    const safeMime = safeMimeForExt(path.extname(filePath));

    const maxMb = safeMime.startsWith("video/") ? MAX_VIDEO_MB : MAX_PHOTO_MB;
    const maxBytes = maxMb * 1024 * 1024;
    if (req.file.size > maxBytes) {
      fs.unlink(filePath, () => {});
      return res.status(413).json({
        error: `File is too large. Photos and audio may be up to ${MAX_PHOTO_MB} MB; videos may be up to ${MAX_VIDEO_MB} MB.`,
        code: "FILE_TOO_LARGE",
        maxBytes,
      });
    }

    const sha256 = await sha256OfFile(filePath);

    // Idempotent opplasting: en retry etter tapt svar (nett dør etter at
    // serveren committet) skal ikke lage duplikatrad + duplikatfil. Samme
    // innhold fra samme tester på samme prosjekt gjenbruker eksisterende id.
    // Skopet på project_id med vilje: prosjektsletting fjerner media-rader per
    // project_id, så deling av rad på tvers av prosjekter ville vært farlig.
    if (sha256) {
      const pool = getPool();
      const dup = await pool.query(
        `SELECT id, file_path FROM media
         WHERE tester_token = $1 AND sha256 = $2 AND size_bytes = $3
           AND project_id IS NOT DISTINCT FROM $4
         LIMIT 1`,
        [req.testerToken, sha256, req.file.size || null, projectId]
      );
      if (dup.rows.length > 0) {
        // UPDATE-en er det atomiske «kravet» på raden: den nullstiller et ev.
        // ureferert-merke FØR vi kaster den ferske filen, og feiler kravet
        // (raden ble slettet av en samtidig sweep) faller vi gjennom til
        // vanlig INSERT — tempfilen ligger fortsatt på disk.
        const claimed = await pool.query(
          "UPDATE media SET unreferenced_at = NULL WHERE id = $1 AND tester_token = $2 RETURNING file_path",
          [dup.rows[0].id, req.testerToken]
        );
        if (claimed.rowCount === 1 && fs.existsSync(claimed.rows[0].file_path)) {
          fs.unlink(filePath, () => {});
          return res.json({ id: dup.rows[0].id, sha256, deduplicated: true });
        }
      }
    }

    // S3: hindre at tester B planter media under tester A sitt prosjekt. Vi
    // avviser bare når prosjektet FINNES og eies av en annen tester — media
    // lastes ofte opp før prosjektet er synket til serveren, så et prosjekt som
    // ikke finnes ennå er legitimt (mediet knyttes uansett til denne testerens
    // token, og delingslisten er skopet på token).
    if (projectId) {
      const pool = getPool();
      const existing = await pool.query(
        "SELECT tester_token FROM projects WHERE id = $1",
        [projectId]
      );
      if (existing.rows.length > 0 && existing.rows[0].tester_token !== req.testerToken) {
        fs.unlink(filePath, () => {});
        return res.status(403).json({ error: "Project belongs to another tester" });
      }
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO media (id, project_id, kind, mime_type, original_name, size_bytes, file_path, tester_token, sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        projectId,
        kind,
        safeMime,
        req.file.originalname || null,
        req.file.size || null,
        filePath,
        req.testerToken,
        sha256,
      ]
    );

    res.json({ id, sha256 });
  } catch (err) {
    console.error("POST /api/media error:", sanitizeError(err));
    fs.unlink(filePath, () => {});
    res.status(500).json({ error: "Server error" });
  }
});

// ── Multer error handler ─────────────────────────────────────────────────────
// Must be a 4-arg Express error handler. Catches multer's LIMIT_FILE_SIZE error
// (thrown when the uploaded file exceeds the cap) and returns a structured 413
// response so the client can show a specific "file too large" banner instead of
// treating it as a generic upload failure.
router.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `File is too large. Photos and audio may be up to ${MAX_PHOTO_MB} MB; videos may be up to ${MAX_VIDEO_MB} MB. Please trim the video or export at a lower resolution.`,
      code: "FILE_TOO_LARGE",
      maxBytes: MAX_UPLOAD_BYTES,
    });
  }
  next(err);
});

// ── Download / stream ─────────────────────────────────────────────────────────
// The media ID is a UUID (unguessable) AND the query is scoped to the caller's
// tester_token (S3): a tester can only stream their own media. The AI engine
// fetches with the requesting tester's own token (see /report/google-doc), so
// legitimate own-media fetches still work while cross-tester access 404-er.
router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const pool = getPool();
    // Signert forespørsel (S10): signaturen autoriserer nettopp denne ID-en, så
    // vi slår opp på id alene. Ellers krever vi at mediet eies av testerens token.
    const result =
      req.signedMediaId === id
        ? await pool.query(
            "SELECT file_path, mime_type FROM media WHERE id = $1",
            [id]
          )
        : await pool.query(
            "SELECT file_path, mime_type FROM media WHERE id = $1 AND tester_token = $2",
            [id, req.testerToken]
          );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const { file_path: filePath, mime_type: mimeType } = result.rows[0];

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File missing on server" });
    }

    // S7: server alltid med avledet, whitelistet MIME + nosniff.
    applySafeMediaHeaders(res, mimeType);
    res.set("Cache-Control", "private, max-age=31536000, immutable");
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error("GET /api/media/:id error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
