export type Side = 'BUY' | 'SELL';

export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'TAKE_PROFIT';

export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

export interface Order {
  id: string;
  clientOrderId?: string;
  userId: string;
  symbol: string;
  side: Side;
  type: OrderType;
  price: number;       // 0 for MARKET
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: OrderStatus;
  timeInForce: TimeInForce;
  stopPrice?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  quoteQuantity: number;
  buyerOrderId: string;
  sellerOrderId: string;
  buyerUserId: string;
  sellerUserId: string;
  makerSide: Side;
  takerSide?: Side;
  fee?: number;
  timestamp: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount?: number;
  total?: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: [price: number, quantity: number][];
  asks: [price: number, quantity: number][];
  timestamp: number;
  sequence?: number;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  available: number;
  reserved: number;
  total: number;
}

export interface Kline {
  timestamp: number;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  tradesCount: number;
}

export interface MarketConfig {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision?: number;
  quantityPrecision?: number;
  basePrecision?: number;
  quotePrecision?: number;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  minQty?: number;
  tickSize?: number;
  stepSize?: number;
  takerFeeRate?: number; // e.g. 0.001 (0.1%)
  makerFeeRate?: number; // e.g. 0.0005 (0.05%)
}
