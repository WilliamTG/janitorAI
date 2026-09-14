// mediaTypes.js – trygg MIME-avledning for opplastede mediefiler.
//
// Sikkerhet (revisjon S7): klientens Content-Type ble tidligere lagret rått og
// spilt av inline ved nedlasting. En eier kunne da laste opp text/html og få
// det rendret på API-/delings-origin (lagret XSS). Vi avleder derfor MIME kun
// fra en whitelistet filendelse — aldri fra klienten — og serverer alltid med
// X-Content-Type-Options: nosniff.

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".webm": "video/webm",
  ".caf": "audio/x-caf",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  // iPhone tar opp video som QuickTime (.mov). Uten disse ble endelsen
  // strippet ved lagring, MIME ble application/octet-stream, videotaket ble
  // fototaket (50 MB) — og Gemini avviste rapportkjøringen med
  // «Unsupported MIME type: application/octet-stream» (pilotfunn 28.08).
  ".mov": "video/quicktime",
  ".qt": "video/quicktime",
  // Safari-web kan navngi etter blob-MIME: video/quicktime → «video.quicktime».
  ".quicktime": "video/quicktime",
  ".m4v": "video/mp4",
};

// Avled en trygg MIME-type fra en filendelse (med punktum, små bokstaver).
// Ukjente/manglende endelser faller til application/octet-stream, som nettleseren
// aldri rendrer som HTML — trygt som standard.
function safeMimeForExt(ext) {
  return MIME_BY_EXT[String(ext || "").toLowerCase()] || "application/octet-stream";
}

// Sett trygge medie-headere ved servering: den avledede (whitelistede) MIME-en
// pluss nosniff, slik at en feillagret verdi aldri kan sniffes til aktivt innhold.
function applySafeMediaHeaders(res, mimeType) {
  const safe =
    typeof mimeType === "string" && Object.values(MIME_BY_EXT).includes(mimeType)
      ? mimeType
      : "application/octet-stream";
  res.type(safe);
  res.set("X-Content-Type-Options", "nosniff");
}

module.exports = { MIME_BY_EXT, safeMimeForExt, applySafeMediaHeaders };
