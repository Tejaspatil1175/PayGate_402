const express = require('express');
const router = express.Router();
const {
  submitIntent,
  getIntentById,
  getAgentIntents,
} = require('../controllers/intent.controller');

router.route('/').post(submitIntent).get(getAgentIntents);
router.get('/:id', getIntentById);

module.exports = router;
