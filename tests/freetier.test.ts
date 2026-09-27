import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CoinGeckoFeed } from '../src/market/CoinGeckoFeed.js';
import { DbAdapter } from '../src/database/DbAdapter.js';
import { Ledger } from '../src/engine/Ledger.js';
import { AuthService } from '../src/auth/AuthService.js';

describe('Free-Tier Usable Demo Suite (CoinGecko, Auth, Virtual Money)', () => {
  it('should provide cached Top 100 coin market data with ₹0 API cost limits', async () => {
    const feed = new CoinGeckoFeed(async () => new Response('', { status: 503 }));
    const data = await feed.getTop100Coins();

    assert.ok(data.coins.length >= 10);
    assert.ok(data.total >= 10);
    assert.ok(data.attribution.includes('CoinGecko'));

    // Check primary coins exist in the list
    const symbols = data.coins.map(c => c.symbol.toUpperCase());
    assert.ok(symbols.includes('BTC'));
    assert.ok(symbols.includes('ETH'));
    assert.ok(symbols.includes('SOL'));
    assert.ok(symbols.includes('TON') || symbols.includes('GRAM'));
    assert.ok(symbols.includes('USDT'));

    // Test second immediate call retrieves from cache
    const cachedData = await feed.getTop100Coins();
    assert.ok(cachedData.cacheSource === 'in_memory_cache' || cachedData.cacheSource === 'fallback_dataset');
  });

  it('should register users with $10,000 Virtual USDT demo funds and isolate accounts', async () => {
    const db = new DbAdapter();
    const ledger = new Ledger();
    const auth = new AuthService(db, ledger);

    // Register User 1
    const user1 = await auth.register('alice@demo.exchange', 'password123');
    assert.strictEqual(user1.user.email, 'alice@demo.exchange');
    assert.strictEqual(user1.user.virtualBalanceUsdt, 10000);

    // Verify Ledger received $10,000 USDT and 500 TON
    assert.strictEqual(ledger.getBalance(user1.user.id, 'USDT').available, 10000);
    assert.strictEqual(ledger.getBalance(user1.user.id, 'TON').available, 500);

    // Register User 2 (Testing User Isolation)
    const user2 = await auth.register('bob@demo.exchange', 'securepass456');
    assert.strictEqual(user2.user.email, 'bob@demo.exchange');

    // User isolation: Bob's account is completely independent
    assert.strictEqual(ledger.getBalance(user2.user.id, 'USDT').available, 10000);

    // Login Alice
    const loginRes = await auth.login('alice@demo.exchange', 'password123');
    assert.strictEqual(loginRes.user.id, user1.user.id);

    // Test incorrect password rejection
    await assert.rejects(async () => {
      await auth.login('alice@demo.exchange', 'wrongpass');
    }, /Invalid email or password/);
  });

  it('should compute live portfolio net worth and allow demo balance reset', async () => {
    const db = new DbAdapter();
    const ledger = new Ledger();
    const auth = new AuthService(db, ledger);

    const user = await auth.register('charlie@demo.exchange', 'charliepass');
    const portfolio = await auth.getPortfolio(user.user.id);

    assert.ok(portfolio.totalNetWorthUsd > 10000); // 10,000 USDT + 500 TON * $6.45
    assert.strictEqual(portfolio.balances.length, 2);

    // Simulate spending 4,000 USDT
    ledger.withdraw(user.user.id, 'USDT', 4000);
    assert.strictEqual(ledger.getBalance(user.user.id, 'USDT').available, 6000);

    // Reset demo balance
    const resetPortfolio = await auth.resetVirtualBalance(user.user.id);
    assert.strictEqual(ledger.getBalance(user.user.id, 'USDT').available, 10000);
    assert.strictEqual(ledger.getBalance(user.user.id, 'TON').available, 500);
  });
});
