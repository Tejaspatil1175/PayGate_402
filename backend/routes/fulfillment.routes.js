const express = require('express');
const router = express.Router();
const {
  triggerFulfillment,
  getFulfillmentStatus,
} = require('../controllers/fulfillment.controller');

router.post('/:id/fulfill', triggerFulfillment);
router.get('/:id', getFulfillmentStatus);

module.exports = router;
