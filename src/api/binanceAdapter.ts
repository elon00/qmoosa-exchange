import { Router, Request, Response } from 'express';
import { MatchingEngine } from '../engine/MatchingEngine.js';
import { Ledger } from '../engine/Ledger.js';
import { Side, OrderType } from '../engine/types.js';

export function createBinanceRouter(engine: MatchingEngine, ledger: Ledger): Router {
  const router = Router();

  // GET /api/v3/ping
  router.get('/ping', (_req: Request, res: Response) => {
    res.json({});
  });

  // GET /api/v3/time
  router.get('/time', (_req: Request, res: Response) => {
    res.json({ serverTime: Date.now() });
  });

  // GET /api/v3/exchangeInfo
  router.get('/exchangeInfo', (_req: Request, res: Response) => {
    const markets = engine.getAllMarkets();
    res.json({
      timezone: 'UTC',
      serverTime: Date.now(),
      rateLimits: [
        {
          rateLimitType: 'REQUEST_WEIGHT',
          interval: 'MINUTE',
          intervalNum: 1,
          limit: 1200
        },
        {
          rateLimitType: 'ORDERS',
          interval: 'SECOND',
          intervalNum: 10,
          limit: 100
        }
      ],
      symbols: markets.map(m => {
        const quotePrecision = m.quotePrecision ?? 4;
        const basePrecision = m.basePrecision ?? 2;
        const minPrice = m.minPrice ?? 0.001;
        const minQty = m.minQuantity ?? m.minQty ?? 0.1;

        return {
          symbol: m.symbol.replace('-', ''),
          status: 'TRADING',
          baseAsset: m.baseAsset,
          baseAssetPrecision: basePrecision,
          quoteAsset: m.quoteAsset,
          quotePrecision: quotePrecision,
          orderTypes: ['LIMIT', 'MARKET'],
          icebergAllowed: false,
          ocoAllowed: false,
          quoteOrderQtyMarketAllowed: true,
          filters: [
            {
              filterType: 'PRICE_FILTER',
              minPrice: minPrice.toString(),
              maxPrice: '1000000.00',
              tickSize: (1 / Math.pow(10, quotePrecision)).toFixed(quotePrecision)
            },
            {
              filterType: 'LOT_SIZE',
              minQty: minQty.toString(),
              maxQty: '9000000.00',
              stepSize: (1 / Math.pow(10, basePrecision)).toFixed(basePrecision)
            }
          ]
        };
      })
    });
  });

  // Helper to normalize symbol: TONUSDT -> TON-USDT
  const normalizeSymbol = (sym?: string): string => {
    if (!sym) return 'TON-USDT';
    if (sym.includes('-')) return sym.toUpperCase();
    if (sym.endsWith('USDT')) {
      const base = sym.slice(0, -4);
      return `${base}-USDT`.toUpperCase();
    }
    return sym.toUpperCase();
  };

  // GET /api/v3/depth
  router.get('/depth', (req: Request, res: Response) => {
    const symbol = normalizeSymbol(req.query.symbol as string);
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const snapshot = engine.getDepth(symbol, limit);

    if (!snapshot) {
      res.status(400).json({ code: -1121, msg: `Invalid symbol ${symbol}` });
      return;
    }

    res.json({
      lastUpdateId: snapshot.timestamp,
      bids: snapshot.bids.map((b: [number, number]) => [b[0].toFixed(4), b[1].toFixed(4)]),
      asks: snapshot.asks.map((a: [number, number]) => [a[0].toFixed(4), a[1].toFixed(4)])
    });
  });

  // GET /api/v3/trades
  router.get('/trades', (req: Request, res: Response) => {
    const symbol = normalizeSymbol(req.query.symbol as string);
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const trades = engine.getRecentTrades(symbol, limit);

    res.json(
      trades.map(t => ({
        id: t.id,
        price: t.price.toFixed(4),
        qty: t.quantity.toFixed(4),
        quoteQty: (t.price * t.quantity).toFixed(4),
        time: t.timestamp,
        isBuyerMaker: t.takerSide === 'SELL',
        isBestMatch: true
      }))
    );
  });

  // GET /api/v3/ticker/price
  router.get('/ticker/price', (req: Request, res: Response) => {
    const querySymbol = req.query.symbol as string;
    const markets = engine.getAllMarkets();

    if (querySymbol) {
      const symbol = normalizeSymbol(querySymbol);
      const trades = engine.getRecentTrades(symbol, 1);
      const price = trades.length > 0 ? trades[0].price : 0;
      res.json({
        symbol: querySymbol.toUpperCase(),
        price: price.toFixed(4)
      });
      return;
    }

    res.json(
      markets.map(m => {
        const trades = engine.getRecentTrades(m.symbol, 1);
        return {
          symbol: m.symbol.replace('-', ''),
          price: (trades.length > 0 ? trades[0].price : 0).toFixed(4)
        };
      })
    );
  });

  // GET /api/v3/ticker/24hr
  router.get('/ticker/24hr', (req: Request, res: Response) => {
    const querySymbol = req.query.symbol as string;
    const markets = engine.getAllMarkets();

    const getStats = (sym: string) => {
      const stats = engine.get24HourStats(sym);
      const formattedSym = sym.replace('-', '');
      return {
        symbol: formattedSym,
        priceChange: (stats.closePrice - stats.openPrice).toFixed(4),
        priceChangePercent: (
          stats.openPrice > 0 ? ((stats.closePrice - stats.openPrice) / stats.openPrice) * 100 : 0
        ).toFixed(2),
        prevClosePrice: stats.openPrice.toFixed(4),
        lastPrice: stats.closePrice.toFixed(4),
        bidPrice: (stats.bidPrice || 0).toFixed(4),
        askPrice: (stats.askPrice || 0).toFixed(4),
        openPrice: stats.openPrice.toFixed(4),
        highPrice: stats.highPrice.toFixed(4),
        lowPrice: stats.lowPrice.toFixed(4),
        volume: stats.volume.toFixed(4),
        quoteVolume: stats.quoteVolume.toFixed(4),
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        count: stats.tradeCount
      };
    };

    if (querySymbol) {
      const symbol = normalizeSymbol(querySymbol);
      res.json(getStats(symbol));
      return;
    }

    res.json(markets.map(m => getStats(m.symbol)));
  });

  // GET /api/v3/klines
  router.get('/klines', (req: Request, res: Response) => {
    const symbol = normalizeSymbol(req.query.symbol as string);
    const interval = (req.query.interval as string) || '1m';
    const limit = parseInt((req.query.limit as string) || '100', 10);

    const klines = engine.getKlines(symbol, interval, limit);
    res.json(
      klines.map(k => [
        k.openTime,
        k.open.toFixed(4),
        k.high.toFixed(4),
        k.low.toFixed(4),
        k.close.toFixed(4),
        k.volume.toFixed(4),
        k.closeTime,
        k.quoteVolume.toFixed(4),
        k.tradesCount,
        (k.volume * 0.5).toFixed(4),
        (k.quoteVolume * 0.5).toFixed(4),
        '0'
      ])
    );
  });

  // POST /api/v3/order
  router.post('/order', (req: Request, res: Response) => {
    const {
      symbol: rawSymbol,
      side,
      type,
      quantity,
      price,
      userId = 'user_trader1',
      clientOrderId
    } = req.body;

    const symbol = normalizeSymbol(rawSymbol);
    const parsedQty = parseFloat(quantity);
    const parsedPrice = price ? parseFloat(price) : undefined;

    if (!symbol || !side || !type || isNaN(parsedQty) || parsedQty <= 0) {
      res.status(400).json({ code: -1102, msg: 'Mandatory parameter missing or malformed' });
      return;
    }

    const orderType = type.toUpperCase() as 'LIMIT' | 'MARKET';
    if (orderType === 'LIMIT' && (!parsedPrice || parsedPrice <= 0)) {
      res.status(400).json({ code: -1104, msg: 'Price required for LIMIT orders' });
      return;
    }

    try {
      const result = engine.placeOrder({
        userId,
        symbol,
        side: side.toUpperCase() as Side,
        type: orderType,
        quantity: parsedQty,
        price: parsedPrice,
        clientOrderId
      });

      res.json({
        symbol: symbol.replace('-', ''),
        orderId: result.order.id,
        clientOrderId: result.order.clientOrderId || '',
        transactTime: result.order.createdAt,
        price: (result.order.price || 0).toFixed(4),
        origQty: result.order.quantity.toFixed(4),
        executedQty: result.order.filledQuantity.toFixed(4),
        status: result.order.status,
        type: result.order.type,
        side: result.order.side,
        fills: result.trades.map(t => ({
          price: t.price.toFixed(4),
          qty: t.quantity.toFixed(4),
          commission: (t.fee || 0).toFixed(4),
          commissionAsset: t.takerSide === 'BUY' ? symbol.split('-')[0] : symbol.split('-')[1]
        }))
      });
    } catch (err: any) {
      res.status(400).json({ code: -2010, msg: err.message || 'Order execution error' });
    }
  });

  // DELETE /api/v3/order
  router.delete('/order', (req: Request, res: Response) => {
    const { symbol: rawSymbol, orderId, userId = 'user_trader1' } = req.body;
    const symbol = normalizeSymbol(rawSymbol);

    if (!orderId) {
      res.status(400).json({ code: -1102, msg: 'Missing orderId' });
      return;
    }

    const cancelledOrder = engine.cancelOrder(orderId, symbol, userId);
    if (!cancelledOrder) {
      res.status(404).json({ code: -2011, msg: 'Unknown order or already filled/cancelled' });
      return;
    }

    res.json({
      symbol: symbol.replace('-', ''),
      origClientOrderId: cancelledOrder.clientOrderId || '',
      orderId: cancelledOrder.id,
      clientOrderId: cancelledOrder.clientOrderId || '',
      price: (cancelledOrder.price || 0).toFixed(4),
      origQty: cancelledOrder.quantity.toFixed(4),
      executedQty: cancelledOrder.filledQuantity.toFixed(4),
      status: cancelledOrder.status,
      type: cancelledOrder.type,
      side: cancelledOrder.side
    });
  });

  // GET /api/v3/openOrders
  router.get('/openOrders', (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || 'user_trader1';
    const rawSymbol = req.query.symbol as string;
    const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : undefined;

    const orders = engine.getOpenOrders(userId, symbol);
    res.json(
      orders.map(o => ({
        symbol: o.symbol.replace('-', ''),
        orderId: o.id,
        clientOrderId: o.clientOrderId || '',
        price: (o.price || 0).toFixed(4),
        origQty: o.quantity.toFixed(4),
        executedQty: o.filledQuantity.toFixed(4),
        status: o.status,
        type: o.type,
        side: o.side,
        time: o.createdAt
      }))
    );
  });

  // GET /api/v3/account
  router.get('/account', (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || 'user_trader1';
    const userBalances = ledger.getUserBalances(userId);

    const balancesList: any[] = [];
    for (const [asset, bal] of userBalances.entries()) {
      balancesList.push({
        asset,
        free: bal.available.toFixed(8),
        locked: bal.reserved.toFixed(8)
      });
    }

    res.json({
      makerCommission: 10,
      takerCommission: 10,
      buyerCommission: 0,
      sellerCommission: 0,
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      updateTime: Date.now(),
      accountType: 'SPOT',
      balances: balancesList,
      permissions: ['SPOT']
    });
  });

  return router;
}
