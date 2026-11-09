<div align="center">

# RunLattice

**Connect. Execute. Orchestrate.**

Design, run and monitor workflows from one clear workspace.

An evolving workflow automation platform for non-technical users, developers, teams and businesses.

</div>

---

## Product direction

RunLattice combines approachable automation with advanced workflow controls. Users can start from templates or describe an automation in natural language; developers can extend workflows through typed actions and integrations.

AI-generated workflows are drafts. They must be reviewed and saved by the user; the assistant does not activate or execute them automatically.

## Implemented capabilities

- Email/password authentication, verified-email sign-up, password reset and PostgreSQL-backed sessions through Better Auth (requires a configured transactional email provider in production).
- Organization-based workspaces with owner, admin and member roles.
- Workspace-scoped workflow CRUD and execution history.
- Visual workflow builder and searchable workflow templates.
- Integration catalog, with Discord webhook as the first live provider.
- AES-256-GCM encryption for Discord webhook credentials.
- Redis/BullMQ background execution with atomic run claiming.
- Real Discord message delivery from a supported workflow, including safe `{{input.path}}` message templates.
- Signed inbound webhook triggers using timestamped HMAC-SHA256 signatures and replay-window validation.
- Cron-based scheduled triggers managed by BullMQ with IANA timezone support and worker-side reconciliation.
- AI workflow planning with OpenAI, Anthropic and Google Gemini adapters, encrypted workspace BYOK keys, disabled by default and returning reviewable drafts.
- Stripe-hosted subscription Checkout, Customer Portal and signed webhook processing, with Free/Pro/Team workspace entitlements and server-side workflow/run/AI quotas (sandbox credentials and end-to-end verification still required).
- Workspace monthly AI request/token budgets and atomic per-user/per-workspace request throttling.
- Vitest unit tests for workflow validation, execution paths, credential encryption, trigger configuration, webhook signatures and subscription entitlement rules.
- PostgreSQL/Redis integration tests covering signed webhook acceptance, invalid signatures, replay rejection, scheduler lifecycle and the real worker's failure handling.

## Current execution limits

The worker currently supports manual, signed-webhook and cron-scheduled runs with exactly one trigger and at most one condition node. Condition nodes evaluate input data and route execution through an explicit true or false branch; only the selected path runs. The only live external action is sending a message to a connected Discord webhook. Arbitrary code execution and additional provider actions are not implemented.

Automatic BullMQ retries are disabled for the Discord action because it is non-idempotent. The worker refreshes a database heartbeat while a run is active; a separate recovery sweep marks runs with an expired five-minute heartbeat as FAILED. It does not replay the run because an external action may already have happened. Step checkpoints are persisted, but resuming from a checkpoint and exactly-once delivery are not supported.

## Integration security

Discord webhook URLs are accepted only for the official Discord HTTPS webhook hosts, encrypted at rest and never returned by the API. The worker revalidates the stored destination, blocks redirects and applies a 10-second timeout. Set `INTEGRATION_ENCRYPTION_KEY` to a unique base64-encoded 32-byte key in both the web and worker environments. Generate one with:

```bash
openssl rand -base64 32
```

Back up the key securely. Losing it makes existing integration credentials undecryptable.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, CSS |
| API | Next.js Route Handlers, Zod |
| Data | PostgreSQL, Prisma ORM |
| Background jobs | Redis, BullMQ |
| Authentication | Better Auth |
| AI planning | Server-side OpenAI, Anthropic and Google Gemini adapters with encrypted workspace BYOK |
| Tests | Vitest |
| Local services | Docker Compose |

## Getting started

### Requirements

- Node.js 22 or newer
- npm
- Docker Desktop or Docker Engine

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Configure `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS`. Configure `INTEGRATION_ENCRYPTION_KEY` before saving provider credentials. Configure Resend and Stripe only when testing those features. Never commit real credentials.

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 4. Apply database migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Start the web application

```bash
npm run dev
```

Open http://localhost:3000.

