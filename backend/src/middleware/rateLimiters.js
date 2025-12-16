const rateLimit = require('express-rate-limit');

/**
 * General rate limiter for all endpoints
 * 15-minute window, max 300 requests per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Heavy rate limiter for resource-intensive endpoints
 * (OpenAI API calls, media uploads, etc.)
 * 15-minute window, max 30 requests per IP
 */
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  heavyLimiter,
};
