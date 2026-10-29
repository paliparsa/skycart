# Deployment

1. `npm install`
2. `npx wrangler d1 create skycart-db` and copy its ID into `wrangler.toml`.
3. `npm run db:migrate:local` for development; `npm run db:migrate:remote` for production.
4. `npm run typecheck && npm test`
5. `npm run dev` locally or `npm run deploy` when ready.

Before live commerce, implement and sandbox-test the official SUNSKY authentication/signature, product and inventory sync, supplier order creation, retries/idempotency, shipping, cancellations, and reconciliation. Add a payment provider with verified signed webhooks and only then transition order state after payment confirmation. Set credentials using `wrangler secret put NAME`; never commit secrets. The included scheduled task records a skipped sync, and the supplier integration intentionally makes no network calls.
