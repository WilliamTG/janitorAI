// shareUtils.js – pure crypto/validation helpers for PIN-protected share links.
// Kept free of Express/DB imports so the whole file is unit-testable with node.

const crypto = require("crypto");

const PIN_LENGTH = 6;
const VIEW_TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // one recipient session
const MAX_PIN_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function generateShareId() {
  return crypto.randomBytes(16).toString("base64url");
}

function generatePin() {
  // crypto.randomInt avoids modulo bias; pad keeps leading zeros.
  return String(crypto.randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
}

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

// scrypt slows offline brute force of the 10^6 PIN space; the online path is
// additionally capped by the attempt limiter below.
function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 32).toString("hex");
}

function pinMatches(pin, salt, expectedHash) {
  const actual = Buffer.from(hashPin(pin, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function signPayload(share, exp) {
  return crypto
    .createHmac("sha256", share.pin_hash)
    .update(`${share.id}.${exp}`)
    .digest("base64url");
}

// View token = "<expEpochMs>.<hmac>", verifiable from the share row alone, so
// it survives server restarts and dies with revocation (row check) and expiry.
function createViewToken(share, now = Date.now()) {
  const shareExpiry = new Date(share.expires_at).getTime();
  const exp = Math.min(now + VIEW_TOKEN_TTL_MS, shareExpiry);
  return `${exp}.${signPayload(share, exp)}`;
}

function verifyViewToken(share, token, now = Date.now()) {
  if (typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < now) return false;
  if (new Date(share.expires_at).getTime() < now) return false;
  const expected = Buffer.from(signPayload(share, exp));
  const actual = Buffer.from(sig);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// ── PIN attempt limiter (in-memory, per share) ───────────────────────────────
// A restart resets counters, which only ever helps an attacker by MAX_PIN_ATTEMPTS
// extra guesses per restart — acceptable against a 10^6 space.

const attempts = new Map(); // shareId -> { count, resetAt }

function attemptsFor(shareId, now = Date.now()) {
  const entry = attempts.get(shareId);
  if (!entry || entry.resetAt <= now) return { count: 0, resetAt: now + ATTEMPT_WINDOW_MS };
  return entry;
}

function isLockedOut(shareId, now = Date.now()) {
  return attemptsFor(shareId, now).count >= MAX_PIN_ATTEMPTS;
}

function registerFailedAttempt(shareId, now = Date.now()) {
  const entry = attemptsFor(shareId, now);
  entry.count += 1;
  attempts.set(shareId, entry);
  return entry;
}

function clearAttempts(shareId) {
  attempts.delete(shareId);
}

module.exports = {
  PIN_LENGTH,
  MAX_PIN_ATTEMPTS,
  ATTEMPT_WINDOW_MS,
  VIEW_TOKEN_TTL_MS,
  generateShareId,
  generatePin,
  generateSalt,
  hashPin,
  pinMatches,
  createViewToken,
  verifyViewToken,
  isLockedOut,
  registerFailedAttempt,
  clearAttempts,
};
