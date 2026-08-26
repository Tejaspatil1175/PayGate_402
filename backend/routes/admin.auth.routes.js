const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../controllers/admin.auth.controller');

router.post('/login', login);
router.get('/me', getProfile);

module.exports = router;
