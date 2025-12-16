// Minimal request logger middleware
// Logs only: method, path, status code, latency (ms).
// Does NOT log request/response bodies, headers, or env vars.

module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const latencyMs = Number(end - start) / 1e6;
    const method = req.method;
    const path = req.originalUrl || req.url;
    const status = res.statusCode;

    console.log(`${method} ${path} ${status} ${latencyMs.toFixed(2)}ms`);
  });

  next();
};
