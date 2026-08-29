const fs = require('fs');
const Product = require('../models/Product');
const cloudinary = require('cloudinary').v2;
const XLSX = require('xlsx');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads an array of multer file objects to Cloudinary (or falls back to base64 Data URI if credentials unset)
async function uploadImagesToCloudinary(files) {
  const uploadedUrls = [];
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const hasCloudinary = Boolean(cloudName && apiKey && apiSecret);

  if (hasCloudinary) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  for (const file of files) {
    try {
      if (hasCloudinary) {
        console.log(`[Catalog] Uploading image ${file.originalname || file.path} to Cloudinary...`);
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'paygate402/products',
        });
        console.log(`[Catalog] Upload success! Secure URL:`, result.secure_url);
        uploadedUrls.push(result.secure_url);
      } else {
        console.warn('[Catalog] Cloudinary credentials not configured, falling back to base64 Data URI.');
        const fileData = fs.readFileSync(file.path);
        const mimeType = file.mimetype || 'image/jpeg';
        uploadedUrls.push(`data:${mimeType};base64,${fileData.toString('base64')}`);
      }
    } catch (err) {
      console.error('[Catalog] Cloudinary upload error:', err.message);
      try {
        const fileData = fs.readFileSync(file.path);
        const mimeType = file.mimetype || 'image/jpeg';
        uploadedUrls.push(`data:${mimeType};base64,${fileData.toString('base64')}`);
      } catch (e) {
        console.error('[Catalog] File read error on fallback:', e.message);
      }
    } finally {
      if (fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
    }
  }
  return uploadedUrls;
}

// Helper to safely extract and normalize image URLs to an array of valid strings
function normalizeImages(rawImages) {
  if (!rawImages) return [];

  // If it's a string, try JSON.parse in case it's a stringified array/object
  if (typeof rawImages === 'string') {
    const trimmed = rawImages.trim();
    if (
      !trimmed ||
      trimmed === '""' ||
      trimmed === "''" ||
      trimmed === '[]' ||
      trimmed === '{}' ||
      trimmed === '[ {} ]' ||
      trimmed === '[{}]' ||
      trimmed === '[object Object]'
    ) {
      return [];
    }
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeImages(parsed);
      } catch (e) {
        if (trimmed.includes(',')) {
          return trimmed
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && (s.startsWith('http') || s.startsWith('data:')));
        }
        return [trimmed];
      }
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter((s) => Boolean(s) && s !== '{}' && s !== '[object Object]');
    }
    return [trimmed];
  }

  // If it's an array
  if (Array.isArray(rawImages)) {
    const result = [];
    for (const item of rawImages) {
      if (!item) continue;
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed && trimmed !== '{}' && trimmed !== '[object Object]' && trimmed !== '[ {} ]') {
          result.push(trimmed);
        }
      } else if (typeof item === 'object') {
        const url = item.url || item.secure_url || item.path || item.src || item.imageUrl;
        if (url && typeof url === 'string' && url.trim()) {
          result.push(url.trim());
        }
      }
    }
    return result;
  }

  // If it's an object with url/secure_url properties
  if (typeof rawImages === 'object') {
    const url = rawImages.url || rawImages.secure_url || rawImages.path || rawImages.src || rawImages.imageUrl;
    if (url && typeof url === 'string' && url.trim()) {
      return [url.trim()];
    }
    return [];
  }

  return [];
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
        tags: item.tags ? item.tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
        images: item.images ? item.images.split(';').map((img) => img.trim()).filter(Boolean) : (item.image ? [item.image.trim()] : []),
      });
    }
  }

  return products;
}

