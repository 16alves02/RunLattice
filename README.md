<div align="center">

# RunLattice

**Connect. Execute. Orchestrate.**

Design, run and monitor workflows from one clear workspace.

An evolving workflow automation platform designed for both non-technical users and developers.

[Features](#features) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Project status](#project-status)

</div>

---

## Product direction

RunLattice aims to make automation understandable without hiding advanced capabilities. Beginners should be able to start from templates or describe a task in plain language. Developers should be able to extend workflows with conditions, APIs and custom integrations.

AI-generated workflows are drafts only. Users must review and save them; the assistant never activates or executes a workflow.

## Features

- **Personal accounts** with email/password sign-up, sign-in, sign-out and database-backed sessions.
- **Account-scoped workspaces** so each account can only list, edit, delete and execute its own workflows.
- **Visual workflow builder** that loads, creates and updates saved trigger, condition and action node definitions.
- **Template library** with searchable, category-filtered starter workflows.
- **Integration catalog** describing planned providers, authentication methods, triggers and actions.
- **AI workflow assistant foundation** that sends natural-language requests to a server-side model and validates the returned workflow definition before presenting it for review.
- **REST API** to list, create, update and delete workflow definitions.
- **Schema validation** for node identifiers, connections and workflow fields.
- **Execution queue foundation** using Redis and BullMQ with retries and exponential backoff.
- **Worker process** that records simulated traversal and run status.
- **Execution history** with database-backed run records, statuses, timestamps and durations.
- **Automated tests** for workflow graph and trigger type validation.
- **Docker Compose** for local PostgreSQL and Redis services.

## Integration status

The integration library currently describes planned integrations for Gmail, Google Drive, Google Sheets, Discord, Slack, Shopify, Stripe, GitHub and generic HTTP APIs. It is a catalog only: OAuth flows, provider credentials, connected accounts and external action adapters are not implemented. Do not enter provider credentials.

## AI assistant status

The AI planning endpoint is disabled by default. It requires `AI_ASSISTANT_ENABLED=true` and a server-side `AI_API_KEY`. It uses structured JSON output followed by Zod validation and requires a signed-in account. A generated plan is not saved or executed until the user reviews and saves it. Configure provider billing limits and application-level AI request quotas before enabling it publicly.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, CSS |
| API | Next.js Route Handlers, Zod |
| Data | PostgreSQL, Prisma ORM |
| Background jobs | Redis, BullMQ |
| AI planning | OpenAI API via server-side fetch |
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

Review `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Generate a secret with `openssl rand -base64 32`. For local development, the auth module has a development-only fallback; production refuses to start without `BETTER_AUTH_SECRET`. Never commit real credentials.

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 4. Generate the Prisma client and apply the schema

```bash
npx prisma generate
npx prisma db push
```

### 5. Start the web app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Start the worker in a second terminal

```bash
npm run worker
```

The worker expects the same `DATABASE_URL` and `REDIS_URL` as the web app. It currently simulates workflow traversal and does not perform third-party actions.

## Useful commands

```bash
npm run dev
npm run typecheck
npm run test
npm run worker
npm run build
docker compose down
```

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Basic application health response |
| `GET` | `/api/integrations` | List planned integration definitions |
| `POST` | `/api/ai/workflow-plan` | Generate a validated workflow draft (disabled by default) |
| `GET` | `/api/workflows` | List workflows |
| `POST` | `/api/workflows` | Validate and create a workflow |
| `GET` | `/api/workflows/:id` | Retrieve a workflow and recent runs |
| `PATCH` | `/api/workflows/:id` | Update supported workflow fields |
| `DELETE` | `/api/workflows/:id` | Delete a workflow |
| `POST` | `/api/workflows/:id/runs` | Queue an execution for an active workflow |

All workflow and run endpoints require a valid Better Auth session. Workflow reads and mutations are scoped to the signed-in user. `/api/health` remains public for deployment health checks.

## Project structure

```text
src/
  app/                 Next.js pages and API routes
  components/          Workspace shell, galleries and builder
  lib/                 Database, queue, integration catalog and validation
prisma/                Database schema
worker/                Background job worker
```

## Project status

This is an active portfolio project and is not yet a production-ready automation service. Email/password authentication, database-backed sessions and per-account workflow ownership are implemented. Workflow definitions and run records are persisted in PostgreSQL, and background jobs are processed through BullMQ. The current worker records a simulated traversal of the graph; it does not send emails, call third-party APIs or perform external side effects. Secure provider connections, real action adapters, signed webhooks, scheduling, billing, production observability and a full security review remain outstanding.

## Roadmap

- [x] Responsive workspace and visual workflow editor
- [x] Workflow validation and persistence
- [x] Redis/BullMQ queue and simulated worker
- [x] Searchable template library
- [x] Integration catalog foundation
- [x] AI workflow planning endpoint and review interface (disabled by default)
- [x] Email/password authentication and per-account workflow ownership
- [ ] Multi-user workspaces, roles and invitations
- [ ] Secure OAuth connection and credential storage
- [ ] First real integration with end-to-end tests
- [ ] Safe action adapters, signed webhooks and scheduling
- [ ] AI workflow generation enabled after quotas, abuse controls and security review
- [ ] Production observability, security review and public demo

## Author

Built by [16alves02](https://github.com/16alves02).

## Launch audit notes

- Email/password authentication and per-account data isolation are implemented. Email verification and account recovery are not configured yet.
- No analytics or advertising scripts are included. Reassess cookie consent if analytics or non-essential storage is introduced.
- A privacy notice must be written from the actual data controller, hosting provider and integrations before collecting personal data from external users.
- A canonical URL and sitemap should be configured after the production domain is selected.
- The AI endpoint remains disabled by default. Configure spend limits and per-account quotas before enabling it publicly.
- Provider cards describe planned capabilities only. No provider accounts are connected and no external actions are executed.
- The worker simulates graph traversal and is not a production automation engine.
- Browser-based accessibility checks, dependency installation, automated tests and a production build must be completed before deployment.
