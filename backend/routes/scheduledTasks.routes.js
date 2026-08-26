const express = require('express');
const router = express.Router();
const {
  createScheduledTask,
  getUserScheduledTasks,
  cancelScheduledTask,
} = require('../services/scheduler.service');
const { executeSingleScheduledTask } = require('../jobs/scheduledTasks.job');
const ScheduledTask = require('../models/ScheduledTask');

function getUserIdFromReq(req) {
  return req.body.userId || req.query.userId || req.headers['x-user-id'];
}

// @desc    Get all scheduled tasks for buyer
// @route   GET /api/scheduled-tasks
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const tasks = await getUserScheduledTasks(userId);
    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Create a new scheduled task (e.g. "Buy at 6 PM")
// @route   POST /api/scheduled-tasks
router.post('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { taskName, itemKeywords, category, budgetCap, brandPreference, scheduleTime } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const task = await createScheduledTask(userId, {
      taskName,
      itemKeywords,
      category,
      budgetCap,
      brandPreference,
      scheduleTime,
    });

    res.status(201).json({
      success: true,
      message: 'Task scheduled successfully',
      task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Cancel a scheduled task
// @route   DELETE /api/scheduled-tasks/:taskId
router.delete('/:taskId', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { taskId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const cancelledTask = await cancelScheduledTask(taskId, userId);
    res.status(200).json({
      success: true,
      message: 'Scheduled task cancelled',
      task: cancelledTask,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Manually trigger immediate execution of a scheduled task (for testing)
// @route   POST /api/scheduled-tasks/:taskId/execute-now
router.post('/:taskId/execute-now', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await ScheduledTask.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled task not found',
      });
    }

    const resultOrder = await executeSingleScheduledTask(task);

    if (!resultOrder) {
      return res.status(400).json({
        success: false,
        message: 'Task execution failed or skipped (check task logs)',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Scheduled task executed successfully',
      order: resultOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
