# SkyCart

A global dropshipping storefront powered by **Cloudflare Workers**, **D1**, and the **SUNSKY Open API**.

Production deployments run through **Cloudflare Workers Builds**, connected directly to this GitHub repository. GitHub Actions is used for code verification only; no Cloudflare deployment token is required in GitHub.

## Production deployment

### 1. Connect this repository to Cloudflare

1. In Cloudflare, open **Workers & Pages → Create application → Connect to Git**. If the Worker already exists, open its **Builds** settings instead.
2. Authorize GitHub if prompted.
3. Select repository `paliparsa/skycart`.
4. Select `main` as the production branch.
5. Configure the build settings as follows:

| Setting | Value |
|---|---|
| Root directory | `/` |
| Build command | `npm install && npm run typecheck && npm test` |
| Deploy command | `npm run deploy:cloudflare` |
| Build output directory | Leave empty |

Do not use `npm ci`: this repository does not currently include a package lockfile.

The deploy command runs `scripts/deploy-cloudflare.mjs`, which:

1. Lists your remote D1 databases and looks for `skycart-db`.
2. Reuses the existing database if found; otherwise creates it with the `DB` binding.
3. Writes the database UUID into `wrangler.toml` in the build workspace (no manual ID copy or commit is needed).
4. Applies pending remote migrations, then deploys the Worker.

The provisioning step is safe to repeat: it checks for the named database before creating one, so subsequent builds reuse the same database. Workers Builds creates its own API token by default. Open the token in Cloudflare **My Profile → API Tokens** and ensure it has **D1: Edit** in addition to the Worker deployment permissions; the default token may not include D1 access. Pushes to `main` will then trigger Cloudflare Builds automatically.

### 3. Add application secrets in Cloudflare

After the first successful deployment, open **Workers & Pages → skycart → Settings → Variables and Secrets**. Add the following as **Secret** values (not plain-text variables):

| Secret | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Admin login password; use a unique password of at least 20 characters |
| `SUNSKY_API_KEY` | SUNSKY Open API key |
| `SUNSKY_API_SECRET` | SUNSKY Open API secret |

Save the settings. These credentials are stored in Cloudflare and are not committed to the repository. Do not add them to the GitHub repository, source code, or build command.

### 4. Add your domain and verify the deployment

1. In the Worker settings, open **Domains & Routes** and attach your domain.
2. Visit `/api/health` and confirm the Worker and D1 database are available.
3. Visit `/admin` and sign in with `ADMIN_PASSWORD`.
4. Check the supplier integration status and run **Sync SUNSKY products**.

## Development and CI

Install dependencies:

```bash
npm install
```

Run checks locally:

```bash
npm run typecheck
npm test
```

Run the Worker locally:

```bash
npm run dev
```

GitHub Actions runs type checking and tests on pushes to `main` and pull requests. It does **not** deploy the production Worker and does not need `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` secrets.

Useful scripts:

| Command | Description |
|---|---|
| `npm run dev` | Start the local Wrangler development server |
| `npm run typecheck` | Run TypeScript checks |
| `npm test` | Run automated tests |
| `npm run deploy:cloudflare` | Create or reuse D1, apply remote migrations, then deploy the Worker |
| `npm run db:migrate:local` | Apply D1 migrations to the local database |
| `npm run db:migrate:remote` | Apply D1 migrations to the remote database |

## Admin and catalogue

The admin dashboard is available at `/admin`. Use **Sync SUNSKY products** to import catalogue products. A scheduled sync runs every 15 minutes. Product markup can be adjusted in the admin panel.

## Orders and payments

Checkout retrieves SUNSKY shipping methods and revalidates shipping server-side. New orders remain in `pending_payment` until payment is independently verified and manually confirmed in the admin panel using **Confirm paid & submit**.

Supplier orders use the SUNSKY account balance (`useBalanceOnly=true`). Ensure the supplier account has sufficient funds before submitting. If a supplier response is ambiguous, SkyCart blocks blind retries to reduce duplicate orders; verify the order in the SUNSKY portal before taking further action.

**No card or crypto payment gateway is currently enabled.** The storefront does not claim to collect payments automatically.

## Requirements and launch notes

- SUNSKY must enable Open API access for your supplier account.
- Review product costs, markup, inventory, and shipping options before launch.
- Test shipping quotes and place a small test order before accepting real orders.
- Keep all application credentials in Cloudflare Worker Secrets.

For the detailed deployment checklist, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
