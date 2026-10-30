# Cloudflare-native deployment and launch checklist

## One-time setup

1. Connect `paliparsa/skycart` to Cloudflare Workers Builds with production branch `main`.
2. Set the build command to `npm install && npm run typecheck && npm test`.
3. Set the deploy command to `npm run deploy:cloudflare`.
4. Ensure the Cloudflare build integration is authorized to list and create D1 databases, apply D1 migrations, and deploy Workers.
5. The first deployment automatically creates `skycart-db` if it does not exist, writes its UUID into the build workspace's `wrangler.toml`, applies migrations, and deploys the Worker. Later deployments reuse the same database.
6. After the first successful deploy, add the three application credentials below as Worker Secrets.
7. Attach your custom domain under **Settings → Domains & Routes**.

## Worker secrets

Set these in **Workers & Pages → skycart → Settings → Variables and Secrets** as Secret values:

- `ADMIN_PASSWORD` — unique password, at least 20 characters.
- `SUNSKY_API_KEY` — SUNSKY Open API key.
- `SUNSKY_API_SECRET` — SUNSKY Open API secret.

Never commit credentials or put application secrets in GitHub Actions. Cloudflare stores these values and subsequent deployments do not overwrite them.

## Deployment behavior

Cloudflare Workers Builds watches the connected GitHub branch and runs the configured build and deploy commands. `scripts/deploy-cloudflare.mjs` checks the account for `skycart-db`, creates it only when absent, writes the discovered/created UUID into the temporary build checkout, applies pending remote migrations, and runs `wrangler deploy`. The D1 database ID is not committed back to GitHub; every build resolves it from the Cloudflare account. GitHub Actions runs CI checks only; it does not deploy.

## Launch checklist

1. Open `/api/health` and verify the Worker and D1 database respond.
2. Open `/admin`, sign in, check the integration status and run **Sync SUNSKY products**.
3. Review product costs, markup, inventory, and shipping options.
4. Place a small test order and verify the shipping method and total.
5. Confirm a real customer payment only after checking your payment provider/bank independently. Then use **Confirm paid & submit**. The action uses the SUNSKY account balance; ensure the balance is sufficient.

## Boundaries

- Customer payment gateway is not configured; manual payment verification is used.
- SUNSKY account must have Open API access enabled by its sales manager.
- Cloudflare custom domain/DNS attachment is a one-time dashboard step.
- A supplier API timeout after submission may be ambiguous. The admin intentionally blocks blind retry; verify the SUNSKY portal first.
