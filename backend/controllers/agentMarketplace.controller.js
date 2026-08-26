const AgentType = require('../models/AgentType');
const UserAgent = require('../models/UserAgent');
const logger = require('../utils/logger');

// Seed catalog of default well-known agents if empty
async function seedDefaultAgentTypes() {
  const count = await AgentType.countDocuments();
  if (count === 0) {
    const defaults = [
      {
        agentSlug: 'smart-negotiator',
        title: 'Smart Negotiator Agent',
        description: 'Autonomous negotiator that negotiates discounts with merchant policy engines up to pre-approved rules.',
        category: 'Negotiation',
        icon: 'trending-down',
        defaultCapabilities: ['Auto counter-offer', 'Price trend scoring', 'RSA-PSS Contract signing'],
      },
      {
        agentSlug: 'deal-scout',
        title: 'Deal Scout Agent',
        description: 'Scouts onboarded merchant catalogs to discover best product matches within user budget limits.',
        category: 'Discovery',
        icon: 'search',
        defaultCapabilities: ['Internal catalog search', 'Attribute drop fallback', 'Policy pre-check'],
      },
      {
        agentSlug: 'budget-guard',
        title: 'Budget Guard Agent',
        description: 'Enforces strict per-transaction and daily wallet guardrails across all automated agent spending.',
        category: 'Security',
        icon: 'shield-check',
        defaultCapabilities: ['Atomic wallet debit', 'Daily cap tracking', 'PII minimization'],
      },
      {
        agentSlug: 'scheduled-buyer',
        title: 'Scheduled Commerce Agent',
        description: 'Executes "buy at 6 PM" automated task orders with fresh price and stock re-verification.',
        category: 'Automation',
        icon: 'clock',
        defaultCapabilities: ['Cron task runner', 'Stock re-verification', 'Shared wallet settlement'],
      },
    ];

    await AgentType.insertMany(defaults);
    logger.info('[MARKETPLACE] Seeded default agent catalog types.');
  }
}

// @desc    Get all public agent types in marketplace catalog
// @route   GET /api/agent-marketplace/catalog
exports.getAgentCatalog = async (req, res) => {
  try {
    await seedDefaultAgentTypes();
    const agentTypes = await AgentType.find({ isPublic: true }).sort({ createdAt: 1 }).lean();

    res.status(200).json({
      success: true,
      count: agentTypes.length,
      catalog: agentTypes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get user's active/installed agents
// @route   GET /api/agent-marketplace/active
exports.getUserActiveAgents = async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const activeAgents = await UserAgent.find({ user: userId })
      .populate('agentType')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: activeAgents.length,
      activeAgents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Activate an agent for user
// @route   POST /api/agent-marketplace/activate
exports.activateAgent = async (req, res) => {
  try {
    const userId = req.body.userId || req.headers['x-user-id'];
    const { agentSlug, customSettings } = req.body;

    if (!userId || !agentSlug) {
      return res.status(400).json({
        success: false,
        error: 'userId and agentSlug are required',
      });
    }

    await seedDefaultAgentTypes();
    const agentType = await AgentType.findOne({ agentSlug: agentSlug.toLowerCase() });

    if (!agentType) {
      return res.status(404).json({
        success: false,
        error: `Agent type '${agentSlug}' not found`,
      });
    }

    const userAgent = await UserAgent.findOneAndUpdate(
      { user: userId, agentType: agentType._id },
      {
        user: userId,
        agentType: agentType._id,
        agentSlug: agentType.agentSlug,
        status: 'active',
        customSettings: customSettings || {},
        activatedAt: new Date(),
      },
      { upsert: true, new: true }
    ).populate('agentType');

    res.status(201).json({
      success: true,
      message: `Agent '${agentType.title}' activated successfully`,
      userAgent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Toggle agent status (active / paused / disabled)
// @route   PUT /api/agent-marketplace/toggle
exports.toggleAgentStatus = async (req, res) => {
  try {
    const userId = req.body.userId || req.headers['x-user-id'];
    const { userAgentId, status } = req.body;

    if (!userId || !userAgentId || !status) {
      return res.status(400).json({
        success: false,
        error: 'userId, userAgentId, and status are required',
      });
    }

    const userAgent = await UserAgent.findOneAndUpdate(
      { _id: userAgentId, user: userId },
      { status },
      { new: true }
    ).populate('agentType');

    if (!userAgent) {
      return res.status(404).json({
        success: false,
        error: 'Activated agent not found or unauthorized',
      });
    }

    res.status(200).json({
      success: true,
      message: `Agent status updated to '${status}'`,
      userAgent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
