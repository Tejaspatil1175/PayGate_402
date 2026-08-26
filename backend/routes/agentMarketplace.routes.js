const express = require('express');
const router = express.Router();
const {
  getAgentCatalog,
  getUserActiveAgents,
  activateAgent,
  toggleAgentStatus,
} = require('../controllers/agentMarketplace.controller');

router.get('/catalog', getAgentCatalog);
router.get('/active', getUserActiveAgents);
router.post('/activate', activateAgent);
router.put('/toggle', toggleAgentStatus);

module.exports = router;
