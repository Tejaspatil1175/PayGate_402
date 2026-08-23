const express = require('express');
const router = express.Router();
const { executePayment, getPaymentStatus } = require('../controllers/payment.controller');

router.post('/execute', executePayment);
router.get('/:id/status', getPaymentStatus);

module.exports = router;
