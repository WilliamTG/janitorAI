// index.js – backend for inspection MVP

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const requireTesterToken = require("./middleware/requireTesterToken");
const { generalLimiter, heavyLimiter } = require("./middleware/rateLimiters");
const requestLogger = require("./middleware/requestLogger");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------- REQUEST LOGGER ----------
// Minimal request logging (method, path, status, latency only)
app.use(requestLogger);

// ---------- RATE LIMITING ----------
// Apply general rate limiter globally
app.use(generalLimiter);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

if (!GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY is not set — transcription and image description will fail");
}

// Helper function to sanitize errors for logging (avoid logging full error objects)
function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// Multer config for uploads (audio / images) — 20 MB cap keeps Render RAM safe
const upload = multer({ dest: "uploads/", limits: { fileSize: 20 * 1024 * 1024 } });

// ---------- HEALTH CHECK (PUBLIC) ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- STATIC WEB APP (PUBLIC, production) ----------
// Serves the Expo web export when present (built via `expo export --platform web`).
const path = require("path");
const STATIC_DIR =
  process.env.STATIC_DIR || path.join(__dirname, "../../mobile/dist");
const API_PATHS = new Set([
  "/health",
  "/whoami",
  "/report/google-doc",
  "/transcribe",
  "/describe-image",
]);
// ---------- ADMIN DASHBOARD (public HTML shell, API calls carry the secret) --
// Inject the server's own API_BASE_URL so the dashboard can warn when its
// configured target differs from the URL the app itself uses.
app.get("/admin-dashboard", (req, res) => {
  const htmlPath = path.join(__dirname, "admin-dashboard.html");
  const appApiBase =
    process.env.API_BASE_URL || "https://janitorai-backend.onrender.com";
  try {
    let html = fs.readFileSync(htmlPath, "utf8");
    // Replace all occurrences of placeholder with the actual app API base URL
    html = html.replaceAll("__APP_API_BASE_PLACEHOLDER__", appApiBase);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).send("Failed to load admin dashboard");
  }
});

app.get("/presentation", (req, res) => {
  res.sendFile(path.join(__dirname, "../../../presentation/index.html"));
});

