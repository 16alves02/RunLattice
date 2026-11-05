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

- Email/password authentication and PostgreSQL-backed sessions through Better Auth.
- Organization-based workspaces with owner, admin and member roles.
- Workspace-scoped workflow CRUD and execution history.
- Visual workflow builder and searchable workflow templates.
- Integration catalog, with Discord webhook as the first live provider.
- AES-256-GCM encryption for Discord webhook credentials.
- Redis/BullMQ background execution with atomic run claiming.
- Real Discord message delivery from a supported linear workflow.
- AI workflow planning foundation, disabled by default and returning reviewable drafts.
- Vitest tests for workflow validation, execution-path validation and credential encryption.

## Current execution limits

The worker currently supports manual runs with exactly one trigger and one linear path. The only live action is sending a static message to a connected Discord webhook. Conditions, branching, arbitrary code, inbound webhooks, scheduled triggers and other provider actions are not implemented.

Automatic BullMQ retries are disabled for the Discord action because it is non-idempotent. A worker crash after claiming a run can leave it in RUNNING; durable checkpoints and stale-run recovery remain outstanding. This is not an exactly-once execution guarantee.

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
| AI planning | Server-side OpenAI API integration |
| Tests | Vitest |
| Local services | Docker Compose |

## Getting started

### Requirements

- Node.js 20 or newer
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

Configure `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS`. Configure `INTEGRATION_ENCRYPTION_KEY` before saving provider credentials. Never commit real credentials.

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
| GET | `/api/health` | Basic application health response |
| GET | `/api/integrations` | List the catalog and workspace connections |
| POST | `/api/integrations` | Save an encrypted Discord webhook |
| DELETE | `/api/integrations/:id` | Remove a workspace connection |
| GET | `/api/workflows` | List workspace workflows |
| POST | `/api/workflows` | Create a workflow |
| GET | `/api/workflows/:id` | Retrieve a workflow and recent runs |
| PATCH | `/api/workflows/:id` | Update workflow fields |
| DELETE | `/api/workflows/:id` | Delete a workflow |
| POST | `/api/workflows/:id/runs` | Queue an active workflow |

All workflow and integration endpoints require an authenticated session and verified membership in the active organization. Members can read; owners and admins can make changes and queue runs. The health endpoint is public and does not currently test PostgreSQL or Redis connectivity.

## Project status

RunLattice is an active portfolio project, not a production-ready automation service. The authentication and workspace foundation is implemented, and the first real external action is available through Discord webhooks. Additional provider integrations, general-purpose action adapters, condition evaluation, branching, durable recovery, email delivery, invitation management, AI quotas, observability, billing and a full security review remain outstanding.

## Roadmap

- [x] Authentication and organization-based workspace isolation
- [x] Visual workflow editor and template library
- [x] Redis/BullMQ queue and first live Discord action
- [x] Encrypted workspace-scoped integration credentials
- [ ] Durable execution checkpoints and stale-run recovery
- [ ] Condition evaluation and branching
- [ ] Additional integrations and OAuth connections
- [ ] Signed inbound webhooks and scheduled triggers
- [ ] Member administration and transactional email
- [ ] AI usage budgets, observability and billing
- [ ] Security review and public launch readiness

## Author

Built by [16alves02](https://github.com/16alves02).
