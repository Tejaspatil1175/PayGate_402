const express = require('express');
const router = express.Router();
const {
  createContract,
  verifyContract,
  getContractDetails,
  preCheckPolicy,
} = require('../controllers/contract.controller');

const { CreateContractSchema, validateBody } = require('../middleware/schemaValidation');

router.post('/', validateBody(CreateContractSchema), createContract);
router.post('/precheck', preCheckPolicy);
router.get('/:id', getContractDetails);
router.post('/:id/verify', verifyContract);


module.exports = router;
