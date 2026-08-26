const fs = require('fs');
const Product = require('../models/Product');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads an array of multer file objects to Cloudinary and returns their secure URLs
async function uploadImagesToCloudinary(files) {
  const uploadedUrls = [];
  for (const file of files) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'paygate402/products',
    });
    uploadedUrls.push(result.secure_url);
    fs.unlink(file.path, () => {}); // clean up local temp file after upload
  }
  return uploadedUrls;
}

// Helper to parse simple CSV text into product objects
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length < headers.length) continue;

    const item = {};
    headers.forEach((header, index) => {
      item[header] = values[index];
    });

    if (item.title && item.price) {
      products.push({
        title: item.title,
        description: item.description || '',
        price: parseFloat(item.price) || 0,
        category: item.category || 'General',
        sku: item.sku || '',
        stock: parseInt(item.stock, 10) || 0,
        tags: item.tags ? item.tags.split(';').map((t) => t.trim()) : [],
      });
    }
  }

  return products;
}

// @desc    Create a new product
// @route   POST /api/catalog
exports.createProduct = async (req, res) => {
  try {
    let merchantId = req.body.merchant || req.body.merchantId || req.headers['x-merchant-id'];

    // Support extracting merchant ID from Bearer token header if passed directly
    if (!merchantId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      if (token && token.length === 24) {
        merchantId = token;
      }
    }

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required. Pass "merchant" in request body or header "x-merchant-id"',
      });
    }

    const productData = {
      ...req.body,
      merchant: merchantId,
    };

    if (req.files && req.files.length > 0) {
      productData.images = await uploadImagesToCloudinary(req.files);
    }

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get products (filtered by merchant, category, search)
// @route   GET /api/catalog
exports.getProducts = async (req, res) => {
  try {
    const { merchant, category, search, availableOnly } = req.query;
    const filter = {};

    if (merchant || req.headers['x-merchant-id']) {
      filter.merchant = merchant || req.headers['x-merchant-id'];
    }

    if (category) {
      filter.category = category;
    }

    if (availableOnly === 'true') {
      filter.isAvailable = true;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(filter)
      .populate('merchant', 'businessName email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/catalog/:id
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      'merchant',
      'businessName email phone'
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update product by ID
// @route   PUT /api/catalog/:id
exports.updateProduct = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.files && req.files.length > 0) {
      updateData.images = await uploadImagesToCloudinary(req.files);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete product by ID
// @route   DELETE /api/catalog/:id
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Bulk CSV upload / batch product import
// @route   POST /api/catalog/bulk
exports.bulkUploadCSV = async (req, res) => {
  try {
    let merchantId = req.body.merchant || req.body.merchantId || req.headers['x-merchant-id'];

    if (!merchantId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      if (token && token.length === 24) {
        merchantId = token;
      }
    }

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant ID is required for bulk upload',
      });
    }

    let productList = [];

    if (req.body.csvText && typeof req.body.csvText === 'string') {
      productList = parseCSV(req.body.csvText);
    } else if (Array.isArray(req.body.products)) {
      productList = req.body.products;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please provide csvText string or products array',
      });
    }

    if (productList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid products found to import',
      });
    }

    const itemsToInsert = productList.map((item) => ({
      ...item,
      merchant: merchantId,
    }));

    const insertedProducts = await Product.insertMany(itemsToInsert);

    res.status(201).json({
      success: true,
      message: `Successfully imported ${insertedProducts.length} products`,
      count: insertedProducts.length,
      products: insertedProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
