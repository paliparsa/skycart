# SkyCart

A Cloudflare-first branded dropshipping storefront starter using Workers, D1 and static assets.

## Safety/status
The storefront, catalog API and D1-backed demo-order flow are included. **Live SUNSKY ordering and payment capture are deliberately disabled** until official seller API documentation, authentication/signature rules, shipping logic and a payment provider are verified. Demo checkout records `pending_payment`; it does not charge a card or submit a supplier order.

## Local setup
1. Install Node.js 20+.
2. `npm install`
3. Run `npx wrangler d1 create skycart-db`; copy the returned ID into `wrangler.toml`.
4. `npm run db:migrate:local`
5. `npm run dev`

## API
- `GET /api/health`
- `GET /api/products?q=&category=&limit=`
- `GET /api/products/:slug`
- `POST /api/orders` — validates prices server-side and stores pending order only
- `GET /api/orders/:id` — status only, no personal data

Read [deployment notes](docs/DEPLOYMENT.md) before going live. Sample products/prices are illustrative; never publish them as supplier-confirmed inventory.
