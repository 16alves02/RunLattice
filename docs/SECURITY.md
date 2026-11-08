# RunLattice security foundation

## Authentication

RunLattice uses Better Auth with PostgreSQL-backed sessions and email/password authentication. Passwords are handled by Better Auth and are not stored on the User record. Production sign-up requires verified email; sign-up is disabled until Resend credentials and a verified sender identity are configured. Password reset uses the same transactional email service.

Required environment:
- `BETTER_AUTH_SECRET`: unique high-entropy secret of at least 32 characters.
- `BETTER_AUTH_URL`: canonical application origin.
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated allowed browser origins.
- `DATABASE_URL`: PostgreSQL connection string.
- `INTEGRATION_ENCRYPTION_KEY`: base64-encoded 32-byte key used for AES-256-GCM integration credential encryption.
- `RESEND_API_KEY` and `EMAIL_FROM`: required for production verification and password-reset delivery.

Generate secrets with `openssl rand -base64 32`. Use different values per environment. Never expose them to client-side code. Back up the integration encryption key securely: losing it makes saved provider credentials undecryptable.

## Workspace isolation

An organization is the workspace boundary. Every workflow and integration API request resolves the authenticated session's active organization and verifies membership against the Member table. A client-supplied organization ID is never accepted as proof of access.

Workflow list, read, update, delete and run operations include the resolved organization ID in their database predicates. Execution history is scoped through its parent workflow. Integration connection reads and writes are scoped to the same organization.

The organization plugin provides owner, admin and member roles:
- Owners and admins can create, update, delete and execute workflows and manage integration connections.
- Members can read workflows, execution history and integration metadata.
- Membership is checked on the server for every request; client-side role state is not trusted.

## Existing account migration

The workspace migration creates one personal organization and owner membership for every existing user, attaches that user's existing workflows to the organization and sets the active organization on existing sessions. The original workflow creator reference is retained and uses SET NULL on user deletion so shared workflows are not deleted with their creator.

Legacy workflows with no user owner remain unassigned and are not visible to normal workspace queries.

## API boundaries

- `/api/auth/*` is handled by Better Auth.
- `/api/health` is public and verifies PostgreSQL with `SELECT 1`; it does not prove Redis or Worker health.
- `/api/billing` creates owner/admin-only Stripe Checkout and Customer Portal sessions.
- `/api/billing/webhook` verifies the raw request signature and deduplicates Stripe event IDs.
- Workflow, run and integration APIs require a valid session and workspace membership.
- Mutating workflow and integration operations require owner/admin membership.
- The Redis worker is an internal process and is not exposed as an HTTP endpoint.
- No shared execution secret is sent to the browser.

## Integration credential handling

The first supported connection is a Discord webhook. Its URL is encrypted using AES-256-GCM with a random 96-bit nonce and authentication tag. The API returns connection metadata only; the webhook URL is never returned after creation. Authenticated additional data binds each ciphertext to its owning organization and provider, preventing a copied ciphertext from being decrypted in another workspace.

The worker revalidates the URL against the official Discord HTTPS hosts, blocks redirects and applies a 10-second timeout. Integration records are scoped to an organization and the worker verifies that scope before use.

The initial Discord action is non-idempotent. Automatic BullMQ retries are disabled, and each run is atomically claimed before execution to reduce duplicate side effects. The worker refreshes `WorkflowRun.heartbeatAt` every 20 seconds. A recovery sweep runs at startup and every 60 seconds; runs whose heartbeat is older than five minutes are marked FAILED with an explicit unknown-outcome warning. Recovery never replays external actions. This reduces indefinitely stuck RUNNING records but does not resume a run or provide exactly-once delivery.

## AI planning and usage controls

