import { Balance } from './types.js';

export interface LedgerEntry {
  id: string;
  userId: string;
  asset: string;
  deltaFree: number;
  deltaLocked: number;
  reason: string;
  refId?: string;
  timestamp: number;
}

export interface SettleTradeParams {
  tradeId: string;
  buyerId: string;
  sellerId: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  quantity: number;
  makerFeeRate: number;
  takerFeeRate: number;
  makerSide: 'BUY' | 'SELL';
}

export class Ledger {
  // userId -> asset -> raw balance
  private balances: Map<string, Map<string, { asset: string; free: number; locked: number }>> = new Map();
  private auditLog: LedgerEntry[] = [];
  public static readonly TREASURY_USER_ID = 'EXCHANGE_TREASURY';

  constructor() {
    this.ensureUser(Ledger.TREASURY_USER_ID);
  }

  private ensureUser(userId: string): Map<string, { asset: string; free: number; locked: number }> {
    let userBalances = this.balances.get(userId);
    if (!userBalances) {
      userBalances = new Map();
      this.balances.set(userId, userBalances);
    }
    return userBalances;
  }

  private formatBalance(b: { asset: string; free: number; locked: number }): Balance {
    return {
      asset: b.asset,
      free: b.free,
      locked: b.locked,
      available: b.free,
      reserved: b.locked,
      total: b.free + b.locked
    };
  }

  public getBalance(userId: string, asset: string): Balance {
    const userBalances = this.ensureUser(userId);
    let balance = userBalances.get(asset);
    if (!balance) {
      balance = { asset, free: 0, locked: 0 };
      userBalances.set(asset, balance);
    }
    return this.formatBalance(balance);
  }

  public getAllBalances(userId: string): Balance[] {
    const userBalances = this.ensureUser(userId);
    return Array.from(userBalances.values()).map(b => this.formatBalance(b));
  }

  public getUserBalances(userId: string): Map<string, Balance> {
    const userBalances = this.ensureUser(userId);
    const result = new Map<string, Balance>();
    for (const [asset, b] of userBalances.entries()) {
      result.set(asset, this.formatBalance(b));
    }
    return result;
  }

  public getAllUsers(): string[] {
    return Array.from(this.balances.keys()).filter(id => id !== Ledger.TREASURY_USER_ID);
  }

  public getExchangeFeeBalance(asset: string): number {
    return this.getBalance(Ledger.TREASURY_USER_ID, asset).free;
  }

  public deposit(userId: string, asset: string, amount: number, refId?: string): Balance {
    if (amount <= 0) throw new Error('Deposit amount must be strictly positive');
    const userBalances = this.ensureUser(userId);
    let balance = userBalances.get(asset);
    if (!balance) {
      balance = { asset, free: 0, locked: 0 };
      userBalances.set(asset, balance);
    }
    balance.free += amount;

    this.recordEntry(userId, asset, amount, 0, 'DEPOSIT', refId);
    return this.formatBalance(balance);
  }

  public withdraw(userId: string, asset: string, amount: number, refId?: string): Balance {
    if (amount <= 0) throw new Error('Withdrawal amount must be strictly positive');
    const balance = this.getBalance(userId, asset);
    if (balance.free < amount) {
      throw new Error(`Insufficient free balance for ${asset}: available ${balance.free}, requested ${amount}`);
    }

    const userBalances = this.ensureUser(userId);
    const userBal = userBalances.get(asset)!;
    userBal.free -= amount;

    this.recordEntry(userId, asset, -amount, 0, 'WITHDRAWAL', refId);
    return this.formatBalance(userBal);
  }

  public lock(userId: string, asset: string, amount: number, refId?: string): boolean {
    if (amount <= 0) throw new Error('Lock amount must be positive');
    const balance = this.getBalance(userId, asset);
    if (balance.free < amount) {
      return false; // Not enough free balance to lock
    }

    const userBalances = this.ensureUser(userId);
    const userBal = userBalances.get(asset)!;
    userBal.free -= amount;
    userBal.locked += amount;

    this.recordEntry(userId, asset, -amount, amount, 'LOCK_ORDER', refId);
    return true;
  }

  public reserve(userId: string, asset: string, amount: number, refId?: string): boolean {
    return this.lock(userId, asset, amount, refId);
  }

  public unlock(userId: string, asset: string, amount: number, refId?: string): void {
    if (amount <= 0) return;
    const userBalances = this.ensureUser(userId);
    const userBal = userBalances.get(asset);
    if (!userBal) return;

    const actualUnlock = Math.min(userBal.locked, amount);
    userBal.locked -= actualUnlock;
    userBal.free += actualUnlock;

    this.recordEntry(userId, asset, actualUnlock, -actualUnlock, 'UNLOCK_ORDER', refId);
  }

  public unreserve(userId: string, asset: string, amount: number, refId?: string): void {
    this.unlock(userId, asset, amount, refId);
  }

