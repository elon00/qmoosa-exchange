import { Address, Hex } from 'viem';
import {
  SignedZeroExOrder,
  ZeroExOrderBookResponse,
  ZeroExOrderBookRecord
} from './zeroExTypes.js';

export class ZeroExOrderBook {
  // orderHash -> SignedZeroExOrder
  private orders: Map<Hex, SignedZeroExOrder> = new Map();

  // (makerToken:takerToken) -> Set of orderHashes
  private tokenPairs: Map<string, Set<Hex>> = new Map();

  private getPairKey(tokenA: Address, tokenB: Address): string {
    return `${tokenA.toLowerCase()}:${tokenB.toLowerCase()}`;
  }

  /**
   * Add a signed 0x Limit Order to the Relayer OrderBook
   */
  public addOrder(order: SignedZeroExOrder): boolean {
    const hash = order.orderHash.toLowerCase() as Hex;
    if (this.orders.has(hash)) {
      return false; // Order already in book
    }

    // Verify order not expired
    const now = Math.floor(Date.now() / 1000);
    if (Number(order.order.expiry) <= now) {
      return false;
    }

    this.orders.set(hash, order);

    const pairKey = this.getPairKey(order.order.makerToken, order.order.takerToken);
    if (!this.tokenPairs.has(pairKey)) {
      this.tokenPairs.set(pairKey, new Set());
    }
    this.tokenPairs.get(pairKey)!.add(hash);

    return true;
  }

  /**
   * Get an order by its canonical 0x orderHash
   */
  public getOrder(orderHash: Hex): SignedZeroExOrder | undefined {
    return this.orders.get(orderHash.toLowerCase() as Hex);
  }

  /**
   * Query orders using standard SRA filtering
   */
  public getOrders(params: {
    makerToken?: Address;
    takerToken?: Address;
    maker?: Address;
    status?: 'FILLABLE' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  }): SignedZeroExOrder[] {
    let result = Array.from(this.orders.values());

    if (params.makerToken) {
      const mt = params.makerToken.toLowerCase();
      result = result.filter(o => o.order.makerToken.toLowerCase() === mt);
    }
    if (params.takerToken) {
      const tt = params.takerToken.toLowerCase();
      result = result.filter(o => o.order.takerToken.toLowerCase() === tt);
    }
    if (params.maker) {
      const m = params.maker.toLowerCase();
      result = result.filter(o => o.order.maker.toLowerCase() === m);
    }
    if (params.status) {
      result = result.filter(o => o.metaData.status === params.status);
    }

    return result;
  }

