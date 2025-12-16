/**
 * Middleware to verify tester token from environment variables
 * Protects sensitive API endpoints
 */
function requireTesterToken(req, res, next) {
  const expectedToken = process.env.TESTER_TOKEN;

  // Check if TESTER_TOKEN is configured
  if (!expectedToken) {
    return res.status(503).json({ error: 'TESTER_TOKEN not configured' });
  }

  // Read x-tester-token header (case-insensitive)
  const providedToken = req.get('x-tester-token');

  // Verify token
  if (!providedToken || providedToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Token is valid, proceed
  next();
}

module.exports = requireTesterToken;
