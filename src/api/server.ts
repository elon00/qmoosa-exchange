import path from 'node:path';
import http from 'node:http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { MatchingEngine } from '../engine/MatchingEngine.js';
import { Ledger } from '../engine/Ledger.js';
import { MultiChainGateway, SupportedChain } from '../custody/MultiChainGateway.js';
import { ProofOfReservesEngine, UserAuditProof } from '../custody/ProofOfReserves.js';
import { MarketMakerBot } from '../automation/MarketMakerBot.js';
import { GridTradingBot } from '../automation/GridTradingBot.js';
import { ArbitrageRouter } from '../automation/ArbitrageRouter.js';
import { createBinanceRouter } from './binanceAdapter.js';
import { createCoinbaseRouter } from './coinbaseAdapter.js';
import { ZeroExOrderBook } from '../hybrid/ZeroExOrderBook.js';
import { HybridOrderRouter } from '../hybrid/HybridOrderRouter.js';
import { createZeroExRouter } from './zeroExAdapter.js';
import { ZeroExOrderValidator } from '../hybrid/ZeroExOrderValidator.js';
import { KNOWN_TOKENS } from '../hybrid/zeroExTypes.js';
import { DbAdapter } from '../database/DbAdapter.js';
import { AuthService } from '../auth/AuthService.js';
import { CoinGeckoFeed } from '../market/CoinGeckoFeed.js';
import { X402Gateway } from '../x402/X402Gateway.js';
import { X402ServiceManager } from '../x402/X402Services.js';
import { createX402Router } from './x402Adapter.js';
import { PqcEngine } from '../pqc/PqcEngine.js';
import { MultimodalEngine } from '../multimodal/MultimodalEngine.js';
import { AgenticOrchestrator } from '../agentics/AgenticOrchestrator.js';
import { createPqcMultimodalAgentRouter } from './pqcMultimodalAgentRouter.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

// Initialize Core Subsystems & Persistence
export const db = new DbAdapter();
export const ledger = new Ledger();
export const engine = new MatchingEngine(ledger);
export const custody = new MultiChainGateway();
export const porEngine = new ProofOfReservesEngine(ledger, custody);
export const authService = new AuthService(db, ledger);
export const marketFeed = new CoinGeckoFeed();

// Initialize Database Schema (Postgres if DATABASE_URL provided, else in-memory)
await db.initSchema();

// 0x Protocol Hybrid Subsystems
export const zeroExOrderBook = new ZeroExOrderBook();
export const hybridRouter = new HybridOrderRouter(engine, zeroExOrderBook);

// x402 Bazaar Protocol Subsystems
export const x402Gateway = new X402Gateway();
export const x402ServiceManager = new X402ServiceManager(
  engine,
  ledger,
  porEngine,
  hybridRouter,
  zeroExOrderBook,
  marketFeed
);

// NIST Post-Quantum (PQC), Multimodal AI & Autonomous Agentics Subsystems
export const pqcEngine = new PqcEngine();
export const multimodalEngine = new MultimodalEngine();
export const agenticOrchestrator = new AgenticOrchestrator(
  engine,
  ledger,
  hybridRouter,
  pqcEngine,
  multimodalEngine,
  x402ServiceManager
);

// Register Core Markets
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
  makerFeeRate: 0.001, // 0.10%
  takerFeeRate: 0.001  // 0.10%
});

engine.registerMarket({
  symbol: 'BTC-USDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  minPrice: 0.01,
  minQty: 0.0001,
  tickSize: 0.01,
  stepSize: 0.0001,
  basePrecision: 4,
  quotePrecision: 2,
  makerFeeRate: 0.001,
  takerFeeRate: 0.001
});

engine.registerMarket({
  symbol: 'ETH-USDT',
  baseAsset: 'ETH',
  quoteAsset: 'USDT',
  minPrice: 0.01,
  minQty: 0.001,
  tickSize: 0.01,
  stepSize: 0.001,
  basePrecision: 3,
  quotePrecision: 2,
  makerFeeRate: 0.001,
  takerFeeRate: 0.001
});

