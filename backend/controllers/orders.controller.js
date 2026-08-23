const Order = require('../models/Order');

// @desc    Get merchant order feed (filtered by status, search, date range)
// @route   GET /api/merchant/orders
exports.getMerchantOrders = async (req, res) => {
  try {
    const merchantId = req.query.merchant || req.headers['x-merchant-id'];

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required',
      });
    }

    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = { merchant: merchantId };

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { razorpayPaymentId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('items.product', 'title price sku');

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get merchant order statistics for dashboard
// @route   GET /api/merchant/orders/stats
exports.getOrderStats = async (req, res) => {
  try {
    const merchantId = req.query.merchant || req.headers['x-merchant-id'];

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required',
      });
    }

    const orders = await Order.find({ merchant: merchantId }).lean();

    const stats = {
      totalOrders: orders.length,
      paidOrders: 0,
      fulfilledOrders: 0,
      failedOrders: 0,
      totalRevenue: 0,
    };

    orders.forEach((o) => {
      if (o.status === 'paid') {
        stats.paidOrders += 1;
        stats.totalRevenue += o.amount || 0;
      } else if (o.status === 'fulfilled') {
        stats.fulfilledOrders += 1;
        stats.totalRevenue += o.amount || 0;
      } else if (o.status === 'failed') {
        stats.failedOrders += 1;
      }
    });

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single order by ID
// @route   GET /api/merchant/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'items.product',
      'title price sku images'
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update order status (fulfillment / cancellation)
// @route   PATCH /api/merchant/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['pending', 'created', 'paid', 'failed', 'fulfilled', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order status',
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to '${status}'`,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
