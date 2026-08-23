const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/merchant.auth.controller');

router.post('/register', register);
router.post('/login', login);
router.get('/me', getProfile);

module.exports = router;
