# Changelog

## 0.5.1 — 2026-10-30

- Restored automatic Cloudflare D1 provisioning for Cloudflare Workers Builds.
- Deployment now checks for `skycart-db`, creates it only when missing, and resolves its database UUID without manual configuration.
- Applies remote D1 migrations before deploying the Worker; repeated builds reuse the existing database.
- Updated deployment documentation and removed the manual database-ID setup step.

## 0.5.0 — 2026-10-30

- Switched production deployment from GitHub Actions to Cloudflare Workers Builds connected directly to GitHub.
- Removed the GitHub workflow that provisioned D1 and deployed the Worker using Cloudflare API credentials.
- Added a Cloudflare-native deploy command that applies remote D1 migrations before Wrangler deployment.
- Documented one-time D1 creation, repository connection, build/deploy commands, and Worker secret configuration.
- Kept GitHub Actions for CI verification only.

## 0.4.0 — 2026-10-30

- Moved admin and SUNSKY credentials from GitHub Actions to Cloudflare Worker Secrets.
- Reduced GitHub deployment requirements to Cloudflare account ID and deployment API token.
- Deployments no longer overwrite application secrets stored in Cloudflare.
- Updated setup documentation.

## 0.3.0 — 2026-10-29

- Added GitHub Actions deployment to Cloudflare Workers.
- Added automatic D1 database provisioning and migration application.
- Added Worker secret provisioning for the admin password and SUNSKY API credentials.
- Added a password-protected admin dashboard with login throttling and signed secure sessions.
- Added SUNSKY API signing, product import, scheduled catalogue sync, margin controls and shipping quotes.
- Added manual payment confirmation followed by SUNSKY order submission.
- Added shipping address fields, live shipping-method selection and server-side shipping revalidation.
- Added safeguards against blind retries after ambiguous supplier-order responses.
- Updated CI to Node.js 22 and expanded guardrail tests.

## 0.2.0 — 2026-10-29

- Added initial SkyCart storefront and Cloudflare Worker foundation.
