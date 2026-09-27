import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { DbAdapter, DbUser } from '../database/DbAdapter.js';
import { Ledger } from '../engine/Ledger.js';

export interface UserPortfolio {
  userId: string;
  email: string;
  totalNetWorthUsd: number;
  virtualTier: string;
  balances: Array<{
    asset: string;
    free: number;
    locked: number;
    total: number;
    priceUsd: number;
    valueUsd: number;
  }>;
}

export class AuthService {
  constructor(
    private db: DbAdapter,
    private ledger: Ledger
  ) {}

  private hashPassword(password: string, salt: string): string {
    return pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  /**
   * Register a new user with $10,000 Virtual USDT + 500 Virtual TON demo funds
   */
  public async register(email: string, password: string): Promise<{ user: Omit<DbUser, 'passwordHash'>; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || password.length < 6) {
      throw new Error('Email must be valid and password must be at least 6 characters');
    }

    const existing = await this.db.getUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('User already exists with this email address');
    }

    const salt = randomBytes(16).toString('hex');
    const hash = `${salt}:${this.hashPassword(password, salt)}`;
    const userId = `usr_${Date.now()}_${randomBytes(4).toString('hex')}`;

    const newUser: DbUser = {
      id: userId,
      email: normalizedEmail,
      passwordHash: hash,
      virtualBalanceUsdt: 10000.0,
      createdAt: Date.now()
    };

    await this.db.createUser(newUser);

    // Seed Virtual Demo Balances in Ledger
    this.ledger.deposit(userId, 'USDT', 10000);
    this.ledger.deposit(userId, 'TON', 500);

    await this.db.saveBalance(userId, 'USDT', 10000, 0);
    await this.db.saveBalance(userId, 'TON', 500, 0);

    const token = `demo_tok_${userId}_${Date.now()}`;
    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        virtualBalanceUsdt: newUser.virtualBalanceUsdt,
        createdAt: newUser.createdAt
      },
      token
    };
  }

  /**
   * Authenticate an existing user
   */
  public async login(email: string, password: string): Promise<{ user: Omit<DbUser, 'passwordHash'>; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.db.getUserByEmail(normalizedEmail);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const [salt, originalHash] = user.passwordHash.split(':');
    const computedHash = this.hashPassword(password, salt);

    if (computedHash !== originalHash) {
      throw new Error('Invalid email or password');
    }

    const token = `demo_tok_${user.id}_${Date.now()}`;
    return {
      user: {
        id: user.id,
        email: user.email,
        virtualBalanceUsdt: user.virtualBalanceUsdt,
        createdAt: user.createdAt
      },
      token
    };
  }

  /**
   * Reset user's virtual demo balance back to $10,000 USDT anytime
   */
  public async resetVirtualBalance(userId: string): Promise<UserPortfolio> {
    const user = await this.db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Reset ledger balances
    const userBals = this.ledger.getUserBalances(userId);
    for (const [asset, bal] of userBals.entries()) {
      if (bal.free > 0) {
        try {
          this.ledger.withdraw(userId, asset, bal.free);
        } catch {}
      }
    }

    this.ledger.deposit(userId, 'USDT', 10000);
    this.ledger.deposit(userId, 'TON', 500);

    await this.db.saveBalance(userId, 'USDT', 10000, 0);
    await this.db.saveBalance(userId, 'TON', 500, 0);

    return this.getPortfolio(userId);
  }

  /**
   * Get user portfolio with live USD valuations
   */
  public async getPortfolio(userId: string, currentPrices?: Record<string, number>): Promise<UserPortfolio> {
    const user = await this.db.getUserById(userId) || {
      id: userId,
      email: 'demo@qmoosa.exchange',
      passwordHash: '',
      virtualBalanceUsdt: 10000,
      createdAt: Date.now()
    };

    const prices: Record<string, number> = {
      USDT: 1.0,
      TON: 6.452,
      BTC: 64280.5,
      ETH: 3485.2,
      SOL: 154.8,
      ...(currentPrices || {})
    };

    const ledgerBals = this.ledger.getUserBalances(userId);
    const balancesList: any[] = [];
    let totalNetWorth = 0;

    for (const [asset, b] of ledgerBals.entries()) {
      const price = prices[asset] || 0;
      const totalAmount = b.total;
      const valueUsd = totalAmount * price;
      totalNetWorth += valueUsd;

      balancesList.push({
        asset,
        free: b.available,
        locked: b.reserved,
        total: totalAmount,
        priceUsd: price,
        valueUsd: Number(valueUsd.toFixed(2))
      });
    }

    return {
      userId,
      email: user.email,
      totalNetWorthUsd: Number(totalNetWorth.toFixed(2)),
      virtualTier: 'Free Virtual Trader ($10,000 Initial Grant)',
      balances: balancesList
    };
  }
}
