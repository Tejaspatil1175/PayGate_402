const mongoose = require('mongoose');

const agentTypeSchema = new mongoose.Schema(
  {
    agentSlug: {
      type: String,
      required: [true, 'Agent slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
    },
    icon: {
      type: String,
      default: 'robot',
    },
    defaultCapabilities: [
      {
        type: String,
        trim: true,
      },
    ],
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AgentType', agentTypeSchema);
