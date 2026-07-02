// Minimal request logger middleware
// Logs only: method, path, status code, latency (ms).
// Does NOT log request/response bodies, headers, or env vars.

module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1e6;
    const method = req.method;
    // Redact sensitive query params (media URLs carry ?token= because
    // <Image>/audio elements cannot set headers).
    const rawPath = req.originalUrl || req.url;
    const path = rawPath.replace(/([?&]token=)[^&]*/gi, '$1[redacted]');
    const status = res.statusCode;

    console.log(`${method} ${path} ${status} ${latencyMs.toFixed(2)}ms`);
  });

  next();
};
