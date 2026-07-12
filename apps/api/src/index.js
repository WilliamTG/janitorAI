// index.js – backend for inspection MVP

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { createDocxBuffer } = require("@janitorai/docx-builder");
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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const OPENAI_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

if (!OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is not set in .env");
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
  "/report",
  "/report/docx",
  "/report/google-doc",
  "/transcribe",
  "/describe-image",
]);
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

// ---------- REPORT GENERATION ----------
const REPORT_SYSTEM_PROMPT = `
You are an AI assistant that writes clear, professional inspection reports.

You receive:
- Project metadata (project name, inspection date, inspector).
- A list of raw observations with text notes and optional transcriptions.

Write a concise, structured inspection report with these sections:

1. Inspection Overview
2. Scope and Method
3. Detailed Findings (grouped logically, with Low/Medium/High severity and suggested actions)
4. Recommended Actions and Priorities
5. Remarks and Limitations

Do not invent facts, measurements or regulations that are not in the input.
`;

app.post("/report", heavyLimiter, async (req, res) => {
  try {
    const { project, notes } = req.body;

    if (!project || !notes || !Array.isArray(notes)) {
      return res.status(400).json({ error: "Missing project or notes" });
    }

    const observationsText = notes
      .map((note, index) => {
        const base = `Observation ${index + 1} (created at ${
          note.createdAt
        }):\nText note: ${note.text || "(no text)"}\n`;
        const transcriptionPart = note.transcription
          ? `Transcription: ${note.transcription}\n`
          : "";
        let photoPart = "";
        if (note.photos && note.photos.length > 0) {
          photoPart = "Photos:\n" + note.photos.map((p, i) => 
            `  Photo ${i + 1}: ${p.caption || "(no description)"}`
          ).join("\n") + "\n";
        } else if (note.legacyImagesCount && note.legacyImagesCount > 0) {
          photoPart = `Photos attached: ${note.legacyImagesCount} (no descriptions)\n`;
        }
        return base + transcriptionPart + photoPart;
      })
      .join("\n--------------------\n");

    const hasDescriptionContext =
      Boolean(project.descriptionText) || Boolean(project.descriptionTranscription);

    const descriptionBlock = hasDescriptionContext
      ? `\nProject description/context:\n${
          project.descriptionText ? `- Text: ${project.descriptionText}\n` : ""
        }${
          project.descriptionTranscription
            ? `- Transcription: ${project.descriptionTranscription}\n`
            : ""
        }`
      : "";

    // Build a structured block from per-project report metadata (filled in by inspector)
    const rm = project.reportMeta || {};
    const rmLines = [];
    if (rm.caseNumber) rmLines.push(`- Case number: ${rm.caseNumber}`);
    if (rm.customerName) rmLines.push(`- Customer: ${rm.customerName}`);
    if (rm.addressStreet || rm.addressPostcodeCity)
      rmLines.push(`- Address: ${[rm.addressStreet, rm.addressPostcodeCity].filter(Boolean).join(", ")}`);
    if (rm.damageDate) rmLines.push(`- Damage date: ${rm.damageDate}`);
    if (rm.insuranceCompany) rmLines.push(`- Insurance: ${rm.insuranceCompany}`);
    if (rm.possibleRecourse) rmLines.push(`- Possible recourse: ${rm.possibleRecourse}`);
    if (rm.startedRepairs) rmLines.push(`- Started repairs: ${rm.startedRepairs}`);
    if (rm.summaryText) rmLines.push(`- Summary note from inspector: ${rm.summaryText}`);
    const reportMetaBlock = rmLines.length
      ? `\nCase metadata (from inspector):\n${rmLines.join("\n")}\n`
      : "";

    const userContent = `
Project metadata:
- Project name: ${project.name}
- Inspection date: ${project.inspectionDate}
- Inspector: ${project.inspector}

${descriptionBlock}${reportMetaBlock}
Project focus reminder: Use the project description/context (if provided) to orient the report before reviewing raw observations.

Raw observations:
${observationsText}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_CHAT_MODEL,
        messages: [
          { role: "system", content: REPORT_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error("OpenAI /report error: non-OK response", { status: response.status, length: raw ? raw.length : 0 });
      return res.status(500).json({ error: "OpenAI error" });
    }

    const data = JSON.parse(raw);
    const reportText = data.choices?.[0]?.message?.content?.trim();

    if (!reportText) {
      return res
        .status(500)
        .json({ error: "No report text returned from OpenAI" });
    }

    res.json({ report: reportText });
  } catch (err) {
    console.error("Backend /report error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- REPORT DOCX EXPORT ----------
app.post("/report/docx", heavyLimiter, async (req, res) => {
  try {
    const { reportText, project } = req.body || {};

    if (!reportText || !project || !project.name) {
      return res.status(400).json({ error: "Missing report text or project" });
    }

    const subtitleParts = [];
    if (project.inspectionDate) subtitleParts.push(project.inspectionDate);
    if (project.inspector) subtitleParts.push(project.inspector);
    const subtitle = subtitleParts.filter(Boolean).join(" — ");

    const paragraphs = String(reportText)
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);

    const buffer = await createDocxBuffer({
      title: project.name,
      subtitle,
      paragraphs,
    });

    const safeName = project.name.replace(/[\\/:*?"<>|]+/g, "_") || "Project";

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Inspection Report - ${safeName}.docx"`,
    });

    res.send(buffer);
  } catch (err) {
    console.error("Backend /report/docx error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- TRANSCRIPTION ----------
app.post("/transcribe", heavyLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;

  try {
    // Read uploaded file into memory (small recordings are fine)
    const buffer = await fs.promises.readFile(filePath);

    // Use Node 18+ built-in FormData + Blob (NOT the form-data package)
    const fd = new FormData();
    fd.append(
      "file",
      new Blob([buffer], { type: req.file.mimetype || "audio/mp4" }),
      req.file.originalname || "audio.m4a"
    );
    fd.append("model", OPENAI_TRANSCRIBE_MODEL);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        // IMPORTANT: do NOT set Content-Type manually here
      },
      body: fd,
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error("OpenAI /transcribe error: non-OK response", { status: response.status, length: raw ? raw.length : 0 });
      return res.status(500).json({ error: "OpenAI error" });
    }

    const data = JSON.parse(raw);
    const text = data.text;

    if (!text) {
      return res
        .status(500)
        .json({ error: "No text returned from transcription API" });
    }

    res.json({ text });
  } catch (err) {
    console.error("Backend /transcribe error:", sanitizeError(err));
    res.status(500).json({ error: "Server error" });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// ---------- IMAGE DESCRIPTION ----------
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

const VISION_SYSTEM_PROMPT = `You are an inspection assistant analyzing photos from building/facility inspections.
Describe what is visible in the image in 1-3 sentences. Focus on:
1. What is shown (object, area, condition)
2. Any visible issues or observations
3. Suggested severity (Low/Medium/High) and recommended action if applicable
Be concise and professional.`;

app.post("/describe-image", heavyLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;

  try {
    const buffer = await fs.promises.readFile(filePath);
    const base64 = buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_VISION_MODEL,
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl }
              },
              {
                type: "text",
                text: "Describe this inspection photo."
              }
            ]
          }
        ],
        max_tokens: 300
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error("OpenAI /describe-image error: non-OK response", { status: response.status });
      return res.status(500).json({ error: "OpenAI error" });
    }

    const data = JSON.parse(raw);
    const description = data.choices?.[0]?.message?.content?.trim();

    if (!description) {
      return res.status(500).json({ error: "No description returned from OpenAI" });
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
    const { report_meta, video_filename } = req.body;
    const token = req.headers["x-tester-token"];

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
    const videoUrl = `${apiBaseUrl}/api/media/${video_filename}?token=${encodeURIComponent(
      req.testerToken || ""
    )}`;

    const response = await fetch(`${aiEngineUrl}/api/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tester-token": token || "",
      },
      body: JSON.stringify({
        video_url: videoUrl,
        report_meta: report_meta || {},
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

// ---------- ORPHANED MEDIA CLEANUP ----------
// Sweep on boot + every few hours: deletes media files that have not been
// referenced by any project for longer than the grace period.
const { startMediaSweepScheduler } = require("./mediaCleanup");
startMediaSweepScheduler();

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