  public settleTrade(
    buyerOrParams: string | SettleTradeParams,
    sellerId?: string,
    baseAsset?: string,
    quoteAsset?: string,
    price?: number,
    quantity?: number,
    makerSide?: 'BUY' | 'SELL',
    makerFeeRate?: number,
    takerFeeRate?: number,
    tradeId?: string
  ): void {
    let pBuyerId: string;
    let pSellerId: string;
    let pBaseAsset: string;
    let pQuoteAsset: string;
    let pPrice: number;
    let pQuantity: number;
    let pMakerSide: 'BUY' | 'SELL';
    let pMakerFeeRate: number;
    let pTakerFeeRate: number;
    let pTradeId: string;

    if (typeof buyerOrParams === 'object') {
      pBuyerId = buyerOrParams.buyerId;
      pSellerId = buyerOrParams.sellerId;
      pBaseAsset = buyerOrParams.baseAsset;
      pQuoteAsset = buyerOrParams.quoteAsset;
      pPrice = buyerOrParams.price;
      pQuantity = buyerOrParams.quantity;
      pMakerSide = buyerOrParams.makerSide;
      pMakerFeeRate = buyerOrParams.makerFeeRate;
      pTakerFeeRate = buyerOrParams.takerFeeRate;
      pTradeId = buyerOrParams.tradeId;
    } else {
      pBuyerId = buyerOrParams;
      pSellerId = sellerId!;
      pBaseAsset = baseAsset!;
      pQuoteAsset = quoteAsset!;
      pPrice = price!;
      pQuantity = quantity!;
      pMakerSide = makerSide!;
      pMakerFeeRate = makerFeeRate!;
      pTakerFeeRate = takerFeeRate!;
      pTradeId = tradeId!;
    }

    const grossQuote = pPrice * pQuantity;
    const buyerFeeRate = pMakerSide === 'BUY' ? pMakerFeeRate : pTakerFeeRate;
    const sellerFeeRate = pMakerSide === 'SELL' ? pMakerFeeRate : pTakerFeeRate;

    const buyerFeeBase = pQuantity * buyerFeeRate;
    const sellerFeeQuote = grossQuote * sellerFeeRate;

    const netBaseBuyer = pQuantity - buyerFeeBase;
    const netQuoteSeller = grossQuote - sellerFeeQuote;

    // Buyer settlement: deduct locked quote, add net base
    const buyerBalances = this.ensureUser(pBuyerId);
    const buyerQuote = buyerBalances.get(pQuoteAsset)!;
    buyerQuote.locked -= grossQuote;
    this.recordEntry(pBuyerId, pQuoteAsset, 0, -grossQuote, 'TRADE_SETTLE_QUOTE_DEBIT', pTradeId);

    let buyerBase = buyerBalances.get(pBaseAsset);
    if (!buyerBase) {
      buyerBase = { asset: pBaseAsset, free: 0, locked: 0 };
      buyerBalances.set(pBaseAsset, buyerBase);
    }
    buyerBase.free += netBaseBuyer;
    this.recordEntry(pBuyerId, pBaseAsset, netBaseBuyer, 0, 'TRADE_SETTLE_BASE_CREDIT', pTradeId);

    // Seller settlement: deduct locked base, add net quote
    const sellerBalances = this.ensureUser(pSellerId);
    const sellerBase = sellerBalances.get(pBaseAsset)!;
    sellerBase.locked -= pQuantity;
    this.recordEntry(pSellerId, pBaseAsset, 0, -pQuantity, 'TRADE_SETTLE_BASE_DEBIT', pTradeId);

    let sellerQuote = sellerBalances.get(pQuoteAsset);
    if (!sellerQuote) {
      sellerQuote = { asset: pQuoteAsset, free: 0, locked: 0 };
      sellerBalances.set(pQuoteAsset, sellerQuote);
    }
    sellerQuote.free += netQuoteSeller;
    this.recordEntry(pSellerId, pQuoteAsset, netQuoteSeller, 0, 'TRADE_SETTLE_QUOTE_CREDIT', pTradeId);

    // Collect fees to Exchange Treasury
    if (buyerFeeBase > 0) {
      this.deposit(Ledger.TREASURY_USER_ID, pBaseAsset, buyerFeeBase, `FEE_${pTradeId}`);
    }
    if (sellerFeeQuote > 0) {
      this.deposit(Ledger.TREASURY_USER_ID, pQuoteAsset, sellerFeeQuote, `FEE_${pTradeId}`);
    }
  }

  private recordEntry(
    userId: string,
    asset: string,
    deltaFree: number,
    deltaLocked: number,
    reason: string,
    refId?: string
  ): void {
    this.auditLog.push({
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      asset,
      deltaFree,
      deltaLocked,
      reason,
      refId,
      timestamp: Date.now(),
    });
  }

  public getAuditTrail(limit = 100): LedgerEntry[] {
    return this.auditLog.slice(-limit);
  }

  // Double-entry zero-sum asset integrity check
  public getSystemTotal(asset: string): number {
    let total = 0;
    for (const [_, userBalances] of this.balances) {
      const b = userBalances.get(asset);
      if (b) {
        total += b.free + b.locked;
      }
    }
    return total;
  }
}
