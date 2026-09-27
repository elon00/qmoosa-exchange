import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MatchingEngine } from '../src/engine/MatchingEngine.js';
import { Ledger } from '../src/engine/Ledger.js';
import { ZeroExOrderValidator } from '../src/hybrid/ZeroExOrderValidator.js';
import { ZeroExOrderBook } from '../src/hybrid/ZeroExOrderBook.js';
import { HybridOrderRouter } from '../src/hybrid/HybridOrderRouter.js';
import { KNOWN_TOKENS, ZeroExLimitOrder } from '../src/hybrid/zeroExTypes.js';

describe('0x Protocol Hybrid Exchange Test Suite', () => {
  const samplePrivKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  const sampleMaker = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

  it('should compute valid EIP-712 0x v4 order hashes deterministically', () => {
    const order: ZeroExLimitOrder = {
      makerToken: KNOWN_TOKENS.TON.address,
      takerToken: KNOWN_TOKENS.USDT.address,
      makerAmount: '100000000000', // 100 TON
      takerAmount: '650000000', // 650 USDT
      takerTokenFeeAmount: '0',
      maker: sampleMaker,
      taker: '0x0000000000000000000000000000000000000000',
      sender: '0x0000000000000000000000000000000000000000',
      feeRecipient: '0x0000000000000000000000000000000000000000',
      pool: '0x0000000000000000000000000000000000000000000000000000000000000000',
      expiry: (Math.floor(Date.now() / 1000) + 3600).toString(),
      salt: '42'
    };

    const hash1 = ZeroExOrderValidator.computeOrderHash(order, 1);
    const hash2 = ZeroExOrderValidator.computeOrderHash(order, 1);

    assert.ok(hash1.startsWith('0x'));
    assert.strictEqual(hash1.length, 66);
    assert.strictEqual(hash1, hash2);
  });

  it('should sign and cryptographically verify EIP-712 0x limit orders', async () => {
    const order: ZeroExLimitOrder = {
      makerToken: KNOWN_TOKENS.TON.address,
      takerToken: KNOWN_TOKENS.USDT.address,
      makerAmount: '50000000000',
      takerAmount: '325000000',
      takerTokenFeeAmount: '0',
      maker: sampleMaker,
      taker: '0x0000000000000000000000000000000000000000',
      sender: '0x0000000000000000000000000000000000000000',
      feeRecipient: '0x0000000000000000000000000000000000000000',
      pool: '0x0000000000000000000000000000000000000000000000000000000000000000',
      expiry: (Math.floor(Date.now() / 1000) + 7200).toString(),
      salt: '101'
    };

    const signedOrder = await ZeroExOrderValidator.signOrder(order, samplePrivKey, 1);

    assert.ok(signedOrder.signature.r);
    assert.ok(signedOrder.signature.s);
    assert.strictEqual(signedOrder.signature.signatureType, 2); // EIP-712

    // Validate Signature
    const validation = await ZeroExOrderValidator.validateOrderSignature(signedOrder, 1);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.recoveredAddress?.toLowerCase(), sampleMaker.toLowerCase());

    // Corrupted signature verification should fail
    const corruptedOrder = {
      order,
      signature: {
        ...signedOrder.signature,
        s: '0x1111111111111111111111111111111111111111111111111111111111111111' as any
      }
    };
    const invalidValidation = await ZeroExOrderValidator.validateOrderSignature(corruptedOrder, 1);
    assert.strictEqual(invalidValidation.isValid, false);
  });

  it('should manage 0x SRA OrderBook with bids, asks, and partial fills', async () => {
    const book = new ZeroExOrderBook();

    const askOrder: ZeroExLimitOrder = {
      makerToken: KNOWN_TOKENS.TON.address,
      takerToken: KNOWN_TOKENS.USDT.address,
      makerAmount: '100000000000', // 100 TON
      takerAmount: '650000000', // 650 USDT ($6.50/TON)
      takerTokenFeeAmount: '0',
      maker: sampleMaker,
      taker: '0x0000000000000000000000000000000000000000',
      sender: '0x0000000000000000000000000000000000000000',
      feeRecipient: '0x0000000000000000000000000000000000000000',
      pool: '0x0000000000000000000000000000000000000000000000000000000000000000',
      expiry: (Math.floor(Date.now() / 1000) + 3600).toString(),
      salt: '202'
    };

    const signedAsk = await ZeroExOrderValidator.signOrder(askOrder, samplePrivKey, 1);
    const added = book.addOrder(signedAsk);
    assert.strictEqual(added, true);

    // Retrieve orderbook
    const sraBook = book.getOrderBook(KNOWN_TOKENS.TON.address, KNOWN_TOKENS.USDT.address);
    assert.strictEqual(sraBook.asks.total, 1);
    assert.strictEqual(sraBook.asks.records[0].order.maker, sampleMaker);

    // Partial fill of 200 USDT
    const fillResult = book.recordFill(signedAsk.orderHash, '200000000');
    assert.ok(fillResult);
    assert.strictEqual(fillResult.filledAmount, '200000000');
    assert.strictEqual(fillResult.remainingAmount, '450000000');
    assert.strictEqual(fillResult.isComplete, false);

    // Complete fill of remaining 450 USDT
    const finalFill = book.recordFill(signedAsk.orderHash, '450000000');
    assert.ok(finalFill);
    assert.strictEqual(finalFill.isComplete, true);

    const updatedBook = book.getOrderBook(KNOWN_TOKENS.TON.address, KNOWN_TOKENS.USDT.address);
    assert.strictEqual(updatedBook.asks.records.length, 0); // Filled orders are excluded
  });

  it('should generate optimal Hybrid Swap Quotes combining CEX and 0x AMM liquidity', () => {
    const ledger = new Ledger();
    const engine = new MatchingEngine(ledger);
    const zeroExBook = new ZeroExOrderBook();

    engine.registerMarket({
      symbol: 'TON-USDT',
      baseAsset: 'TON',
      quoteAsset: 'USDT',
      minPrice: 0.01,
      minQty: 0.1,
      tickSize: 0.001,
      stepSize: 0.1,
      basePrecision: 2,
      quotePrecision: 4
    });

    const router = new HybridOrderRouter(engine, zeroExBook);

    const price = router.getPrice({
      buyToken: KNOWN_TOKENS.TON.address,
      sellToken: KNOWN_TOKENS.USDT.address,
      sellAmount: '1000'
    });

    assert.ok(parseFloat(price.buyAmount) > 0);
    assert.ok(price.sources.length >= 3);
    assert.strictEqual(price.sources[0].name, 'Qmoosa_CEX_Engine');

    const quote = router.getQuote({
      buyToken: KNOWN_TOKENS.TON.address,
      sellToken: KNOWN_TOKENS.USDT.address,
      sellAmount: '1000',
      slippagePercentage: 0.01
    });

    assert.ok(quote.to.startsWith('0x'));
    assert.ok(quote.data.startsWith('0x'));
    assert.ok(parseFloat(quote.minBuyAmount) > 0);
    assert.ok(parseFloat(quote.guaranteedPrice) > 0);
  });
});
