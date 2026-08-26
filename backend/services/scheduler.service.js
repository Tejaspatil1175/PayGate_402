const ScheduledTask = require('../models/ScheduledTask');
const logger = require('../utils/logger');

/**
 * Create a new scheduled task (e.g. "Buy running shoes under ₹2000 at 6 PM")
 */
async function createScheduledTask(userId, params = {}) {
  const {
    taskName,
    itemKeywords,
    category = 'General',
    budgetCap,
    brandPreference = '',
    scheduleTime,
    cronExpression = '',
  } = params;

  if (!userId) {
    throw new Error('User ID is required to schedule task');
  }
  if (!itemKeywords || !budgetCap) {
    throw new Error('itemKeywords and budgetCap are required');
  }
  if (!scheduleTime) {
    throw new Error('scheduleTime timestamp is required');
  }

  const targetDate = new Date(scheduleTime);
  if (isNaN(targetDate.getTime())) {
    throw new Error('Invalid scheduleTime date format');
  }

  const name = taskName || `Buy ${itemKeywords} (Cap: ₹${budgetCap})`;

  const task = await ScheduledTask.create({
    user: userId,
    taskName: name,
    intent: {
      category,
      itemKeywords,
      budgetCap: Number(budgetCap),
      brandPreference,
    },
    scheduleTime: targetDate,
    cronExpression,
    status: 'scheduled',
    isActive: true,
  });

  logger.info(`[SCHEDULER] Scheduled task "${task.taskName}" for user ${userId} at ${targetDate.toISOString()}`);
  return task;
}

/**
 * Fetch scheduled tasks for a user
 */
async function getUserScheduledTasks(userId) {
  if (!userId) return [];
  return await ScheduledTask.find({ user: userId, isActive: true })
    .sort({ scheduleTime: 1 })
    .populate('executionLog.order')
    .lean();
}

/**
 * Get all pending tasks due for execution (scheduleTime <= now)
 */
async function getPendingTasksToExecute() {
  const now = new Date();
  return await ScheduledTask.find({
    status: 'scheduled',
    isActive: true,
    scheduleTime: { $lte: now },
  }).populate('user');
}

/**
 * Update task status after execution attempt
 */
async function updateTaskExecutionStatus(taskId, status, details = {}) {
  const { orderId, errorMessage } = details;

  const update = {
    status,
    executionLog: {
      executedAt: new Date(),
      status,
      order: orderId || null,
      errorMessage: errorMessage || '',
    },
  };

  if (status === 'executed' || status === 'failed') {
    update.isActive = false;
  }

  const task = await ScheduledTask.findByIdAndUpdate(taskId, update, { new: true });
  logger.info(`[SCHEDULER] Task ${taskId} updated status to '${status}'`);
  return task;
}

/**
 * Cancel a scheduled task
 */
async function cancelScheduledTask(taskId, userId) {
  const task = await ScheduledTask.findOneAndUpdate(
    { _id: taskId, user: userId },
    { status: 'cancelled', isActive: false },
    { new: true }
  );

  if (!task) {
    throw new Error('Scheduled task not found or unauthorized');
  }

  logger.info(`[SCHEDULER] Task ${taskId} cancelled by user ${userId}`);
  return task;
}

module.exports = {
  createScheduledTask,
  getUserScheduledTasks,
  getPendingTasksToExecute,
  updateTaskExecutionStatus,
  cancelScheduledTask,
};
