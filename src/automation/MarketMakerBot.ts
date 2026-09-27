import { MatchingEngine } from '../engine/MatchingEngine.js';

export interface MarketMakerConfig {
  symbol: string;
  botUserId: string;
  baseAnchorPrice: number;
  spreadBps: number;       // e.g. 20 bps = 0.2%
  levels: number;          // number of bid/ask ladder steps (e.g. 5)
  levelStepBps: number;    // spread expansion per step (e.g. 10 bps)
  quantityPerLevel: number;
  volatilityJitter: number; // random walk tick variation
}

export class MarketMakerBot {
  private engine: MatchingEngine;
  private config: MarketMakerConfig;
  public isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private activeOrders: string[] = [];
  private currentAnchorPrice: number;

  constructor(engine: MatchingEngine, config: MarketMakerConfig) {
    this.engine = engine;
    this.config = config;
    this.currentAnchorPrice = config.baseAnchorPrice;

    // Seed bot with abundant liquidity
    const market = engine.getMarketConfig(config.symbol);
    if (market) {
      engine.ledger.deposit(config.botUserId, market.baseAsset, 10000000);
      engine.ledger.deposit(config.botUserId, market.quoteAsset, 50000000);
    }
  }

  public start(intervalMs = 2500): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.quote();

    this.timer = setInterval(() => {
      if (!this.isRunning) return;
      this.stepPrice();
      this.refreshQuotes();
    }, intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.cancelAllQuotes();
  }

  private stepPrice(): void {
    const deviation = (this.currentAnchorPrice - this.config.baseAnchorPrice) / this.config.baseAnchorPrice;
    const meanReversionForce = -deviation * 0.05;
    const randomShock = (Math.random() - 0.49) * (this.config.volatilityJitter / 100);
    this.currentAnchorPrice = Number((this.currentAnchorPrice * (1 + randomShock + meanReversionForce)).toFixed(4));
  }

  private refreshQuotes(): void {
    this.cancelAllQuotes();
    this.quote();
  }

  private quote(): void {
    const market = this.engine.getMarketConfig(this.config.symbol);
    if (!market) return;

    this.activeOrders = [];
    const baseSpread = (this.config.spreadBps / 10000) / 2;
    const pricePrec = market.pricePrecision ?? market.quotePrecision ?? 4;
    const qtyPrec = market.quantityPrecision ?? market.basePrecision ?? 2;

    for (let i = 1; i <= this.config.levels; i++) {
      const stepOffset = (i - 1) * (this.config.levelStepBps / 10000);
      const bidPrice = Number((this.currentAnchorPrice * (1 - baseSpread - stepOffset)).toFixed(pricePrec));
      const askPrice = Number((this.currentAnchorPrice * (1 + baseSpread + stepOffset)).toFixed(pricePrec));
      const qty = Number((this.config.quantityPerLevel * (1 + i * 0.15)).toFixed(qtyPrec));

      // Place Bid
      try {
        const bidRes = this.engine.placeOrder({
          userId: this.config.botUserId,
          symbol: this.config.symbol,
          side: 'BUY',
          type: 'LIMIT',
          price: bidPrice,
          quantity: qty,
        });
        if (bidRes.order.status === 'NEW' || bidRes.order.status === 'PARTIALLY_FILLED') {
          this.activeOrders.push(bidRes.order.id);
        }
      } catch (e) {
        // Ignored
      }

      // Place Ask
      try {
        const askRes = this.engine.placeOrder({
          userId: this.config.botUserId,
          symbol: this.config.symbol,
          side: 'SELL',
          type: 'LIMIT',
          price: askPrice,
          quantity: qty,
        });
        if (askRes.order.status === 'NEW' || askRes.order.status === 'PARTIALLY_FILLED') {
          this.activeOrders.push(askRes.order.id);
        }
      } catch (e) {
        // Ignored
      }
    }
  }

  private cancelAllQuotes(): void {
    for (const orderId of this.activeOrders) {
      try {
        this.engine.cancelOrder(this.config.symbol, orderId, this.config.botUserId);
      } catch (e) {
        // Order may already be filled
      }
    }
    this.activeOrders = [];
  }

  public getStatus() {
    return {
      symbol: this.config.symbol,
      running: this.isRunning,
      anchorPrice: this.currentAnchorPrice,
      activeQuoteOrders: this.activeOrders.length,
      spread: (this.config.spreadBps / 10000),
      midPrice: this.currentAnchorPrice,
      activeOrdersCount: this.activeOrders.length,
      cycleCount: 1
    };
  }

  public getStats() {
    return this.getStatus();
  }
}
