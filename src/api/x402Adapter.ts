import { Router, Request, Response } from 'express';
import { X402Gateway } from '../x402/X402Gateway.js';
import { X402ServiceManager, X402_SERVICES } from '../x402/X402Services.js';

export function createX402Router(gateway: X402Gateway, serviceManager: X402ServiceManager): Router {
  const router = Router();
  router.use((_req, res) => {
    res.status(503).json({ error: 'PAYMENT_VERIFICATION_UNAVAILABLE', realFundsEnabled: false,
      message: 'No payment is requested or accepted until verified settlement is implemented.' });
  });

  // Public discovery manifest
  router.get('/manifest', (_req: Request, res: Response) => {
    res.json(serviceManager.getBazaarManifest());
  });

  // Explicit challenge request endpoint
  router.get('/challenge', (req: Request, res: Response) => {
    const serviceKey = (req.query.service as string) || 'signals';
    const def = X402_SERVICES[serviceKey] || X402_SERVICES.signals;
    const challenge = gateway.createChallenge(def);
    const encoded = Buffer.from(JSON.stringify(challenge)).toString('base64');

    res.setHeader('PAYMENT-REQUIRED', encoded);
    res.setHeader('x-payment-required', encoded);
    res.status(402).json({
      error: 'Payment Required',
      statusCode: 402,
      x402Version: 2,
      challenge
    });
  });

  // Mesh status endpoint
  router.get('/mesh-status', (_req: Request, res: Response) => {
    res.json({
      status: 'NOT_VERIFIED',
      orchestrator: 'bountyhunter-os',
      nodeId: 'qmoosa-exchange',
      role: 'Hybrid Liquidity, 0x Relayer & x402 Settlement Hub',
      meshVersion: '1.0.0',
      connectedChains: ['Solana Testnet', 'BNB Chain / EVM', 'TON Mainnet (Gram)'],
      supportedAssets: ['USDC', 'USDT', 'SOL', 'GRAM', 'TON', 'BTC', 'ETH'],
      activeServicesCount: Object.keys(X402_SERVICES).length,
      lastSync: null
    });
  });

  // 1. Protected Service: AI Arbitrage & SOR Signals
  router.get('/signals', gateway.middleware(X402_SERVICES.signals), async (req: Request, res: Response) => {
    const receipt = (req as any).x402Receipt;
    const data = await serviceManager.getArbitrageSignals();
    res.json({
      success: true,
      service: X402_SERVICES.signals.name,
      receipt,
      data
    });
  });

  // 2. Protected Service: Pay-Per-Trade Execution
  router.post('/trade-settle', gateway.middleware(X402_SERVICES.tradeSettle), (req: Request, res: Response) => {
    const receipt = (req as any).x402Receipt;
    const { pair = 'TON-USDT', side = 'BUY', price = 6.45, amount = 10 } = req.body;

    const result = serviceManager.executeAgentTrade({
      pair,
      side,
      price: Number(price),
      amount: Number(amount),
      payer: receipt.payer,
      receiptId: receipt.receiptId
    });

    res.json({
      success: true,
      service: X402_SERVICES.tradeSettle.name,
      receipt,
      result
    });
  });

  // 3. Protected Service: Hybrid OrderBook Depth Snapshot
  router.get('/orderbook-depth', gateway.middleware(X402_SERVICES.orderbookDepth), (req: Request, res: Response) => {
    const receipt = (req as any).x402Receipt;
    const pair = (req.query.pair as string) || 'TON-USDT';
    const depth = serviceManager.getHybridDepth(pair);

    res.json({
      success: true,
      service: X402_SERVICES.orderbookDepth.name,
      receipt,
      depth
    });
  });

  // 4. Protected Service: Proof of Reserves Solvency Attestation
  router.get('/por-attestation', gateway.middleware(X402_SERVICES.porAttestation), (req: Request, res: Response) => {
    const receipt = (req as any).x402Receipt;
    const attestation = serviceManager.getPoRAttestation(receipt.payer);

    res.json({
      success: true,
      service: X402_SERVICES.porAttestation.name,
      receipt,
      attestation
    });
  });

  return router;
}
