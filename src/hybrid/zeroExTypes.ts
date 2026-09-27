import { Address, Hex } from 'viem';

export interface ZeroExLimitOrder {
  makerToken: Address;
  takerToken: Address;
  makerAmount: string; // uint128 string
  takerAmount: string; // uint128 string
  takerTokenFeeAmount: string; // uint128 string
  maker: Address;
  taker: Address;
  sender: Address;
  feeRecipient: Address;
  pool: Hex; // bytes32 hex
  expiry: string; // uint64 timestamp string
  salt: string; // uint256 string
}

export enum ZeroExSignatureType {
  ILLEGAL = 0,
  INVALID = 1,
  EIP712 = 2,
  ETHSIGN = 3,
  PRESIGNED = 4
}

export interface ZeroExSignature {
  signatureType: ZeroExSignatureType;
  v: number;
  r: Hex;
  s: Hex;
}

export interface SignedZeroExOrder {
  order: ZeroExLimitOrder;
  signature: ZeroExSignature;
  orderHash: Hex;
  metaData: {
    orderHash: Hex;
    remainingFillableTakerAmount: string;
    createdAt: number;
    filledTakerAmount?: string;
    status: 'FILLABLE' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  };
}

export interface ZeroExOrderBookRecord {
  order: ZeroExLimitOrder;
  signature: ZeroExSignature;
  metaData: {
    orderHash: Hex;
    remainingFillableTakerAmount: string;
    createdAt: number;
  };
}

export interface ZeroExOrderBookResponse {
  bids: {
    total: number;
    page: number;
    perPage: number;
    records: ZeroExOrderBookRecord[];
  };
  asks: {
    total: number;
    page: number;
    perPage: number;
    records: ZeroExOrderBookRecord[];
  };
}

export interface LiquiditySource {
  name: string;
  proportion: string; // e.g. "0.6"
  liquidityUsd: number;
  avgSlippagePct: number;
}

export interface ZeroExSwapPrice {
  chainId: number;
  price: string;
  grossPrice: string;
  buyAmount: string;
  sellAmount: string;
  buyTokenAddress: Address;
  sellTokenAddress: Address;
  sources: LiquiditySource[];
  allowanceTarget: Address;
  gasPrice: string;
  estimatedGas: string;
}

export interface ZeroExSwapQuote extends ZeroExSwapPrice {
  to: Address;
  data: Hex; // 0x Exchange Proxy execution calldata
  value: string;
  protocolFee: string;
  minBuyAmount: string;
  guaranteedPrice: string;
  orders?: SignedZeroExOrder[];
}

// 0x Protocol Canonical Addresses
export const ZERO_EX_EXCHANGE_PROXY: Record<number, Address> = {
  1: '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // Ethereum Mainnet
  137: '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // Polygon
  42161: '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // Arbitrum
  10: '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // Optimism
  8453: '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // Base
  56: '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // BNB Chain
};

// Known Standard Token Addresses
export const KNOWN_TOKENS: Record<string, { symbol: string; address: Address; decimals: number }> = {
  USDT: {
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6
  },
  WETH: {
    symbol: 'WETH',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18
  },
  TON: {
    symbol: 'TON',
    address: '0x582d872A1B094FC48F5DE31D3B73F2D9bE47def1', // Wrapped TON on Ethereum
    decimals: 9
  },
  WBTC: {
    symbol: 'WBTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8
  }
};
