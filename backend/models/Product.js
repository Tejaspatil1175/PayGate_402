const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    option: {
      type: String,
      required: true,
      trim: true,
    },
    priceOffset: {
      type: Number,
      default: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: [true, 'Merchant reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    variants: [variantSchema],
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

productSchema.index({ merchant: 1, title: 1 });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
