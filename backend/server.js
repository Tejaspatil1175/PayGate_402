require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/merchant/auth', require('./routes/merchant.auth.routes'));
app.use('/api/catalog', require('./routes/catalog.routes'));
app.use('/api/merchant/orders', require('./routes/orders.routes'));




connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`PayGate 402 backend listening on port ${PORT}`);
  });
});
