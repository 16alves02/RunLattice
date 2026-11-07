# RunLattice deployment guide

This guide describes the deployment shape required by the current repository. It is not a record of a completed deployment. No production environment or external provider has been configured by this document.

## Runtime topology

RunLattice has two independently running application processes and two shared data services:

1. **Web application** — Next.js application and Route Handlers.
2. **Execution worker** — long-running Node.js process started with `npm run worker`.
3. **PostgreSQL** — persistent application database managed by Prisma migrations.
4. **Redis** — BullMQ queue, worker coordination and cron-based scheduled triggers.

The web application and worker must use the same PostgreSQL database, Redis instance and `INTEGRATION_ENCRYPTION_KEY`. The worker must run as a persistent process/container; do not start it from a serverless request handler or rely on a serverless function staying alive.

A Vercel deployment can host the Next.js web application, but the worker must run separately on a platform that supports long-running processes. PostgreSQL and Redis must be reachable securely from both runtimes.

## Required environment

Configure secrets independently in each environment. Never commit real values or expose server secrets through `NEXT_PUBLIC_*` variables.

| Variable | Web | Worker | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required | Required | PostgreSQL connection |
| `REDIS_URL` | Required | Required | Redis/BullMQ connection |
| `BETTER_AUTH_SECRET` | Required | Not required | Session signing secret |
| `BETTER_AUTH_URL` | Required | Not required | Canonical web origin |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Required | Not required | Allowed browser origins |
| `INTEGRATION_ENCRYPTION_KEY` | Required | Required | Shared AES-256-GCM credential key |
| `AI_ASSISTANT_ENABLED` | Optional; keep false initially | Not required | AI planning feature flag |
| `AI_PROVIDER` | If AI enabled | Not required | `openai` or `anthropic` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | If AI enabled | Not required | Server-side provider credentials |
| `AI_MODEL` | If AI enabled | Not required | Explicit provider model |
| `AI_MONTHLY_REQUEST_LIMIT` | Optional | Not required | Monthly workspace request budget |
| `AI_MONTHLY_TOKEN_LIMIT` | Optional | Not required | Monthly workspace token budget |
| `AI_RATE_LIMIT_PER_USER` | Optional | Not required | Per-user AI request limit per 60 seconds |
| `AI_RATE_LIMIT_PER_WORKSPACE` | Optional | Not required | Shared workspace AI request limit per 60 seconds |

Generate high-entropy secrets using a trusted secret manager or `openssl rand -base64 32`. Use separate authentication secrets per environment. The encryption key must be identical in the web and worker environments and backed up securely: losing it makes existing integration credentials undecryptable.

AI planning is disabled unless `AI_ASSISTANT_ENABLED=true`. Keep it disabled until provider billing, edge protection, monitoring, privacy and retention have been reviewed. Application-level PostgreSQL throttling and workspace quotas do not replace edge-level rate limiting or abuse monitoring.

## Release procedure

1. Provision PostgreSQL and Redis with private networking/TLS where supported.
2. Configure the required environment variables in the web and worker runtimes.
3. Build and test the exact commit intended for release.
4. Run `npx prisma migrate deploy` once as a release step against the target database; do not run migrations independently from every web or worker instance.
5. Start the web application with `npm run start`.
6. Start the worker as a persistent service with `npm run worker`. The worker consumes run jobs, reconciles active cron schedules and queues scheduled runs through the same transactional outbox. Keep at least one worker process running for scheduled triggers to fire.
7. Verify authentication, workspace isolation, integration credential encryption, queue dispatch, worker execution and failure recovery.
8. Confirm database backups and test a restore before accepting real customer data.

## Operational requirements before public launch

- Use HTTPS and exact trusted origins; do not use wildcard production origins.
- Use managed secret storage and rotate credentials through a documented procedure.
- Configure PostgreSQL backups, retention and tested point-in-time recovery where available.
- Back up `INTEGRATION_ENCRYPTION_KEY` separately from the database.
- Monitor web errors, worker health, queue depth, failed/stale runs, provider failures and AI usage.
- Add edge-level rate limiting, bot/abuse controls and alerting for expensive endpoints.
- Define data retention, export/deletion and privacy processes.
- Test cross-workspace authorization and recovery against production-like PostgreSQL and Redis.
- Keep AI disabled until provider terms, data processing, retention and budget controls are approved.

## Health endpoint limitation

`GET /api/health` currently reports basic web-process status. It does not prove that PostgreSQL, Redis, the worker or external integrations are healthy. Use separate infrastructure checks and operational alerts; do not treat an HTTP 200 from this endpoint as end-to-end readiness.

## Current status

This guide records the required deployment architecture and checklist only. RunLattice has not been deployed to production by this change, and no production credentials, domains, databases, Redis services, backups or monitoring have been provisioned here.


## Signed inbound webhooks

- Configure the workflow trigger as **Signed webhook**, save the workflow, then generate a signing secret from the builder.
- The secret is shown only once. Store it in the sending system's secret manager; rotating it immediately invalidates the previous secret.
- Send a JSON object (maximum 32 KB) to `POST /api/webhooks/:workflowId`.
- Include a unique `x-runlattice-delivery-id`, `x-runlattice-timestamp` as Unix seconds and `x-runlattice-signature` as `v1=<hex>`. Reusing a delivery ID for the same workflow is rejected.
- The signature is HMAC-SHA256 over `timestamp + "." + deliveryId + "." + exact raw request body`; timestamps outside the five-minute replay window are rejected.
- Webhook secrets are encrypted at rest using the same `INTEGRATION_ENCRYPTION_KEY` used by the worker. Back up and rotate this key carefully.

## Scheduled workflows

- Configure the trigger with a five-field cron expression and an IANA timezone such as `Europe/Lisbon`.
- The worker registers schedules in the dedicated BullMQ `workflow-schedules` queue and periodically reconciles active schedules from PostgreSQL.
- Keep the worker online and Redis reachable. If the schedule service cannot be registered while activating a workflow, the API pauses that workflow rather than reporting a false successful activation.
- Scheduled runs are inserted through the same PostgreSQL outbox as manual and webhook runs.

## Integration tests

Run `npm run test:integration` with a disposable PostgreSQL database and Redis instance available. The suite applies real API webhook requests, verifies persisted run/outbox records, checks the BullMQ scheduler lifecycle, and starts the real worker against an intentionally invalid workflow to verify safe failure recording. Do not point this test suite at production data.
