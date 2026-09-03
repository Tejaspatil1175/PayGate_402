/**
 * PayGate 402 - AP2 Protocol & Financial Schema Type Definitions
 * Strict contracts for autonomous agent commerce, cryptographic mandates, and ledger settlements.
 */

export type CurrencyCode = 'INR' | 'USD';

export type GateDecision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'PAYOUT_HOLD';

export interface CartItem {
  product: string;
  title: string;
  quantity: number;
  unitPrice: number; // In standard units (Rupees), non-negative integer or fixed 2-decimal
  totalPrice: number;
  variant?: string;
  category?: string;
}

export interface ContractTerms {
  agreedAmount: number;
  currency: CurrencyCode;
  validUntil: string | Date;
  termsHash?: string;
}

/**
 * AP2 Cryptographically Signed Cart Mandate
 */
export interface CartMandate {
  merchantId: string;
  buyerId: string;
  amount: number; // Stored in Rupees / Paise as integer to prevent floating point drift
  currency: CurrencyCode;
  nonce: string; // UUID v4 cryptographic nonce preventing replay
  signature: string; // Base64 RSA-PSS or Ed25519 digital signature
  mandateHash?: string;
}

/**
 * Verified Commerce Contract Model
 */
export interface CommerceContract {
  contractId: string;
  intent: string;
  merchant: string;
  agentId: string;
  userPublicKey: string;
  contractTerms: ContractTerms;
  items: CartItem[];
  mandateHash: string;
  digitalSignature: string;
  status: 'draft' | 'pending' | 'signed' | 'executed' | 'cancelled' | 'rejected';
  executedAt?: Date;
  createdAt: Date;
}

/**
 * Wallet Settlement & Ledger Entry
 */
export interface WalletLedgerEntry {
  transactionId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  referenceId: string;
  description: string;
  timestamp: Date;
}

export interface WalletAccount {
  id: string;
  owner: string;
  balance: number;
  currency: CurrencyCode;
  perTransactionCap: number;
  perDayCap: number;
  dailySpent: number;
  lastSpentResetDate: Date;
  ledger: WalletLedgerEntry[];
}

/**
 * 5-Checkpoint Verification Policy Check Request
 */
export interface PolicyPreCheckRequest {
  merchantId: string;
  agentId: string;
  amount: number;
  category?: string;
  budgetCap?: number;
  userId?: string;
}

export interface PolicyPreCheckResult {
  preCheckPassed: boolean;
  gateDecision: GateDecision;
  reason: string;
  ruleId?: string;
  reasonCode?: string;
  effectiveDiscountPercent?: number;
}

/**
 * MCP (Model Context Protocol) Tool Call Payload
 */
export interface McpToolCallRequest {
  name: 'discover_catalog' | 'check_cart_mandate';
  arguments: Record<string, unknown>;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