The AI planning endpoint requires an authenticated workspace membership and is disabled unless `AI_ASSISTANT_ENABLED=true`. It supports server-side OpenAI and Anthropic adapters. Configure `AI_PROVIDER=openai` or `AI_PROVIDER=anthropic`, then set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` and `AI_MODEL` where required. `AI_API_KEY` remains a legacy fallback for OpenAI only. Provider keys are never sent to the browser.

When planning is enabled, the configured provider receives the user's prompt and limited integration-catalog metadata (integration names, availability/connection status and supported action names). The endpoint does not send saved credentials, webhook URLs, connection IDs or unrelated workspace records. Users are warned not to include passwords, API keys, webhook URLs or personal/sensitive data. Provider-side processing and retention remain subject to the selected provider's terms and the operator's data-processing configuration; review those terms and applicable privacy obligations before enabling the feature.

Each request is subject to atomic PostgreSQL fixed-window request limits (defaults: 5 per user and 30 per workspace per 60 seconds; configurable with `AI_RATE_LIMIT_PER_USER` and `AI_RATE_LIMIT_PER_WORKSPACE`) before it reserves workspace monthly request and token budget atomically. Global defaults are 100 requests and 100,000 tokens per UTC calendar month; override with `AI_MONTHLY_REQUEST_LIMIT` and `AI_MONTHLY_TOKEN_LIMIT`. The Free plan has no AI requests; Pro and Team have 100 and 500 requests/month respectively. The effective request limit is the lower of the global and plan limit. Provider-reported token usage reconciles the reservation; when a provider omits usage metadata, the adapter estimates tokens from prompt and response length. If a provider request fails or times out after submission, the reservation remains charged because provider-side usage is ambiguous. Requests are workspace-scoped and the endpoint does not accept a client-supplied organization ID.

AI output is treated as untrusted text, validated against the workflow schema and returned as a proposal. The test suite includes a deterministic regression evaluator for malformed graphs, secret references, unsupported or disconnected integrations, missing side-effect disclosures and plans without actions. This evaluator is a test harness, not a runtime prompt-injection detector or a security guarantee. Missing or unconnected integrations are identified from the workspace connection records and integration catalog. Saving a draft is a separate user action; activation remains separate. The dry-run endpoint simulates graph traversal only and never invokes integration adapters, reads credentials, enqueues jobs or performs external side effects. The feature remains disabled by default pending deployment-specific security and privacy review.

## Remaining production requirements

Before public launch:
1. Configure Resend credentials and a verified sender domain; run verification and password-reset email tests.
2. Add member administration, invitation acceptance and seat-limit enforcement.
3. Add deployment-edge rate limiting and abuse monitoring for AI planning and other expensive endpoints; application-level PostgreSQL limits are not a substitute for network abuse protection.
4. Configure a Stripe sandbox, create monthly Price IDs, configure Customer Portal and test payment, renewal, failure, cancellation and webhook replay.
5. Configure secure production origins and HTTPS, backups and a tested restore procedure.
6. Add audit events for membership and permission changes.
7. Test cross-workspace access denial against PostgreSQL and Redis.
8. Review data retention, export/deletion and GDPR processes with qualified counsel.
9. Implement durable step resumption, explicit operator handling for unknown external-action outcomes and provider-specific safe retry policies.
10. Add provider-specific rate limits and integration end-to-end tests.

This document describes the implemented foundation and remaining work. It is not a certification or a claim of completed compliance.


## Signed webhook triggers

Inbound webhook triggers use HMAC-SHA256 over the exact request timestamp and raw body. The timestamp must be within five minutes of server time to reduce replay risk. The endpoint rejects malformed JSON, oversized payloads, inactive workflows, missing secrets and invalid signatures. The secret is generated only by workspace owners/admins, encrypted at rest with the integration encryption key and returned only at generation time. Rotate it if the sending system is compromised.

## Scheduled triggers

Scheduled workflows use BullMQ job schedulers in a separate Redis queue. The worker checks that the workflow is still active and configured as a schedule before inserting a run and transactional outbox event. Schedules are reconciled periodically from PostgreSQL; pausing or deleting a workflow removes its scheduler through the API. Scheduled triggers require a continuously running worker and Redis service.

## PostgreSQL and Supabase Data API boundary

The production application uses Better Auth for identity and Prisma for trusted server-side database access; it does not use Supabase Auth or direct browser access to application tables.

The existing 16 public application tables have Row Level Security enabled. The `anon` and `authenticated` roles have no table privileges in the public schema and have explicit deny-all RLS policies. The pending workspace-billing migration adds three more tables with the same protection, taking the expected total to 19 after deployment. The trusted Prisma connection uses a dedicated server-side role with BYPASSRLS; this credential must never leave the backend. Do not add `auth.uid()` policies; Better Auth sessions are not Supabase Auth JWT identities.

The Supabase security advisor currently returns no findings. Validate that:
- the Data API roles cannot read or mutate any application table;
- the Railway Web and Worker services connect only with server-side database credentials;
- no database URL or privileged credential reaches browser code or public logs;
- workspace authorization remains enforced by the API for every request.

The migration `20261107224500_lock_down_public_table_access` keeps the existing boundary reproducible. The billing migration extends it to billing tables and revokes default privileges for future Prisma-owned tables. The deployment baseline script records the previously provisioned schema in Prisma migration history before applying pending migrations.


## Stripe subscription billing

The application uses Stripe-hosted Checkout and Customer Portal sessions. Checkout and portal creation require an authenticated workspace owner/admin. The application accepts test-mode API keys by default and rejects live keys unless STRIPE_LIVE_MODE_ENABLED=true is explicitly set. Keep that flag false during development and sandbox tests.

Stripe webhook signatures are verified against the raw request body. Event IDs are stored in StripeEvent and already-processed events are acknowledged without reapplying changes. Subscription status and price metadata determine workspace plan entitlements. Workflow creation, monthly workflow runs and AI requests are enforced server-side; UI-only limits are not trusted. The initial plans are Free, Pro and Team. Stripe Price IDs, webhook signing secret, Customer Portal settings and test-mode end-to-end verification are still required before billing is enabled.

The new billing migration enables RLS on BillingCustomer, BillingSubscription and StripeEvent and creates explicit deny-all policies for Supabase Data API roles. It also revokes default table/sequence privileges for those roles on future Prisma-owned objects.
