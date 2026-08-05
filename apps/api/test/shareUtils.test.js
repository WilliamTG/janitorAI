// Unit tests for shareUtils — plain node, no framework:
//   node test/shareUtils.test.js
// Exits non-zero on the first failure.

const assert = require("assert");
const {
  PIN_LENGTH,
  MAX_PIN_ATTEMPTS,
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
} = require("../src/shareUtils");

function makeShare(overrides = {}) {
  const salt = generateSalt();
  return {
    id: generateShareId(),
    pin_salt: salt,
    pin_hash: hashPin("123456", salt),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    revoked: false,
    ...overrides,
  };
}

// PIN generation shape
for (let i = 0; i < 200; i++) {
  const pin = generatePin();
  assert.strictEqual(pin.length, PIN_LENGTH, `pin length: ${pin}`);
  assert.ok(/^\d+$/.test(pin), `pin digits only: ${pin}`);
}

// Share ids are url-safe and unique
const ids = new Set(Array.from({ length: 500 }, generateShareId));
assert.strictEqual(ids.size, 500, "share ids unique");
ids.forEach((id) => assert.ok(/^[A-Za-z0-9_-]+$/.test(id), "share id url-safe"));

// PIN hashing round-trip + salt sensitivity
{
  const salt = generateSalt();
  const hash = hashPin("042317", salt);
  assert.ok(pinMatches("042317", salt, hash), "correct pin matches");
  assert.ok(!pinMatches("042318", salt, hash), "wrong pin rejected");
  assert.notStrictEqual(hashPin("042317", generateSalt()), hash, "salt changes hash");
}

// View tokens: valid, tamper-proof, session-expiring, share-expiring
{
  const share = makeShare();
  const token = createViewToken(share);
  assert.ok(verifyViewToken(share, token), "fresh token verifies");
  assert.ok(!verifyViewToken(share, token + "x"), "tampered sig rejected");
  const [exp, sig] = token.split(".");
  assert.ok(!verifyViewToken(share, `${Number(exp) + 1000}.${sig}`), "tampered exp rejected");
  assert.ok(!verifyViewToken(share, token, Number(exp) + 1), "expired session rejected");
  assert.ok(!verifyViewToken(makeShare(), token, Date.now()), "token bound to its share");

  const expiredShare = makeShare({ expires_at: new Date(Date.now() - 1000).toISOString() });
  const staleToken = createViewToken(expiredShare, Date.now() - 86400000);
  assert.ok(!verifyViewToken(expiredShare, staleToken), "share expiry caps session");

  // Session never outlives the share itself
  const shortShare = makeShare({ expires_at: new Date(Date.now() + 60000).toISOString() });
  const shortExp = Number(createViewToken(shortShare).split(".")[0]);
  assert.ok(shortExp <= new Date(shortShare.expires_at).getTime(), "token exp clamped to share expiry");

  assert.ok(!verifyViewToken(share, null), "null token rejected");
  assert.ok(!verifyViewToken(share, ""), "empty token rejected");
  assert.ok(!verifyViewToken(share, "."), "malformed token rejected");
}

// Attempt limiter
{
  const shareId = generateShareId();
  assert.ok(!isLockedOut(shareId), "starts unlocked");
  for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
    assert.ok(!isLockedOut(shareId), `not locked before attempt ${i + 1}`);
    registerFailedAttempt(shareId);
  }
  assert.ok(isLockedOut(shareId), "locked after max attempts");
  clearAttempts(shareId);
  assert.ok(!isLockedOut(shareId), "cleared after successful unlock");

  const other = generateShareId();
  registerFailedAttempt(other);
  const now = Date.now();
  registerFailedAttempt(other, now);
  assert.ok(!isLockedOut(other, now + 16 * 60 * 1000), "window resets after 15 min");
}

console.log("shareUtils: all tests passed");