engine.registerMarket({
  symbol: 'SOL-USDT',
  baseAsset: 'SOL',
  quoteAsset: 'USDT',
  minPrice: 0.01,
  minQty: 0.01,
  tickSize: 0.01,
  stepSize: 0.01,
  basePrecision: 2,
  quotePrecision: 2,
  makerFeeRate: 0.001,
  takerFeeRate: 0.001
});

// Seed Initial Balances & Liquidities
ledger.deposit('user_trader1', 'USDT', 50000);
ledger.deposit('user_trader1', 'TON', 5000);
ledger.deposit('user_trader1', 'BTC', 1.5);
ledger.deposit('user_trader1', 'ETH', 15);
ledger.deposit('user_trader1', 'SOL', 150);

ledger.deposit('user_alice', 'USDT', 150000);
ledger.deposit('user_alice', 'TON', 25000);

ledger.deposit('user_bob', 'USDT', 200000);
ledger.deposit('user_bob', 'BTC', 5.0);

ledger.deposit('user_mm', 'USDT', 1000000);
ledger.deposit('user_mm', 'TON', 200000);
ledger.deposit('user_mm', 'BTC', 25.0);
ledger.deposit('user_mm', 'ETH', 250.0);
ledger.deposit('user_mm', 'SOL', 2500.0);

// Initialize Custody Reserve Balances (matching/exceeding ledger for 100%+ Solvency)
custody.recordHotWalletBalance('USDT', 300000);
custody.recordColdStorageBalance('USDT', 1200000);
custody.recordHotWalletBalance('TON', 50000);
custody.recordColdStorageBalance('TON', 200000);
custody.recordHotWalletBalance('BTC', 8);
custody.recordColdStorageBalance('BTC', 25);
custody.recordHotWalletBalance('ETH', 60);
custody.recordColdStorageBalance('ETH', 220);
custody.recordHotWalletBalance('SOL', 500);
custody.recordColdStorageBalance('SOL', 2500);

// Initialize Automated Bots with compliant config
export const tonMarketMaker = new MarketMakerBot(engine, {
  symbol: 'TON-USDT',
  botUserId: 'user_mm',
  baseAnchorPrice: 6.45,
  spreadBps: 30, // 0.3% spread
  levels: 10,
  levelStepBps: 10,
  quantityPerLevel: 35,
  volatilityJitter: 0.1
});

export const btcMarketMaker = new MarketMakerBot(engine, {
  symbol: 'BTC-USDT',
  botUserId: 'user_mm',
  baseAnchorPrice: 64250,
  spreadBps: 15,
  levels: 6,
  levelStepBps: 5,
  quantityPerLevel: 0.08,
  volatilityJitter: 0.08
});

export const gridBot = new GridTradingBot(engine, {
  botId: 'grid_ton',
  userId: 'user_grid',
  symbol: 'TON-USDT',
  lowerPrice: 5.5,
  upperPrice: 7.5,
  grids: 8,
  totalInvestmentQuote: 5000
});

export const arbitrageRouter = new ArbitrageRouter();

// Generate Initial Solvency Merkle Tree
porEngine.generateMerkleSumTree();

