const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  bulkUploadCSV,
} = require('../controllers/catalog.controller');

router.route('/').post(createProduct).get(getProducts);
router.post('/bulk', bulkUploadCSV);
router.route('/:id').get(getProductById).put(updateProduct).delete(deleteProduct);

module.exports = router;
