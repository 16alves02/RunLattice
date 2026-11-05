# Security foundation

## Authentication

RunLattice uses Better Auth with database-backed sessions and email/password authentication. Passwords are hashed by Better Auth and are never stored in the User record. Session cookies are managed by the authentication library.

Required environment:
- `BETTER_AUTH_SECRET`: high-entropy secret of at least 32 characters.
- `BETTER_AUTH_URL`: canonical origin of the application.
- `DATABASE_URL`: PostgreSQL connection string.

Generate a secret with `openssl rand -base64 32`. Use a different secret for every environment. Do not commit secrets or expose them through client-side environment variables.

## Workspace isolation

An organization is the workspace boundary. Every authenticated request resolves the user's active organization and verifies membership against the database. Workflow list, read, update, delete and execution operations include the resolved organization ID in their database predicates.

A client-supplied organization ID is never trusted as proof of access. The session's active organization is checked against the Member table on every request.

Existing workflows are migrated with a nullable organization ID. They remain inaccessible to normal workspace queries until an administrator explicitly assigns them to a legitimate organization. This avoids exposing legacy records to newly registered accounts.

## API boundaries

- `/api/auth/*` is handled by Better Auth.
- `/api/health` is public and returns service status only.
- Workflow and execution APIs require a session and workspace membership.
- The Redis worker is an internal process and is not exposed as an HTTP endpoint.
- No authentication secret is sent to the browser.

## Known production requirements

Before inviting external users:
1. Configure email verification and password-reset delivery through a transactional email provider.
2. Add rate limiting and abuse monitoring at the application and edge layers.
3. Configure secure production origins and HTTPS.
4. Review session lifetime, cookie policy and account recovery.
5. Add audit events for membership and permission changes.
6. Test cross-workspace access denial against a real PostgreSQL database.
7. Review data retention, export/deletion and GDPR processes.

This document describes implemented controls and remaining work. It is not a certification or a claim of completed compliance.
