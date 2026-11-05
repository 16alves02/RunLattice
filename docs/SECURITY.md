# RunLattice security foundation

## Authentication

RunLattice uses Better Auth with PostgreSQL-backed sessions and email/password authentication. Passwords are hashed by Better Auth and are not stored on the User record.

Required environment:
- `BETTER_AUTH_SECRET`: unique high-entropy secret of at least 32 characters.
- `BETTER_AUTH_URL`: canonical application origin.
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated allowed browser origins.
- `DATABASE_URL`: PostgreSQL connection string.\n- `INTEGRATION_ENCRYPTION_KEY`: base64-encoded 32-byte key used for AES-256-GCM integration credential encryption.

Generate each secret with `openssl rand -base64 32`. Use a different value per environment. Never expose them to client-side code. Back up the integration encryption key securely: losing it makes saved provider credentials undecryptable.

## Workspace isolation

An organization is the workspace boundary. Every workflow API request resolves the authenticated session's active organization and verifies membership against the Member table. A client-supplied organization ID is never accepted as proof of access.

Workflow list, read, update, delete and run operations include the resolved organization ID in their database predicates. Execution history is scoped through its parent workflow.

The organization plugin provides owner, admin and member roles:
- Owners and admins can create, update, delete and execute workflows.
- Members can read workflows and execution history.
- Membership is checked on the server for every request; client-side role state is not trusted.

## Existing account migration

The workspace migration creates one personal organization and owner membership for every existing user, attaches that user's existing workflows to the organization and sets the active organization on existing sessions. The original workflow creator reference is retained for audit context and uses SET NULL on user deletion so shared workflows are not deleted with their creator.

Legacy workflows with no user owner remain unassigned and are not visible to normal workspace queries.

## API boundaries

- `/api/auth/*` is handled by Better Auth.
- `/api/health` is public and returns service status only.
- Workflow and execution APIs require a valid session and workspace membership.
- Mutating workflow operations require owner/admin membership.
- The Redis worker is an internal process and is not exposed as an HTTP endpoint.
- No shared execution secret is sent to the browser.

## Integration credential handling\n\nThe first supported connection is a Discord webhook. Its URL is encrypted using AES-256-GCM with a random 96-bit nonce and authentication tag. The API returns connection metadata only; the webhook URL is never returned after creation. The worker revalidates the URL against the official Discord HTTPS hosts, blocks redirects and applies a 10-second timeout. Integration records are scoped to an organization and the worker verifies that scope before use.\n\nThe initial Discord action is non-idempotent. Automatic BullMQ retries are disabled, and each run is atomically claimed before execution to reduce duplicate side effects. If a worker crashes after claiming a run, it may remain RUNNING and needs an explicit recovery procedure. This is not an exactly-once guarantee.\n\n## Remaining production requirements

Before public launch:
1. Configure email verification, password-reset and invitation delivery through a transactional email provider.
2. Add member administration and invitation acceptance UI.
3. Add rate limiting and abuse monitoring for AI planning and other expensive endpoints.
4. Configure secure production origins and HTTPS.
5. Add audit events for membership and permission changes.
6. Test cross-workspace access denial against PostgreSQL and Redis.
7. Review data retention, export/deletion and GDPR processes.\n8. Implement durable step checkpoints, stale-run recovery and safe retry policies.\n9. Add provider-specific rate limits and integration end-to-end tests.

This document describes the implemented foundation and remaining work. It is not a certification or a claim of completed compliance.
