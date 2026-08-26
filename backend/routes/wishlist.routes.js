const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

function getUserIdFromReq(req) {
  return req.body.userId || req.query.userId || req.headers['x-user-id'];
}

// @desc    Get user's saved wishlist items with price-drop indicators
// @route   GET /api/wishlist
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const wishlistItems = await Wishlist.find({ user: userId, isActive: true })
      .populate({
        path: 'product',
        populate: { path: 'merchant', select: 'businessName businessCategory' },
      })
      .sort({ createdAt: -1 })
      .lean();

    const items = wishlistItems.map((item) => {
      const currentPrice = item.product?.price || item.savedPrice;
      const isPriceDropped = currentPrice < item.savedPrice;
      const priceDifference = item.savedPrice - currentPrice;

      return {
        id: item._id,
        savedPrice: item.savedPrice,
        targetPrice: item.targetPrice,
        notifyPriceDrop: item.notifyPriceDrop,
        isPriceDropped,
        priceDifference: isPriceDropped ? priceDifference : 0,
        createdAt: item.createdAt,
        product: item.product,
      };
    });

    res.status(200).json({
      success: true,
      count: items.length,
      wishlist: items,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add
router.post('/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { productId, targetPrice } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'userId and productId are required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const wishlistItem = await Wishlist.findOneAndUpdate(
      { user: userId, product: productId },
      {
        user: userId,
        product: productId,
        savedPrice: product.price,
        targetPrice: targetPrice !== undefined ? Number(targetPrice) : null,
        isActive: true,
      },
      { upsert: true, new: true }
    ).populate('product');

    res.status(201).json({
      success: true,
      message: 'Product added to wishlist',
      item: wishlistItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/remove/:productId
router.delete('/remove/:productId', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { productId } = req.params;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'userId and productId are required',
      });
    }

    await Wishlist.findOneAndDelete({ user: userId, product: productId });

    res.status(200).json({
      success: true,
      message: 'Item removed from wishlist',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Get active price drop alerts for user
// @route   GET /api/wishlist/price-drops
router.get('/price-drops', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const wishlistItems = await Wishlist.find({ user: userId, isActive: true })
      .populate('product')
      .lean();

    const priceDrops = wishlistItems
      .filter((item) => item.product && item.product.price < item.savedPrice)
      .map((item) => ({
        wishlistId: item._id,
        savedPrice: item.savedPrice,
        currentPrice: item.product.price,
        dropAmount: item.savedPrice - item.product.price,
        productTitle: item.product.title,
        product: item.product,
      }));

    res.status(200).json({
      success: true,
      hasPriceDrops: priceDrops.length > 0,
      count: priceDrops.length,
      priceDrops,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
