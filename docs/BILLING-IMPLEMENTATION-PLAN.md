# RunLattice — Stripe Billing implementation plan

**Status:** Architecture selected. Application billing code and Stripe account configuration are not complete.

## Product model
- B2B SaaS subscription billed per workspace initially (not per seat).
- Free tier without payment details.
- Paid plans: Pro and Team, monthly and annual, in EUR.
- Each selectable tier is a separate Stripe Product; monthly/annual variants are Prices on that product.
- Backend enforces entitlements and quotas; never trust client-side plan labels.

## Checkout and lifecycle
1. Authenticate with Better Auth.
2. Resolve active workspace from server session and verify owner/admin membership.
3. Create/retrieve Stripe Customer associated with that workspace.
4. Create hosted Checkout Session in subscription mode using a server-side allowlist of configured Price IDs.
5. Store Stripe identifiers and subscription state in PostgreSQL.
6. Provide Stripe Customer Portal for upgrades, downgrades, cancellations and payment-method updates.
7. Grant paid entitlements only after verified webhooks and a valid subscription state. Never grant access from a browser success redirect alone.

## Required webhook events
Handle only events the application acts on:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.dispute.created`
- `charge.refunded`
- `radar.early_fraud_warning.created`

Verify signatures against the raw request body. Persist event IDs for idempotency and make handlers retry-safe. Resolve Stripe Customer/Subscription resources to the owning workspace; do not rely on untrusted metadata alone. Never log keys, webhook secrets or payment data.

## Required Railway Web configuration
- `STRIPE_SECRET_KEY`: test-mode restricted key during development; separate least-privilege live restricted key only after launch approval.
- `STRIPE_WEBHOOK_SECRET`: test endpoint signing secret.
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_TEAM_MONTHLY`
- `STRIPE_PRICE_TEAM_ANNUAL`
- `APP_BASE_URL`: canonical HTTPS origin.

Use separate test/live keys and secrets. Prefer restricted API keys with only required Customer, Checkout Session, Billing Portal, Subscription and Product/Price permissions.

## Tax
Do not enable automatic tax until the merchant's VAT/tax obligations and active Stripe Tax registrations are confirmed. Enabling an automatic-tax flag without a valid registration does not ensure tax is collected.

## Launch gates
- [ ] Create Products and Prices in a Stripe sandbox/test environment.
- [ ] Configure Customer Portal features and branding.
- [ ] Implement checkout, portal and webhook API routes.
- [ ] Add database migration and idempotent event storage.
- [ ] Test successful/async payment, renewal, failed invoice, cancellation, plan change, refund, dispute and replayed webhook.
- [ ] Verify workspace isolation and entitlement enforcement.
- [ ] Add billing emails and support/refund processes.
- [ ] Complete VAT/tax and legal review.
- [ ] Only then configure live-mode products, restricted key and webhook endpoint.
