# Qmoosa: free-tier master blueprint and activation

## What this release actually provides

A sandbox with a same-origin Express backend and Vite frontend, a connected
`/sandbox.html` dashboard, bearer-session account access, cached market data,
and build/test/HTTP smoke gates. The older terminal remains a visual simulation.
This is not a live-money exchange, audited custody system, or certified PQC product.

## One-time activation

1. Merge the safety/deployment changes after CI is green.
2. Sign in to Render, connect **your** elon00/qmoosa-exchange repository, and
   create a Blueprint from `render.yaml` on `main`. Confirm the Free service.
   Link your Git provider so deployment can wait for passing CI checks.
3. Open the resulting Render URL, then `/sandbox.html`. The same service serves
   frontend, API and WebSocket, so no cross-origin URL guessing is needed.
4. Optional: set COINGECKO_API_KEY in Render environment settings to your Demo
   API key. Never put API secrets in frontend VITE variables or Git.
5. Optional account persistence: configure DATABASE_URL for a PostgreSQL service
   such as Neon Free. This does NOT persist the matching engine or full trading
   state. Database initialization errors now stop startup instead of silently
   losing data. Sessions are intentionally invalidated on restart.
6. Register a sandbox account, view your own portfolio and load market data.
   Check the displayed source/time. Offline samples are not live prices.

Provider account creation, provider permissions and any provider-required billing
verification cannot be automated without your participation. No paid resource is
requested by this blueprint. No active cloud backend URL is claimed until its
health and account flow are observed. Free quotas and terms can change.

## CI/CD

`npm run verify` runs unit/regression tests, frontend and backend compilation,
and a real HTTP child-process smoke test. GitHub runs it on PRs, main pushes,
manual dispatch and weekly. Production dependency audit blocks high severity
findings. Main deploys only `dist/client` to Pages. Render rebuilds the full
application after linked CI checks pass. API server code is never published in
the Pages artifact. GitHub Pages/Netlify alone host only the static UI.

Render setup is once per account/service; subsequent eligible pushes deploy
through CI. A manual workflow run validates code; it cannot create cloud
accounts or turn simulated modules into live trading infrastructure.

## Free-tier limits and recovery

Render Free can sleep after inactivity, restart, or exhaust monthly quotas.
No artificial keep-alive traffic is configured. The browser shows backend
unavailable/waking instead of fabricating success. Trading data still resides
in memory; do not call it durable or distribute customer funds. To roll back,
redeploy a reviewed known-good commit through Render's normal controls.

The market cache is ten minutes with shared in-flight fetches and failure
backoff. With one continuously running instance, one call per interval is
about 4,464 calls in 31 days, plus restarts. This is an estimate, not a quota
guarantee. Check the provider's account dashboard before enabling more feeds.
No real-money trades may use delayed/stale/sample prices.

## Remaining milestones (not completed)

1. Durable transactional ledger/order storage, restart recovery and migrations.
2. Proper identity recovery/MFA, durable revocable sessions, abuse testing.
3. Connect terminal orders and balances to authenticated APIs and test isolation.
4. Real testnet deposit verification, withdrawal policies and isolated signing.
5. Official x402 interoperability, independent verified settlement, durable
   replay protection and receipts bound to exact service, chain, asset and amount.
6. Real venue data and honest AI evaluation; no random profit or confidence claims.
7. External audit, operator runbooks, backups, restore/load tests and production
   decisions before any real customer funds.

Blocked legacy custody, bot control, AI execution and x402 routes return 503.
No fake payment is accepted; service fees never manufacture trading collateral.
Do not remove these gates merely to obtain successful demo responses.

## Acceptance checklist

- CI green at the exact commit, including backend smoke and forged-payment tests.
- /health reports sandbox, realFundsEnabled=false, and volatile trading storage.
- /sandbox.html and /api/* share the Render origin.
- Another user's ID cannot select that user's portfolio.
- x402 payment routes and arbitrary server-key signing stay disabled.
- A live deployment is marked active only after the above checks pass there.

Sources (checked 2026-09-27):
- https://render.com/docs/blueprint-spec
- https://render.com/docs/free
- https://render.com/docs/deploys
- https://www.coingecko.com/en/api/pricing
