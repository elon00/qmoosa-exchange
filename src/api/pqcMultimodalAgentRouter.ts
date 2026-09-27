import { Router, Request, Response } from 'express';
import { PqcEngine } from '../pqc/PqcEngine.js';
import { MultimodalEngine, ChartCandle } from '../multimodal/MultimodalEngine.js';
import { AgenticOrchestrator } from '../agentics/AgenticOrchestrator.js';

export function createPqcMultimodalAgentRouter(
  pqc: PqcEngine,
  multimodal: MultimodalEngine,
  orchestrator: AgenticOrchestrator
): Router {
  const router = Router();

  // -----------------------------------------------------------------
  // 1. NIST Post-Quantum Cryptography (PQC) Endpoints
  // -----------------------------------------------------------------
  router.get('/pqc/keybundle', (_req: Request, res: Response) => {
    const keys = pqc.getKeyBundle();
    res.json({
      standard: 'NIST FIPS 203 (ML-KEM-768) & NIST FIPS 204 (ML-DSA-65)',
      dsaPublicKeyHex: keys.dsaPublicKeyHex,
      kemPublicKeyHex: keys.kemPublicKeyHex,
      constants: {
        dsaSignatureBytes: 3309,
        dsaPublicKeyBytes: 1952,
        kemPublicKeyBytes: 1184,
        kemCiphertextBytes: 1088
      }
    });
  });

  router.post('/pqc/sign', (req: Request, res: Response) => {
    const { payload } = req.body;
    if (!payload) {
      res.status(400).json({ error: 'Payload is required' });
      return;
    }
    const signatureHex = pqc.signPayload(payload);
    res.json({
      success: true,
      standard: 'NIST FIPS 204 (ML-DSA-65)',
      signatureHex,
      publicKeyHex: pqc.getKeyBundle().dsaPublicKeyHex
    });
  });

  router.post('/pqc/verify', (req: Request, res: Response) => {
    const { payload, signatureHex, publicKeyHex } = req.body;
    if (!payload || !signatureHex) {
      res.status(400).json({ error: 'Payload and signatureHex are required' });
      return;
    }
    const pubKey = publicKeyHex ? Buffer.from(publicKeyHex, 'hex') : undefined;
    const isValid = pqc.verifySignature(payload, signatureHex, pubKey);
    res.json({
      valid: isValid,
      standard: 'NIST FIPS 204 (ML-DSA-65)'
    });
  });

  router.post('/pqc/encapsulate', (req: Request, res: Response) => {
    const { peerKemPublicKeyHex } = req.body;
    try {
      const pubKey = peerKemPublicKeyHex
        ? Buffer.from(peerKemPublicKeyHex, 'hex')
        : pqc.getKeyBundle().kemPublicKey;
      const result = pqc.encapsulate(pubKey);
      res.json({
        success: true,
        standard: 'NIST FIPS 203 (ML-KEM-768)',
        cipherTextHex: result.cipherTextHex,
        sharedSecretHex: result.sharedSecretHex
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Encapsulation failed' });
    }
  });

  // -----------------------------------------------------------------
  // 2. Multimodal AI Endpoints (Vision, NLP & Sentiment)
  // -----------------------------------------------------------------
  router.post('/multimodal/patterns', (req: Request, res: Response) => {
    const { candles } = req.body as { candles: ChartCandle[] };
    if (!candles || !Array.isArray(candles)) {
      res.status(400).json({ error: 'candles array is required' });
      return;
    }
    const patterns = multimodal.analyzeChartPatterns(candles);
    res.json({ success: true, patterns });
  });

  router.post('/multimodal/interpret', (req: Request, res: Response) => {
    const { prompt, currentPrice = 6.45 } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    const interpreted = multimodal.parseOrderIntent(prompt, Number(currentPrice));
    res.json({ success: true, interpreted });
  });

  router.get('/multimodal/report', (req: Request, res: Response) => {
    const symbol = (req.query.symbol as string) || 'TON-USDT';
    const currentPrice = Number(req.query.price) || 6.452;

    // Generate sample 10-candle series for visual evaluation
    const now = Date.now();
    const candles: ChartCandle[] = Array.from({ length: 10 }).map((_, i) => {
      const base = currentPrice - (5 - i) * 0.02;
      return {
        timestamp: now - (10 - i) * 60000,
        open: Number((base - 0.01).toFixed(4)),
        high: Number((base + 0.03).toFixed(4)),
        low: Number((base - 0.02).toFixed(4)),
        close: Number((base + 0.015).toFixed(4)),
        volume: Math.floor(1000 + Math.random() * 5000)
      };
    });

    const report = multimodal.generateMarketReport(symbol, currentPrice, candles);
    res.json({ success: true, report });
  });

  // -----------------------------------------------------------------
  // 3. AI Agentics Endpoints (Autonomous Swarm & Action Logs)
  // -----------------------------------------------------------------
  router.get('/agentics/fleet', (_req: Request, res: Response) => {
    const agents = orchestrator.getAgents();
    res.json({
      fleetCount: agents.length,
      orchestratorStatus: orchestrator.isRunning() ? 'AUTONOMOUS_RUNNING' : 'PAUSED',
      agents
    });
  });

  router.get('/agentics/logs', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const logs = orchestrator.getActionLogs(limit);
    res.json({ total: logs.length, logs });
  });

  router.post('/agentics/cycle', async (_req: Request, res: Response) => {
    const newLogs = await orchestrator.executeCycle();
    res.json({
      success: true,
      executedActions: newLogs.length,
      actions: newLogs
    });
  });

  router.post('/agentics/prompt-trade', (req: Request, res: Response) => {
    const { prompt, currentPrice = 6.45 } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    try {
      const result = orchestrator.executeAgentPrompt(prompt, Number(currentPrice));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Agent prompt execution failed' });
    }
  });

  return router;
}
