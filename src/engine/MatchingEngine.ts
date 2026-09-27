import { Order, Trade, MarketConfig, OrderBookSnapshot, Kline, Side } from './types.js';
import { OrderBook } from './OrderBook.js';
import { Ledger } from './Ledger.js';

export class MatchingEngine {
  private orderBooks: Map<string, OrderBook> = new Map();
  private marketConfigs: Map<string, MarketConfig> = new Map();
  public readonly ledger: Ledger;
  private recentTrades: Map<string, Trade[]> = new Map();
  private klines1m: Map<string, Kline[]> = new Map();
  private listeners: Set<(event: { type: string; data: any }) => void> = new Set();
  private typedListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(ledger?: Ledger) {
    this.ledger = ledger || new Ledger();
  }

  public registerMarket(config: MarketConfig): void {
    const minQty = config.minQuantity ?? config.minQty ?? 0.1;
    const makerFee = config.makerFeeRate ?? 0.001;
    const takerFee = config.takerFeeRate ?? 0.001;

    const normalizedConfig: MarketConfig = {
      ...config,
      minQuantity: minQty,
      minQty,
      makerFeeRate: makerFee,
      takerFeeRate: takerFee,
      pricePrecision: config.pricePrecision ?? config.quotePrecision ?? 4,
      quantityPrecision: config.quantityPrecision ?? config.basePrecision ?? 2,
      basePrecision: config.basePrecision ?? config.quantityPrecision ?? 2,
      quotePrecision: config.quotePrecision ?? config.pricePrecision ?? 4,
      minPrice: config.minPrice ?? 0.0001,
      maxPrice: config.maxPrice ?? 1000000
    };

    this.marketConfigs.set(normalizedConfig.symbol, normalizedConfig);
    this.orderBooks.set(normalizedConfig.symbol, new OrderBook(normalizedConfig.symbol));
    this.recentTrades.set(normalizedConfig.symbol, []);
    this.klines1m.set(normalizedConfig.symbol, []);
  }

  public getMarketConfig(symbol: string): MarketConfig | undefined {
    return this.marketConfigs.get(symbol);
  }

  public getMarket(symbol: string): MarketConfig | undefined {
    return this.getMarketConfig(symbol);
  }

  public getSupportedMarkets(): MarketConfig[] {
    return Array.from(this.marketConfigs.values());
  }

  public getAllMarkets(): MarketConfig[] {
    return this.getSupportedMarkets();
  }

  public getOrderBook(symbol: string): OrderBook | undefined {
    return this.orderBooks.get(symbol);
  }

  public getDepth(symbol: string, limit = 20): OrderBookSnapshot | null {
    const book = this.orderBooks.get(symbol);
    return book ? book.getDepth(limit) : null;
  }

  public getRecentTrades(symbol: string, limit = 50): Trade[] {
    const trades = this.recentTrades.get(symbol) || [];
    return trades.slice(-limit).reverse();
  }

  public getKlines(symbol: string, _interval = '1m', limit = 100): Kline[] {
    const klines = this.klines1m.get(symbol) || [];
    return klines.slice(-limit);
  }

  public get24HourStats(symbol: string) {
    const trades = this.recentTrades.get(symbol) || [];
    const book = this.orderBooks.get(symbol);
    const bestBid = book?.getBestBid()?.price || 0;
    const bestAsk = book?.getBestAsk()?.price || 0;

    if (trades.length === 0) {
      return {
        openPrice: 0,
        highPrice: 0,
        lowPrice: 0,
        closePrice: 0,
        volume: 0,
        quoteVolume: 0,
        tradeCount: 0,
        bidPrice: bestBid,
        askPrice: bestAsk
      };
    }

    const openPrice = trades[0].price;
    const closePrice = trades[trades.length - 1].price;
    let highPrice = -Infinity;
    let lowPrice = Infinity;
    let volume = 0;
    let quoteVolume = 0;

    for (const t of trades) {
      if (t.price > highPrice) highPrice = t.price;
      if (t.price < lowPrice) lowPrice = t.price;
      volume += t.quantity;
      quoteVolume += t.quoteQuantity;
    }

    return {
      openPrice,
      highPrice,
      lowPrice,
      closePrice,
      volume,
      quoteVolume,
      tradeCount: trades.length,
      bidPrice: bestBid,
      askPrice: bestAsk
    };
  }

