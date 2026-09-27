/**
 * x402 Bazaar Protocol v2 — Standard Type Definitions for Qmoosa Exchange
 * Machine-to-Machine (M2M) Agent Commerce & Micropayment Fee Settlement
 */

export interface X402PaymentRoute {
  chain: 'solana' | 'evm' | 'ton';
  caip2: string;
  currency: string;
  payTo: string;
  tokenMint?: string;
  name: string;
}

export interface X402ServiceDefinition {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST';
  name: string;
  description: string;
  cost: string;
  amountUnits: string;
  currency: string;
  acceptedChains: string[];
}

export interface X402BazaarManifest {
  $schema: string;
  x402Version: number;
  name: string;
  category: string;
  description: string;
  provider: {
    name: string;
    website: string;
    github: string;
  };
  meshNodeId: string;
  synchronizedAt: string;
  paymentRoutes: Record<string, X402PaymentRoute>;
  services: X402ServiceDefinition[];
}

export interface X402PaymentChallenge {
  nonce: string;
  service: string;
  cost: string;
  amountUnits: string;
  currency: string;
  issuedAt: number;
  expiresAt: number;
  acceptedRoutes: X402PaymentRoute[];
}

export interface X402PaymentProof {
  nonce: string;
  service: string;
  chain: 'solana' | 'evm' | 'ton';
  payer: string;
  signature: string;
  txHash?: string;
  timestamp: number;
}

export interface X402Receipt {
  receiptId: string;
  nonce: string;
  service: string;
  payer: string;
  chain: string;
  settledAmount: string;
  settledAt: string;
  status: 'SETTLED' | 'VERIFIED';
}

export interface X402ArbitrageSignal {
  id: string;
  pair: string;
  cexPrice: number;
  zeroExPrice: number;
  ammPrice: number;
  spreadBps: number;
  recommendedRoute: string;
  expectedProfitPct: number;
  timestamp: number;
}

/**
 * Standard Unified Multi-Chain Identity
 */
export const UNIFIED_X402_IDENTITIES = {
  solanaWallet: 'BPshPrMazV7qunhcq18AvCHjSceHbKytiRDNrtCv68g3',
  evmOwner: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
  gramTonWallet: 'UQAJO_hgYMZq3ULuzFv7927z-WgsM0BApc0IRniDrHORTzm3'
};