// Helper to parse Excel (.xlsx, .xls) workbook into product objects
function parseExcel(filePathOrBuffer) {
  try {
    const workbook = typeof filePathOrBuffer === 'string'
      ? XLSX.readFile(filePathOrBuffer)
      : XLSX.read(filePathOrBuffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    return rawRows.map((row) => {
      const normalized = {};
      Object.keys(row).forEach((k) => {
        normalized[k.trim().toLowerCase()] = row[k];
      });

      const tags = normalized.tags
        ? (typeof normalized.tags === 'string' ? normalized.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [String(normalized.tags)])
        : [];

      const images = normalized.images
        ? (typeof normalized.images === 'string' ? normalized.images.split(/[;,]/).map((img) => img.trim()).filter(Boolean) : [String(normalized.images)])
        : (normalized.image ? [String(normalized.image).trim()] : (normalized.imageurl ? [String(normalized.imageurl).trim()] : []));

      return {
        title: String(normalized.title || normalized.name || '').trim(),
        description: String(normalized.description || '').trim(),
        price: parseFloat(normalized.price) || 0,
        category: String(normalized.category || 'General').trim(),
        sku: String(normalized.sku || '').trim(),
        stock: parseInt(normalized.stock, 10) || 0,
        tags,
        images,
      };
    }).filter((p) => p.title && p.price > 0);
  } catch (err) {
    console.error('[Catalog parseExcel Error]:', err.message);
    return [];
  }
}

// @desc    Create a new product
// @route   POST /api/catalog
exports.createProduct = async (req, res) => {
  try {
    console.log('[Catalog createProduct] req.files:', req.files ? req.files.length : 0, 'req.body:', req.body);

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
      price: Number(req.body.price) || 0,
      stock: Number(req.body.stock) || 0,
    };

    // Handle tags safely
    if (req.body.tags) {
      if (Array.isArray(req.body.tags)) {
        productData.tags = req.body.tags.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter(Boolean);
      } else if (typeof req.body.tags === 'string') {
        try {
          const parsed = JSON.parse(req.body.tags);
          if (Array.isArray(parsed)) {
            productData.tags = parsed.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter(Boolean);
          } else {
            productData.tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
          }
        } catch (e) {
          productData.tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
    } else {
      productData.tags = [];
    }

    // Handle images cleanly
    if (req.files && req.files.length > 0) {
      productData.images = await uploadImagesToCloudinary(req.files);
    } else if (req.body.images) {
      productData.images = normalizeImages(req.body.images);
    } else if (req.body.imageUrl) {
      productData.images = normalizeImages(req.body.imageUrl);
    } else if (req.body.image) {
      productData.images = normalizeImages(req.body.image);
    } else {
      productData.images = [];
    }

    // Clean up variants and attributes if invalid
    if (typeof productData.variants === 'string') {
      try {
        productData.variants = JSON.parse(productData.variants);
      } catch (e) {
        delete productData.variants;
      }
    }
    if (!Array.isArray(productData.variants)) {
      delete productData.variants;
    }

    if (typeof productData.attributes === 'string') {
      try {
        productData.attributes = JSON.parse(productData.attributes);
      } catch (e) {
        delete productData.attributes;
      }
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
    } else if (req.body.images !== undefined) {
      updateData.images = normalizeImages(req.body.images);
    } else if (req.body.imageUrl) {
      updateData.images = normalizeImages(req.body.imageUrl);
    }

    if (req.body.price !== undefined) updateData.price = Number(req.body.price) || 0;
    if (req.body.stock !== undefined) updateData.stock = Number(req.body.stock) || 0;
    if (req.body.tags !== undefined) {
      if (Array.isArray(req.body.tags)) {
        updateData.tags = req.body.tags.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter(Boolean);
      } else if (typeof req.body.tags === 'string') {
        try {
          const parsed = JSON.parse(req.body.tags);
          if (Array.isArray(parsed)) {
            updateData.tags = parsed.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter(Boolean);
          } else {
            updateData.tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
          }
        } catch (e) {
          updateData.tags = req.body.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
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

    if (req.file && req.file.path) {
      try {
        const originalName = (req.file.originalname || '').toLowerCase();
        const isExcel =
          originalName.endsWith('.xlsx') ||
          originalName.endsWith('.xls') ||
          req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          req.file.mimetype === 'application/vnd.ms-excel';

        if (isExcel) {
          productList = parseExcel(req.file.path);
        } else {
          const fileContent = fs.readFileSync(req.file.path, 'utf8');
          productList = parseCSV(fileContent);
        }

        // Clean up temp file
        fs.unlink(req.file.path, () => {});
      } catch (fileErr) {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({
          success: false,
          error: 'Failed to parse uploaded file: ' + fileErr.message,
        });
      }
    } else if (req.body.csvText && typeof req.body.csvText === 'string') {
      productList = parseCSV(req.body.csvText);
    } else if (Array.isArray(req.body.products)) {
      productList = req.body.products;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please provide a CSV/Excel file, csvText string, or products array',
      });
    }

    if (productList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid products found to import',
      });
    }

    const itemsToInsert = productList.map((item) => {
      const sanitized = {
        ...item,
        merchant: merchantId,
        price: Number(item.price) || 0,
        stock: Number(item.stock) || 0,
        images: normalizeImages(item.images || item.imageUrl || item.image),
      };
      if (item.tags) {
        if (Array.isArray(item.tags)) {
          sanitized.tags = item.tags.map((t) => (typeof t === 'string' ? t.trim() : String(t))).filter(Boolean);
        } else if (typeof item.tags === 'string') {
          sanitized.tags = item.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
      return sanitized;
    });

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