  public getOpenOrders(userId: string, symbol?: string): Order[] {
    const orders: Order[] = [];
    const books = symbol ? [this.orderBooks.get(symbol)].filter(Boolean) as OrderBook[] : Array.from(this.orderBooks.values());

    for (const book of books) {
      const snap = book.getDepth(100);
      // Scan active bid/ask orders
      const bestBid = book.getBestBid();
      if (bestBid) {
        for (const o of bestBid.orders) {
          if (o.userId === userId && (o.status === 'NEW' || o.status === 'PARTIALLY_FILLED')) {
            orders.push(o);
          }
        }
      }
      const bestAsk = book.getBestAsk();
      if (bestAsk) {
        for (const o of bestAsk.orders) {
          if (o.userId === userId && (o.status === 'NEW' || o.status === 'PARTIALLY_FILLED')) {
            orders.push(o);
          }
        }
      }
    }
    return orders;
  }

  public on(event: string, handler: (data: any) => void): void {
    if (!this.typedListeners.has(event)) {
      this.typedListeners.set(event, new Set());
    }
    this.typedListeners.get(event)!.add(handler);
  }

  public subscribe(cb: (event: { type: string; data: any }) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(type: string, data: any): void {
    for (const listener of this.listeners) {
      try {
        listener({ type, data });
      } catch (err) {
        console.error('Error in engine listener:', err);
      }
    }

    const typedSet = this.typedListeners.get(type);
    if (typedSet) {
      for (const listener of typedSet) {
        try {
          listener(data);
        } catch (err) {
          console.error(`Error in typed engine listener [${type}]:`, err);
        }
      }
    }
  }

  public placeOrder(params: {
    userId: string;
    symbol: string;
    side: Side;
    type: 'LIMIT' | 'MARKET';
    price?: number;
    quantity: number;
    clientOrderId?: string;
  }): { order: Order; trades: Trade[] } {
    const config = this.marketConfigs.get(params.symbol);
    if (!config) throw new Error(`Market ${params.symbol} not supported`);
    const book = this.orderBooks.get(params.symbol);
    if (!book) throw new Error(`OrderBook for ${params.symbol} not found`);

    const minQty = config.minQuantity ?? config.minQty ?? 0;
    if (params.quantity < minQty) {
      throw new Error(`Quantity ${params.quantity} below min ${minQty}`);
    }

    const price = params.type === 'LIMIT' ? (params.price || 0) : 0;
    if (params.type === 'LIMIT' && price <= 0) {
      throw new Error('Limit order requires a positive price');
    }

    // Balance Lock Pre-condition Check
    if (params.side === 'BUY') {
      const requiredQuote = params.type === 'LIMIT' ? price * params.quantity : (this.estimateMarketBuyCost(params.symbol, params.quantity));
      const locked = this.ledger.lock(params.userId, config.quoteAsset, requiredQuote);
      if (!locked) {
        throw new Error(`Insufficient ${config.quoteAsset} balance for order`);
      }
    } else {
      const locked = this.ledger.lock(params.userId, config.baseAsset, params.quantity);
      if (!locked) {
        throw new Error(`Insufficient ${config.baseAsset} balance for order`);
      }
    }

    const order: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clientOrderId: params.clientOrderId,
      userId: params.userId,
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      price,
      quantity: params.quantity,
      filledQuantity: 0,
      remainingQuantity: params.quantity,
      status: 'NEW',
      timeInForce: 'GTC',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const trades: Trade[] = [];

    // Execute matching
    if (order.side === 'BUY') {
      this.matchBuyOrder(order, book, config, trades);
    } else {
      this.matchSellOrder(order, book, config, trades);
    }

    // If limit order has remaining quantity, add to book as Maker
    if (order.type === 'LIMIT' && order.remainingQuantity > 0) {
      book.addOrder(order);
    } else if (order.type === 'MARKET' && order.remainingQuantity > 0) {
      // Unfilled market order remainder is cancelled/unlocked
      order.status = order.filledQuantity > 0 ? 'PARTIALLY_FILLED' : 'CANCELLED';
      this.unlockRemainder(order, config);
    }

    this.emit('orderPlaced', order);
    this.emit('order_update', order);
    this.emit('depth_update', book.getDepth());

    return { order, trades };
  }

  private matchBuyOrder(order: Order, book: OrderBook, config: MarketConfig, trades: Trade[]): void {
    while (order.remainingQuantity > 0) {
      const bestAsk = book.getBestAsk();
      if (!bestAsk) break;

      // For limit order, price must be >= bestAsk.price
      if (order.type === 'LIMIT' && order.price < bestAsk.price) {
        break; // No cross
      }

      const matchPrice = bestAsk.price;
      const makerOrder = bestAsk.orders[0]; // FIFO priority
      const matchQty = Math.min(order.remainingQuantity, makerOrder.remainingQuantity);

      // Execute Trade
      const trade: Trade = {
        id: `trd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        symbol: order.symbol,
        price: matchPrice,
        quantity: matchQty,
        quoteQuantity: matchPrice * matchQty,
        buyerOrderId: order.id,
        sellerOrderId: makerOrder.id,
        buyerUserId: order.userId,
        sellerUserId: makerOrder.userId,
        makerSide: 'SELL',
        takerSide: 'BUY',
        fee: matchQty * (config.takerFeeRate || 0.001),
        timestamp: Date.now(),
      };

      // Ledger Atomic Settlement
      this.ledger.settleTrade(
        order.userId,
        makerOrder.userId,
        config.baseAsset,
        config.quoteAsset,
        matchPrice,
        matchQty,
        'SELL',
        config.makerFeeRate || 0.001,
        config.takerFeeRate || 0.001,
        trade.id
      );

      // Update Order Quantities
      order.filledQuantity += matchQty;
      order.remainingQuantity -= matchQty;
      makerOrder.filledQuantity += matchQty;
      makerOrder.remainingQuantity -= matchQty;

      if (makerOrder.remainingQuantity === 0) {
        makerOrder.status = 'FILLED';
        book.removeOrder(makerOrder.id);
      } else {
        makerOrder.status = 'PARTIALLY_FILLED';
      }
      makerOrder.updatedAt = Date.now();

      trades.push(trade);
      this.recordTrade(trade);
    }

    order.status = order.remainingQuantity === 0 ? 'FILLED' : (order.filledQuantity > 0 ? 'PARTIALLY_FILLED' : 'NEW');
    order.updatedAt = Date.now();
  }

  private matchSellOrder(order: Order, book: OrderBook, config: MarketConfig, trades: Trade[]): void {
    while (order.remainingQuantity > 0) {
      const bestBid = book.getBestBid();
      if (!bestBid) break;

      // For limit order, price must be <= bestBid.price
      if (order.type === 'LIMIT' && order.price > bestBid.price) {
        break; // No cross
      }

      const matchPrice = bestBid.price;
      const makerOrder = bestBid.orders[0]; // FIFO priority
      const matchQty = Math.min(order.remainingQuantity, makerOrder.remainingQuantity);

      // Execute Trade
      const trade: Trade = {
        id: `trd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        symbol: order.symbol,
        price: matchPrice,
        quantity: matchQty,
        quoteQuantity: matchPrice * matchQty,
        buyerOrderId: makerOrder.id,
        sellerOrderId: order.id,
        buyerUserId: makerOrder.userId,
        sellerUserId: order.userId,
        makerSide: 'BUY',
        takerSide: 'SELL',
        fee: (matchPrice * matchQty) * (config.takerFeeRate || 0.001),
        timestamp: Date.now(),
      };

      // Ledger Atomic Settlement
      this.ledger.settleTrade(
        makerOrder.userId,
        order.userId,
        config.baseAsset,
        config.quoteAsset,
        matchPrice,
        matchQty,
        'BUY',
        config.makerFeeRate || 0.001,
        config.takerFeeRate || 0.001,
        trade.id
      );

      // Update Order Quantities
      order.filledQuantity += matchQty;
      order.remainingQuantity -= matchQty;
      makerOrder.filledQuantity += matchQty;
      makerOrder.remainingQuantity -= matchQty;

      if (makerOrder.remainingQuantity === 0) {
        makerOrder.status = 'FILLED';
        book.removeOrder(makerOrder.id);
      } else {
        makerOrder.status = 'PARTIALLY_FILLED';
      }
      makerOrder.updatedAt = Date.now();

      trades.push(trade);
      this.recordTrade(trade);
    }

    order.status = order.remainingQuantity === 0 ? 'FILLED' : (order.filledQuantity > 0 ? 'PARTIALLY_FILLED' : 'NEW');
    order.updatedAt = Date.now();
  }

  public cancelOrder(
    param1: string,
    param2?: string,
    param3?: string
  ): Order | null {
    let symbol: string | undefined;
    let orderId: string;
    let userId: string;

    if (this.orderBooks.has(param1)) {
      // (symbol, orderId, userId)
      symbol = param1;
      orderId = param2!;
      userId = param3 || 'user_trader1';
    } else if (param2 && this.orderBooks.has(param2)) {
      // (orderId, symbol, userId)
      orderId = param1;
      symbol = param2;
      userId = param3 || 'user_trader1';
    } else {
      // (orderId, undefined, userId) - locate book
      orderId = param1;
      userId = param3 || param2 || 'user_trader1';
      for (const [s, b] of this.orderBooks) {
        if (b.getOrder(orderId)) {
          symbol = s;
          break;
        }
      }
    }

    if (!symbol) return null;
    const book = this.orderBooks.get(symbol);
    if (!book) return null;
    const config = this.marketConfigs.get(symbol)!;

    const order = book.getOrder(orderId);
    if (!order || order.userId !== userId) return null;

    book.removeOrder(orderId);
    order.status = 'CANCELLED';
    order.updatedAt = Date.now();

    this.unlockRemainder(order, config);

    this.emit('orderCancelled', order);
    this.emit('order_update', order);
    this.emit('depth_update', book.getDepth());

    return order;
  }

  private unlockRemainder(order: Order, config: MarketConfig): void {
    if (order.remainingQuantity <= 0) return;
    if (order.side === 'BUY') {
      const unlockAmount = order.price * order.remainingQuantity;
      this.ledger.unlock(order.userId, config.quoteAsset, unlockAmount, `CANCEL_${order.id}`);
    } else {
      this.ledger.unlock(order.userId, config.baseAsset, order.remainingQuantity, `CANCEL_${order.id}`);
    }
  }

  private estimateMarketBuyCost(symbol: string, quantity: number): number {
    const book = this.orderBooks.get(symbol);
    if (!book) return 0;
    const depth = book.getDepth(10);
    if (depth.asks.length === 0) throw new Error('Cannot execute market order on empty book');
    // Use best ask + 5% slippage buffer
    return depth.asks[0][0] * quantity * 1.05;
  }

  private recordTrade(trade: Trade): void {
    const trades = this.recentTrades.get(trade.symbol)!;
    trades.push(trade);
    if (trades.length > 500) trades.shift();

    // Update 1m Kline
    this.updateKline(trade);

    this.emit('trade', trade);
  }

  private updateKline(trade: Trade): void {
    const klines = this.klines1m.get(trade.symbol)!;
    const intervalMs = 60 * 1000;
    const bucketTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;

    let current = klines[klines.length - 1];
    if (!current || current.timestamp !== bucketTime) {
      current = {
        timestamp: bucketTime,
        openTime: bucketTime,
        closeTime: bucketTime + intervalMs - 1,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.quantity,
        quoteVolume: trade.quoteQuantity,
        tradesCount: 1,
      };
      klines.push(current);
      if (klines.length > 1000) klines.shift();
    } else {
      current.high = Math.max(current.high, trade.price);
      current.low = Math.min(current.low, trade.price);
      current.close = trade.price;
      current.volume += trade.quantity;
      current.quoteVolume += trade.quoteQuantity;
      current.tradesCount += 1;
    }

    this.emit('kline', current);
  }
}
