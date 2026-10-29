# Cloudflare-native deployment and launch checklist

## One-time setup

1. Create a Cloudflare D1 database named `skycart-db`.
2. Copy its database ID into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`, and commit the change.
3. Connect `paliparsa/skycart` to Cloudflare Workers Builds with production branch `main`.
4. Set the build command to `npm install && npm run typecheck && npm test`.
5. Set the deploy command to `npm run deploy:cloudflare`.
6. Ensure the Cloudflare Git integration can deploy Workers and apply D1 migrations.
7. After the first successful deploy, add the three application credentials below as Worker Secrets.
8. Attach your custom domain under **Settings → Domains & Routes**.

## Worker secrets

Set these in **Workers & Pages → skycart → Settings → Variables and Secrets** as Secret values:

- `ADMIN_PASSWORD` — unique password, at least 20 characters.
- `SUNSKY_API_KEY` — SUNSKY Open API key.
- `SUNSKY_API_SECRET` — SUNSKY Open API secret.

Never commit credentials or put application secrets in GitHub Actions. Cloudflare stores these values and subsequent deployments do not overwrite them.

## Deployment behavior

Cloudflare Workers Builds watches the connected GitHub branch and runs the configured build and deploy commands. The deploy command applies pending remote D1 migrations, then runs Wrangler deployment. GitHub Actions runs CI checks only; it does not deploy or require Cloudflare account credentials.

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
