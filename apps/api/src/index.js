// index.js – backend for inspection MVP

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const requireTesterToken = require("./middleware/requireTesterToken");
const { generalLimiter, heavyLimiter } = require("./middleware/rateLimiters");
const requestLogger = require("./middleware/requestLogger");

const { getPool, isDbEnabled } = require("./db");
const { signedMediaUrl } = require("./mediaSign");
const { extractGeminiUsage, recordCost } = require("./costTracking");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

// CORS (S12): standard er åpen (auth er header-token, ikke cookies, så det er
// ingen credentialed CSRF). Sett CORS_ORIGINS=komma,separert,liste i produksjon
// for å låse API-et til webappens og admin-dashbordets origins.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : {}));

// Eksplisitt body-tak (S15): prosjekt-bloben lagres som JSONB; 300kb holder for
// store befaringer med mange notater, og hindrer at en klient dytter inn
// vilkårlig store payloads.
app.use(express.json({ limit: "300kb" }));

// ---------- SIKKERHETS-HEADERE (OWASP: Security Misconfiguration) ----------
// Nøkterne, alltid-trygge headere på alt: hindrer MIME-sniffing, clickjacking
// og referrer-lekkasje. (CSP holdes utenfor her fordi de statiske HTML-sidene
// bruker inline-script; kan legges på per-side senere.)
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ---------- REQUEST LOGGER ----------
// Minimal request logging (method, path, status, latency only)
app.use(requestLogger);

// ---------- RATE LIMITING ----------
// Apply general rate limiter globally
app.use(generalLimiter);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

if (!GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY is not set — transcription and image description will fail");
}

// Helper function to sanitize errors for logging (avoid logging full error objects)
function sanitizeError(err) {
  return err && err.message ? err.message : String(err);
}

// Utgående fetch med tidsavbrudd (Denial-of-Wallet-vern): et hengende
// oppstrøms-kall (Gemini/AI-motor) skal aldri holde en forbindelse — og en
// fakturerbar operasjon — åpen i det uendelige. Kaster ved timeout.
function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
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

