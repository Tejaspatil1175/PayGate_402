const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const logger = require('../utils/logger');

// Helper to extract merchant ID
function getMerchantId(req) {
  let merchantId = req.query.merchantId || req.body.merchantId || req.body.merchant || req.headers['x-merchant-id'];
  if (!merchantId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    if (token && token.length === 24) {
      merchantId = token;
    }
  }
  return merchantId;
}

// GET /api/campaigns — List all campaigns for a merchant
router.get('/', async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    const filter = {};
    if (merchantId) {
      filter.merchant = merchantId;
    }

    const campaigns = await Campaign.find(filter).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: campaigns.length,
      campaigns,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns — Create a new merchant campaign
router.post('/', async (req, res, next) => {
  try {
    const merchantId = getMerchantId(req);
    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required to create a campaign',
      });
    }

    const {
      name,
      description,
      discountPercent,
      minQuantity,
      startDate,
      endDate,
      isActive,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name is required',
      });
    }

    const newCampaign = await Campaign.create({
      merchant: merchantId,
      name,
      description: description || '',
      discountPercent: Number(discountPercent) || 15,
      minQuantity: Number(minQuantity) || 1,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    logger.info(`[CAMPAIGN_CREATED] Campaign "${newCampaign.name}" (${newCampaign.discountPercent}% off for ≥${newCampaign.minQuantity} units) created for merchant ${merchantId}`);

    res.status(201).json({
      success: true,
      campaign: newCampaign,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/campaigns/:id/toggle — Toggle campaign active status
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    campaign.isActive = !campaign.isActive;
    await campaign.save();

    logger.info(`[CAMPAIGN_TOGGLED] Campaign ${campaign._id} set isActive=${campaign.isActive}`);
    res.status(200).json({
      success: true,
      campaign,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/campaigns/:id — Delete a campaign
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Campaign.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    logger.info(`[CAMPAIGN_DELETED] Campaign ${req.params.id} deleted`);
    res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
