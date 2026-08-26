const mongoose = require('mongoose');

const userAgentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    agentType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentType',
      required: [true, 'AgentType reference is required'],
    },
    agentSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'disabled'],
      default: 'active',
    },
    customSettings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    activatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring one activation per agent type per user
userAgentSchema.index({ user: 1, agentType: 1 }, { unique: true });

module.exports = mongoose.model('UserAgent', userAgentSchema);
