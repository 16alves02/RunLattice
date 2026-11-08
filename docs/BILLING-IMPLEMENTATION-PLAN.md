# RunLattice — Plans, quotas and Stripe Billing

**Status:** Plan entitlements and server-side quota enforcement are being implemented on `feature/plan-quotas-enforcement`. Stripe Checkout and webhook code exists, but sandbox end-to-end verification is still pending. No live billing is enabled by this work.

## Proposed customer-facing pricing

| Plan | Monthly | Annual monthly equivalent | Annual charge |
| --- | ---: | ---: | ---: |
| Free | €0 | €0 | €0 |
| Pro | €11.99 | €9.99 | €119.88 |
| Teams | €34.99 | €27.99 | €335.88 |
| Business | €99.99 | €84.99 | €1,019.88 |
| Enterprise | Custom | Custom | Custom |

These are the selected commercial prices from the RunLattice pricing discussion. Annual amounts are monthly-equivalent prices billed once per year. Stripe sandbox Price objects still need to be created and connected; no live price or charge is configured. The 14-day trial is the default for new paid subscriptions. Displayed prices and tax treatment require accounting review before launch.

## Plan quotas

Monthly execution and AI counters reset at 00:00 UTC on the first day of each calendar month.

| Limit | Free | Pro | Teams | Business |
| --- | ---: | ---: | ---: | ---: |
| Active workflows | 3 | 20 | 100 | 500 |
| Workflow executions/month | 100 | 1,000 | 5,000 | 20,000 |
| Workspace members | 1 | 1 | 5 | 15 |
| Connected integrations | 1 | 5 | 15 | 50 |
| AI credits/month | 10 | 100 | 400 | 1,200 |
| AI token ceiling/month | 20,000 | 200,000 | 800,000 | 2,400,000 |
| Visible run history | 7 days | 30 days | 90 days | 180 days |
| Concurrent executions | 1 | 2 | 5 | 10 |

One workflow run consumes one execution, including failed runs. A duplicate delivery is rejected by the existing webhook idempotency constraint. Technical retries of the same run do not create a second billable run. Each AI workflow-plan request consumes one credit; token usage is separately capped to prevent oversized requests.

## Implemented in this branch

- Plan entitlement definitions for Free, Pro, Teams and Business.
- Atomic monthly run admission using a PostgreSQL workspace advisory lock, applied to manual runs, signed inbound webhooks and scheduled triggers.
- Per-workspace concurrent execution admission in the worker; jobs are deferred while the workspace is at its concurrency ceiling.
- Active workflow quota, enforced atomically when a workflow is activated. Draft workflows do not consume an active-workflow slot.
- Integration connection quota, enforced atomically when a connection is created.
- Better Auth organization membership limit, resolved from the workspace's current subscription.
- AI request and token reservations before platform-funded provider calls, with plan-specific ceilings and provider-reported usage settlement.
- Encrypted workspace BYOK credentials for OpenAI, Anthropic and Google Gemini; BYOK usage is recorded for telemetry but does not consume RunLattice-funded credits.
- Run-history visibility windows in the API. This hides older history from the application; it does not physically delete old database records.
- Dashboard usage warnings at 50%, 75% and 90% of the workflow, execution, integration and AI credit limits.
- Billing page aligned with the proposed monthly prices and quota table.
- Stripe subscription mapping supports monthly and annual Price IDs for Pro, Teams and Business.
- Checkout supports a 14-day trial for paid plans and the Customer Portal for subscription self-service.
- Webhook processing handles subscription lifecycle events, `invoice.paid`, `invoice.payment_failed`, disputes, refunds and early-fraud warnings. Risk-related events are retained for workspace review.

## Not yet implemented or verified

- Physical deletion/archival of run history after the visible-history window.
- Additional prepaid AI credit packs, with Stripe one-time checkout and usage reconciliation still pending.
- Annual Stripe sandbox Price objects and end-to-end checkout verification.
- Stripe sandbox Products/Prices, webhook signing secret and end-to-end checkout tests.
- Automatic usage notifications by email or push at 50%, 75% and 90%.
- Billing usage reconciliation and finance dashboard.
- Full race-condition and load tests across multiple worker instances.
- Enterprise contract and custom limit administration.

## Required Railway Web variables for sandbox billing

- `STRIPE_SECRET_KEY`: sandbox/test secret key only (`sk_test_...` or restricted test key).
- `STRIPE_WEBHOOK_SECRET`: sandbox webhook signing secret.
- `STRIPE_PRICE_PRO_MONTHLY`: Pro monthly sandbox Price ID.
- `STRIPE_PRICE_TEAM_MONTHLY`: Teams monthly sandbox Price ID.
- `STRIPE_PRICE_BUSINESS_MONTHLY`: Business monthly sandbox Price ID.
- `STRIPE_PRICE_PRO_ANNUAL`: Pro annual sandbox Price ID.
- `STRIPE_PRICE_TEAM_ANNUAL`: Teams annual sandbox Price ID.
- `STRIPE_PRICE_BUSINESS_ANNUAL`: Business annual sandbox Price ID.
- `STRIPE_AUTOMATIC_TAX_ENABLED`: keep `false` until applicable tax registrations and settings are confirmed.
- `RESEND_API_KEY` and `EMAIL_FROM`: transactional email verification and password recovery.

Do not configure live Stripe keys or enable `STRIPE_LIVE_MODE_ENABLED` during development.

## Stripe and tax safety

Checkout is hosted by Stripe. Subscription state changes only after a verified webhook. Webhook event IDs are stored for deduplication. Configure the sandbox webhook endpoint for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`, `charge.dispute.created`, `charge.refunded` and `radar.early_fraud_warning.created`. Automatic tax remains disabled until the business has configured applicable VAT registrations and tax settings. VAT treatment, invoicing, refund policy, terms and displayed prices need review by an accountant before launch.
