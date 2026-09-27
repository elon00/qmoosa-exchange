import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MultimodalEngine, ChartCandle } from '../src/multimodal/MultimodalEngine.js';
import { AgenticOrchestrator } from '../src/agentics/AgenticOrchestrator.js';
import { MatchingEngine } from '../src/engine/MatchingEngine.js';
import { Ledger } from '../src/engine/Ledger.js';
import { HybridOrderRouter } from '../src/hybrid/HybridOrderRouter.js';
import { ZeroExOrderBook } from '../src/hybrid/ZeroExOrderBook.js';
import { PqcEngine } from '../src/pqc/PqcEngine.js';

describe('AI Agentics & Multimodal Engine Suite', () => {
  const multimodal = new MultimodalEngine();
  const ledger = new Ledger();
  const engine = new MatchingEngine(ledger);
  const zeroExOrderBook = new ZeroExOrderBook();
  const hybridRouter = new HybridOrderRouter(engine, zeroExOrderBook);
  const pqc = new PqcEngine();
  const orchestrator = new AgenticOrchestrator(engine, ledger, hybridRouter, pqc, multimodal);

  engine.registerMarket({
    symbol: 'TON-USDT',
    baseAsset: 'TON',
    quoteAsset: 'USDT',
    minPrice: 0.01,
    minQty: 0.1,
    tickSize: 0.01,
    stepSize: 0.1
  });

  it('should identify visual candlestick chart patterns and compute key support/resistance levels', () => {
    const candles: ChartCandle[] = [
      { timestamp: 1, open: 6.50, high: 6.55, low: 6.45, close: 6.48, volume: 1200 },
      { timestamp: 2, open: 6.48, high: 6.50, low: 6.40, close: 6.42, volume: 1100 },
      { timestamp: 3, open: 6.42, high: 6.46, low: 6.38, close: 6.40, volume: 1300 },
      { timestamp: 4, open: 6.40, high: 6.42, low: 6.35, close: 6.36, volume: 1500 }, // Red candle
      { timestamp: 5, open: 6.35, high: 6.52, low: 6.34, close: 6.50, volume: 2800 }  // Green engulfing candle
    ];

    const patterns = multimodal.analyzeChartPatterns(candles);
    assert.ok(patterns.length > 0);

    const engulfing = patterns.find(p => p.patternName.includes('Bullish Engulfing'));
    assert.ok(engulfing);
    assert.strictEqual(engulfing.bias, 'BULLISH');
    assert.ok(engulfing.confidencePct >= 80);
    assert.ok(engulfing.keyLevels.breakoutTarget! > 6.50);
  });

  it('should transpile natural language trader prompts into structured orders with risk bounds', () => {
    const prompt = 'Please buy 35 TON at 6.40 with stop loss 6.10 and take profit 7.20 immediately';
    const interpreted = multimodal.parseOrderIntent(prompt, 6.45);

    assert.strictEqual(interpreted.isValid, true);
    assert.strictEqual(interpreted.symbol, 'TON-USDT');
    assert.strictEqual(interpreted.side, 'BUY');
    assert.strictEqual(interpreted.quantity, 35);
    assert.strictEqual(interpreted.price, 6.40);
    assert.strictEqual(interpreted.stopLoss, 6.10);
    assert.strictEqual(interpreted.takeProfit, 7.20);
    assert.ok(interpreted.confidence >= 0.9);
  });

  it('should generate multimodal market reports with sentiment scoring and regime classification', () => {
    const candles: ChartCandle[] = [
      { timestamp: 1, open: 6.30, high: 6.35, low: 6.28, close: 6.32, volume: 1000 },
      { timestamp: 2, open: 6.32, high: 6.40, low: 6.30, close: 6.38, volume: 1400 },
      { timestamp: 3, open: 6.38, high: 6.45, low: 6.35, close: 6.43, volume: 1800 },
      { timestamp: 4, open: 6.43, high: 6.50, low: 6.40, close: 6.48, volume: 2200 },
      { timestamp: 5, open: 6.48, high: 6.55, low: 6.46, close: 6.52, volume: 3000 }
    ];

    const report = multimodal.generateMarketReport('TON-USDT', 6.52, candles);
    assert.strictEqual(report.symbol, 'TON-USDT');
    assert.ok(report.sentimentScore > 0);
    assert.ok(report.visionPatterns.length > 0);
    assert.ok(['AGGRESSIVE_BUY', 'ACCUMULATE_DIPS', 'HOLD'].includes(report.agentActionRecommendation));
  });

  it('should orchestrate autonomous agent fleet and execute synchronized agentic cycles', async () => {
    const agents = orchestrator.getAgents();
    assert.strictEqual(agents.length, 5);

    const agentIds = agents.map(a => a.id);
    assert.ok(agentIds.includes('agent_alpha_arb'));
    assert.ok(agentIds.includes('agent_risk_guard'));
    assert.ok(agentIds.includes('agent_pqc_shield'));

    const logs = await orchestrator.executeCycle();
    assert.ok(logs.length >= 2);
    assert.ok(logs.some(l => l.actionType === 'ARBITRAGE_TRADE'));
    assert.ok(logs.some(l => l.actionType === 'PQC_ATTESTATION'));
  });

  it('should execute natural language prompt through agentic executor wrapped with PQC protection', () => {
    const result = orchestrator.executeAgentPrompt('Buy 20 TON at 6.45', 6.45);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.interpreted.symbol, 'TON-USDT');
    assert.strictEqual(result.interpreted.quantity, 20);

    // Verify PQC lattice signature on executed order
    assert.strictEqual(result.pqcOrder.quantumSafe, true);
    assert.ok(result.pqcOrder.pqcSignatureHex.length > 5000);

    // Verify CEX execution
    assert.strictEqual(result.execution.order.symbol, 'TON-USDT');
    assert.strictEqual(result.execution.order.quantity, 20);
  });
});
