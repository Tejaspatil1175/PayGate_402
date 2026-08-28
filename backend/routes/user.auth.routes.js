const express = require('express');
const router = express.Router();
const { register, login, getProfile, updatePublicKey } = require('../controllers/user.auth.controller');

router.post('/register', register);
router.post('/login', login);
router.get('/me', getProfile);
router.post('/keys', updatePublicKey);

module.exports = router;
