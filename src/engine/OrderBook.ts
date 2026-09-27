import { Order, OrderBookSnapshot, Side } from './types.js';

export class OrderBook {
  public readonly symbol: string;
  // Price level -> Map of orderId -> Order
  private bids: Map<number, Map<string, Order>> = new Map();
  private asks: Map<number, Map<string, Order>> = new Map();
  // Quick lookup orderId -> { side, price, order }
  private orderIndex: Map<string, { side: Side; price: number; order: Order }> = new Map();
  private sequence: number = 0;

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  public addOrder(order: Order): void {
    const book = order.side === 'BUY' ? this.bids : this.asks;
    let priceMap = book.get(order.price);
    if (!priceMap) {
      priceMap = new Map<string, Order>();
      book.set(order.price, priceMap);
    }
    priceMap.set(order.id, order);
    this.orderIndex.set(order.id, { side: order.side, price: order.price, order });
    this.sequence++;
  }

  public removeOrder(orderId: string): Order | null {
    const entry = this.orderIndex.get(orderId);
    if (!entry) return null;

    const { side, price, order } = entry;
    const book = side === 'BUY' ? this.bids : this.asks;
    const priceMap = book.get(price);

    if (priceMap) {
      priceMap.delete(orderId);
      if (priceMap.size === 0) {
        book.delete(price);
      }
    }

    this.orderIndex.delete(orderId);
    this.sequence++;
    return order;
  }

  public getOrder(orderId: string): Order | undefined {
    return this.orderIndex.get(orderId)?.order;
  }

  public getBestBid(): { price: number; orders: Order[] } | null {
    if (this.bids.size === 0) return null;
    let maxPrice = -Infinity;
    for (const p of this.bids.keys()) {
      if (p > maxPrice) maxPrice = p;
    }
    const ordersMap = this.bids.get(maxPrice);
    if (!ordersMap || ordersMap.size === 0) return null;
    return { price: maxPrice, orders: Array.from(ordersMap.values()) };
  }

  public getBestAsk(): { price: number; orders: Order[] } | null {
    if (this.asks.size === 0) return null;
    let minPrice = Infinity;
    for (const p of this.asks.keys()) {
      if (p < minPrice) minPrice = p;
    }
    const ordersMap = this.asks.get(minPrice);
    if (!ordersMap || ordersMap.size === 0) return null;
    return { price: minPrice, orders: Array.from(ordersMap.values()) };
  }

  public getSpread(): { bid: number | null; ask: number | null; spread: number | null } {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    const bid = bestBid ? bestBid.price : null;
    const ask = bestAsk ? bestAsk.price : null;
    const spread = bid !== null && ask !== null ? ask - bid : null;
    return { bid, ask, spread };
  }

  public getDepth(limit = 20): OrderBookSnapshot {
    // Sort bids descending
    const sortedBidPrices = Array.from(this.bids.keys()).sort((a, b) => b - a).slice(0, limit);
    const bids: [number, number][] = sortedBidPrices.map(p => {
      const orders = this.bids.get(p)!;
      let totalQty = 0;
      for (const ord of orders.values()) totalQty += ord.remainingQuantity;
      return [p, Number(totalQty.toFixed(8))];
    });

    // Sort asks ascending
    const sortedAskPrices = Array.from(this.asks.keys()).sort((a, b) => a - b).slice(0, limit);
    const asks: [number, number][] = sortedAskPrices.map(p => {
      const orders = this.asks.get(p)!;
      let totalQty = 0;
      for (const ord of orders.values()) totalQty += ord.remainingQuantity;
      return [p, Number(totalQty.toFixed(8))];
    });

    return {
      symbol: this.symbol,
      bids,
      asks,
      timestamp: Date.now(),
      sequence: this.sequence,
    };
  }

  public clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.orderIndex.clear();
    this.sequence++;
  }
}
