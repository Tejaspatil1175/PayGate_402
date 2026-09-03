const express = require('express');
const router = express.Router();
const { executePayment, getPaymentStatus } = require('../controllers/payment.controller');
const { ExecutePaymentSchema, validateBody } = require('../middleware/schemaValidation');

router.post('/execute', validateBody(ExecutePaymentSchema), executePayment);
router.get('/:id/status', getPaymentStatus);

module.exports = router;
