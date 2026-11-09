# RunLattice deployment guide

This guide describes the current Railway + Supabase deployment and the release procedure. The deployed environment is a public preview, not a commercially approved production service.

## Runtime topology

1. **Web application** — Next.js application and Route Handlers on Railway.
2. **Execution worker** — persistent Node.js process on Railway.
3. **PostgreSQL** — Supabase project in EU West (Ireland).
4. **Redis** — Railway Redis service used by BullMQ and scheduled triggers.

The web application and worker use the same PostgreSQL database, Redis instance and INTEGRATION_ENCRYPTION_KEY. The worker must remain a persistent process.

## Current infrastructure snapshot

- Railway project: RunLattice, environment: production.
- Services: RunLattice Web, RunLattice Worker and Redis.
- Public preview origin: https://runlattice-web-production.up.railway.app
- Supabase project region: eu-west-1 (Ireland).
- PostgreSQL public application tables have RLS enabled. Supabase Data API roles anon/authenticated have no table privileges and explicit deny-all policies.
- A dedicated Prisma database role is used by the backend. It has BYPASSRLS because Better Auth authorization is enforced by the server-side application and Prisma does not use Supabase Auth JWT identities. Never expose this connection to browsers or client-side code.
- The currently active Railway deployments may lag the latest development branch. Deploy only a CI-verified commit and confirm the commit SHA on both services before treating the new features as live.
- Automated database backups and a tested restore procedure are not yet configured.

## Database connection modes

For the persistent Railway Web and Worker services, use Supabase's shared pooler:
- DATABASE_URL: transaction pooler, port 6543, with pgbouncer=true.
- DIRECT_URL: session pooler, port 5432, used by Prisma Migrate.
- Username for the dedicated Prisma role: prisma.<project-ref>.
- Use the same rotated password in both URLs and both Railway services.

Do not paste credentials into GitHub, source code or chat. Rotate any password that has been exposed. Keep the PostgreSQL owner credential separate from the application role.

### Existing Supabase database baseline

The existing Supabase database was provisioned before Prisma's migration metadata table existed. The production Worker start command therefore uses:

npm run worker:start

This runs:
1. db:baseline — verifies the existing public schema contains the expected application tables and marks the 12 already-applied historical Prisma migrations as applied. The script is idempotent and can resume after a partial baseline.
2. db:deploy — applies any pending Prisma migrations, including workspace billing.
3. worker — starts the persistent BullMQ worker.

Do not run the baseline script against an empty local database. For a fresh database, use npx prisma migrate deploy directly after provisioning it.

## Required environment variables

Configure secrets separately in each environment. Never expose server secrets through NEXT_PUBLIC_* variables.

| Variable | Web | Worker | Purpose |
| --- | --- | --- | --- |
| DATABASE_URL | Required | Required | PostgreSQL runtime connection |
| DIRECT_URL | Required for release/migrations | Required for worker:start | Session pooler connection for Prisma Migrate |
| REDIS_URL | Required | Required | Redis/BullMQ |
| BETTER_AUTH_SECRET | Required | Not required | Session signing secret |
| BETTER_AUTH_URL | Required | Not required | Canonical HTTPS origin |
| BETTER_AUTH_TRUSTED_ORIGINS | Required | Not required | Exact allowed browser origins |
| INTEGRATION_ENCRYPTION_KEY | Required | Required | Shared AES-256-GCM credential key |
| RESEND_API_KEY | Required for production sign-up | Not required | Verification and password-reset emails |
| EMAIL_FROM | Required for production sign-up | Not required | Verified sender identity |
| STRIPE_SECRET_KEY | Required for billing | Not required | Use a test-mode key until sandbox tests pass |
| STRIPE_WEBHOOK_SECRET | Required for billing | Not required | Signed Stripe webhook verification |
| STRIPE_PRICE_PRO_MONTHLY | Required for billing | Not required | Pro monthly Price ID in the selected Stripe mode |
| STRIPE_PRICE_TEAM_MONTHLY | Required for billing | Not required | Team monthly Price ID in the selected Stripe mode |
| STRIPE_LIVE_MODE_ENABLED | false | Not required | Keep false until a separate live launch approval |
| STRIPE_AUTOMATIC_TAX_ENABLED | false | Not required | Enable only after tax registrations are configured |
| AI_ASSISTANT_ENABLED | false initially | Not required | AI workflow planning feature flag |
| AI_PROVIDER / OPENAI_API_KEY / ANTHROPIC_API_KEY / AI_MODEL | If AI enabled | Not required | Server-side AI provider configuration |

