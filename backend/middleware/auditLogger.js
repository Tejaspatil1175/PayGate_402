const AuditLog = require('../models/AuditLog');
const { generateNonce } = require('../utils/crypto');
const logger = require('../utils/logger');

/**
 * Log a structured audit event to MongoDB and console logger
 * @param {Object} data
 * @returns {Promise<Object>} Created AuditLog document
 */
async function logAuditEvent(data) {
  try {
    const correlationId = data.correlationId || generateNonce();

    const logEntry = await AuditLog.create({
      merchant: data.merchant || null,
      correlationId,
      agentId: data.agentId || 'agent_anonymous',
      mandateHash: data.mandateHash || '',
      razorpayOrderId: data.razorpayOrderId || '',
      razorpayPaymentId: data.razorpayPaymentId || '',
      action: data.action || 'API_CALL',
      decision: data.decision || 'ALLOW',
      reason: data.reason || 'Operation performed successfully',
      ipAddress: data.ipAddress || '',
      metadata: data.metadata || {},
      executionTimeMs: data.executionTimeMs || 0,
    });

    const level = data.decision === 'BLOCK' ? 'warn' : 'info';
    logger[level](
      `[AUDIT] Action: ${data.action} | Decision: ${data.decision} | Agent: ${data.agentId} | Reason: ${data.reason}`
    );

    return logEntry;
  } catch (error) {
    logger.error('Failed to write audit log:', error.message);
    return null;
  }
}

/**
 * Express middleware to automatically audit incoming requests
 */
function auditLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  const correlationId = req.headers['x-correlation-id'] || generateNonce();
  req.correlationId = correlationId;

  res.on('finish', async () => {
    // Only audit non-health endpoints to avoid log noise
    if (req.originalUrl === '/health') return;

    const executionTimeMs = Date.now() - startTime;
    const isErrorOrBlocked = res.statusCode >= 400;

    await logAuditEvent({
      correlationId,
      merchant: req.merchant ? req.merchant._id : req.headers['x-merchant-id'] || null,
      agentId: req.headers['x-agent-id'] || 'agent_anonymous',
      action: `${req.method} ${req.originalUrl}`,
      decision: isErrorOrBlocked ? 'BLOCK' : 'ALLOW',
      reason: isErrorOrBlocked ? `HTTP ${res.statusCode}` : 'HTTP Request completed',
      ipAddress: req.ip || req.connection.remoteAddress || '',
      executionTimeMs,
      metadata: {
        statusCode: res.statusCode,
        query: req.query,
      },
    });
  });

  next();
}

module.exports = {
  logAuditEvent,
  auditLoggerMiddleware,
};
