const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  bulkUploadCSV,
} = require('../controllers/catalog.controller');

const upload = multer({ dest: 'uploads/' });

router.route('/').post(upload.array('images', 5), createProduct).get(getProducts);
router.post('/bulk', bulkUploadCSV);
router
  .route('/:id')
  .get(getProductById)
  .put(upload.array('images', 5), updateProduct)
  .delete(deleteProduct);

module.exports = router;
