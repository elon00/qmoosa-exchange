// No secret or bearer token is persisted in browser storage.
let token = ''; let coins = [];
const byId = id => document.getElementById(id);
async function api(path, body, method) {
  const res = await fetch(path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})
  }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(70000) });
  if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('Backend unavailable. Open this dashboard on the Render full-stack URL, not the static Pages URL.');
  const data = await res.json(); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); return data;
}
byId('account').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const data = await api(`/api/auth/${event.submitter.value}`, { email: byId('email').value, password: byId('password').value });
    token = data.token; byId('password').value = '';
    byId('account-result').textContent = `Signed in: ${data.user.email}. Virtual sandbox account only.`;
  } catch (err) { byId('account-result').textContent = err.message; }
});
byId('logout').onclick = async () => { try { await api('/api/auth/logout', {}); } catch {} token = ''; byId('account-result').textContent = 'Signed out'; };
byId('portfolio').onclick = async () => { try { byId('account-result').textContent = JSON.stringify(await api('/api/portfolio'), null, 2); } catch (err) { byId('account-result').textContent = err.message; } };
function render() {
  const query = byId('search').value.toLowerCase(); byId('coins').replaceChildren();
  for (const coin of coins.filter(c => `${c.name} ${c.symbol}`.toLowerCase().includes(query))) {
    const row = document.createElement('tr');
    for (const value of [`${coin.name} (${coin.symbol.toUpperCase()})`, coin.current_price.toLocaleString(), `${coin.price_change_percentage_24h.toFixed(2)}%`, coin.market_cap.toLocaleString()]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    byId('coins').append(row);
  }
}
byId('search').oninput = render;
byId('refresh').onclick = async () => {
  byId('source').textContent = 'Loading (free backend may need to wake up)…';
  try { const data = await api('/api/markets/top100'); coins = data.coins;
    byId('source').textContent = `${data.total} coins • ${data.cacheSource} • ${data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'No live update yet'}${data.cacheSource === 'fallback_dataset' ? ' — OFFLINE SAMPLE / STALE DATA' : ''}`; render();
  } catch (err) { byId('source').textContent = err.message; }
};
api('/health').then(d => { byId('status').textContent = `Backend connected • ${d.mode} • trading storage: ${d.tradingPersistence}`; byId('refresh').click(); }).catch(err => byId('status').textContent = err.message);

byId('order').onsubmit = async event => {
  event.preventDefault();
  try { byId('order-result').textContent = JSON.stringify(await api('/api/v3/order', {
    symbol: byId('pair').value, side: byId('side').value, type: 'LIMIT',
    quantity: Number(byId('quantity').value), price: Number(byId('price').value)
  }), null, 2); } catch (err) { byId('order-result').textContent = err.message; }
};
byId('orders').onclick = async () => { try { byId('order-result').textContent = JSON.stringify(await api('/api/v3/openOrders'), null, 2); } catch (err) { byId('order-result').textContent = err.message; } };
byId('cancel').onclick = async () => { try { byId('order-result').textContent = JSON.stringify(await api('/api/v3/order', { symbol: byId('pair').value, orderId: byId('cancel-id').value }, 'DELETE'), null, 2); } catch (err) { byId('order-result').textContent = err.message; } };