// Pre-seed sample 0x Protocol EIP-712 Limit Orders
async function seedZeroExOrders() {
  const samplePrivKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  const sampleMaker = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

  try {
    const signedAsk = await ZeroExOrderValidator.signOrder(
      {
        makerToken: KNOWN_TOKENS.TON.address,
        takerToken: KNOWN_TOKENS.USDT.address,
        makerAmount: (100n * 10n ** 9n).toString(),
        takerAmount: (650n * 10n ** 6n).toString(),
        takerTokenFeeAmount: '0',
        maker: sampleMaker,
        taker: '0x0000000000000000000000000000000000000000',
        sender: '0x0000000000000000000000000000000000000000',
        feeRecipient: '0x0000000000000000000000000000000000000000',
        pool: '0x0000000000000000000000000000000000000000000000000000000000000000',
        expiry: (Math.floor(Date.now() / 1000) + 86400 * 7).toString(),
        salt: '123456789'
      },
      samplePrivKey
    );
    zeroExOrderBook.addOrder(signedAsk);

    const signedBid = await ZeroExOrderValidator.signOrder(
      {
        makerToken: KNOWN_TOKENS.USDT.address,
        takerToken: KNOWN_TOKENS.TON.address,
        makerAmount: (640n * 10n ** 6n).toString(),
        takerAmount: (100n * 10n ** 9n).toString(),
        takerTokenFeeAmount: '0',
        maker: sampleMaker,
        taker: '0x0000000000000000000000000000000000000000',
        sender: '0x0000000000000000000000000000000000000000',
        feeRecipient: '0x0000000000000000000000000000000000000000',
        pool: '0x0000000000000000000000000000000000000000000000000000000000000000',
        expiry: (Math.floor(Date.now() / 1000) + 86400 * 7).toString(),
        salt: '987654321'
      },
      samplePrivKey
    );
    zeroExOrderBook.addOrder(signedBid);
  } catch (err) {
    console.error('Failed to pre-seed 0x orders:', err);
  }
}
seedZeroExOrders();

// Express Application Setup
const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || false }));
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
// A bounded process-wide budget protects this small free-tier sandbox.
let requestWindow = Date.now(); let requestCount = 0;
app.use((req, res, next) => {
  if (req.path === '/health') { next(); return; }
  if (Date.now() - requestWindow >= 60000) { requestWindow = Date.now(); requestCount = 0; }
  if (++requestCount > 300) { res.status(429).json({ error: 'SANDBOX_RATE_LIMIT' }); return; }
  next();
});

// This deployment is an explicitly non-custodial sandbox; unsafe legacy
// operations stay disabled until independently verified implementations exist.
app.use((req, res, next) => {
  res.setHeader('X-Qmoosa-Mode', 'sandbox');
  if (req.path.startsWith('/api/custody') || req.path.startsWith('/api/bots') ||
      req.path.startsWith('/api/v1/agentics') || req.path.startsWith('/api/v1/multimodal') ||
      req.path === '/api/v1/pqc/sign' || req.path === '/api/v1/pqc/encapsulate') {
    res.status(503).json({ error: 'FEATURE_NOT_ACTIVATED', mode: 'sandbox', realFunds: false });
    return;
  }
  next();
});
const requireSession: express.RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
  const userId = authService.authenticate(token);
  if (!userId) { res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' }); return; }
  // Never trust client-provided account identity.
  req.query.userId = userId;
  req.body = { ...(req.body || {}), userId };
  res.locals.userId = userId;
  next();
};
app.use(['/api/portfolio', '/api/auth/me', '/api/v3'], requireSession);
app.post('/api/auth/logout', requireSession, (req, res) => {
  authService.logout(req.headers.authorization!.replace(/^Bearer /, ''));
  res.json({ success: true });
});


// -------------------------------------------------------------
// Health Check Endpoint (Render Sleep & Uptime Monitor)
// -------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: db.getType(),
    mode: 'sandbox',
    realFundsEnabled: false,
    tradingPersistence: 'volatile_memory',
    paymentSettlement: 'disabled',
    proofOfReserves: 'not_audited',
    memoryUsage: process.memoryUsage()
  });
});

// -------------------------------------------------------------
// CoinGecko Top 100 Crypto Market Data (10-min Cache, Zero Cost)
// -------------------------------------------------------------
app.get('/api/markets/top100', async (_req: Request, res: Response) => {
  const feed = await marketFeed.getTop100Coins();
  res.json(feed);
});

