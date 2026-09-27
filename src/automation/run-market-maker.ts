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

const mm = new MarketMakerBot(engine, {
  symbol: 'TON-USDT',
  botUserId: 'mm_bot',
  baseAnchorPrice: 6.50,
  spreadBps: 20,
  levels: 10,
  levelStepBps: 10,
  quantityPerLevel: 50,
  volatilityJitter: 0.15
});

mm.start();

setInterval(() => {
  const stats = mm.getStats();
  const depth = engine.getDepth('TON-USDT', 3);
  console.log(`[MM Cycle] Mid: $${stats.midPrice.toFixed(4)} | Active Orders: ${stats.activeOrdersCount}`);
  if (depth && depth.bids[0] && depth.asks[0]) {
    console.log(`   Best Bid: $${depth.bids[0][0].toFixed(4)} (${depth.bids[0][1]}) | Best Ask: $${depth.asks[0][0].toFixed(4)} (${depth.asks[0][1]})`);
  }
}, 3000);
