const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const Merchant = require('../models/Merchant');

/**
 * Generate agent-catalog JSON object for a specific merchant or all available products
 * @param {string} [merchantId] - Optional merchant ID to filter products
 * @returns {Promise<Object>} Standardized AP2/x402 agent-catalog object
 */
async function generateAgentCatalog(merchantId = null) {
  const filter = { isAvailable: true };
  if (merchantId) {
    filter.merchant = merchantId;
  }

  const products = await Product.find(filter)
    .populate('merchant', 'businessName email phone businessCategory')
    .lean();

  let merchantInfo = null;
  if (merchantId) {
    const merchantDoc = await Merchant.findById(merchantId).lean();
    if (merchantDoc) {
      merchantInfo = {
        id: merchantDoc._id,
        businessName: merchantDoc.businessName,
        email: merchantDoc.email,
        category: merchantDoc.businessCategory,
      };
    }
  }

  const catalogItems = products.map((prod) => ({
    id: prod._id.toString(),
    title: prod.title,
    description: prod.description || '',
    price: {
      amount: prod.price,
      currency: prod.currency || 'INR',
    },
    category: prod.category || 'General',
    sku: prod.sku || '',
    stock: prod.stock || 0,
    inStock: (prod.stock || 0) > 0,
    images: prod.images || [],
    attributes: prod.attributes || {},
    variants: (prod.variants || []).map((v) => ({
      id: v._id ? v._id.toString() : '',
      name: v.name,
      option: v.option,
      priceOffset: v.priceOffset || 0,
      stock: v.stock || 0,
      sku: v.sku || '',
    })),
    merchant: prod.merchant
      ? {
          id: prod.merchant._id,
          name: prod.merchant.businessName,
          category: prod.merchant.businessCategory,
        }
      : merchantInfo,
    updatedAt: prod.updatedAt || prod.createdAt,
  }));

  return {
    protocol: 'AP2/x402',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    itemCount: catalogItems.length,
    merchant: merchantInfo,
    catalog: catalogItems,
  };
}

/**
 * Write agent-catalog.json to physical public directory (e.g. public/.well-known/)
 * @param {string} [merchantId]
 * @param {string} [customPath]
 */
async function writeCatalogToFile(merchantId = null, customPath = null) {
  const catalogData = await generateAgentCatalog(merchantId);
  const targetDir = customPath || path.join(__dirname, '..', 'public', '.well-known');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, 'agent-catalog.json');
  fs.writeFileSync(filePath, JSON.stringify(catalogData, null, 2), 'utf8');

  return {
    filePath,
    catalogData,
  };
}

module.exports = {
  generateAgentCatalog,
  writeCatalogToFile,
};