// -------------------------------------------------------------
// Auth & Virtual-Money Account Management
// -------------------------------------------------------------
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const result = await authService.register(email, password);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Invalid credentials' });
  }
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'user_trader1';
  const portfolio = await authService.getPortfolio(userId);
  res.json(portfolio);
});

// -------------------------------------------------------------
// Virtual-Money Portfolio & Reset Endpoints
// -------------------------------------------------------------
app.get('/api/portfolio', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'user_trader1';
  const portfolio = await authService.getPortfolio(userId);
  res.json(portfolio);
});

app.post('/api/portfolio/reset', async (req: Request, res: Response) => {
  const userId = (req.body.userId as string) || 'user_trader1';
  try {
    const refreshedPortfolio = await authService.resetVirtualBalance(userId);
    res.json({
      success: true,
      message: 'Demo balance successfully reset to $10,000 Virtual USDT + 500 Virtual TON!',
      portfolio: refreshedPortfolio
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to reset virtual balance' });
  }
});

// Attach Binance & Coinbase API Routers
app.use('/api/v3', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/order') {
    const q = Number(req.body.quantity); const p = Number(req.body.price);
    if (!['BUY', 'SELL'].includes(req.body.side) || !['LIMIT', 'MARKET'].includes(req.body.type) ||
        typeof req.body.symbol !== 'string' || !Number.isFinite(q) || q <= 0 || q > 1000000 ||
        (req.body.type === 'LIMIT' && (!Number.isFinite(p) || p <= 0 || p > 1000000000))) {
      res.status(400).json({ error: 'INVALID_ORDER' }); return;
    }
  }
  // Coinbase writes need their own validated schema before activation.
  if (req.path.startsWith('/brokerage') && req.method !== 'GET') {
    res.status(503).json({ error: 'BROKERAGE_WRITES_NOT_ACTIVATED' }); return;
  }
  next();
});
app.use('/api/v3', createBinanceRouter(engine, ledger));
app.use('/api/v3/brokerage', createCoinbaseRouter(engine, ledger));

// Attach 0x Protocol SRA and Swap API Routers
const { sraRouter, swapRouter } = createZeroExRouter(zeroExOrderBook, hybridRouter);
app.use('/orderbook/v1', (req, res, next) => {
  if (req.method !== 'GET') { res.status(503).json({ error: 'RELAYER_WRITES_NOT_ACTIVATED' }); return; }
  next();
}, sraRouter);
app.use('/swap/v1', swapRouter);

// Attach x402 v2 Bazaar Discovery & API Routers
app.get('/.well-known/x402-bazaar.json', (_req: Request, res: Response) => {
  res.json({ status: "disabled", services: [], realFundsEnabled: false });
});
app.get('/.well-known/x402.json', (_req: Request, res: Response) => {
  res.json({ status: "disabled", services: [], realFundsEnabled: false });
});
app.use('/api/v1/x402', createX402Router(x402Gateway, x402ServiceManager));

// Attach NIST PQC, Multimodal AI & Autonomous Agentics Routers
app.use('/api/v1', createPqcMultimodalAgentRouter(pqcEngine, multimodalEngine, agenticOrchestrator));

// Custody & Proof-of-Reserves REST Endpoints
app.get('/api/custody/wallets', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'user_trader1';
  const tonAddr = custody.getDepositAddress(userId, 'TON');
  const evmAddr = custody.getDepositAddress(userId, 'EVM');
  const solAddr = custody.getDepositAddress(userId, 'SOLANA');
  const btcAddr = custody.getDepositAddress(userId, 'BITCOIN');

  res.json({
    userId,
    depositAddresses: {
      TON: tonAddr,
      EVM: evmAddr,
      SOLANA: solAddr,
      BITCOIN: btcAddr
    },
    reservesSummary: custody.getAllReserves()
  });
});

