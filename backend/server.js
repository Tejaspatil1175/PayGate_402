require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const { auditLoggerMiddleware } = require('./middleware/auditLogger');

const { globalRateLimiter } = require('./middleware/rateLimiter');

const app = express();

// Razorpay Webhook Route with raw body parsing (must precede express.json for HMAC signature validation)
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), require('./webhooks/razorpay.webhook'));

// Strict Origin CORS headers middleware
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://pay-gate-402.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed =
    !origin ||
    allowedOrigins.includes(origin) ||
    (origin && origin.endsWith('.vercel.app'));

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id, x-merchant-id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(auditLoggerMiddleware);
app.use(globalRateLimiter);

const PORT = process.env.PORT || 4000;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api', require('./routes/index'));
app.use('/api/merchant/auth', require('./routes/merchant.auth.routes'));

app.use('/api/catalog', require('./routes/catalog.routes'));
app.use('/api/policy', require('./routes/policy.routes'));
app.use('/api/campaigns', require('./routes/campaign.routes'));
app.use('/api/merchant/orders', require('./routes/orders.routes'));
app.use('/api/registry', require('./routes/registry.routes'));
app.use('/api/agent/intent', require('./routes/intent.routes'));
app.use('/api/agent/negotiation', require('./routes/negotiation.routes'));
app.use('/api/agent/contract', require('./routes/contract.routes'));
app.use('/api/agent/payment', require('./routes/payment.routes'));
app.use('/api/agent/fulfillment', require('./routes/fulfillment.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/admin/overview', require('./routes/admin.overview.routes'));
app.use('/api/admin/merchants', require('./routes/admin.merchants.routes'));
app.use('/api/admin/monitoring', require('./routes/admin.monitoring.routes'));
app.use('/api/admin/system', require('./routes/admin.system.routes'));
app.use('/api/admin/config', require('./routes/admin.config.routes'));
app.use('/.well-known', require('./routes/wellknown.routes'));
app.use('/well-known', require('./routes/wellknown.routes'));

// Phase 9 Routes
app.use('/api/user/auth', require('./routes/user.auth.routes'));
app.use('/api/admin/auth', require('./routes/admin.auth.routes'));
app.use('/api/wallet', require('./routes/wallet.routes'));
app.use('/api/voice', require('./routes/voice.routes'));
app.use('/api/discovery', require('./routes/discovery.routes'));
app.use('/api/recommendations', require('./routes/recommendation.routes'));
app.use('/api/user-analytics', require('./routes/userAnalytics.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/user-orders', require('./routes/userOrders.routes'));
app.use('/api/scheduled-tasks', require('./routes/scheduledTasks.routes'));
app.use('/api/agent-marketplace', require('./routes/agentMarketplace.routes'));

// Centralized Error Handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

const { seedAdmin } = require('./config/adminSeed');
const { initScheduledTasksCron } = require('./jobs/scheduledTasks.job');
const { ensureProductIndexes } = require('./services/productDiscovery.service');

connectDB().then(async () => {
  seedAdmin();
  initScheduledTasksCron();
  await ensureProductIndexes();
  app.listen(PORT, () => {
    console.log(`PayGate 402 backend listening on port ${PORT}`);
  });
});
