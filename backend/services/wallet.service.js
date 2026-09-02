const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const { createRazorpayOrder } = require('./razorpay.service');
const logger = require('../utils/logger');

/**
 * Get or create wallet for user, handling daily spent reset if date changed
 */
async function getOrCreateWallet(userId) {
  let targetOwnerId = userId;
  if (!targetOwnerId || !mongoose.Types.ObjectId.isValid(targetOwnerId)) {
    const existingUser = await User.findOne({
      $or: [{ email: targetOwnerId }, { name: targetOwnerId }],
    });
    if (existingUser) {
      targetOwnerId = existingUser._id;
    } else {
      let defaultUser = await User.findOne();
      if (!defaultUser) {
        defaultUser = await User.create({
          name: 'Demo Buyer',
          email: 'buyer@paygate.internal',
          password: 'demo_password_hash',
        });
      }
      targetOwnerId = defaultUser._id;
    }
  }

  let wallet = await Wallet.findOne({ owner: targetOwnerId });

  if (!wallet) {
    wallet = await Wallet.create({
      owner: targetOwnerId,
      balance: 0,
      perTransactionCap: 10000,
      perDayCap: 50000,
      dailySpent: 0,
      lastSpentResetDate: new Date(),
      ledger: [],
    });

    await User.findByIdAndUpdate(targetOwnerId, { walletId: wallet._id });
  } else {
    // Reset daily spent if lastSpentResetDate is before today
    const now = new Date();
    const lastReset = new Date(wallet.lastSpentResetDate);
    if (
      now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCDate() !== lastReset.getUTCDate()
    ) {
      wallet.dailySpent = 0;
      wallet.lastSpentResetDate = now;
      await wallet.save();
    }
  }

  return wallet;
}

/**
 * Get wallet details and balance for user
 */
async function getWalletBalance(userId) {
  const wallet = await getOrCreateWallet(userId);
  return {
    walletId: wallet._id,
    owner: wallet.owner,
    balance: wallet.balance,
    currency: wallet.currency,
    perTransactionCap: wallet.perTransactionCap,
    perDayCap: wallet.perDayCap,
    dailySpent: wallet.dailySpent,
    availableDailyCap: Math.max(0, wallet.perDayCap - wallet.dailySpent),
    ledger: wallet.ledger,
  };
}

/**
 * Create a Razorpay top-up order for wallet
 */
async function createTopUpOrder(userId, amount) {
  if (!amount || amount <= 0) {
    throw new Error('Top-up amount must be greater than zero');
  }

  const wallet = await getOrCreateWallet(userId);

  const order = await createRazorpayOrder({
    amount,
    currency: wallet.currency || 'INR',
    receipt: `topup_${userId}_${Date.now()}`,
    notes: {
      purpose: 'wallet_topup',
      userId: userId.toString(),
      walletId: wallet._id.toString(),
    },
  });

  return {
    orderId: order.id,
    amount: amount,
    currency: order.currency,
    razorpayOrder: order,
  };
}

// Precision currency math helpers (guarantee zero floating-point drift)
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const fromPaise = (paise) => Math.round(Number(paise)) / 100;

/**
 * Credit wallet (Top-Up completion) with idempotency check
 */
async function creditWallet(userId, amount, referenceId, description = 'Wallet Top-up', options = {}) {
  const safeAmount = fromPaise(toPaise(amount));
  if (!safeAmount || safeAmount <= 0) {
    throw new Error('Credit amount must be greater than zero');
  }

  const wallet = await getOrCreateWallet(userId);

  // Idempotency check: prevent duplicate credits for the same payment/reference ID
  if (
    referenceId &&
    wallet.ledger.some(
      (entry) => entry.referenceId === referenceId && entry.status === 'completed'
    )
  ) {
    logger.info(
      `[WALLET_IDEMPOTENT] Reference ${referenceId} already credited to user ${wallet.owner}. Skipping duplicate.`
    );
    return null;
  }

  const newBalance = fromPaise(toPaise(wallet.balance || 0) + toPaise(safeAmount));
  const debitAccount =
    (options && options.debitAccount) ||
    (referenceId && referenceId.startsWith('rollback') ? 'merchant_escrow' : 'external_razorpay');
  const creditAccount = (options && options.creditAccount) || `wallet_${wallet.owner}`;

  const updatedWallet = await Wallet.findOneAndUpdate(
    { owner: wallet.owner },
    {
      $inc: { balance: safeAmount },
      $push: {
        ledger: {
          type: 'topup',
          amount: safeAmount,
          description,
          referenceId,
          debitAccount,
          creditAccount,
          status: 'completed',
          balanceAfter: newBalance,
        },
      },
    },
    { new: true }
  );

  logger.info(`[WALLET] Credited ₹${safeAmount} to user ${wallet.owner}. New balance: ₹${updatedWallet.balance}`);
  return updatedWallet;
}

