# SkyCart

Cloudflare Workers + D1 dropshipping store. Cloudflare Workers Builds connects directly to GitHub for build and deployment. Application credentials are stored as Cloudflare Worker Secrets.

## One-time Cloudflare setup

1. In Cloudflare Dashboard, open **Workers & Pages → D1 SQL Database → Create database**.
2. Create a database named **skycart-db**.
3. Copy its database ID. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with that exact ID and commit the change.
4. Open **Workers & Pages → Create application → Connect to Git** (or open your existing Worker and configure Builds).
5. Select the GitHub repository `paliparsa/skycart` and production branch `main`.
6. Configure the build:
   - Build command: `npm install && npm run typecheck && npm test`
   - Deploy command: `npm run deploy:cloudflare`
   - Root directory: `/`
   - Build output directory: leave empty (Wrangler publishes the Worker and `public/` assets).
7. Ensure the Cloudflare Git integration has permission to deploy Workers and apply D1 migrations.

The deploy command applies pending remote D1 migrations first, then deploys the Worker. Cloudflare automatically starts a new build when changes are pushed to `main`. GitHub Actions remains responsible only for CI checks; it no longer deploys to Cloudflare.

## Configure application secrets

After the first successful deployment, open **Workers & Pages → skycart → Settings → Variables and Secrets** and add these as **Secret** values:

- `ADMIN_PASSWORD` — unique password of at least 20 characters.
- `SUNSKY_API_KEY` — SUNSKY Open API key.
- `SUNSKY_API_SECRET` — SUNSKY Open API secret.

Save the settings. These values remain in Cloudflare and are not committed to GitHub. Attach your custom domain under **Settings → Domains & Routes**. The admin dashboard is at `/admin`.

## Admin and catalogue

Sign in at `/admin` with `ADMIN_PASSWORD`. Use **Sync SUNSKY products** to import the first page. Scheduled catalogue sync runs every 15 minutes. Adjust product markup in the admin panel.

## Orders and payments

Checkout obtains SUNSKY shipping methods and revalidates shipping server-side. Orders remain `pending_payment` until you independently verify payment and select **Confirm paid & submit** in the admin panel. Supplier orders use your SUNSKY account balance (`useBalanceOnly=true`). Ambiguous supplier responses are blocked from automatic retry to reduce duplicate orders; verify the SUNSKY portal before taking further action.

No card or crypto payment gateway is enabled. The storefront does not pretend to collect payments.

## Important

SUNSKY must enable Open API access for your supplier account. Review product costs, markup, inventory, and shipping options before launch. See `docs/DEPLOYMENT.md`.