app.post('/api/custody/deposit', (req: Request, res: Response) => {
  const { chain, symbol, amount, userId = 'user_trader1' } = req.body;
  const numAmount = parseFloat(amount);

  if (!chain || !symbol || isNaN(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: 'INVALID_DEPOSIT_PARAMS' });
    return;
  }

  const tx = custody.simulateDeposit({
    userId,
    chain: chain.toUpperCase() as SupportedChain,
    asset: symbol.toUpperCase(),
    amount: numAmount
  });
  ledger.deposit(userId, symbol.toUpperCase(), numAmount);

  // Update Merkle Tree liabilities
  porEngine.generateMerkleSumTree();

  res.json({
    success: true,
    transaction: tx,
    newBalance: ledger.getBalance(userId, symbol.toUpperCase())
  });
});

app.post('/api/custody/withdraw', (req: Request, res: Response) => {
  const { chain, symbol, amount, toAddress, userId = 'user_trader1' } = req.body;
  const numAmount = parseFloat(amount);

  if (!chain || !symbol || !toAddress || isNaN(numAmount) || numAmount <= 0) {
    res.status(400).json({ error: 'INVALID_WITHDRAWAL_PARAMS' });
    return;
  }

  const userBal = ledger.getBalance(userId, symbol.toUpperCase());
  if (userBal.available < numAmount) {
    res.status(400).json({ error: 'INSUFFICIENT_FUNDS', available: userBal.available });
    return;
  }

  const tx = custody.recordWithdrawal(chain as SupportedChain, symbol.toUpperCase(), numAmount, toAddress, userId);
  ledger.withdraw(userId, symbol.toUpperCase(), numAmount);

  // Update Merkle Tree liabilities
  porEngine.generateMerkleSumTree();

  res.json({
    success: true,
    transaction: tx,
    newBalance: ledger.getBalance(userId, symbol.toUpperCase())
  });
});

app.get('/api/custody/reserves', (_req: Request, res: Response) => {
  const report = porEngine.generateSolvencyReport();
  res.json(report);
});

app.get('/api/custody/proof/:userId', (req: Request, res: Response) => {
  const rawUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const proof = porEngine.generateProofForUser(rawUserId);

  if (!proof) {
    res.status(404).json({ error: 'USER_NOT_FOUND_IN_MERKLE_TREE' });
    return;
  }

  res.json(proof);
});

app.post('/api/custody/verify-proof', (req: Request, res: Response) => {
  const proof: UserAuditProof = req.body;
  const isValid = ProofOfReservesEngine.verifyProof(proof);
  res.json({ valid: isValid });
});

// Automation Bot Management Endpoints
app.get('/api/bots/status', (_req: Request, res: Response) => {
  res.json({
    marketMaker: {
      TON: {
        running: tonMarketMaker.isRunning,
        stats: tonMarketMaker.getStats()
      },
      BTC: {
        running: btcMarketMaker.isRunning,
        stats: btcMarketMaker.getStats()
      }
    },
    gridBot: {
      running: gridBot.isRunning,
      stats: gridBot.getStats()
    },
    arbitrage: arbitrageRouter.scanOpportunities()
  });
});

app.post('/api/bots/mm/toggle', (req: Request, res: Response) => {
  const { symbol = 'TON-USDT', enable } = req.body;
  const bot = symbol.includes('BTC') ? btcMarketMaker : tonMarketMaker;

  if (enable) {
    bot.start();
  } else {
    bot.stop();
  }

  res.json({ symbol, running: bot.isRunning });
});

app.post('/api/bots/grid/toggle', (req: Request, res: Response) => {
  const { enable } = req.body;
  if (enable) {
    ledger.deposit('user_grid', 'USDT', 10000);
    ledger.deposit('user_grid', 'TON', 2000);
    gridBot.start();
  } else {
    gridBot.stop();
  }
  res.json({ running: gridBot.isRunning, stats: gridBot.getStats() });
});

// Serve the Vite frontend from the same origin as the API on Render.
app.use(express.static(path.resolve('dist/client')));
app.get('/', (_req, res) => res.sendFile(path.resolve('dist/client/index.html')));

