# SkyCart

Cloudflare Workers + D1 dropshipping store, with automatic D1 provisioning, migrations, Worker secret setup, scheduled SUNSKY product sync, and a password-protected admin dashboard.

## One-time GitHub setup

Open Settings → Secrets and variables → Actions and add:

- CLOUDFLARE_ACCOUNT_ID (required)
- CLOUDFLARE_API_TOKEN (required; account-scoped token with Workers Scripts edit, D1 edit, and Workers Routes/custom domains permissions if you want to manage routes via API)
- ADMIN_PASSWORD (required; unique password, at least 20 characters)
- SUNSKY_API_KEY (optional until your SUNSKY API access is approved)
- SUNSKY_API_SECRET (optional until your SUNSKY API access is approved)

Push to main or run the Deploy SkyCart to Cloudflare workflow manually. The workflow creates or reuses D1 database skycart-db, updates the binding, applies migrations, sets Worker secrets, and deploys the Worker and storefront assets. Then attach your custom domain in Cloudflare Workers → skycart → Settings → Domains & Routes.

## Admin

Visit /admin on your domain. Sign in using ADMIN_PASSWORD. Configure SUNSKY API key and secret as GitHub Actions secrets, then deploy again. Use Sync SUNSKY products to import the first page. A scheduled sync runs every 15 minutes and processes additional pages in batches. Product markup can be adjusted per product in the admin panel.

## Orders and payments

Customer checkout asks SUNSKY for shipping methods and recalculates shipping server-side. Orders remain pending_payment. Only after you independently verify the customer's payment should you click Confirm paid & submit in the admin panel. This submits the order to SUNSKY using your SUNSKY account balance (useBalanceOnly=true). A failed/ambiguous supplier response is blocked from automatic retry to reduce duplicate orders; verify the supplier portal before taking further action.

No card/crypto gateway is enabled. The storefront does not pretend to collect payments.

## Important

SUNSKY Open API access must be enabled for your supplier account by SUNSKY. API signing follows the official Open API documentation. Product images are imported only when the API provides a valid HTTPS image URL. Review product costs, markup, inventory and shipping options before launch. See docs/DEPLOYMENT.md.
