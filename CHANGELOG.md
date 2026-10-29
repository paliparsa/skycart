# Changelog

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
