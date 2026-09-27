import { Ledger } from '../engine/Ledger.js';
import { MatchingEngine } from '../engine/MatchingEngine.js';
import { MarketMakerBot } from './MarketMakerBot.js';

console.log('--- Starting Qmoosa Autonomous Market Maker ---');

const ledger = new Ledger();
const engine = new MatchingEngine(ledger);

engine.registerMarket({
  symbol: 'TON-USDT',
  baseAsset: 'TON',
  quoteAsset: 'USDT',
  minPrice: 0.001,
  minQty: 0.1,
  tickSize: 0.001,
  stepSize: 0.1,
  basePrecision: 2,
  quotePrecision: 4,
  makerFeeRate: 0.001,
  takerFeeRate: 0.001
});

// Fund MM
ledger.deposit('mm_bot', 'USDT', 500000);
ledger.deposit('mm_bot', 'TON', 100000);

const mm = new MarketMakerBot(engine, ledger, {
  symbol: 'TON-USDT',
  initialMidPrice: 6.50,
  spreadPct: 0.002,
  levels: 10,
  orderSize: 50,
  intervalMs: 1000,
  volatilityPct: 0.0015,
  userId: 'mm_bot'
});

mm.start();

setInterval(() => {
  const stats = mm.getStats();
  const book = engine.getOrderBook('TON-USDT')?.getSnapshot(3);
  console.log(`[MM Cycle ${stats.cycleCount}] Mid: $${stats.midPrice.toFixed(4)} | Spread: ${(stats.spread * 100).toFixed(2)}% | Active Orders: ${stats.activeOrdersCount}`);
  if (book && book.bids[0] && book.asks[0]) {
    console.log(`   Best Bid: $${book.bids[0].price.toFixed(4)} (${book.bids[0].quantity}) | Best Ask: $${book.asks[0].price.toFixed(4)} (${book.asks[0].quantity})`);
  }
}, 3000);
