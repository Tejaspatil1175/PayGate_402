const express = require('express');
const router = express.Router();
const {
  submitIntent,
  getIntentById,
  getAgentIntents,
  matchIntent,
} = require('../controllers/intent.controller');

router.route('/').post(submitIntent).get(getAgentIntents);
router.get('/:id', getIntentById);
router.get('/:id/matches', matchIntent);


module.exports = router;
