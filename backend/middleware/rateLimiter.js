const logger = require('../utils/logger');
const { AppError } = require('./errorHandler');

// Memory store for tracking hit counts per key
const rateLimitStore = new Map();

// Periodic cleanup of expired window entries every 5 minutes
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (rateLimitCleanupTimer.unref) rateLimitCleanupTimer.unref();

/**
 * In-memory Rate Limiting Middleware
 * @param {Object} options - { windowMs, maxRequests, keyPrefix }
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
  const isDev = process.env.NODE_ENV !== 'production';
  const defaultMax = isDev ? 10000 : 1000;
  const maxRequests = options.maxRequests !== undefined ? options.maxRequests : defaultMax;
  const keyPrefix = options.keyPrefix || 'rl';

  return (req, res, next) => {
    // Skip health check route
    if (req.originalUrl === '/health') return next();

    // In development mode, bypass rate limit blocking
    if (isDev) return next();

    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const agentId = req.headers['x-agent-id'] || 'anonymous';
    const key = `${keyPrefix}:${clientIp}:${agentId}`;

    const now = Date.now();
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > maxRequests) {
      logger.warn(`[RATE_LIMIT_EXCEEDED] IP: ${clientIp} | Agent: ${agentId} | Path: ${req.originalUrl}`);
      return next(
        new AppError(
          `Too many requests from IP/Agent (${record.count}/${maxRequests} in window). Try again in ${resetSeconds}s`,
          429,
          'BLOCK'
        )
      );
    }

    next();
  };
}

// Global API rate limiter (10,000 req in dev / 1,000 in prod per 15 min)
const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'production' ? 1000 : 10000,
  keyPrefix: 'global',
});

// Stricter AI Agent API rate limiter
const agentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'production' ? 100 : 5000,
  keyPrefix: 'agent',
});

module.exports = {
  createRateLimiter,
  globalRateLimiter,
  agentRateLimiter,
};
