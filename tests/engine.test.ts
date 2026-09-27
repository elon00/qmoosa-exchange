import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Ledger } from '../src/engine/Ledger.js';
import { MatchingEngine } from '../src/engine/MatchingEngine.js';
import { ProofOfReservesEngine } from '../src/custody/ProofOfReserves.js';
import { MultiChainGateway } from '../src/custody/MultiChainGateway.js';

describe('Qmoosa Exchange Engine Test Suite', () => {
  it('should maintain double-entry ledger invariants and zero-sum conservation', () => {
    const ledger = new Ledger();

    // Deposit initial funds
    ledger.deposit('alice', 'USDT', 10000);
    ledger.deposit('bob', 'TON', 2000);

    assert.strictEqual(ledger.getBalance('alice', 'USDT').available, 10000);
    assert.strictEqual(ledger.getBalance('bob', 'TON').available, 2000);

    // Reserve balances for orders
    ledger.reserve('alice', 'USDT', 5000);
    assert.strictEqual(ledger.getBalance('alice', 'USDT').available, 5000);
    assert.strictEqual(ledger.getBalance('alice', 'USDT').reserved, 5000);

    ledger.reserve('bob', 'TON', 1000);
    assert.strictEqual(ledger.getBalance('bob', 'TON').available, 1000);
    assert.strictEqual(ledger.getBalance('bob', 'TON').reserved, 1000);

    // Settle Trade: Alice buys 1000 TON from Bob at 5 USDT/TON (Total: 5000 USDT)
    ledger.settleTrade({
      tradeId: 't-1',
      buyerId: 'alice',
      sellerId: 'bob',
      baseAsset: 'TON',
      quoteAsset: 'USDT',
      price: 5.0,
      quantity: 1000,
      makerFeeRate: 0.001,
      takerFeeRate: 0.001,
      makerSide: 'SELL'
    });

    // Verify Bob received 5000 USDT minus maker fee (5 USDT) = 4995 USDT
    assert.strictEqual(ledger.getBalance('bob', 'USDT').available, 4995);
    // Verify Bob's TON reserved was deducted
    assert.strictEqual(ledger.getBalance('bob', 'TON').reserved, 0);

    // Verify Alice received 1000 TON minus taker fee (1 TON) = 999 TON
    assert.strictEqual(ledger.getBalance('alice', 'TON').available, 999);
    // Verify Alice's USDT reserved was deducted
    assert.strictEqual(ledger.getBalance('alice', 'USDT').reserved, 0);

    // Treasury fee checks
    assert.strictEqual(ledger.getExchangeFeeBalance('USDT'), 5);
    assert.strictEqual(ledger.getExchangeFeeBalance('TON'), 1);

    // Zero-sum conservation check
    assert.strictEqual(ledger.getSystemTotal('USDT'), 10000);
    assert.strictEqual(ledger.getSystemTotal('TON'), 2000);
  });

  it('should execute FIFO limit order matching correctly', () => {
    const ledger = new Ledger();
    const engine = new MatchingEngine(ledger);

    engine.registerMarket({
      symbol: 'TON-USDT',
      baseAsset: 'TON',
      quoteAsset: 'USDT',
      minPrice: 0.01,
      minQty: 0.1,
      tickSize: 0.01,
      stepSize: 0.1,
      basePrecision: 2,
      quotePrecision: 2,
      makerFeeRate: 0.001,
      takerFeeRate: 0.001
    });

    // Fund accounts
    ledger.deposit('maker1', 'TON', 500);
    ledger.deposit('maker2', 'TON', 500);
    ledger.deposit('taker1', 'USDT', 10000);

    // Maker 1 places SELL Limit at $6.50 for 100 TON
    const maker1Order = engine.placeOrder({
      userId: 'maker1',
      symbol: 'TON-USDT',
      side: 'SELL',
      type: 'LIMIT',
      price: 6.5,
      quantity: 100
    });

    assert.strictEqual(maker1Order.order.status, 'NEW');

    // Maker 2 places SELL Limit at $6.50 for 200 TON (FIFO behind maker1)
    const maker2Order = engine.placeOrder({
      userId: 'maker2',
      symbol: 'TON-USDT',
      side: 'SELL',
      type: 'LIMIT',
      price: 6.5,
      quantity: 200
    });

    assert.strictEqual(maker2Order.order.status, 'NEW');

    // Taker places BUY Limit at $6.50 for 150 TON
    // Should completely fill Maker 1 (100) and partially fill Maker 2 (50)
    const takerOrder = engine.placeOrder({
      userId: 'taker1',
      symbol: 'TON-USDT',
      side: 'BUY',
      type: 'LIMIT',
      price: 6.5,
      quantity: 150
    });

    assert.strictEqual(takerOrder.order.status, 'FILLED');
    assert.strictEqual(takerOrder.trades.length, 2);
    assert.strictEqual(takerOrder.trades[0].quantity, 100);
    assert.strictEqual(takerOrder.trades[0].sellerOrderId, maker1Order.order.id);
    assert.strictEqual(takerOrder.trades[1].quantity, 50);
    assert.strictEqual(takerOrder.trades[1].sellerOrderId, maker2Order.order.id);

    // Check orderbook remaining depth
    const snapshot = engine.getDepth('TON-USDT', 5);
    assert.ok(snapshot);
    assert.strictEqual(snapshot.asks.length, 1);
    assert.strictEqual(snapshot.asks[0][0], 6.5);
    assert.strictEqual(snapshot.asks[0][1], 150); // 200 - 50 = 150 remaining
  });

  it('should support order cancellation and release reserved balance', () => {
    const ledger = new Ledger();
    const engine = new MatchingEngine(ledger);

    engine.registerMarket({
      symbol: 'TON-USDT',
      baseAsset: 'TON',
      quoteAsset: 'USDT',
      minPrice: 0.01,
      minQty: 0.1,
      tickSize: 0.01,
      stepSize: 0.1,
      basePrecision: 2,
      quotePrecision: 2,
      makerFeeRate: 0.001,
      takerFeeRate: 0.001
    });

    ledger.deposit('trader_charlie', 'USDT', 1000);
    const orderResult = engine.placeOrder({
      userId: 'trader_charlie',
      symbol: 'TON-USDT',
      side: 'BUY',
      type: 'LIMIT',
      price: 5.0,
      quantity: 100 // requires 500 USDT reserved
    });

    assert.strictEqual(ledger.getBalance('trader_charlie', 'USDT').reserved, 500);

    // Cancel order
    const cancelled = engine.cancelOrder('TON-USDT', orderResult.order.id, 'trader_charlie');
    assert.ok(cancelled);
    assert.strictEqual(cancelled?.status, 'CANCELLED');

    // Balance should be unreserved
    assert.strictEqual(ledger.getBalance('trader_charlie', 'USDT').reserved, 0);
    assert.strictEqual(ledger.getBalance('trader_charlie', 'USDT').available, 1000);
  });

  it('should build and verify Merkle Sum Tree Proof of Reserves', () => {
    const ledger = new Ledger();
    const custody = new MultiChainGateway();
    const por = new ProofOfReservesEngine(ledger, custody);

    ledger.deposit('cust_1', 'USDT', 10000);
    ledger.deposit('cust_1', 'TON', 2000);
    ledger.deposit('cust_2', 'USDT', 25000);
    ledger.deposit('cust_2', 'BTC', 1.5);
    ledger.deposit('cust_3', 'USDT', 40000);

    // Set custody cold and hot reserves to exceed liabilities
    custody.recordHotWalletBalance('USDT', 20000);
    custody.recordColdStorageBalance('USDT', 60000); // 80,000 > 75,000
    custody.recordHotWalletBalance('TON', 500);
    custody.recordColdStorageBalance('TON', 2000); // 2,500 > 2,000
    custody.recordColdStorageBalance('BTC', 2.0); // 2.0 > 1.5

    // Build Merkle Tree
    const root = por.generateMerkleSumTree();
    assert.ok(root.hash.length === 64);
    assert.strictEqual(root.balances['USDT'], 75000);
    assert.strictEqual(root.balances['TON'], 2000);
    assert.strictEqual(root.balances['BTC'], 1.5);

    // Check Solvency Report
    const report = por.generateSolvencyReport();
    assert.strictEqual(report.isFullySolvent, true);
    assert.strictEqual(report.totalUsersAudited, 3);
    assert.ok(report.solvencyRatio['USDT'] > 100);

    // Generate individual cryptographic proof for cust_1
    const proof = por.generateProofForUser('cust_1');
    assert.ok(proof);
    assert.strictEqual(proof?.userId, 'cust_1');

    // Verify proof
    const isValid = ProofOfReservesEngine.verifyProof(proof!);
    assert.strictEqual(isValid, true);
  });
});
