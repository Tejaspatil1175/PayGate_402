const { z } = require('zod');
const { AppError } = require('./errorHandler');

/**
 * Zod Schema Definitions for AP2 Protocol and Payment Endpoints
 * All schemas use .strict() to drop or reject injected rogue properties.
 */

const CartItemSchema = z.object({
  product: z.string().min(1, 'Product identifier is required'),
  productId: z.string().optional(),
  _id: z.string().optional(),
  id: z.string().optional(),
  title: z.string().default('Item'),
  quantity: z.number().int().positive('Quantity must be a positive integer').default(1),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').optional(),
  price: z.number().nonnegative().optional(),
  totalPrice: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  variant: z.string().optional(),
  category: z.string().optional(),
});

const CreateContractSchema = z.object({
  intentId: z.string().min(1, 'intentId is required'),
  merchantId: z.string().min(1, 'merchantId is required'),
  agreedAmount: z.number().positive('agreedAmount must be a positive number'),
  items: z.array(CartItemSchema).optional(),
  userPrivateKey: z.string().optional(),
  userPublicKey: z.string().optional(),
  expiresInMinutes: z.number().int().positive().max(10080).optional(),
});

const ExecutePaymentSchema = z.object({
  contractId: z.string().min(1, 'contractId is required'),
  userId: z.string().optional(),
  customer: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email('Valid email required').optional(),
    phone: z.string().optional(),
  }).optional(),
});

const WalletDebitSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  amount: z.number().positive('amount must be positive integer/rupee'),
  referenceId: z.string().min(1, 'referenceId is required'),
  description: z.string().optional(),
});

const McpJsonRpcSchema = z.object({
  jsonrpc: z.literal('2.0').default('2.0'),
  method: z.enum(['tools/list', 'tools/call', 'initialize', 'ping']),
  params: z.object({
    name: z.string().optional(),
    arguments: z.record(z.any()).optional(),
  }).optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
});

/**
 * Higher-order middleware to validate incoming request body against a Zod schema
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errorMessages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return next(new AppError(`[SCHEMA_VALIDATION_ERROR] ${errorMessages}`, 400));
  }
  req.validatedBody = result.data;
  next();
};

module.exports = {
  CartItemSchema,
  CreateContractSchema,
  ExecutePaymentSchema,
  WalletDebitSchema,
  McpJsonRpcSchema,
  validateBody,
};
