# SkyCart

Cloudflare Workers + D1 dropshipping store. Application credentials are managed as Cloudflare Worker Secrets; GitHub Actions is used only to deploy.

## GitHub deployment setup

Add only these repository Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (Workers Scripts edit and D1 edit permissions)

Push to `main` or manually run **Deploy SkyCart to Cloudflare**. The workflow provisions/reuses D1, applies migrations, and deploys the Worker and storefront. It does not read or overwrite application secrets.

## Configure secrets in Cloudflare

After the first successful deployment, open **Cloudflare Dashboard → Workers & Pages → skycart → Settings → Variables and Secrets** and add these as **Secret** values:

- `ADMIN_PASSWORD` — unique password of at least 20 characters.
- `SUNSKY_API_KEY` — SUNSKY Open API key.
- `SUNSKY_API_SECRET` — SUNSKY Open API secret.

Save the settings. These values remain in Cloudflare and are not touched by later GitHub deployments. Rotate them from the same Cloudflare screen whenever needed.

Attach your custom domain under **Settings → Domains & Routes**. The admin dashboard is at `/admin`.

## Admin and catalogue

Sign in at `/admin` with `ADMIN_PASSWORD`. Use **Sync SUNSKY products** to import the first page. Scheduled catalogue sync runs every 15 minutes. Adjust product markup in the admin panel.

## Orders and payments

Checkout obtains SUNSKY shipping methods and revalidates shipping server-side. Orders remain `pending_payment` until you independently verify payment and select **Confirm paid & submit** in the admin panel. Supplier orders use your SUNSKY account balance (`useBalanceOnly=true`). Ambiguous supplier responses are blocked from automatic retry to reduce duplicate orders; verify the SUNSKY portal before taking further action.

No card or crypto payment gateway is enabled. The storefront does not pretend to collect payments.

## Important

SUNSKY must enable Open API access for your supplier account. Review product costs, markup, inventory, and shipping options before launch. See `docs/DEPLOYMENT.md`.
