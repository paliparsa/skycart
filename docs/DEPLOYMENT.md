# Deployment and launch checklist

1. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to GitHub Actions secrets.
2. Add ADMIN_PASSWORD (unique, at least 20 characters).
3. Add SUNSKY_API_KEY and SUNSKY_API_SECRET from your SUNSKY account manager when API access is enabled.
4. Push to main or run the Deploy SkyCart to Cloudflare workflow.
5. Wait for the workflow to complete successfully. It provisions/reuses D1, applies migrations, configures Worker secrets and deploys.
6. In Cloudflare, open Workers & Pages → skycart → Settings → Domains & Routes and add your domain.
7. Open /admin, sign in, check the integration status and run Sync SUNSKY products.
8. Place a small test order with a test customer address. Verify the shipping method and total before accepting orders.
9. Confirm a real customer payment only after checking your payment provider/bank independently. Then use Confirm paid & submit. The action uses the SUNSKY account balance; ensure the balance is sufficient.

## Secrets

Never commit API credentials or paste them into the browser admin. GitHub Actions deploys them to Worker secrets. Updating the secrets and running the deploy workflow updates the live Worker.

## Boundaries

- Customer payment gateway is not configured; manual payment verification is used.
- SUNSKY account must have API access enabled by its sales manager.
- Cloudflare custom domain/DNS attachment is a one-time dashboard step.
- A supplier API timeout after submission may be ambiguous. The admin intentionally blocks blind retry; verify the SUNSKY portal first.
