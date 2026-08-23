const express = require('express');
const router = express.Router();
const {
  createContract,
  verifyContract,
  getContractDetails,
} = require('../controllers/contract.controller');

router.post('/', createContract);
router.get('/:id', getContractDetails);
router.post('/:id/verify', verifyContract);

module.exports = router;
