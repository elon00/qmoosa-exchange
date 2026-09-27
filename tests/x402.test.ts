import { describe, it } from 'node:test';
import assert from 'node:assert';
import { X402Gateway } from '../src/x402/X402Gateway.js';
import { X402ServiceManager, X402_SERVICES } from '../src/x402/X402Services.js';
import { Ledger } from '../src/engine/Ledger.js';
import { MatchingEngine } from '../src/engine/MatchingEngine.js';
import { ProofOfReservesEngine } from '../src/custody/ProofOfReserves.js';
import { HybridOrderRouter } from '../src/hybrid/HybridOrderRouter.js';
import { ZeroExOrderBook } from '../src/hybrid/ZeroExOrderBook.js';
import { CoinGeckoFeed } from '../src/market/CoinGeckoFeed.js';
import { UNIFIED_X402_IDENTITIES } from '../src/x402/x402Types.js';

describe('x402 Bazaar Protocol Suite (M2M Agentics & Fee Settlement)', () => {
  const ledger = new Ledger();
  const engine = new MatchingEngine(ledger);
  const porEngine = new ProofOfReservesEngine(ledger);
  const zeroExOrderBook = new ZeroExOrderBook();
  const hybridRouter = new HybridOrderRouter(engine, zeroExOrderBook);
  const feed = new CoinGeckoFeed(async () => new Response('', { status: 503 }));
  const gateway = new X402Gateway();
  const serviceManager = new X402ServiceManager(
    engine,
    ledger,
    porEngine,
    hybridRouter,
    zeroExOrderBook,
    feed
  );

  // Register market for trading
  engine.registerMarket({
    symbol: 'TON-USDT',
    baseAsset: 'TON',
    quoteAsset: 'USDT',
    minPrice: 0.01,
    minQty: 0.1,
    tickSize: 0.01,
    stepSize: 0.1
  });

  it('should generate valid HTTP 402 Payment Required challenges with multi-chain routes', () => {
    const challenge = gateway.createChallenge(X402_SERVICES.signals);

    assert.ok(challenge.nonce && challenge.nonce.length > 10);
    assert.strictEqual(challenge.service, '/api/v1/x402/signals');
    assert.strictEqual(challenge.cost, '0.001 USDC');
    assert.ok(challenge.expiresAt > Date.now());

    // Verify multi-chain routes
    assert.strictEqual(challenge.acceptedRoutes.length, 3);
    const chains = challenge.acceptedRoutes.map(r => r.chain);
    assert.ok(chains.includes('solana'));
    assert.ok(chains.includes('evm'));
    assert.ok(chains.includes('ton'));

    // Verify unified identities
    const solRoute = challenge.acceptedRoutes.find(r => r.chain === 'solana');
    assert.strictEqual(solRoute?.payTo, UNIFIED_X402_IDENTITIES.solanaWallet);
    const evmRoute = challenge.acceptedRoutes.find(r => r.chain === 'evm');
    assert.strictEqual(evmRoute?.payTo, UNIFIED_X402_IDENTITIES.evmOwner);
    const tonRoute = challenge.acceptedRoutes.find(r => r.chain === 'ton');
    assert.strictEqual(tonRoute?.payTo, UNIFIED_X402_IDENTITIES.gramTonWallet);
  });

  it('rejects forged payment formats instead of minting settlement receipts', () => {
    for (const signature of ['sig_x402_fake', '0x' + 'a'.repeat(130), 'a'.repeat(64), 'ton_fake']) {
      const challenge = gateway.createChallenge(X402_SERVICES.tradeSettle);
      const result = gateway.verifyProof(Buffer.from(JSON.stringify({ nonce: challenge.nonce, payer: 'attacker', signature })).toString('base64'));
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.receipt, undefined);
    }
  });

  it('retains legacy manifest metadata for internal tests only', () => {
    const manifest = serviceManager.getBazaarManifest();

    assert.strictEqual(manifest.x402Version, 2);
    assert.strictEqual(manifest.meshNodeId, 'qmoosa-exchange');
    assert.ok(manifest.paymentRoutes.solana);
    assert.ok(manifest.paymentRoutes.evm);
    assert.ok(manifest.paymentRoutes.ton);
    assert.strictEqual(manifest.services.length, 4);

    const serviceIds = manifest.services.map(s => s.id);
    assert.ok(serviceIds.includes('qmoosa-arbitrage-alpha'));
    assert.ok(serviceIds.includes('qmoosa-zero-balance-trade'));
    assert.ok(serviceIds.includes('qmoosa-hybrid-depth'));
    assert.ok(serviceIds.includes('qmoosa-por-attestation'));
  });

  it('generates synthetic signal fixtures, not live venue quotes', async () => {
    const result = await serviceManager.getArbitrageSignals();

    assert.ok(result.signals.length >= 4);
    assert.ok(result.activeVenues.includes('Qmoosa CEX Engine'));
    assert.ok(result.activeVenues.includes('0x SRA Relayer v4'));

    const tonSignal = result.signals.find(s => s.pair === 'TON-USDT');
    assert.ok(tonSignal);
    assert.ok(tonSignal.cexPrice > 0);
    assert.ok(tonSignal.zeroExPrice > 0);
    assert.ok(tonSignal.spreadBps >= 0);
  });

  it('rejects unfunded trades without creating virtual collateral', () => {
    assert.throws(() => serviceManager.executeAgentTrade({ pair: 'TON-USDT', side: 'BUY', price: 6.45, amount: 10, payer: 'unfunded', receiptId: 'fake' }), /INSUFFICIENT_COLLATERAL/);
    assert.strictEqual(ledger.getBalance('unfunded', 'USDT').total, 0);
  });

  it('labels reserve reports unaudited without fabricating a signature', () => {
    const por = serviceManager.getPoRAttestation('agent_trader');

    assert.strictEqual(por.solvencyStatus, 'SIMULATED_RESERVES_NOT_AUDITED');
    assert.ok(por.rootHash.length > 0);
    assert.strictEqual(por.attestationSignature, null);
    assert.strictEqual(por.audited, false);
  });
});
