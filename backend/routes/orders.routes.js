const express = require('express');
const router = express.Router();
const {
  getMerchantOrders,
  getOrderStats,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orders.controller');

router.get('/', getMerchantOrders);
router.get('/stats', getOrderStats);
router.get('/:id', getOrderById);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
