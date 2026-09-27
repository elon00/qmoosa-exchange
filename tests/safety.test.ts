import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoinGeckoFeed } from '../src/market/CoinGeckoFeed.js';
import { AuthService } from '../src/auth/AuthService.js';
import { DbAdapter } from '../src/database/DbAdapter.js';
import { Ledger } from '../src/engine/Ledger.js';

test('market requests coalesce and back off on upstream failures', async () => {
  let calls = 0;
  const feed = new CoinGeckoFeed(async () => { calls++; return new Response('', { status: 429 }); });
  const responses = await Promise.all(Array.from({length: 20}, () => feed.getTop100Coins()));
  await feed.getTop100Coins();
  assert.equal(calls, 1);
  assert.equal(responses[0].cacheSource, 'fallback_dataset');
  assert.equal(responses[0].lastUpdated, 0);
});
test('bearer sessions reject fabricated tokens and revoke on logout', async () => {
  const auth = new AuthService(new DbAdapter(), new Ledger());
  const user = await auth.register('session@test.example', 'long-test-password');
  assert.equal(auth.authenticate(`demo_tok_${user.user.id}_${Date.now()}`), null);
  assert.equal(auth.authenticate(user.token), user.user.id);
  auth.logout(user.token);
  assert.equal(auth.authenticate(user.token), null);
});
