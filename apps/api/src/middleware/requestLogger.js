// Minimal request logger middleware
// Logs only: request id, method, path, status code, latency (ms).
// Does NOT log request/response bodies, headers, or env vars.
//
// Request-id-en gjør en hendelse korrelérbar på tvers av app → API → AI-motor:
// den logges her, og /report/google-doc sender den videre som X-Request-Id så
// motorens logglinjer kan matches mot API-loggen uten tidsstempel-gjetting.

const crypto = require("crypto");

module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  req.requestId = crypto.randomUUID().slice(0, 8);

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1e6;
    const method = req.method;
    // Redact sensitive query params (media URLs carry ?token= because
    // <Image>/audio elements cannot set headers).
    const rawPath = req.originalUrl || req.url;
    const path = rawPath.replace(/([?&]token=)[^&]*/gi, '$1[redacted]');
    const status = res.statusCode;

    console.log(`[${req.requestId}] ${method} ${path} ${status} ${latencyMs.toFixed(2)}ms`);
  });

  next();
};
