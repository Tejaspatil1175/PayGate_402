const express = require('express');
const router = express.Router();
const {
  searchRegistry,
  getRegistryBySlug,
  registerMerchantInDiscovery,
} = require('../controllers/registry.controller');

router.route('/').get(searchRegistry).post(registerMerchantInDiscovery);
router.get('/:slug', getRegistryBySlug);

module.exports = router;
