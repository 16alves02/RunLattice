# RunLattice security foundation

## Authentication

RunLattice uses Better Auth with PostgreSQL-backed sessions and email/password authentication. Passwords are handled by Better Auth and are not stored on the User record.

Required environment:
- `BETTER_AUTH_SECRET`: unique high-entropy secret of at least 32 characters.
- `BETTER_AUTH_URL`: canonical application origin.
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated allowed browser origins.
- `DATABASE_URL`: PostgreSQL connection string.
- `INTEGRATION_ENCRYPTION_KEY`: base64-encoded 32-byte key used for AES-256-GCM integration credential encryption.

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
- `/api/health` is public and returns basic web-process status only.
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

Each request reserves workspace monthly request and token budget atomically before contacting the provider. Defaults are 100 requests and 100,000 tokens per UTC calendar month; override with `AI_MONTHLY_REQUEST_LIMIT` and `AI_MONTHLY_TOKEN_LIMIT`. Provider-reported token usage reconciles the reservation. Requests are workspace-scoped and the endpoint does not accept a client-supplied organization ID.

AI output is treated as untrusted text, validated against the workflow schema and returned as a proposal. Missing or unconnected integrations are identified from the workspace connection records and integration catalog. Saving a draft is a separate user action; activation remains separate. The dry-run endpoint simulates graph traversal only and never invokes integration adapters, reads credentials, enqueues jobs or performs external side effects. The feature remains disabled by default pending deployment-specific security and privacy review.

## Remaining production requirements

Before public launch:
1. Configure email verification, password-reset and invitation delivery through a transactional email provider.
2. Add member administration and invitation acceptance UI.
3. Add edge-level rate limiting and abuse monitoring for AI planning and other expensive endpoints; workspace quotas are not a substitute for network abuse protection.
4. Configure secure production origins and HTTPS.
5. Add audit events for membership and permission changes.
6. Test cross-workspace access denial against PostgreSQL and Redis.
7. Review data retention, export/deletion and GDPR processes.
8. Implement durable step resumption, explicit operator handling for unknown external-action outcomes and provider-specific safe retry policies.
9. Add provider-specific rate limits and integration end-to-end tests.

This document describes the implemented foundation and remaining work. It is not a certification or a claim of completed compliance.
