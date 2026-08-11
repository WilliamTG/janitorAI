// mediaSign.js – korte, signerte medie-URL-er for maskin-til-maskin-henting.
//
// Sikkerhet (revisjon S10): tidligere ble tester-tokenet lagt i ?token= på
// medie-URL-ene som ble sendt til AI-motoren. Da kunne et langlivet token havne
// i AI-motorens logger eller mellomliggende edge-logger. I stedet signerer vi en
// kortlevd URL som autoriserer ÉN bestemt medie-ID: tokenet forlater aldri
// API-serveren, og signaturen utløper etter noen minutter.

const crypto = require("crypto");

// Nøkkelen kan settes eksplisitt (MEDIA_URL_SECRET) for at signaturer skal
// overleve omstart og deles mellom instanser. Uten den lager vi en tilfeldig
// nøkkel i minnet — trygt fordi disse URL-ene konsumeres av AI-motoren i løpet
// av sekunder etter at de utstedes.
let KEY = process.env.MEDIA_URL_SECRET || null;
if (!KEY) {
  KEY = crypto.randomBytes(32).toString("hex");
  console.log(
    "MEDIA_URL_SECRET ikke satt — bruker en efemer signeringsnøkkel i minnet " +
      "(signerte medie-URL-er overlever ikke omstart; sett MEDIA_URL_SECRET i drift)."
  );
}

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutter

function computeSig(mediaId, exp) {
  return crypto
    .createHmac("sha256", KEY)
    .update(`${mediaId}.${exp}`)
    .digest("base64url");
}

// Returner { exp, sig } for en medie-ID.
function signMedia(mediaId, ttlMs = DEFAULT_TTL_MS) {
  const exp = Date.now() + ttlMs;
  return { exp, sig: computeSig(String(mediaId), exp) };
}

// Bygg en komplett signert URL som AI-motoren kan hente uten headere.
function signedMediaUrl(baseUrl, mediaId, ttlMs = DEFAULT_TTL_MS) {
  const { exp, sig } = signMedia(mediaId, ttlMs);
  return `${baseUrl}/api/media/${encodeURIComponent(mediaId)}?exp=${exp}&sig=${sig}`;
}

// Verifiser signatur + utløp for en gitt medie-ID (timing-sikker).
function verifyMedia(mediaId, exp, sig) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  if (typeof sig !== "string" || !sig) return false;
  const expected = computeSig(String(mediaId), expNum);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { signMedia, signedMediaUrl, verifyMedia };
