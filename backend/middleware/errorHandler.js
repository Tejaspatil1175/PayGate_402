const logger = require('../utils/logger');
const { logAuditEvent } = require('./auditLogger');

class AppError extends Error {
  constructor(message, statusCode = 500, gateDecision = 'BLOCK') {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.gateDecision = gateDecision;

    Error.captureStackTrace(this, this.constructor);
  }
}

class PolicyViolationError extends AppError {
  constructor(message, challengeDetails = {}) {
    super(message, 402, 'BLOCK');
    this.name = 'PolicyViolationError';
    this.challengeDetails = challengeDetails;
  }
}

/**
 * Centralized Express Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error via internal logger
  if (err.statusCode >= 500) {
    logger.error(`[SERVER_ERROR] ${req.method} ${req.originalUrl}:`, err.message, err.stack);
  } else {
    logger.warn(`[CLIENT_ERROR] ${req.method} ${req.originalUrl} (${err.statusCode}):`, err.message);
  }

  // Handle Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    err = new AppError(`Invalid format for field '${err.path}'`, 400);
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(', ');
    err = new AppError(`Duplicate entry for field: ${fields}`, 400);
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((el) => el.message);
    err = new AppError(`Validation failed: ${errors.join('. ')}`, 400);
  }

  // Handle AP2 / x402 Policy Violation (HTTP 402 Challenge)
  if (err.name === 'PolicyViolationError' || err.statusCode === 402) {
    // Write audit log entry for gate block
    logAuditEvent({
      correlationId: req.correlationId,
      merchant: req.merchant ? req.merchant._id : req.headers['x-merchant-id'] || null,
      agentId: req.headers['x-agent-id'] || 'agent_anonymous',
      action: `${req.method} ${req.originalUrl}`,
      decision: 'BLOCK',
      reason: err.message,
      ipAddress: req.ip || '',
      metadata: {
        statusCode: 402,
        challenge: err.challengeDetails || {},
      },
    });

    return res.status(402).json({
      protocol: 'AP2/x402',
      success: false,
      error: 'HTTP 402 Payment Required',
      gateDecision: 'BLOCK',
      message: err.message,
      challenge: {
        type: 'AP2_CartMandate_Required',
        reason: err.message,
        details: err.challengeDetails || {},
        instructedAction: 'Please submit a valid, cryptographically signed Cart Mandate within policy bounds.',
      },
    });
  }

  const responsePayload = {
    success: false,
    error: err.message || 'Internal Server Error',
    statusCode: err.statusCode,
  };

  if (process.env.NODE_ENV === 'development') {
    responsePayload.stack = err.stack;
  }

  res.status(err.statusCode).json(responsePayload);
}

module.exports = {
  AppError,
  PolicyViolationError,
  errorHandler,
};