// Basis-URL for absolutte SEO-lenker: PUBLIC_BASE_URL i drift, ellers request-
// origin (robust uansett hvilket domene som serverer).
function publicBase(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

// Absolutiser SEO-URL-er kirurgisk (OG-protokollen og Googles rich-results krever
// absolutte URL-er): kun og:image, canonical og JSON-LD item/url/logo — aldri
// body-lenker. Injiser og:url. Mønstrene forekommer bare i <head>/ld+json.
function absolutizeSeo(html, base, routePath) {
  html = html
    .replace(/(<meta property="og:image" content=")(\/[^"]*)(")/g, `$1${base}$2$3`)
    .replace(/(<link rel="canonical" href=")(\/[^"]*)(")/g, `$1${base}$2$3`)
    .replace(/("(?:item|url|logo)":")(\/[^"]*)(")/g, `$1${base}$2$3`);
  if (routePath && !/property="og:url"/.test(html) && /<meta property="og:image"/.test(html)) {
    html = html.replace(
      /(<meta property="og:image"[^>]*>\n?)/,
      `$1<meta property="og:url" content="${base}${routePath}" />\n`
    );
  }
  return html;
}

// Server en offentlig salgsside med absolutte SEO-URL-er.
function sendPublicPage(req, res, filename, routePath) {
  fs.readFile(path.join(__dirname, filename), "utf8", (err, html) => {
    if (err) return sendNotFound(req, res);
    res.type("html").send(absolutizeSeo(html, publicBase(req), routePath));
  });
}

// Pitch-, skisse- og sammenstillings-sidene er skrevet uten dokumentskall
// (de publiseres også som artifacts); pakk dem inn her så nettleseren
// rendrer i standards mode.
// /kundereisen er bevisst offentlig (lenket + i sitemap); resten er interne
// pitch-/strategisider som ikke skal indekseres selv om URL-en lekker.
const PUBLIC_PRESENTATION = new Set(["kundereisen.html"]);
function sendPresentationPage(req, res, filename, routePath) {
  const file = path.join(__dirname, "../../../presentation", filename);
  fs.readFile(file, "utf8", (err, html) => {
    if (err) return res.status(404).json({ error: "Not found" });
    const isPublic = PUBLIC_PRESENTATION.has(filename);
    if (!isPublic) res.set("X-Robots-Tag", "noindex");
    if (isPublic) html = absolutizeSeo(html, publicBase(req), routePath);
    res.type("html").send('<!DOCTYPE html>\n<html lang="nb">\n' + html + "\n</html>");
  });
}

app.get("/kundereisen", (req, res) => sendPresentationPage(req, res, "kundereisen.html", "/kundereisen"));
// Gammelt navn på kundereise-siden — behold som alias.
app.get("/pitch", (req, res) => sendPresentationPage(req, res, "kundereisen.html", "/kundereisen"));
app.get("/losningsskisse", (req, res) => sendPresentationPage(req, res, "losningsskisse.html"));
app.get("/ui-endringer", (req, res) => sendPresentationPage(req, res, "ui-endringer.html"));
app.get("/underlag-demo", (req, res) => sendPresentationPage(req, res, "underlag-demo.html"));
app.get("/totalbilde", (req, res) => sendPresentationPage(req, res, "totalbilde.html"));
app.get("/ui-total", (req, res) => sendPresentationPage(req, res, "ui-total.html"));
app.get("/fargealternativer", (req, res) => sendPresentationPage(req, res, "fargealternativer.html"));

// ---------- SHARE PAGE (public HTML shell; data endpoints gate on PIN) ------
// Registered before the static/SPA fallback so /share/:id is never swallowed
// by the web app's index.html.
app.get("/share/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "share-page.html"));
});

// ---------- DEMO (public — kampanjekroken, inkorporering A4) ----------------
// /demo?adresse=… viser saksunderlaget for en adresse uten innlogging.
// Absolutte SEO-URL-er via sendPublicPage (OG-preview krever absolutt og:image).
app.get("/demo", (req, res) => sendPublicPage(req, res, "demo-page.html", "/demo"));

// ---------- OM/SALGSSIDE (public — Befar/Wenn-mønsteret) --------------------
// Landingsside med verdiløfte, prisnivåer og prøv-selv-inngang til /demo.
app.get("/om", (req, res) => sendPublicPage(req, res, "om-page.html", "/om"));

// ---------- KONTAKT (public — L2X-mønsteret: book møte eller e-post) --------
// To tydelige veier inn: 15-min introduksjonsmøte og e-post. Booking-lenken
// settes med BOOKING_URL (f.eks. Microsoft Bookings/Calendly); uten den faller
// knappen ærlig tilbake til e-post der vi foreslår tidspunkt.
app.get("/kontakt", (req, res) => {
  fs.readFile(path.join(__dirname, "kontakt-page.html"), "utf8", (err, html) => {
    if (err) return sendNotFound(req, res);
    const booking = (process.env.BOOKING_URL || "").trim().replace(/"/g, "%22");
    const mailto =
      "mailto:fdalen.97@gmail.com?subject=" +
      encodeURIComponent("Introduksjonsmøte om DocrAI (15 min)") +
      "&body=" +
      encodeURIComponent("Hei!\n\nJeg vil gjerne ta et kort introduksjonsmøte om DocrAI. Tidspunkter som passer for meg:\n\n1.\n2.\n");
    html = html
      .replace("__BOOKING_HREF__", () => (booking || mailto))
      .replace("__BOOKING_TARGET__", () => (booking ? ' target="_blank" rel="noopener"' : ""))
      .replace("__BOOKING_NOTE__", () =>
        booking
          ? "Åpner bookingkalenderen i en ny fane."
          : "Knappen starter en e-post – foreslå tidspunkter, så bekrefter vi innen én virkedag."
      );
    res.type("html").send(absolutizeSeo(html, publicBase(req), "/kontakt"));
  });
});

// ---------- LANSERINGSSIDER (public — FAQ, personvern, takk, robots, og) ----
app.get("/faq", (req, res) => sendPublicPage(req, res, "faq-page.html", "/faq"));
app.get("/personvern", (req, res) => sendPublicPage(req, res, "personvern-page.html", "/personvern"));
app.get("/takk", (req, res) => {
  res.sendFile(path.join(__dirname, "takk-page.html"));
});
app.get("/vilkar", (req, res) => sendPublicPage(req, res, "vilkar-page.html", "/vilkar"));
app.get("/robots.txt", require("./routes/publikum").robotsHandler);
// Sitemap (SEO): kun de offentlige, indekserbare salgssidene.
app.get("/sitemap.xml", (req, res) => {
  const base =
    process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const paths = ["/om", "/demo", "/faq", "/personvern", "/vilkar", "/kontakt", "/kundereisen"];
  const urls = paths
    .map((p) => `  <url><loc>${base}${p}</loc></url>`)
    .join("\n");
  res
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    );
});
app.get("/og-bilde.png", (req, res) => {
  res.sendFile(path.join(__dirname, "assets/og-bilde.png"));
});
// Favicon (W9): egen merkevare-ikon i tre størrelser. /favicon.ico peker på
// PNG-en — nettlesere godtar det, og vi slipper 401 fra token-vakten.
app.get(["/favicon.ico", "/favicon.png"], (req, res) => {
  res.sendFile(path.join(__dirname, "assets/favicon.png"));
});
app.get("/apple-touch-icon.png", (req, res) => {
  res.sendFile(path.join(__dirname, "assets/apple-touch-icon.png"));
});
app.get("/apple-touch-icon-precomposed.png", (req, res) => {
  res.sendFile(path.join(__dirname, "assets/apple-touch-icon.png"));
});

// Merkevare-404 for HTML-forespørsler som ikke traff noen rute; JSON-klienter
// får fortsatt JSON. Registrert som funksjon så både SPA-fallback og halen
// kan bruke den.
function sendNotFound(req, res) {
  const acceptsHtml = (req.get("accept") || "").includes("text/html");
  if (req.method === "GET" && acceptsHtml && !req.path.startsWith("/api/")) {
    return res.status(404).sendFile(path.join(__dirname, "404-page.html"));
  }
  res.status(404).json({ error: "Not found" });
}

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

// HTML-forespørsler som ikke traff noen side (og ikke ble tatt av SPA-
// fallbacken over) skal ha merkevare-404 — ikke 401 fra token-vakten lenger
// ned. API-stier går videre til sine egne feilsvar.
app.use((req, res, next) => {
  const acceptsHtml = (req.get("accept") || "").includes("text/html");
  if (req.method === "GET" && acceptsHtml && !req.path.startsWith("/api/")) {
    return sendNotFound(req, res);
  }
  next();
});

// ---------- MEDIA (own auth: header or ?token= query) ----------
// Mounted before the global guard because media URLs are used directly in
// <Image>/audio players, which cannot set custom headers.
const mediaRouter = require("./routes/media");
app.use("/api/media", mediaRouter);

// ---------- SHARE LINKS (mixed auth: create/revoke need tester token, the
// recipient endpoints gate on PIN + view token) ----------
const shareRouter = require("./routes/share");
app.use("/api/share", shareRouter);

// ---------- PUBLIKUM (public: pilotskjema + cookiefri besøkstelling) --------
app.use("/api", require("./routes/publikum"));

// ---------- KARTFLIS-PROXY (public: <img> kan ikke sette headere) ----------
app.get("/api/flis/:z/:y/:x", require("./routes/underlag").tileHandler);
// Demo-underlaget er offentlig, men bak heavyLimiter (30 kall/15 min per IP)
// så det ikke kan misbrukes som gratis oppslagsproxy.
app.get("/api/demo/underlag", heavyLimiter, require("./routes/underlag").demoHandler);

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

// ---------- SAKSUNDERLAG (PROTECTED, proxyer offentlige API-er) ----------
const underlagRouter = require("./routes/underlag");
app.use("/api/underlag", underlagRouter);

// ---------- WHOAMI (PROTECTED) ----------
app.get("/whoami", (req, res) => {
  res.json({ authorized: true });
});

// ---------- TRANSCRIPTION (Gemini) ----------
// Norsk fagterm-hint (inkorporering A2): befaringstale er bokmål/dialekt med
// byggteknisk vokabular som generiske STT-modeller feiltolker. Termlisten
// styrer modellen mot riktig fagspråk; mål og romnavn skal gjengis ordrett.
const TRANSCRIPTION_PROMPT = [
  "Transkriber lydopptaket ordrett på norsk (bokmål).",
  "Dette er tale fra en takstperson på skadebefaring i en bygning, ofte med",
  "dialekt og bakgrunnsstøy. Vanlige fagord som skal gjenkjennes korrekt:",
  "sluk, klemring, membran, smøremembran, svill, bunnsvill, toppsvill,",
  "diffusjonssperre, dampsperre, vindsperre, fuktsperre, grunnmurspapp,",
  "drenering, drensrør, kapillærbrytende, fuktskjolder, fuktmåling, hulltaking,",
  "krypkjeller, kryperom, bjelkelag, tilfarergulv, påstøp, avretting,",
  "våtromsnormen, våtsone, downlights, rørgjennomføring, rør-i-rør, fordelerskap,",
  "vannbåren varme, varmekabler, flis, fug, silikonfug, gips, sponplate, OSB,",
  "råte, muggsopp, svertesopp, saltutslag, kalkutfelling, betong, lettklinker,",
  "leca, ringmur, radonsperre, takstein, undertak, sutak, lekt, sløyfe,",
  "beslag, takrenne, nedløp, terrengfall, kotehøyde, gradvis, akutt.",
  "Gjengi tall, måleverdier (f.eks. «78 prosent», «15 millimeter») og romnavn",
  "ordrett. Returner kun de talte ordene, uten kommentarer.",
].join(" ");

app.post("/transcribe", heavyLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;
  const startedAt = Date.now();

  try {
    const buffer = await fs.promises.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mimeType = req.file.mimetype || "audio/mp4";

    const response = await fetchWithTimeout(GEMINI_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: TRANSCRIPTION_PROMPT },
          ],
        }],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      // Diagnose (pilotfunn 25.08): statuskoden avgjør tiltaket — 429 = kvote
      // brukt opp, 400/403 = nøkkelproblem. Logg et utdrag av Gemini-svaret
      // (aldri nøkkelen) og send status videre så appen/testeren kan skille
      // «prøv igjen senere» fra «kontakt admin».
      console.error("Gemini /transcribe error:", {
        status: response.status,
        body: raw ? raw.slice(0, 300) : "",
      });
      return res.status(502).json({ error: "Gemini error", geminiStatus: response.status });
    }

    const data = JSON.parse(raw);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return res.status(500).json({ error: "No transcription returned from Gemini" });
    }

    // COGS-måling (fire-and-forget, blokkerer aldri svaret).
    recordCost({
      testerToken: req.testerToken,
      operation: "transcribe",
      model: GEMINI_MODEL,
      usage: extractGeminiUsage(data),
      durationMs: Date.now() - startedAt,
    }).catch(() => {});

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
  const startedAt = Date.now();

  try {
    const buffer = await fs.promises.readFile(filePath);
    const base64 = buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    const response = await fetchWithTimeout(GEMINI_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
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
      // Samme diagnose-mønster som /transcribe: status + utdrag i loggen,
      // status videre i svaret.
      console.error("Gemini /describe-image error:", {
        status: response.status,
        body: raw ? raw.slice(0, 300) : "",
      });
      return res.status(502).json({ error: "Gemini error", geminiStatus: response.status });
    }

    const data = JSON.parse(raw);
    const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!description) {
      return res.status(500).json({ error: "No description returned from Gemini" });
    }

    recordCost({
      testerToken: req.testerToken,
      operation: "describe_image",
      model: GEMINI_MODEL,
      usage: extractGeminiUsage(data),
      durationMs: Date.now() - startedAt,
    }).catch(() => {});

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

    // Video is optional. When supplied, verify that it belongs to this tester
    // before allowing the AI engine to fetch it.
    if (video_filename && video_filename !== "demo" && isDbEnabled()) {
      const pool = getPool();
      const ownsVideo = await pool.query(
        "SELECT 1 FROM media WHERE id = $1 AND tester_token = $2",
        [String(video_filename), token]
      );
      if (ownsVideo.rows.length === 0) {
        return res.status(404).json({ status: "error", message: "Video not found for this tester." });
      }
    }

    // When supplied, build a short-lived URL the AI engine can use to download
    // the video directly from this API server's media storage. A report may
    // instead be generated from notes, transcriptions, photos, and metadata.
    const apiBaseUrl =
      process.env.API_BASE_URL ||
      `${req.protocol}://${req.get("host")}`;
    const videoUrl =
      video_filename && video_filename !== "demo"
        ? signedMediaUrl(apiBaseUrl, video_filename)
        : null;

    // Resolve photo URIs to absolute URLs and strip empty fields so the AI
    // engine receives a clean, self-contained context object.
    // A1: romnavnet følger notatet — rommet er konteksten som skiller
    // «fukt ved sluk på badet» fra «fukt i boden», og styrer hvilket
    // Byggforsk-delsett som er relevant.
    const roomsById = new Map(
      (Array.isArray(project?.rooms) ? project.rooms : [])
        .filter((r) => r && r.id && r.name)
        .map((r) => [String(r.id), String(r.name)])
    );

    // S3/S10: bare foto denne testeren faktisk eier skal signeres og sendes til
    // AI-motoren. Videoen eierskapssjekkes over; her verifiseres alle foto-
    // remoteId-er i én spørring, og ikke-eide utelates (kan ellers omgå tenant-
    // skopingen fordi signert media-GET slår opp på id alene).
    const requestedPhotoIds = [
      ...new Set(
        (Array.isArray(project?.notes) ? project.notes : [])
          .flatMap((n) => (Array.isArray(n.photos) ? n.photos : []))
          .map((p) => (p && p.remoteId ? String(p.remoteId) : null))
          .filter(Boolean)
      ),
    ];
    let ownedPhotoIds = new Set();
    if (isDbEnabled() && requestedPhotoIds.length > 0) {
      const owned = await getPool().query(
        "SELECT id FROM media WHERE id = ANY($1) AND tester_token = $2",
        [requestedPhotoIds, token]
      );
      ownedPhotoIds = new Set(owned.rows.map((r) => String(r.id)));
    }

    const enrichedNotes = (Array.isArray(project?.notes) ? project.notes : [])
      .map((note) => {
        const enrichedPhotos = (Array.isArray(note.photos) ? note.photos : [])
          .filter((p) => p && (p.uri || p.remoteId))
          .map((p) => {
            // Signer bare eide foto; lokale uri-er (ikke synket ennå) sendes som
            // de er; ikke-eide remoteId-er droppes.
            let uri;
            if (p.remoteId) {
              if (!ownedPhotoIds.has(String(p.remoteId))) return null;
              uri = signedMediaUrl(apiBaseUrl, p.remoteId);
            } else {
              uri = String(p.uri);
            }
            return {
              uri,
              ...(p.caption ? { caption: p.caption } : {}),
            };
          })
          .filter(Boolean);

        const enriched = {};
        if (note.text) enriched.text = note.text;
        if (note.transcription) enriched.transcription = note.transcription;
        if (note.roomId && roomsById.has(String(note.roomId))) {
          enriched.room = roomsById.get(String(note.roomId));
        }
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
    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      `${aiEngineUrl}/api/report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tester-token": aiToken,
        },
        body: JSON.stringify({
          ...(videoUrl ? { video_url: videoUrl } : {}),
          report_meta: report_meta || {},
          project: projectContext,
          tester_email: req.testerEmail || "",
        }),
      },
      120000 // rapportgenerering er tung — 2 min
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("AI engine /api/report error:", { status: response.status });
      return res.status(502).json({ error: "AI engine error" });
    }

    // COGS: AI-motoren returnerer token_usage fra Gemini-analysen (den store
    // kostnadsdriveren). Fire-and-forget.
    const tu = data && data.token_usage;
    if (tu) {
      recordCost({
        testerToken: req.testerToken,
        operation: "report",
        model: tu.model || "gemini-2.5-flash",
        usage: {
          input: tu.input_tokens || 0,
          output: tu.output_tokens || 0,
          total: tu.total_tokens || (tu.input_tokens || 0) + (tu.output_tokens || 0),
        },
        durationMs: Date.now() - startedAt,
      }).catch(() => {});
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
//
// Eierskap (S4): AI-motorens /api/export eksporterer via en servicekonto som
// kan nå et hvilket som helst dokument. Vi stoler derfor ALDRI på ?doc_url fra
// klienten — dokument-ID-en avledes fra prosjektets lagrede reportUrl, slått opp
// skopet på denne testerens token. Da kan ingen tester eksportere en annens
// rapport ved å gjette/lekke en doc-URL.
app.get("/api/projects/:id/download/:format", async (req, res) => {
  const { id, format } = req.params;
  if (!["pdf", "docx"].includes(format)) {
    return res.status(400).json({ error: "format must be 'pdf' or 'docx'" });
  }

  if (!isDbEnabled()) {
    return res.status(503).json({ error: "Persistence not configured" });
  }

  const pool = getPool();
  const owned = await pool.query(
    "SELECT data FROM projects WHERE id = $1 AND tester_token = $2",
    [String(id), req.testerToken]
  );
  if (owned.rows.length === 0) {
    return res.status(404).json({ error: "Project not found" });
  }

  const reportUrl = (owned.rows[0].data || {}).reportUrl;
  const match = String(reportUrl || "").match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    return res.status(409).json({
      error: "Report not generated yet",
      message:
        "Generer og synkroniser rapporten før nedlasting — ingen lagret rapportlenke for dette prosjektet.",
    });
  }
  const docId = match[1];

  const aiEngineUrl = process.env.AI_ENGINE_URL;
  if (!aiEngineUrl) {
    return res.status(503).json({ error: "AI engine not configured" });
  }

  try {
    const aiToken = process.env.AI_ENGINE_TOKEN || "";
    const aiRes = await fetchWithTimeout(
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

// ---------- 404 (alt som ikke traff noen rute) ----------
app.use(sendNotFound);

// ---------- GLOBAL FEILHÅNDTERER (S17) ----------
// Uten denne faller JSON-parsefeil (uautentisert nåbar) og multer-feil til
// Express' innebygde handler, som legger err.stack (med serverfilstier) i
// responskroppen når NODE_ENV ikke er "production". Vi returnerer alltid en
// generisk melding og logger detaljene serverside.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("Unhandled error:", req.method, req.path, sanitizeError(err));
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large", code: "FILE_TOO_LARGE" });
  }
  res.status(err && err.status ? err.status : 500).json({ error: "Server error" });
});

// ---------- ORPHANED MEDIA CLEANUP ----------
// Sweep on boot + every few hours: deletes media files that have not been
// referenced by any project for longer than the grace period.
const { startMediaSweepScheduler } = require("./mediaCleanup");
startMediaSweepScheduler();

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  // Opprett skjemaet ved oppstart (idempotent) i stedet for kun lazy via
  // requireDb, så alle tabeller — inkl. cost_events — finnes umiddelbart.
  if (isDbEnabled()) {
    require("./db")
      .initDb()
      .catch((err) => console.error("initDb at boot failed:", err && err.message));
  }
});
