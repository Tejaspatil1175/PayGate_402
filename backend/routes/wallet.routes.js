const express = require('express');
const router = express.Router();
const walletService = require('../services/wallet.service');

// Helper to extract userId from request
function getUserIdFromReq(req) {
  return req.body.userId || req.query.userId || req.headers['x-user-id'] || req.user?.id;
}

// @desc    Get wallet balance & cap summary
// @route   GET /api/wallet/balance
router.get('/balance', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required (via query param ?userId= or header x-user-id)',
      });
    }

    const wallet = await walletService.getWalletBalance(userId);
    res.status(200).json({
      success: true,
      wallet,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Initiate Razorpay top-up order
// @route   POST /api/wallet/topup
router.post('/topup', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { amount } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than zero',
      });
    }

    const topUpResult = await walletService.createTopUpOrder(userId, Number(amount));
    res.status(200).json({
      success: true,
      message: 'Top-up order created successfully',
      ...topUpResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Get wallet transaction history (ledger)
// @route   GET /api/wallet/history
router.get('/history', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const wallet = await walletService.getWalletBalance(userId);
    res.status(200).json({
      success: true,
      ledger: wallet.ledger || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Update wallet spending caps
// @route   PUT /api/wallet/caps
router.put('/caps', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { perTransactionCap, perDayCap } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const wallet = await walletService.updateWalletCaps(userId, {
      perTransactionCap: perTransactionCap !== undefined ? Number(perTransactionCap) : undefined,
      perDayCap: perDayCap !== undefined ? Number(perDayCap) : undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Wallet caps updated successfully',
      wallet: {
        perTransactionCap: wallet.perTransactionCap,
        perDayCap: wallet.perDayCap,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