  /**
   * Return Standard Relayer API (SRA v4) OrderBook format
   * Bids: makerToken = baseToken, takerToken = quoteToken (or vice versa depending on market convention)
   * Asks: makerToken = quoteToken, takerToken = baseToken
   */
  public getOrderBook(
    baseToken: Address,
    quoteToken: Address,
    page = 1,
    perPage = 50
  ): ZeroExOrderBookResponse {
    this.pruneExpired();

    // In 0x terminology:
    // Ask = Maker is selling baseToken for quoteToken
    // (makerToken: baseToken, takerToken: quoteToken)
    const askPairKey = this.getPairKey(baseToken, quoteToken);
    const askHashes = this.tokenPairs.get(askPairKey) || new Set();

    // Bid = Maker is buying baseToken using quoteToken
    // (makerToken: quoteToken, takerToken: baseToken)
    const bidPairKey = this.getPairKey(quoteToken, baseToken);
    const bidHashes = this.tokenPairs.get(bidPairKey) || new Set();

    const askRecords: ZeroExOrderBookRecord[] = [];
    for (const h of askHashes) {
      const o = this.orders.get(h);
      if (o && o.metaData.status === 'FILLABLE') {
        askRecords.push({
          order: o.order,
          signature: o.signature,
          metaData: {
            orderHash: o.orderHash,
            remainingFillableTakerAmount: o.metaData.remainingFillableTakerAmount,
            createdAt: o.metaData.createdAt
          }
        });
      }
    }

    const bidRecords: ZeroExOrderBookRecord[] = [];
    for (const h of bidHashes) {
      const o = this.orders.get(h);
      if (o && o.metaData.status === 'FILLABLE') {
        bidRecords.push({
          order: o.order,
          signature: o.signature,
          metaData: {
            orderHash: o.orderHash,
            remainingFillableTakerAmount: o.metaData.remainingFillableTakerAmount,
            createdAt: o.metaData.createdAt
          }
        });
      }
    }

    // Sort Asks: lowest price first (price = takerAmount / makerAmount)
    askRecords.sort((a, b) => {
      const priceA = Number(BigInt(a.order.takerAmount)) / Number(BigInt(a.order.makerAmount));
      const priceB = Number(BigInt(b.order.takerAmount)) / Number(BigInt(b.order.makerAmount));
      return priceA - priceB;
    });

    // Sort Bids: highest price first (price = makerAmount / takerAmount)
    bidRecords.sort((a, b) => {
      const priceA = Number(BigInt(a.order.makerAmount)) / Number(BigInt(a.order.takerAmount));
      const priceB = Number(BigInt(b.order.makerAmount)) / Number(BigInt(b.order.takerAmount));
      return priceB - priceA;
    });

    const startIdx = (page - 1) * perPage;
    const paginatedBids = bidRecords.slice(startIdx, startIdx + perPage);
    const paginatedAsks = askRecords.slice(startIdx, startIdx + perPage);

    return {
      bids: {
        total: bidRecords.length,
        page,
        perPage,
        records: paginatedBids
      },
      asks: {
        total: askRecords.length,
        page,
        perPage,
        records: paginatedAsks
      }
    };
  }

  /**
   * Process on-chain or off-chain fill of a 0x order
   */
  public recordFill(orderHash: Hex, takerFillAmount: bigint | string): {
    filledAmount: string;
    remainingAmount: string;
    isComplete: boolean;
  } | null {
    const hash = orderHash.toLowerCase() as Hex;
    const order = this.orders.get(hash);
    if (!order) return null;

    const fillBigInt = BigInt(takerFillAmount);
    const remainingBigInt = BigInt(order.metaData.remainingFillableTakerAmount);

    const actualFill = fillBigInt > remainingBigInt ? remainingBigInt : fillBigInt;
    const newRemaining = remainingBigInt - actualFill;

    order.metaData.remainingFillableTakerAmount = newRemaining.toString();
    order.metaData.filledTakerAmount = (
      BigInt(order.metaData.filledTakerAmount || 0) + actualFill
    ).toString();

    const isComplete = newRemaining === 0n;
    if (isComplete) {
      order.metaData.status = 'FILLED';
    }

    return {
      filledAmount: actualFill.toString(),
      remainingAmount: newRemaining.toString(),
      isComplete
    };
  }

  /**
   * Cancel an order in the relayer book (verified by maker address)
   */
  public cancelOrder(orderHash: Hex, makerAddress: Address): boolean {
    const hash = orderHash.toLowerCase() as Hex;
    const order = this.orders.get(hash);
    if (!order) return false;

    if (order.order.maker.toLowerCase() !== makerAddress.toLowerCase()) {
      return false; // Unauthorized
    }

    order.metaData.status = 'CANCELLED';
    order.metaData.remainingFillableTakerAmount = '0';
    return true;
  }

  /**
   * Purge expired orders from the active book
   */
  public pruneExpired(): number {
    const now = Math.floor(Date.now() / 1000);
    let count = 0;

    for (const [hash, order] of this.orders) {
      if (Number(order.order.expiry) <= now && order.metaData.status === 'FILLABLE') {
        order.metaData.status = 'EXPIRED';
        order.metaData.remainingFillableTakerAmount = '0';
        count++;
      }
    }

    return count;
  }

  public getTotalOrdersCount(): number {
    return this.orders.size;
  }
}
