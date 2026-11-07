# RunLattice — Stripe Billing

**Status:** Billing application code and test-mode safeguards are implemented on the development branch. End-to-end sandbox verification still requires a Stripe sandbox, Price IDs and webhook signing secret.

## Proposed subscription model
- Free: €0/month, 3 workflows, 100 runs/month, 1 member.
- Pro: €19/month, 25 workflows, 5,000 runs/month, 3 members, 100 AI requests/month.
- Team: €49/month, 100 workflows, 25,000 runs/month, 10 members, 500 AI requests/month.
- Flat-rate monthly subscription per workspace. These are launch proposals, not yet live Stripe prices.

## Implemented in the application
- Authenticated owner/admin-only Checkout and Customer Portal API.
- Stripe Customer mapped to each workspace.
- Hosted subscription Checkout with required billing address and VAT ID collection.
- Optional Stripe Tax flag, disabled by default.
- Signed webhook verification using the raw request body.
- Event ID persistence for webhook deduplication.
- Subscription state synchronization.
- Server-side workspace entitlements and workflow/run quota enforcement.
- Stripe live keys rejected unless STRIPE_LIVE_MODE_ENABLED=true is explicitly enabled.

## Required Railway Web variables
- STRIPE_SECRET_KEY: sandbox/test secret key (sk_test_... or restricted test key).
- STRIPE_WEBHOOK_SECRET: sandbox webhook signing secret.
- STRIPE_PRICE_PRO_MONTHLY: Pro monthly test Price ID.
- STRIPE_PRICE_TEAM_MONTHLY: Team monthly test Price ID.
- STRIPE_AUTOMATIC_TAX_ENABLED: keep false until tax registrations are configured.
- RESEND_API_KEY and EMAIL_FROM: transactional email verification and password recovery.

## Remaining Stripe Dashboard work
1. Create Pro (€19/month) and Team (€49/month) Products/Prices in a Stripe sandbox.
2. Configure the Customer Portal for cancellation, payment method updates and plan changes.
3. Register /api/billing/webhook for Checkout completion, subscription create/update/delete and invoice payment failure.
4. Add test-mode Price IDs and webhook secret to Railway.
5. Test successful checkout, failed payment, renewal, cancellation, plan changes, replayed events and workspace isolation.

## Tax and legal
Automatic tax remains disabled until the company has configured applicable VAT registrations and tax settings in Stripe. Tax treatment, refund policy, terms and pricing need review before live billing.
