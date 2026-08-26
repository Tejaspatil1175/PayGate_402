const mongoose = require('mongoose');

const scheduledTaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    taskName: {
      type: String,
      required: true,
      trim: true,
    },
    intent: {
      category: {
        type: String,
        default: 'General',
      },
      itemKeywords: {
        type: String,
        required: true,
      },
      budgetCap: {
        type: Number,
        required: true,
        min: 0,
      },
      brandPreference: {
        type: String,
        default: '',
      },
    },
    scheduleTime: {
      type: Date,
      required: [true, 'Schedule execution time is required'],
    },
    cronExpression: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['scheduled', 'executed', 'failed', 'cancelled'],
      default: 'scheduled',
    },
    executionLog: {
      executedAt: Date,
      status: String,
      order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
      errorMessage: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

scheduledTaskSchema.index({ status: 1, scheduleTime: 1 });
scheduledTaskSchema.index({ user: 1 });

module.exports = mongoose.model('ScheduledTask', scheduledTaskSchema);
