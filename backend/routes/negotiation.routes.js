const express = require('express');
const router = express.Router();
const { initiate, respond, getDetails } = require('../controllers/negotiation.controller');

router.post('/', initiate);
router.get('/:id', getDetails);
router.post('/:id/respond', respond);

module.exports = router;
