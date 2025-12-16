const crypto = require('crypto');

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

  // Verify token exists
  if (!providedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedToken);
    const providedBuffer = Buffer.from(providedToken);

    // Ensure both buffers have same length before comparison
    if (expectedBuffer.length !== providedBuffer.length) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokensMatch = crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    
    if (!tokensMatch) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (err) {
    // timingSafeEqual throws if buffers have different lengths
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Token is valid, proceed
  next();
}

module.exports = requireTesterToken;
