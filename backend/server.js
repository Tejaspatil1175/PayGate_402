require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const { auditLoggerMiddleware } = require('./middleware/auditLogger');

const { globalRateLimiter } = require('./middleware/rateLimiter');

const app = express();
app.use(express.json());
app.use(auditLoggerMiddleware);
app.use(globalRateLimiter);



const PORT = process.env.PORT || 4000;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/merchant/auth', require('./routes/merchant.auth.routes'));
app.use('/api/catalog', require('./routes/catalog.routes'));
app.use('/api/merchant/orders', require('./routes/orders.routes'));
app.use('/api/registry', require('./routes/registry.routes'));
app.use('/api/agent/intent', require('./routes/intent.routes'));
app.use('/api/agent/negotiation', require('./routes/negotiation.routes'));
app.use('/api/agent/contract', require('./routes/contract.routes'));
app.use('/api/agent/payment', require('./routes/payment.routes'));
app.post('/api/webhooks/razorpay', require('./webhooks/razorpay.webhook'));









// Centralized Error Handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`PayGate 402 backend listening on port ${PORT}`);
  });
});
