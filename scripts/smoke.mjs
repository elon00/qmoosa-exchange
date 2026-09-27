import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const port = 14397;
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['dist/api/server.js'], {
  env: { ...process.env, PORT: String(port), NODE_ENV: 'production', DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
async function request(path, options = {}) {
  return fetch(origin + path, { ...options, signal: AbortSignal.timeout(3000) });
}
const post = (path, body, token) => request(path, { method: 'POST', headers: {
  'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})
}, body: JSON.stringify(body) });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error('Server exited before readiness');
    try { ready = (await request('/health')).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, 'Server must start');
  assert.equal((await (await request('/health')).json()).realFundsEnabled, false);
  assert.equal((await request('/')).status, 200, 'Same-origin frontend');
  assert.equal((await request('/sandbox.html')).status, 200);
  assert.equal((await request('/api/portfolio?userId=user_alice')).status, 401);
  const alice = await (await post('/api/auth/register', { email: 'alice@smoke.test', password: 'test-password-123' })).json();
  const bob = await (await post('/api/auth/register', { email: 'bob@smoke.test', password: 'test-password-456' })).json();
  assert.match(alice.token, /^[a-f0-9]{64}$/);
  const portfolio = await (await request(`/api/portfolio?userId=${bob.user.id}`, { headers: { Authorization: `Bearer ${alice.token}` } })).json();
  assert.equal(portfolio.userId, alice.user.id, 'Client cannot select another account');
  const placed = await post('/api/v3/order', {symbol: 'TONUSDT', side: 'BUY', type: 'LIMIT', price: 1, quantity: 1, userId: bob.user.id}, alice.token);
  assert.equal(placed.status, 200);
  const order = await placed.json();
  const bobOrders = await (await request('/api/v3/openOrders', {headers: {Authorization: `Bearer ${bob.token}`}})).json();
  assert.equal(bobOrders.length, 0);
  const denied = await request('/api/v3/order', {method: 'DELETE', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${bob.token}`}, body: JSON.stringify({symbol: 'TONUSDT', orderId: order.orderId, userId: alice.user.id})});
  assert.equal(denied.status, 404, 'Another user cannot cancel the order');
  const cancelled = await request('/api/v3/order', {method: 'DELETE', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${alice.token}`}, body: JSON.stringify({symbol: 'TONUSDT', orderId: order.orderId})});
  assert.equal(cancelled.status, 200);
  assert.equal((await post('/api/custody/withdraw', {})).status, 503);
  assert.equal((await post('/api/v1/pqc/sign', { payload: 'arbitrary' })).status, 503);
  assert.equal((await post('/api/v1/agentics/prompt-trade', {})).status, 503);
  const challengeResponse = await request('/api/v1/x402/challenge');
  assert.equal(challengeResponse.status, 503, 'No payment solicitation without verifier');
  assert.equal((await request('/api/v1/x402/signals', { headers: { 'PAYMENT-SIGNATURE': 'sig_x402_forged' } })).status, 503);
  await post('/api/auth/logout', {}, alice.token);
  assert.equal((await request('/api/portfolio', { headers: { Authorization: `Bearer ${alice.token}` } })).status, 401);
  console.log('HTTP smoke passed: frontend, health, registration, account isolation, disabled unsafe features, logout.');
} catch (error) {
  console.error(logs); throw error;
} finally {
  child.kill('SIGTERM');
}
