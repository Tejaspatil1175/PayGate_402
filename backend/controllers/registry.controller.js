const Registry = require('../models/Registry');
const Merchant = require('../models/Merchant');

// Helper to generate slug from string
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// @desc    Search merchant discovery registry (public endpoint for AI Agents)
// @route   GET /api/registry
exports.searchRegistry = async (req, res) => {
  try {
    const { search, category, protocol, minTrustScore, page = 1, limit = 20 } = req.query;
    const filter = { isListed: true };

    if (category) {
      filter.category = category;
    }

    if (protocol) {
      filter.supportedProtocols = protocol;
    }

    if (minTrustScore) {
      filter.trustScore = { $gte: parseFloat(minTrustScore) };
    }

    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const merchants = await Registry.find(filter)
      .populate('merchant', 'email phone businessCategory')
      .sort({ trustScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await Registry.countDocuments(filter);

    res.status(200).json({
      success: true,
      protocol: 'AP2/x402',
      count: merchants.length,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      registry: merchants,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single merchant registry listing by slug or ID
// @route   GET /api/registry/:slug
exports.getRegistryBySlug = async (req, res) => {
  try {
    const queryParam = req.params.slug;
    const isObjectId = queryParam.match(/^[0-9a-fA-F]{24}$/);

    const filter = isObjectId ? { _id: queryParam } : { slug: queryParam.toLowerCase() };

    const listing = await Registry.findOne(filter).populate(
      'merchant',
      'businessName email phone businessCategory'
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Merchant registry entry not found',
      });
    }

    res.status(200).json({
      success: true,
      protocol: 'AP2/x402',
      listing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Register or update merchant in public discovery index
// @route   POST /api/registry
exports.registerMerchantInDiscovery = async (req, res) => {
  try {
    const merchantId = req.body.merchant || req.headers['x-merchant-id'];

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required',
      });
    }

    const merchantDoc = await Merchant.findById(merchantId);
    if (!merchantDoc) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found',
      });
    }

    const displayName = req.body.displayName || merchantDoc.businessName;
    const baseSlug = req.body.slug ? slugify(req.body.slug) : slugify(displayName);

    const updateData = {
      merchant: merchantId,
      displayName,
      slug: baseSlug,
      category: req.body.category || merchantDoc.businessCategory || 'General',
      description: req.body.description || '',
      catalogEndpoint: req.body.catalogEndpoint || '/.well-known/agent-catalog.json',
      policyEndpoint: req.body.policyEndpoint || '/.well-known/agent-policy.json',
      apiEndpoint: req.body.apiEndpoint || '/api/agent',
      supportedProtocols: req.body.supportedProtocols || ['AP2/CartMandate', 'x402/BaseRPC'],
      tags: req.body.tags || [],
      isListed: req.body.isListed !== undefined ? req.body.isListed : true,
    };

    const listing = await Registry.findOneAndUpdate(
      { merchant: merchantId },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Merchant successfully listed in agent discovery registry',
      listing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