/**
 * Debit wallet atomically for agent execution
 * Atomic query uses findOneAndUpdate with balance-sufficient and cap filters
 */
async function debitWallet(userId, amount, referenceId, description = 'Agent Commerce Purchase', options = {}) {
  const safeAmount = fromPaise(toPaise(amount));
  if (!safeAmount || safeAmount <= 0) {
    throw new Error('Debit amount must be greater than zero');
  }

  const wallet = await getOrCreateWallet(userId);

  if (safeAmount > wallet.perTransactionCap) {
    throw new Error(`Transaction amount ₹${safeAmount} exceeds per-transaction cap of ₹${wallet.perTransactionCap}`);
  }

  const newBalance = fromPaise(Math.max(0, toPaise(wallet.balance || 0) - toPaise(safeAmount)));
  const debitAccount = (options && options.debitAccount) || `wallet_${wallet.owner}`;
  const creditAccount =
    (options && options.creditAccount) ||
    (options && options.merchantId
      ? `merchant_${options.merchantId}`
      : referenceId
      ? (referenceId.startsWith('merchant_') ? referenceId : `merchant_${referenceId}`)
      : 'merchant_settlement');

  const filter = {
    owner: wallet.owner,
    balance: { $gte: safeAmount },
    perTransactionCap: { $gte: safeAmount },
    $expr: { $lte: [{ $add: ['$dailySpent', safeAmount] }, '$perDayCap'] },
  };

  const update = {
    $inc: { balance: -safeAmount, dailySpent: safeAmount },
    $push: {
      ledger: {
        type: 'debit',
        amount: safeAmount,
        description,
        referenceId,
        debitAccount,
        creditAccount,
        status: 'completed',
        balanceAfter: newBalance,
      },
    },
  };

  const updatedWallet = await Wallet.findOneAndUpdate(filter, update, { new: true });

  if (!updatedWallet) {
    const currentWallet = await Wallet.findOne({ owner: wallet.owner });
    if (!currentWallet) {
      throw new Error('Wallet not found');
    }
    if (currentWallet.balance < safeAmount) {
      throw new Error(`Insufficient wallet balance. Required: ₹${safeAmount}, Available: ₹${currentWallet.balance}`);
    }
    if (currentWallet.dailySpent + safeAmount > currentWallet.perDayCap) {
      throw new Error(
        `Transaction of ₹${safeAmount} exceeds remaining daily cap of ₹${Math.max(0, currentWallet.perDayCap - currentWallet.dailySpent)}`
      );
    }
    throw new Error('Wallet debit failed due to concurrency or cap constraint');
  }

  logger.info(`[WALLET] Atomically debited ₹${safeAmount} from user ${wallet.owner}. New balance: ₹${updatedWallet.balance}`);
  return updatedWallet;
}

/**
 * Update wallet spending caps
 */
async function updateWalletCaps(userId, { perTransactionCap, perDayCap }) {
  const wallet = await getOrCreateWallet(userId);

  if (perTransactionCap !== undefined && perTransactionCap >= 0) {
    wallet.perTransactionCap = perTransactionCap;
  }
  if (perDayCap !== undefined && perDayCap >= 0) {
    wallet.perDayCap = perDayCap;
  }

  await wallet.save();
  return wallet;
}

module.exports = {
  getOrCreateWallet,
  getWalletBalance,
  createTopUpOrder,
  creditWallet,
  debitWallet,
  updateWalletCaps,
};