if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { extensions: ["html"] }));
  app.use((req, res, next) => {
    const acceptsHtml = (req.get("accept") || "").includes("text/html");
    if (
      req.method !== "GET" ||
      API_PATHS.has(req.path) ||
      req.path.startsWith("/api/") ||
      !acceptsHtml
    ) {
      return next();
    }
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
  console.log(`Serving static web app from ${STATIC_DIR}`);
}

// ---------- MEDIA (own auth: header or ?token= query) ----------
// Mounted before the global guard because media URLs are used directly in
// <Image>/audio players, which cannot set custom headers.
const mediaRouter = require("./routes/media");
app.use("/api/media", mediaRouter);

// ---------- ADMIN (own auth: x-admin-secret header) ----------
// Mounted before the global tester-token guard so it uses its own middleware.
const adminRouter = require("./routes/admin");
app.use("/api/admin", adminRouter);

// ---------- CLIENT LOGS (UNAUTHENTICATED OK) ----------
// Mounted before the global tester-token guard so log writes succeed even when
// the device has no valid token yet (e.g. background syncs before first login).
// optionalTesterToken enriches req.testerToken when a valid token IS present.
const optionalTesterToken = require("./middleware/optionalTesterToken");
const logsRouter = require("./routes/logs");
app.use("/api/logs", optionalTesterToken, logsRouter);

// ---------- APPLY TESTER TOKEN GUARD ----------
// All routes after this point require x-tester-token header
app.use(requireTesterToken);

// ---------- PROJECT PERSISTENCE (PROTECTED) ----------
const projectsRouter = require("./routes/projects");
app.use("/api/projects", projectsRouter);

// ---------- WHOAMI (PROTECTED) ----------
app.get("/whoami", (req, res) => {
  res.json({ authorized: true });
});

// ---------- TRANSCRIPTION (Gemini) ----------
app.post("/transcribe", heavyLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;

  try {
    const buffer = await fs.promises.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mimeType = req.file.mimetype || "audio/mp4";

    const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: "Transcribe this audio exactly as spoken. Return only the spoken words, no commentary." },
          ],
        }],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error("Gemini /transcribe error:", { status: response.status, length: raw ? raw.length : 0 });
      return res.status(500).json({ error: "Gemini error" });
    }

    const data = JSON.parse(raw);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return res.status(500).json({ error: "No transcription returned from Gemini" });
    }

    res.json({ text });
  } catch (err) {
    console.error("Backend /transcribe error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// ---------- IMAGE DESCRIPTION (Gemini) ----------
const VISION_PROMPT =
  "You are an inspection assistant analyzing photos from building and facility inspections. " +
  "Describe what is visible in the image in 1-3 sentences. Focus on: " +
  "1. What is shown (object, area, condition) " +
  "2. Any visible issues or observations " +
  "3. Suggested severity (Low/Medium/High) and recommended action if applicable. " +
  "Be concise and professional.";

app.post("/describe-image", heavyLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;

  try {
    const buffer = await fs.promises.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: VISION_PROMPT },
          ],
        }],
        generationConfig: { maxOutputTokens: 300 },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error("Gemini /describe-image error:", { status: response.status });
      return res.status(500).json({ error: "Gemini error" });
    }

    const data = JSON.parse(raw);
    const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!description) {
      return res.status(500).json({ error: "No description returned from Gemini" });
    }

    res.json({ description });
  } catch (err) {
    console.error("Backend /describe-image error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// ---------- GOOGLE DOC REPORT (AI ENGINE PROXY) ----------
app.post("/report/google-doc", heavyLimiter, async (req, res) => {
  const aiEngineUrl = process.env.AI_ENGINE_URL;
  if (!aiEngineUrl) {
    return res.status(503).json({ error: "AI engine not configured" });
  }

  try {
    const { report_meta, video_filename, project } = req.body;
    // Use the token already validated and set by the requireTesterToken middleware.
    // Reading the raw header again would miss Authorization: Bearer tokens.
    const token = req.testerToken;

    // Require a real media ID — no demo fallback
    if (!video_filename || video_filename === "demo") {
      return res.status(400).json({
        status: "error",
        message: "No video found. Please add a video note to this project before generating a report.",
      });
    }

    // Build a URL the AI engine can use to download the video directly from
    // this API server's media storage. Token is embedded as ?token= so the
    // AI engine can fetch it with a plain HTTP GET (no custom headers needed).
    const apiBaseUrl =
      process.env.API_BASE_URL ||
      `${req.protocol}://${req.get("host")}`;
    const tokenParam = encodeURIComponent(req.testerToken || "");
    const videoUrl = `${apiBaseUrl}/api/media/${video_filename}?token=${tokenParam}`;

    // Resolve photo URIs to absolute URLs and strip empty fields so the AI
    // engine receives a clean, self-contained context object.
    const enrichedNotes = (Array.isArray(project?.notes) ? project.notes : [])
      .map((note) => {
        const enrichedPhotos = (Array.isArray(note.photos) ? note.photos : [])
          .filter((p) => p && (p.uri || p.remoteId))
          .map((p) => {
            const mediaId = p.remoteId ?? p.uri;
            return {
              uri: `${apiBaseUrl}/api/media/${mediaId}?token=${tokenParam}`,
              ...(p.caption ? { caption: p.caption } : {}),
            };
          });

        const enriched = {};
        if (note.text) enriched.text = note.text;
        if (note.transcription) enriched.transcription = note.transcription;
        if (enrichedPhotos.length > 0) enriched.photos = enrichedPhotos;
        return enriched;
      })
      .filter((n) => Object.keys(n).length > 0);

    const projectContext = {};
    if (project?.name) projectContext.name = project.name;
    if (project?.inspectionDate) projectContext.inspectionDate = project.inspectionDate;
    if (project?.inspector) projectContext.inspector = project.inspector;
    if (project?.projectDescriptionText) projectContext.projectDescriptionText = project.projectDescriptionText;
    if (project?.projectDescriptionTranscription) projectContext.projectDescriptionTranscription = project.projectDescriptionTranscription;
    if (enrichedNotes.length > 0) projectContext.notes = enrichedNotes;

    // Use the dedicated service-to-service secret for the AI engine call.
    // This is separate from the user's tester token (which is validated against
    // the DB) — the AI engine authenticates against its own TESTER_TOKEN env var,
    // so the backend needs AI_ENGINE_TOKEN set to that same value.
    const aiToken = process.env.AI_ENGINE_TOKEN || "";
    const response = await fetch(`${aiEngineUrl}/api/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tester-token": aiToken,
      },
      body: JSON.stringify({
        video_url: videoUrl,
        report_meta: report_meta || {},
        project: projectContext,
        tester_email: req.testerEmail || "",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("AI engine /api/report error:", { status: response.status });
      return res.status(502).json({ error: "AI engine error" });
    }

    res.json(data);
  } catch (err) {
    console.error("Backend /report/google-doc error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- REPORT DOWNLOAD PROXY (PDF / DOCX) ----------
// GET /api/projects/:id/download/pdf?doc_url=<google-doc-url>
// GET /api/projects/:id/download/docx?doc_url=<google-doc-url>
//
// Proxies an export request to the AI engine so the mobile app can receive
// a PDF or Word file directly without needing a Google account.
// The :id segment is kept for semantic clarity and future ownership checks;
// the doc_id is extracted from the ?doc_url query parameter.
app.get("/api/projects/:id/download/:format", async (req, res) => {
  const { format } = req.params;
  if (!["pdf", "docx"].includes(format)) {
    return res.status(400).json({ error: "format must be 'pdf' or 'docx'" });
  }

  const docUrl = req.query.doc_url;
  if (!docUrl) {
    return res.status(400).json({ error: "doc_url query parameter is required" });
  }

  // Extract the document ID from the Google Docs URL
  const match = String(docUrl).match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    return res.status(400).json({ error: "Invalid Google Doc URL" });
  }
  const docId = match[1];

  const aiEngineUrl = process.env.AI_ENGINE_URL;
  if (!aiEngineUrl) {
    return res.status(503).json({ error: "AI engine not configured" });
  }

  try {
    const aiToken = process.env.AI_ENGINE_TOKEN || "";
    const aiRes = await fetch(
      `${aiEngineUrl}/api/export/${encodeURIComponent(docId)}?format=${format}`,
      { headers: { "x-tester-token": aiToken } }
    );

    if (!aiRes.ok) {
      const body = await aiRes.text();
      console.error(`AI engine /api/export error (${aiRes.status}):`, body.slice(0, 200));
      return res.status(502).json({ error: "Export failed" });
    }

    const ext = format === "pdf" ? "pdf" : "docx";
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="report.${ext}"`);

    const buffer = await aiRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Backend /download error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ORPHANED MEDIA CLEANUP ----------
// Sweep on boot + every few hours: deletes media files that have not been
// referenced by any project for longer than the grace period.
const { startMediaSweepScheduler } = require("./mediaCleanup");
startMediaSweepScheduler();

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
