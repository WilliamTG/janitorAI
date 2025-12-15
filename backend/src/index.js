// index.js – backend for inspection MVP

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const OPENAI_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

if (!OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is not set in .env");
}

// Multer config for uploads (audio)
const upload = multer({ dest: "uploads/" });

// ---------- HEALTH CHECK ----------
app.get("/", (req, res) => {
  res.send("Inspection backend is running ✅");
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

app.post("/report", async (req, res) => {
  console.log("Received POST /report request");
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
        const imagePart =
          note.imagesCount && note.imagesCount > 0
            ? `Photos attached: ${note.imagesCount}\n`
            : "";
        const videoPart =
          note.videosCount && note.videosCount > 0
            ? `Videos attached: ${note.videosCount}\n`
            : "";
        return base + transcriptionPart + imagePart + videoPart;
      })
      .join("\n--------------------\n");

    const userContent = `
Project metadata:
- Project name: ${project.name}
- Inspection date: ${project.inspectionDate}
- Inspector: ${project.inspector}

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
      console.error("OpenAI /report error:", raw);
      return res.status(500).json({ error: "OpenAI error", details: raw });
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
    console.error("Backend /report error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- TRANSCRIPTION ----------
app.post("/transcribe", upload.single("file"), async (req, res) => {
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
      console.error("OpenAI /transcribe error:", raw);
      return res.status(500).json({ error: "OpenAI error", details: raw });
    }

    const data = JSON.parse(raw);
    const text = data.text;

    if (!text) {
      return res
        .status(500)
        .json({ error: "No text returned from transcription API", details: data });
    }

    res.json({ text });
  } catch (err) {
    console.error("Backend /transcribe error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
