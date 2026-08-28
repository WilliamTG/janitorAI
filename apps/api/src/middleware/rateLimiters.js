const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

// Custom handler for rate limit responses. Retry-After + retryAfterSeconds i
// kroppen gir klienten et konkret «prøv igjen om X» i stedet for gjetting —
// kroppsfeltet fordi Retry-After-headeren krever CORS-eksponering på web.
const limitHandler = (req, res) => {
  const resetTime = req.rateLimit && req.rateLimit.resetTime;
  const resetMs = resetTime instanceof Date ? resetTime.getTime() - Date.now() : 15 * 60 * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000));
  res.set('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMITED',
    retryAfterSeconds,
  });
};

// Env-justerbare tak så e2e-tester kan trippe limiteren uten 30 ekte kall.
const GENERAL_LIMIT = Math.max(1, Number(process.env.GENERAL_RATE_LIMIT) || 300);
const HEAVY_LIMIT = Math.max(1, Number(process.env.HEAVY_RATE_LIMIT) || 30);

/**
 * General rate limiter for all endpoints
 * 15-minute window, max 300 requests per IP
 * (montert før token-autentiseringen — IP er eneste nøkkel som finnes her)
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: GENERAL_LIMIT,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: limitHandler,
});

/**
 * Heavy rate limiter for resource-intensive endpoints
 * (Gemini API calls, report generation, etc.)
 * 15-minute window, max 30 requests per tester
 *
 * Nøkkel per tester, ikke per IP: pilotkontoret deler én offentlig IP, og de
 * dyre KI-endepunktene skal ikke la én kollega tømme potten for de andre —
 * og en aktør som roterer IP-er skal ikke omgå taket. Autentiseringen kjører
 * før rutene (requireTesterToken er app.use-montert foran de tunge
 * endepunktene), så req.testerToken er alltid satt der; offentlige flater
 * uten token (/api/demo/underlag) faller tilbake til IPv6-trygg IP-nøkling.
 */
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: HEAVY_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.testerToken ? `tester:${req.testerToken}` : ipKeyGenerator(req.ip),
  handler: limitHandler,
});

module.exports = {
  generalLimiter,
  heavyLimiter,
};
