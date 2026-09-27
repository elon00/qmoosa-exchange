import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { app } from '../src/api/server.js';

describe('Free-Tier Usable Demo Exchange Acceptance Suite (All 7 Verification Gates)', () => {
  let serverInstance: http.Server;
  let baseUrl: string;

  before(async () => {
    // Start server on an ephemeral port
    serverInstance = http.createServer(app);
    await new Promise<void>((resolve) => {
      serverInstance.listen(0, '127.0.0.1', () => {
        const addr = serverInstance.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      serverInstance.close(() => resolve());
    });
  });

  // State shared across gates
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let testOrderId: string;

  // -------------------------------------------------------------
  // Verification Gate 1
  // -------------------------------------------------------------
  it('Check 1: Free tier service status (200 OK + JSON describing sandbox environment)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.ok(data.sandbox, 'Sandbox metadata must be present');
    assert.strictEqual(data.sandbox.environment, 'FREE_TIER_DEMO_SANDBOX');
    assert.strictEqual(data.sandbox.virtualTradingOnly, true);
    assert.strictEqual(data.sandbox.realMoneyDisabled, true);
    assert.strictEqual(data.sandbox.initialBalances.USDT, 10000);
    assert.strictEqual(data.sandbox.initialBalances.TON, 500);
    assert.ok(data.sandbox.sleepNotice.includes('15 minutes'));
    assert.ok(data.sandbox.hosting.includes('Render Free'));
  });

  // -------------------------------------------------------------
  // Verification Gate 2
  // -------------------------------------------------------------
  it('Check 2: Registration of two distinct accounts with distinct virtual balances ($10,000 USDT + 500 TON each) and logout/login flow', async () => {
    // Register User A
    const regResA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice_gate@demo.exchange', password: 'Password123!' })
    });
    assert.strictEqual(regResA.status, 201);
    const dataA = await regResA.json();
    userAId = dataA.user.id;
    userAToken = dataA.token;
    assert.strictEqual(dataA.user.email, 'alice_gate@demo.exchange');
    assert.strictEqual(dataA.user.virtualBalanceUsdt, 10000);

    // Register User B
    const regResB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob_gate@demo.exchange', password: 'SecurePassword456!' })
    });
    assert.strictEqual(regResB.status, 201);
    const dataB = await regResB.json();
    userBId = dataB.user.id;
    userBToken = dataB.token;
    assert.strictEqual(dataB.user.email, 'bob_gate@demo.exchange');
    assert.notStrictEqual(userAId, userBId, 'User A and User B must have distinct IDs');

    // Verify User A Portfolio
    const portResA = await fetch(`${baseUrl}/api/portfolio?userId=${userAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(portResA.status, 200);
    const portA = await portResA.json();
    const usdtA = portA.balances.find((b: any) => b.asset === 'USDT');
    const tonA = portA.balances.find((b: any) => b.asset === 'TON');
    assert.strictEqual(usdtA.available, 10000);
    assert.strictEqual(tonA.available, 500);

    // Verify User B Portfolio
    const portResB = await fetch(`${baseUrl}/api/portfolio?userId=${userBId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(portResB.status, 200);
    const portB = await portResB.json();
    const usdtB = portB.balances.find((b: any) => b.asset === 'USDT');
    const tonB = portB.balances.find((b: any) => b.asset === 'TON');
    assert.strictEqual(usdtB.available, 10000);
    assert.strictEqual(tonB.available, 500);

    // Test Logout for User A
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(logoutRes.status, 200);
    const logoutData = await logoutRes.json();
    assert.strictEqual(logoutData.success, true);

    // Login again to restore User A's active token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice_gate@demo.exchange', password: 'Password123!' })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    userAToken = loginData.token;
  });

  // -------------------------------------------------------------
  // Verification Gate 3
  // -------------------------------------------------------------
  it("Check 3: Cross-account security: User B can NOT cancel User A's order; User B can NOT inspect User A's private portfolio", async () => {
    // 1. User A places a limit BUY order on TON-USDT
    const orderRes = await fetch(`${baseUrl}/api/v3/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        symbol: 'TONUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 10,
        price: 5.0
      })
    });
    assert.strictEqual(orderRes.status, 200);
    const orderData = await orderRes.json();
    testOrderId = orderData.orderId;
    assert.ok(testOrderId, 'Order ID must exist');

    // 2. User B tries to cancel User A's order (Cross-account attack attempt)
    const attackCancelRes = await fetch(`${baseUrl}/api/v3/order`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBToken}`
      },
      body: JSON.stringify({
        symbol: 'TONUSDT',
        orderId: testOrderId
      })
    });
    // Must be rejected with 403 (or 404 unauthorized)
    assert.ok([403, 404].includes(attackCancelRes.status), `Cross-account cancellation must be rejected, got ${attackCancelRes.status}`);

    // 3. User B tries to inspect User A's private portfolio
    const attackPortRes = await fetch(`${baseUrl}/api/portfolio?userId=${userAId}`, {
      headers: {
        Authorization: `Bearer ${userBToken}`
      }
    });
    assert.ok([200, 403].includes(attackPortRes.status));
    const attackPortData = await attackPortRes.json();
    if (attackPortRes.status === 200) {
      assert.strictEqual(attackPortData.userId, userBId, 'Client cannot select another account');
      assert.notStrictEqual(attackPortData.userId, userAId, 'Must not return User A portfolio');
    } else {
      assert.ok(attackPortData.error.includes('FORBIDDEN'));
    }

    // 4. User B tries to inspect User A's open orders
    const attackOrdersRes = await fetch(`${baseUrl}/api/v3/openOrders?userId=${userAId}`, {
      headers: {
        Authorization: `Bearer ${userBToken}`
      }
    });
    assert.ok([200, 403].includes(attackOrdersRes.status));
    if (attackOrdersRes.status === 200) {
      const orders = await attackOrdersRes.json();
      assert.strictEqual(orders.length, 0, 'User B must not see User A open orders');
    }
  });

  // -------------------------------------------------------------
  // Verification Gate 4
  // -------------------------------------------------------------
  it('Check 4: Order lifecycle: User A places limit order -> funds locked -> listed in open orders -> canceled -> funds unlocked', async () => {
    // 1. Verify locked funds for User A (10 TON * 5.00 USDT = 50 USDT locked)
    const portRes1 = await fetch(`${baseUrl}/api/portfolio?userId=${userAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const port1 = await portRes1.json();
    const usdt1 = port1.balances.find((b: any) => b.asset === 'USDT');
    assert.strictEqual(usdt1.reserved, 50, '50 USDT should be locked in reserved balance');
    assert.strictEqual(usdt1.available, 9950, '9950 USDT should remain available');

    // 2. Verify order listed in open orders
    const openRes = await fetch(`${baseUrl}/api/v3/openOrders`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(openRes.status, 200);
    const openOrders = await openRes.json();
    const found = openOrders.find((o: any) => o.orderId === testOrderId);
    assert.ok(found, 'Order should be listed in open orders');
    assert.strictEqual(found.status, 'NEW');

    // 3. User A successfully cancels their own order
    const cancelRes = await fetch(`${baseUrl}/api/v3/order`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        symbol: 'TONUSDT',
        orderId: testOrderId
      })
    });
    assert.strictEqual(cancelRes.status, 200);
    const cancelData = await cancelRes.json();
    assert.strictEqual(cancelData.status, 'CANCELLED');

    // 4. Verify funds unlocked back to available balance
    const portRes2 = await fetch(`${baseUrl}/api/portfolio?userId=${userAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    const port2 = await portRes2.json();
    const usdt2 = port2.balances.find((b: any) => b.asset === 'USDT');
    assert.strictEqual(usdt2.reserved, 0, 'Reserved balance should return to 0');
    assert.strictEqual(usdt2.available, 10000, 'Available balance should be fully restored to 10000');
  });

  // -------------------------------------------------------------
  // Verification Gate 5
  // -------------------------------------------------------------
  it('Check 5: Bad input rejection: negative price, 0 quantity, non-existent pair all reject cleanly', async () => {
    // 1. Negative price
    const negPriceRes = await fetch(`${baseUrl}/api/v3/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        symbol: 'TONUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 10,
        price: -5.0
      })
    });
    assert.strictEqual(negPriceRes.status, 400, 'Negative price must be rejected with 400');
    const negPriceData = await negPriceRes.json();
    assert.ok([-1102, -1104].includes(negPriceData.code), 'Code should be -1102 or -1104');

    // 2. Zero quantity
    const zeroQtyRes = await fetch(`${baseUrl}/api/v3/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        symbol: 'TONUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 0,
        price: 5.0
      })
    });
    assert.strictEqual(zeroQtyRes.status, 400, 'Zero quantity must be rejected with 400');
    const zeroQtyData = await zeroQtyRes.json();
    assert.strictEqual(zeroQtyData.code, -1102);

    // 3. Non-existent trading pair
    const badSymbolRes = await fetch(`${baseUrl}/api/v3/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`
      },
      body: JSON.stringify({
        symbol: 'NONEXISTENT-PAIR',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 10,
        price: 5.0
      })
    });
    assert.strictEqual(badSymbolRes.status, 400, 'Non-existent market must be rejected with 400');
    const badSymbolData = await badSymbolRes.json();
    assert.strictEqual(badSymbolData.code, -1121);
  });

  // -------------------------------------------------------------
  // Verification Gate 6
  // -------------------------------------------------------------
  it('Check 6: Deposit/withdraw disabled assertion: attempts return clear disabled status, not fake success', async () => {
    // 1. Attempt on-chain deposit
    const depRes = await fetch(`${baseUrl}/api/custody/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: 'TON',
        symbol: 'TON',
        amount: 100,
        userId: userAId
      })
    });
    assert.ok([403, 503].includes(depRes.status), 'Real money deposit must return disabled status (403 or 503)');
    const depData = await depRes.json();
    assert.ok(depData.error === 'REAL_MONEY_TRADING_DISABLED' || depData.error === 'FEATURE_NOT_ACTIVATED');
    assert.strictEqual(depData.realFunds === false || depData.virtualTradingOnly === true, true);

    // 2. Attempt on-chain withdrawal
    const withRes = await fetch(`${baseUrl}/api/custody/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: 'TON',
        symbol: 'TON',
        amount: 50,
        toAddress: 'EQD__________________________________________088',
        userId: userAId
      })
    });
    assert.ok([403, 503].includes(withRes.status), 'Real money withdrawal must return disabled status (403 or 503)');
    const withData = await withRes.json();
    assert.ok(withData.error === 'REAL_MONEY_TRADING_DISABLED' || withData.error === 'FEATURE_NOT_ACTIVATED');
    assert.strictEqual(withData.realFunds === false || withData.virtualTradingOnly === true, true);
  });

  // -------------------------------------------------------------
  // Verification Gate 7
  // -------------------------------------------------------------
  it('Check 7: Screener data: Top 100 loads, search works, cached fallback flag present if offline', async () => {
    // 1. Full Top 100 fetch
    const screenerRes = await fetch(`${baseUrl}/api/markets/top100`);
    assert.strictEqual(screenerRes.status, 200);
    const screenerData = await screenerRes.json();

    assert.ok(screenerData.coins.length >= 10, 'Should return market coins');
    assert.ok(['coingecko_api', 'in_memory_cache', 'fallback_dataset'].includes(screenerData.cacheSource));
    assert.ok(screenerData.attribution.includes('CoinGecko'));

    // 2. Screener Search query filter
    const searchRes = await fetch(`${baseUrl}/api/markets/top100?search=bitcoin`);
    assert.strictEqual(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.ok(searchData.coins.length >= 1, 'Should find at least 1 match for bitcoin');
    assert.ok(
      searchData.coins.every((c: any) =>
        c.name.toLowerCase().includes('bitcoin') || c.symbol.toLowerCase().includes('btc')
      ),
      'All returned coins must match the search filter'
    );
  });
});
