const express = require('express');
const router = express.Router();
const { getUserOrders, getOrderDetails } = require('../controllers/userOrders.controller');

router.get('/', getUserOrders);
router.get('/:orderId', getOrderDetails);
router.get('/:orderId/tracking', getOrderDetails);

module.exports = router;
