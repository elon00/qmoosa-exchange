import { Router, Request, Response } from 'express';
import { Address, Hex } from 'viem';
import { ZeroExOrderBook } from '../hybrid/ZeroExOrderBook.js';
import { HybridOrderRouter } from '../hybrid/HybridOrderRouter.js';
import { ZeroExOrderValidator } from '../hybrid/ZeroExOrderValidator.js';
import { SignedZeroExOrder } from '../hybrid/zeroExTypes.js';

export function createZeroExRouter(
  orderBook: ZeroExOrderBook,
  routerEngine: HybridOrderRouter
): { sraRouter: Router; swapRouter: Router } {
  const sraRouter = Router();
  const swapRouter = Router();

  // -------------------------------------------------------------
  // 1. 0x Standard Relayer API (SRA v4) Routes (/orderbook/v1/*)
  // -------------------------------------------------------------

  // GET /orderbook/v1/orderbook
  sraRouter.get('/orderbook', (req: Request, res: Response) => {
    const baseToken = (req.query.baseToken as Address) || '0x582d872A1B094FC48F5DE31D3B73F2D9bE47def1'; // Wrapped TON
    const quoteToken = (req.query.quoteToken as Address) || '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT
    const page = parseInt((req.query.page as string) || '1', 10);
    const perPage = parseInt((req.query.perPage as string) || '50', 10);

    const book = orderBook.getOrderBook(baseToken, quoteToken, page, perPage);
    res.json(book);
  });

  // POST /orderbook/v1/order
  sraRouter.post('/order', async (req: Request, res: Response) => {
    const body = req.body;
    const { order, signature } = body;

    if (!order || !signature) {
      res.status(400).json({
        code: 100,
        reason: 'Validation Failed',
        validationErrors: [{ field: 'body', reason: 'Missing order or signature object' }]
      });
      return;
    }

    const chainId = parseInt((req.query.chainId as string) || '1', 10);

    // Cryptographic validation of EIP-712 signature
    const validation = await ZeroExOrderValidator.validateOrderSignature(
      { order, signature },
      chainId
    );

    if (!validation.isValid) {
      res.status(400).json({
        code: 101,
        reason: 'Signature Validation Failed',
        validationErrors: [{ field: 'signature', reason: validation.reason || 'Invalid EIP-712 maker signature' }]
      });
      return;
    }

    const orderHash = ZeroExOrderValidator.computeOrderHash(order, chainId);

    const signedOrder: SignedZeroExOrder = {
      order,
      signature,
      orderHash,
      metaData: {
        orderHash,
        remainingFillableTakerAmount: order.takerAmount,
        createdAt: Date.now(),
        status: 'FILLABLE'
      }
    };

    const added = orderBook.addOrder(signedOrder);
    if (!added) {
      res.status(400).json({
        code: 102,
        reason: 'Order rejected (duplicate orderHash or already expired)'
      });
      return;
    }

    res.status(201).json({
      success: true,
      orderHash,
      order: signedOrder
    });
  });

  // GET /orderbook/v1/orders
  sraRouter.get('/orders', (req: Request, res: Response) => {
    const makerToken = req.query.makerToken as Address | undefined;
    const takerToken = req.query.takerToken as Address | undefined;
    const maker = req.query.maker as Address | undefined;
    const status = req.query.status as any;

    const orders = orderBook.getOrders({ makerToken, takerToken, maker, status });
    res.json({
      total: orders.length,
      page: 1,
      perPage: orders.length,
      records: orders
    });
  });

  // GET /orderbook/v1/order/:orderHash
  sraRouter.get('/order/:orderHash', (req: Request, res: Response) => {
    const orderHash = req.params.orderHash as Hex;
    const order = orderBook.getOrder(orderHash);

    if (!order) {
      res.status(404).json({ code: 104, reason: 'Order not found' });
      return;
    }

    res.json(order);
  });

  // -------------------------------------------------------------
  // 2. 0x Protocol Swap API v1 Routes (/swap/v1/*)
  // -------------------------------------------------------------

  // GET /swap/v1/price
  swapRouter.get('/price', (req: Request, res: Response) => {
    const { buyToken, sellToken, sellAmount, chainId } = req.query;

    if (!buyToken || !sellToken || !sellAmount) {
      res.status(400).json({ code: 100, reason: 'buyToken, sellToken, and sellAmount required' });
      return;
    }

    const price = routerEngine.getPrice({
      buyToken: buyToken as Address,
      sellToken: sellToken as Address,
      sellAmount: sellAmount as string,
      chainId: chainId ? parseInt(chainId as string, 10) : 1
    });

    res.json(price);
  });

  // GET /swap/v1/quote
  swapRouter.get('/quote', (req: Request, res: Response) => {
    const { buyToken, sellToken, sellAmount, takerAddress, slippagePercentage, chainId } = req.query;

    if (!buyToken || !sellToken || !sellAmount) {
      res.status(400).json({ code: 100, reason: 'buyToken, sellToken, and sellAmount required' });
      return;
    }

    const quote = routerEngine.getQuote({
      buyToken: buyToken as Address,
      sellToken: sellToken as Address,
      sellAmount: sellAmount as string,
      takerAddress: takerAddress as Address,
      slippagePercentage: slippagePercentage ? parseFloat(slippagePercentage as string) : undefined,
      chainId: chainId ? parseInt(chainId as string, 10) : 1
    });

    res.json(quote);
  });

  // GET /swap/v1/sources
  swapRouter.get('/sources', (_req: Request, res: Response) => {
    res.json(routerEngine.getSources());
  });

  return { sraRouter, swapRouter };
}