### 6. Start the worker in a second terminal

```bash
npm run worker
```

The web application and worker require the same PostgreSQL and Redis configuration. The worker also needs the same integration encryption key to decrypt saved provider credentials.

## Useful commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run worker
npm run build
docker compose down
```

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Web, PostgreSQL, Redis and worker readiness check |
| GET | `/api/integrations` | List the catalog and workspace connections |
| POST | `/api/integrations` | Save an encrypted Discord webhook |
| DELETE | `/api/integrations/:id` | Remove a workspace connection |
| GET | `/api/workflows` | List workspace workflows |
| POST | `/api/workflows` | Create a workflow |
| GET | `/api/workflows/:id` | Retrieve a workflow and recent runs |
| PATCH | `/api/workflows/:id` | Update workflow fields |
| DELETE | `/api/workflows/:id` | Delete a workflow |
| POST | `/api/workflows/:id/runs` | Queue an active workflow manually |
| POST | `/api/workflows/:id/webhook-secret` | Generate or rotate a signed webhook secret (owner/admin) |
| POST | `/api/webhooks/:workflowId` | Accept a signed inbound webhook and queue a run |
| POST | `/api/ai/workflow-plan` | Generate a reviewable workflow proposal (feature-flagged) |
| POST | `/api/ai/workflow-plan/test` | Simulate a workflow graph without external side effects |
| POST | `/api/billing` | Create a Stripe Checkout or Customer Portal session (owner/admin) |
| POST | `/api/billing/webhook` | Verify and process Stripe subscription events |

All workflow and integration endpoints require an authenticated session and verified membership in the active organization. Members can read; owners and admins can make changes and queue runs. The AI planning endpoint requires an owner/admin role and remains disabled unless `AI_ASSISTANT_ENABLED=true`. It applies request-size limits, per-user/per-workspace throttling and monthly workspace usage budgets. The dry-run endpoint simulates graph traversal only and never invokes integration adapters. The public health endpoint checks PostgreSQL connectivity, Redis availability and the worker heartbeat. It does not verify external integrations or guarantee successful workflow execution.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the required web/worker topology, environment variables and production release checklist. The guide does not indicate that a production deployment has been completed.

## Project status

RunLattice is an early-stage automation product prototype, not yet a production-ready service. The authentication and workspace foundation is implemented, and the first real external action is available through Discord webhooks. AI planning now has provider adapters, workspace budgets, request throttling and review-only proposals, but remains disabled by default. Additional provider integrations, general-purpose action adapters, durable step resumption, member/invitation administration, deployment-edge abuse protection, production observability, Stripe sandbox setup, verified transactional email delivery, backups, legal review and a full security review remain outstanding. The billing code and email delivery integration are present, but their external credentials and end-to-end tests are not yet complete. Signed inbound webhooks, cron scheduling and the PostgreSQL/Redis API-worker integration suite are implemented and pass CI.

## Roadmap

- [x] Authentication and organization-based workspace isolation
- [x] Visual workflow editor and template library
- [x] Redis/BullMQ queue and first live Discord action
- [x] Encrypted workspace-scoped integration credentials
- [x] Run heartbeats and conservative stale-run detection (no automatic replay)
- [ ] Durable execution resumption and safe retry policies
- [x] Condition evaluation and branching
- [ ] Additional integrations and OAuth connections
- [x] Signed inbound webhooks and scheduled triggers
- [ ] Member administration and invitation seat enforcement
- [x] Transactional email integration (Resend; provider credentials and domain verification pending)
- [x] AI workflow planning foundation, workspace usage budgets and application request throttling
- [ ] Deployment-edge abuse protection and production observability
- [x] Stripe billing code and plan entitlement enforcement (sandbox configuration and end-to-end tests pending)
- [x] PostgreSQL/Redis API and worker integration test coverage
- [ ] Managed public demo with provisioned PostgreSQL, Redis and a persistent worker
- [ ] Security review and public launch readiness

## Author

Built by [16alves02](https://github.com/16alves02).