// HTTP & WebSocket Server Setup
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientSubscription {
  ws: WebSocket;
  channels: Set<string>;
}

const clients = new Map<WebSocket, ClientSubscription>();

wss.on('connection', (ws: WebSocket) => {
  const sub: ClientSubscription = { ws, channels: new Set(['all']) };
  clients.set(ws, sub);

  ws.send(JSON.stringify({ event: 'connected', serverTime: Date.now(), exchange: 'Qmoosa Hybrid' }));

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'SUBSCRIBE' && Array.isArray(msg.params)) {
        for (const channel of msg.params) {
          sub.channels.add(channel.toLowerCase());
        }
        ws.send(JSON.stringify({ result: null, id: msg.id || 1 }));
      } else if (msg.method === 'UNSUBSCRIBE' && Array.isArray(msg.params)) {
        for (const channel of msg.params) {
          sub.channels.delete(channel.toLowerCase());
        }
        ws.send(JSON.stringify({ result: null, id: msg.id || 1 }));
      }
    } catch {
      // Ignore
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

export function broadcastWS(channel: string, payload: any) {
  const message = JSON.stringify(payload);
  const normalizedChannel = channel.toLowerCase();

  for (const [, client] of clients.entries()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (client.channels.has('all') || client.channels.has(normalizedChannel)) {
        client.ws.send(message);
      }
    }
  }
}

// Hook Engine Events into WebSocket Stream
engine.on('trade', trade => {
  const symbolKey = trade.symbol.toLowerCase().replace('-', '');
  broadcastWS(`${symbolKey}@trade`, {
    stream: `${symbolKey}@trade`,
    data: {
      e: 'trade',
      E: Date.now(),
      s: trade.symbol.replace('-', ''),
      t: trade.id,
      p: trade.price.toFixed(4),
      q: trade.quantity.toFixed(4),
      T: trade.timestamp,
      m: trade.takerSide === 'SELL'
    }
  });
});

engine.on('orderPlaced', order => {
  const symbolKey = order.symbol.toLowerCase().replace('-', '');
  broadcastWS(`${symbolKey}@depth`, {
    stream: `${symbolKey}@depth`,
    data: {
      e: 'depthUpdate',
      s: order.symbol.replace('-', ''),
      snapshot: engine.getDepth(order.symbol, 20)
    }
  });
});

engine.on('orderCancelled', order => {
  const symbolKey = order.symbol.toLowerCase().replace('-', '');
  broadcastWS(`${symbolKey}@depth`, {
    stream: `${symbolKey}@depth`,
    data: {
      e: 'depthUpdate',
      s: order.symbol.replace('-', ''),
      snapshot: engine.getDepth(order.symbol, 20)
    }
  });
});

// Start Market Maker Bots by Default to create a living, dynamic book
tonMarketMaker.start();
btcMarketMaker.start();

// Launch Server if run directly
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Qmoosa Hybrid Exchange] Engine core active on http://localhost:${PORT}`);
    console.log(`[Health Monitor] Status check active at http://localhost:${PORT}/health`);
    console.log(`[Top 100 Coins] Market feed active at http://localhost:${PORT}/api/markets/top100`);
    console.log(`[Binance Adapter] REST API active at http://localhost:${PORT}/api/v3`);
    console.log(`[Coinbase Adapter] REST API active at http://localhost:${PORT}/api/v3/brokerage`);
    console.log(`[0x Protocol SRA v4] REST API active at http://localhost:${PORT}/orderbook/v1`);
    console.log(`[0x Protocol Swap API] REST API active at http://localhost:${PORT}/swap/v1`);
    console.log(`[WebSocket Stream] ws://localhost:${PORT}/ws`);
    console.log(`[Proof of Reserves] Merkle Sum Tree Root: ${porEngine.generateSolvencyReport().rootHash}`);
  });
}

export { app, server };
