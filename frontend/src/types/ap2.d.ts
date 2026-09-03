/**
 * PayGate 402 - Frontend AP2 Protocol & Financial Type Definitions
 */

export type CurrencyCode = 'INR' | 'USD';

export type GateDecision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'PAYOUT_HOLD';

export interface CartMandate {
  merchantId: string;
  buyerId: string;
  amount: number;
  currency: CurrencyCode;
  nonce: string;
  signature: string;
  mandateHash?: string;
}

export interface CommerceContract {
  contractId: string;
  intent: string;
  merchant: string | { _id: string; businessName: string };
  agentId: string;
  contractTerms: {
    agreedAmount: number;
    currency: CurrencyCode;
    validUntil: string;
  };
  items: Array<{
    product: string;
    title: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  mandateHash: string;
  digitalSignature: string;
  status: 'draft' | 'pending' | 'signed' | 'executed' | 'cancelled' | 'rejected';
}

export interface McpToolInfo {
  name: string;
  description: string;
  safe: boolean;
  pipelineGates: string[];
}
