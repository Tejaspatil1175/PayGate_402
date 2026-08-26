const express = require('express');
const multer = require('multer');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/merchant.auth.controller');

const upload = multer({ dest: 'uploads/' });

router.post('/register', upload.single('logo'), register);
router.post('/login', login);
router.get('/me', getProfile);

module.exports = router;
