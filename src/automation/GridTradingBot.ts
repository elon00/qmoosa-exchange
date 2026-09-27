import { MatchingEngine } from '../engine/MatchingEngine.js';

export interface GridConfig {
  botId: string;
  userId: string;
  symbol: string;
  lowerPrice: number;
  upperPrice: number;
  grids: number;           // number of grid intervals (e.g. 10)
  totalInvestmentQuote: number;
}

export class GridTradingBot {
  private engine: MatchingEngine;
  public readonly config: GridConfig;
  public isRunning = false;
  private gridOrders: Map<string, { level: number; side: 'BUY' | 'SELL'; price: number }> = new Map();
  private gridPrices: number[] = [];

  constructor(engine: MatchingEngine, config: GridConfig) {
    this.engine = engine;
    this.config = config;
    this.calculateGridLevels();
  }

  private calculateGridLevels(): void {
    const market = this.engine.getMarketConfig(this.config.symbol);
    const precision = market ? (market.pricePrecision ?? 2) : 2;
    const step = (this.config.upperPrice - this.config.lowerPrice) / this.config.grids;
    this.gridPrices = [];
    for (let i = 0; i <= this.config.grids; i++) {
      this.gridPrices.push(Number((this.config.lowerPrice + i * step).toFixed(precision)));
    }
  }

  public start(): { success: boolean; placedOrders: number } {
    if (this.isRunning) return { success: false, placedOrders: 0 };
    this.isRunning = true;

    const market = this.engine.getMarketConfig(this.config.symbol);
    if (!market) return { success: false, placedOrders: 0 };

    const depth = this.engine.getDepth(this.config.symbol);
    const midPrice = depth && depth.bids.length && depth.asks.length
      ? (depth.bids[0][0] + depth.asks[0][0]) / 2
      : (this.config.lowerPrice + this.config.upperPrice) / 2;

    const quotePerGrid = this.config.totalInvestmentQuote / this.config.grids;
    let placed = 0;

    for (let i = 0; i < this.gridPrices.length; i++) {
      const price = this.gridPrices[i];
      if (price < midPrice) {
        // Place BUY below mid
        const qty = Number((quotePerGrid / price).toFixed(market.quantityPrecision ?? 2));
        try {
          const res = this.engine.placeOrder({
            userId: this.config.userId,
            symbol: this.config.symbol,
            side: 'BUY',
            type: 'LIMIT',
            price,
            quantity: qty,
          });
          this.gridOrders.set(res.order.id, { level: i, side: 'BUY', price });
          placed++;
        } catch (e) {
          // Ignored if balance locked
        }
      } else if (price > midPrice) {
        // Place SELL above mid
        const qty = Number((quotePerGrid / price).toFixed(market.quantityPrecision ?? 2));
        try {
          const res = this.engine.placeOrder({
            userId: this.config.userId,
            symbol: this.config.symbol,
            side: 'SELL',
            type: 'LIMIT',
            price,
            quantity: qty,
          });
          this.gridOrders.set(res.order.id, { level: i, side: 'SELL', price });
          placed++;
        } catch (e) {
          // Ignored if balance locked
        }
      }
    }

    return { success: true, placedOrders: placed };
  }

  public stop(): { success: boolean; cancelledOrders: number } {
    if (!this.isRunning) return { success: false, cancelledOrders: 0 };
    this.isRunning = false;

    let cancelled = 0;
    for (const [orderId] of this.gridOrders) {
      try {
        this.engine.cancelOrder(this.config.symbol, orderId, this.config.userId);
        cancelled++;
      } catch (e) {
        // May already be filled
      }
    }
    this.gridOrders.clear();
    return { success: true, cancelledOrders: cancelled };
  }

  public getStatus() {
    return {
      botId: this.config.botId,
      symbol: this.config.symbol,
      running: this.isRunning,
      activeGridOrders: this.gridOrders.size,
      gridLevels: this.config.grids,
      range: [this.config.lowerPrice, this.config.upperPrice],
    };
  }

  public getStats() {
    return this.getStatus();
  }
}