Production sign-up is disabled until RESEND_API_KEY and EMAIL_FROM are configured. Email delivery uses Resend's API. Verify the sender domain before enabling public registration.

Stripe keys are checked by the application: test keys are accepted; live keys are rejected unless STRIPE_LIVE_MODE_ENABLED=true. Do not enable live mode during sandbox testing. Create the two recurring Price objects in a Stripe sandbox and configure the matching IDs, webhook secret and Customer Portal before testing checkout.

Automatic Stripe Tax is disabled by default. Configure tax registrations and obtain accounting/legal advice before enabling tax calculation or accepting real payments.

## Release procedure

1. Provision PostgreSQL and Redis with secure network access.
2. Configure all required variables in Railway Web and Worker.
3. Confirm that the exact Git commit has passed TypeScript, ESLint, unit tests, PostgreSQL/Redis integration tests, database migration tests and production build.
4. For the existing Supabase database, run npm run worker:start once the approved commit is deployed. It safely baselines historical migrations, applies pending migrations and starts the worker. For a fresh database, run npx prisma migrate deploy.
5. Deploy Web from the same verified commit and confirm /api/health returns status=ok with checks.database=ok, checks.redis=ok and checks.worker=ok. The worker check requires a heartbeat newer than 90 seconds.
6. Confirm Worker logs show PostgreSQL connection established and the worker is processing the queue. Confirm Redis is online.
7. Test sign-up, verification email, sign-in, session persistence, sign-out, password reset and workspace isolation.
8. Test a real workflow in the preview environment using only a controlled Discord destination. Verify manual, webhook and scheduled triggers.
9. Test Stripe Checkout, Customer Portal, subscription lifecycle, failed payment, cancellation, duplicate webhooks and workspace entitlement changes in test mode.
10. Configure backups and test a restore before accepting customer data.

## Health and operations

GET /api/health checks PostgreSQL with SELECT 1, Redis with PING and the worker heartbeat (updated every 30 seconds, considered healthy for 90 seconds). It returns HTTP 503 if any component is degraded. It does not verify external integrations or guarantee successful workflow execution. Monitor:
- Railway Web and Worker deployment state, restarts and logs.
- Redis availability and BullMQ queue depth.
- PostgreSQL connectivity, capacity and migration state.
- Failed/stale workflow runs and provider errors.
- Stripe webhook failures and email delivery errors.

## Public launch blockers

- Confirm the latest development commit is deployed to both Web and Worker.
- Configure and verify Resend sender domain and test email flows.
- Connect a Stripe sandbox, create Price IDs and webhook endpoint, and pass end-to-end payment tests.
- Complete security review and dependency audit with zero high/critical advisories.
- Configure backups, retention, recovery objectives and restore tests.
- Complete privacy policy, terms, DPA, subprocessors and transfer assessments with qualified Portuguese/EU legal review.
- Add edge-level abuse protection, monitoring and incident alerts.
- Add custom domain and production email sender identity.
- Confirm supported integrations, limits and public pricing match the actual product.

## Signed inbound webhooks

- Configure a workflow trigger as Signed webhook, save it and generate a signing secret from the builder.
- The secret is shown only once. Store it in the sender's secret manager; rotating it invalidates the previous secret.
- Send a JSON object (maximum 32 KB) to POST /api/webhooks/:workflowId.
- Include x-runlattice-delivery-id, x-runlattice-timestamp as Unix seconds and x-runlattice-signature as v1=<hex>.
- The signature is HMAC-SHA256 over timestamp + "." + deliveryId + "." + exact raw request body. Timestamps outside the five-minute replay window are rejected.
- Webhook secrets are encrypted at rest using INTEGRATION_ENCRYPTION_KEY.

## Scheduled workflows

- Configure a five-field cron expression and an IANA timezone such as Europe/Lisbon.
- The worker registers schedules in the dedicated BullMQ workflow-schedules queue and periodically reconciles active schedules from PostgreSQL.
- Keep the worker online and Redis reachable. If a schedule cannot be registered during activation, the API pauses the workflow rather than reporting a false successful activation.
- Scheduled runs are inserted through the same PostgreSQL outbox as manual and webhook runs.

## Integration tests

Run npm run test:integration with disposable PostgreSQL and Redis services. The suite applies real API webhook requests, verifies persisted run/outbox records, checks scheduler lifecycle and starts the real worker against an intentionally invalid workflow to verify safe failure recording. Never point this suite at production customer data.
