import pg from 'pg';

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  virtualBalanceUsdt: number;
  createdAt: number;
}

export interface DbBalance {
  userId: string;
  asset: string;
  free: number;
  locked: number;
}

export class DbAdapter {
  private pool: pg.Pool | null = null;
  private isPostgres = false;

  // In-Memory Fallback Storage
  private memUsers: Map<string, DbUser> = new Map();
  private memUsersByEmail: Map<string, string> = new Map();
  private memBalances: Map<string, Map<string, { free: number; locked: number }>> = new Map();
  private memOrders: Map<string, any> = new Map();
  private memTrades: any[] = [];

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        this.pool = new pg.Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require') ? { rejectUnauthorized: true } : undefined,
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        });
        this.isPostgres = true;
      } catch (err) {
        console.warn('[DbAdapter] Failed to initialize PostgreSQL pool, falling back to in-memory mode:', err);
        this.pool = null;
        this.isPostgres = false;
      }
    }
  }

  public getType(): 'neon_postgresql' | 'in_memory_persistence' {
    return this.isPostgres ? 'neon_postgresql' : 'in_memory_persistence';
  }

  /**
   * Initialize Database Schema (creates tables in PostgreSQL if available)
   */
  public async initSchema(): Promise<void> {
    if (!this.pool) return;

    try {
      const client = await this.pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            virtual_balance_usdt NUMERIC(18, 4) DEFAULT 10000.0,
            created_at BIGINT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS user_balances (
            user_id VARCHAR(64) NOT NULL,
            asset VARCHAR(32) NOT NULL,
            free NUMERIC(18, 8) NOT NULL DEFAULT 0,
            locked NUMERIC(18, 8) NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, asset)
          );

          CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            symbol VARCHAR(32) NOT NULL,
            side VARCHAR(8) NOT NULL,
            type VARCHAR(16) NOT NULL,
            price NUMERIC(18, 8) NOT NULL,
            quantity NUMERIC(18, 8) NOT NULL,
            filled_quantity NUMERIC(18, 8) NOT NULL,
            status VARCHAR(32) NOT NULL,
            created_at BIGINT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS trades (
            id VARCHAR(64) PRIMARY KEY,
            symbol VARCHAR(32) NOT NULL,
            price NUMERIC(18, 8) NOT NULL,
            quantity NUMERIC(18, 8) NOT NULL,
            buyer_user_id VARCHAR(64) NOT NULL,
            seller_user_id VARCHAR(64) NOT NULL,
            timestamp BIGINT NOT NULL
          );
        `);
      } finally {
        client.release();
      }
    } catch (err) {
      throw err;
    }
  }

  public async createUser(user: DbUser): Promise<DbUser> {
    if (this.pool && this.isPostgres) {
      try {
        await this.pool.query(
          'INSERT INTO users (id, email, password_hash, virtual_balance_usdt, created_at) VALUES ($1, $2, $3, $4, $5)',
          [user.id, user.email, user.passwordHash, user.virtualBalanceUsdt, user.createdAt]
        );
        return user;
      } catch (e) {
        throw e; // A configured database must never silently lose a write.
      }
    }

    this.memUsers.set(user.id, user);
    this.memUsersByEmail.set(user.email.toLowerCase(), user.id);
    return user;
  }

  public async getUserByEmail(email: string): Promise<DbUser | null> {
    const normalized = email.toLowerCase();
    if (this.pool && this.isPostgres) {
      try {
        const res = await this.pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalized]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            virtualBalanceUsdt: parseFloat(row.virtual_balance_usdt),
            createdAt: Number(row.created_at)
          };
        }
        return null;
      } catch (e) {
        throw e;
      }
    }

    const userId = this.memUsersByEmail.get(normalized);
    return userId ? this.memUsers.get(userId) || null : null;
  }

  public async getUserById(id: string): Promise<DbUser | null> {
    if (this.pool && this.isPostgres) {
      try {
        const res = await this.pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            virtualBalanceUsdt: parseFloat(row.virtual_balance_usdt),
            createdAt: Number(row.created_at)
          };
        }
        return null;
      } catch (e) {
        throw e;
      }
    }

    return this.memUsers.get(id) || null;
  }

  public async saveBalance(userId: string, asset: string, free: number, locked: number): Promise<void> {
    if (this.pool && this.isPostgres) {
      try {
        await this.pool.query(
          `INSERT INTO user_balances (user_id, asset, free, locked) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, asset) 
           DO UPDATE SET free = EXCLUDED.free, locked = EXCLUDED.locked`,
          [userId, asset, free, locked]
        );
        return;
      } catch (e) {
        throw e;
      }
    }

    let userBals = this.memBalances.get(userId);
    if (!userBals) {
      userBals = new Map();
      this.memBalances.set(userId, userBals);
    }
    userBals.set(asset, { free, locked });
  }

  public async getUserBalances(userId: string): Promise<Record<string, { free: number; locked: number }>> {
    const result: Record<string, { free: number; locked: number }> = {};

    if (this.pool && this.isPostgres) {
      try {
        const res = await this.pool.query('SELECT asset, free, locked FROM user_balances WHERE user_id = $1', [userId]);
        for (const row of res.rows) {
          result[row.asset] = {
            free: parseFloat(row.free),
            locked: parseFloat(row.locked)
          };
        }
        return result;
      } catch (e) {
        throw e;
      }
    }

    const userBals = this.memBalances.get(userId);
    if (userBals) {
      for (const [asset, b] of userBals.entries()) {
        result[asset] = { ...b };
      }
    }
    return result;
  }

  public async saveOrder(order: any): Promise<void> {
    if (this.pool && this.isPostgres) {
      try {
        await this.pool.query(
          `INSERT INTO orders (id, user_id, symbol, side, type, price, quantity, filled_quantity, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET filled_quantity = EXCLUDED.filled_quantity, status = EXCLUDED.status`,
          [
            order.id,
            order.userId,
            order.symbol,
            order.side,
            order.type,
            order.price,
            order.quantity,
            order.filledQuantity,
            order.status,
            order.createdAt
          ]
        );
        return;
      } catch (e) {
        throw e;
      }
    }

    this.memOrders.set(order.id, order);
  }

  public async saveTrade(trade: any): Promise<void> {
    if (this.pool && this.isPostgres) {
      try {
        await this.pool.query(
          `INSERT INTO trades (id, symbol, price, quantity, buyer_user_id, seller_user_id, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [trade.id, trade.symbol, trade.price, trade.quantity, trade.buyerUserId, trade.sellerUserId, trade.timestamp]
        );
        return;
      } catch (e) {
        throw e;
      }
    }

    this.memTrades.push(trade);
  }
}
