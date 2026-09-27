import { Router, Request, Response } from 'express';
import { MatchingEngine } from '../engine/MatchingEngine.js';
import { Ledger } from '../engine/Ledger.js';
import { Side, OrderType } from '../engine/types.js';

export function createCoinbaseRouter(engine: MatchingEngine, ledger: Ledger): Router {
  const router = Router();

  // GET /api/v3/brokerage/products
  router.get('/products', (_req: Request, res: Response) => {
    const markets = engine.getAllMarkets();
    res.json({
      products: markets.map(m => {
        const stats = engine.get24HourStats(m.symbol);
        const quotePrecision = m.quotePrecision ?? 4;
        const basePrecision = m.basePrecision ?? 2;
        const minQty = m.minQuantity ?? m.minQty ?? 0.1;

        return {
          product_id: m.symbol,
          price: stats.closePrice.toFixed(quotePrecision),
          price_percentage_change_24h: (
            stats.openPrice > 0 ? ((stats.closePrice - stats.openPrice) / stats.openPrice) * 100 : 0
          ).toFixed(2),
          volume_24h: stats.volume.toFixed(basePrecision),
          volume_percentage_change_24h: '0.00',
          base_increment: (1 / Math.pow(10, basePrecision)).toFixed(basePrecision),
          quote_increment: (1 / Math.pow(10, quotePrecision)).toFixed(quotePrecision),
          base_min_size: minQty.toString(),
          base_max_size: '10000000',
          base_name: m.baseAsset,
          base_currency_id: m.baseAsset,
          quote_name: m.quoteAsset,
          quote_currency_id: m.quoteAsset,
          status: 'online',
          cancel_only: false,
          limit_only: false,
          post_only: false,
          trading_disabled: false,
          auction_mode: false,
          product_type: 'SPOT',
          quote_currency_symbol: '$'
        };
      }),
      num_products: markets.length
    });
  });

  // GET /api/v3/brokerage/products/:product_id
  router.get('/products/:product_id', (req: Request, res: Response) => {
    const rawProductId = Array.isArray(req.params.product_id) ? req.params.product_id[0] : req.params.product_id;
    const productId = rawProductId.toUpperCase();
    const market = engine.getMarket(productId);

    if (!market) {
      res.status(404).json({ error: 'UNKNOWN_PRODUCT', message: `Product ${productId} not found` });
      return;
    }

    const stats = engine.get24HourStats(productId);
    const quotePrecision = market.quotePrecision ?? 4;
    const basePrecision = market.basePrecision ?? 2;
    const minQty = market.minQuantity ?? market.minQty ?? 0.1;

    res.json({
      product_id: market.symbol,
      price: stats.closePrice.toFixed(quotePrecision),
      price_percentage_change_24h: (
        stats.openPrice > 0 ? ((stats.closePrice - stats.openPrice) / stats.openPrice) * 100 : 0
      ).toFixed(2),
      volume_24h: stats.volume.toFixed(basePrecision),
      base_increment: (1 / Math.pow(10, basePrecision)).toFixed(basePrecision),
      quote_increment: (1 / Math.pow(10, quotePrecision)).toFixed(quotePrecision),
      base_min_size: minQty.toString(),
      base_currency_id: market.baseAsset,
      quote_currency_id: market.quoteAsset,
      status: 'online',
      product_type: 'SPOT'
    });
  });

  // GET /api/v3/brokerage/product_book
  router.get('/product_book', (req: Request, res: Response) => {
    const productId = (req.query.product_id as string || 'TON-USDT').toUpperCase();
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const snapshot = engine.getDepth(productId, limit);

    if (!snapshot) {
      res.status(404).json({ error: 'UNKNOWN_PRODUCT', message: `Product ${productId} not found` });
      return;
    }

    res.json({
      pricebook: {
        product_id: productId,
        bids: snapshot.bids.map((b: [number, number]) => ({
          price: b[0].toFixed(4),
          size: b[1].toFixed(4)
        })),
        asks: snapshot.asks.map((a: [number, number]) => ({
          price: a[0].toFixed(4),
          size: a[1].toFixed(4)
        })),
        time: new Date(snapshot.timestamp).toISOString()
      }
    });
  });

  // GET /api/v3/brokerage/products/:product_id/candles
  router.get('/products/:product_id/candles', (req: Request, res: Response) => {
    const rawProductId = Array.isArray(req.params.product_id) ? req.params.product_id[0] : req.params.product_id;
    const productId = rawProductId.toUpperCase();
    const limit = parseInt((req.query.limit as string) || '100', 10);

    const klines = engine.getKlines(productId, '1m', limit);
    res.json({
      candles: klines.map(k => ({
        start: Math.floor(k.openTime / 1000).toString(),
        low: k.low.toFixed(4),
        high: k.high.toFixed(4),
        open: k.open.toFixed(4),
        close: k.close.toFixed(4),
        volume: k.volume.toFixed(4)
      }))
    });
  });

  // POST /api/v3/brokerage/orders
  router.post('/orders', (req: Request, res: Response) => {
    const {
      client_order_id,
      product_id,
      side,
      order_configuration,
      userId = 'user_trader1'
    } = req.body;

    if (!product_id || !side || !order_configuration) {
      res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'Missing order parameters' });
      return;
    }

    let type: OrderType = 'LIMIT';
    let size = 0;
    let limitPrice: number | undefined;

    if (order_configuration.limit_limit_gtc) {
      type = 'LIMIT';
      size = parseFloat(order_configuration.limit_limit_gtc.base_size);
      limitPrice = parseFloat(order_configuration.limit_limit_gtc.limit_price);
    } else if (order_configuration.market_market_ioc) {
      type = 'MARKET';
      size = parseFloat(order_configuration.market_market_ioc.base_size || '0');
    }

    try {
      const result = engine.placeOrder({
        userId,
        symbol: product_id.toUpperCase(),
        side: side.toUpperCase() as Side,
        type: type === 'LIMIT' ? 'LIMIT' : 'MARKET',
        quantity: size,
        price: limitPrice,
        clientOrderId: client_order_id
      });

      res.json({
        success: true,
        order_id: result.order.id,
        success_response: {
          order_id: result.order.id,
          product_id: result.order.symbol,
          side: result.order.side,
          client_order_id: result.order.clientOrderId
        }
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error_response: {
          error: 'ORDER_FAILED',
          message: err.message || 'Execution error'
        }
      });
    }
  });

  // POST /api/v3/brokerage/orders/batch_cancel
  router.post('/orders/batch_cancel', (req: Request, res: Response) => {
    const { order_ids = [], userId = 'user_trader1' } = req.body;
    const results: any[] = [];

    for (const orderId of order_ids) {
      const cancelled = engine.cancelOrder(orderId, undefined, userId);
      results.push({
        success: !!cancelled,
        order_id: orderId,
        failure_reason: cancelled ? undefined : 'NOT_FOUND'
      });
    }

    res.json({ results });
  });

  // GET /api/v3/brokerage/accounts
  router.get('/accounts', (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || 'user_trader1';
    const balances = ledger.getUserBalances(userId);
    const accounts: any[] = [];

    for (const [currency, bal] of balances.entries()) {
      accounts.push({
        uuid: `acc-${userId}-${currency.toLowerCase()}`,
        name: `${currency} Wallet`,
        currency,
        available_balance: {
          value: bal.available.toFixed(8),
          currency
        },
        default: currency === 'USDT',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        type: 'ACCOUNT_TYPE_CRYPTO',
        ready: true,
        hold: {
          value: bal.reserved.toFixed(8),
          currency
        }
      });
    }

    res.json({
      accounts,
      has_next: false,
      cursor: '',
      size: accounts.length
    });
  });

  // GET /api/v3/brokerage/portfolios
  router.get('/portfolios', (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || 'user_trader1';
    res.json({
      portfolios: [
        {
          uuid: `portfolio-${userId}`,
          name: 'Primary Trading Portfolio',
          type: 'DEFAULT',
          deleted_at: null
        }
      ]
    });
  });

  return router;
}
