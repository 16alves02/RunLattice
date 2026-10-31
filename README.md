<div align="center">

# RunLattice

**Connect. Execute. Orchestrate.**

Design, run and monitor workflows from one clear workspace.

A full-stack workflow automation platform built to explore visual workflow design, API validation, background processing and execution history.

[Features](#features) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Project status](#project-status)

</div>

---

## About the project

RunLattice is a portfolio project focused on the engineering behind automation tools. The first milestone includes a dark, responsive workspace, an interactive workflow draft editor, a PostgreSQL data model, validated REST endpoints and a Redis/BullMQ worker foundation.

The dashboard, workflow list, editor and execution history read and write PostgreSQL records. Workflow runs are queued through Redis/BullMQ; the current worker records a simulated traversal and does not yet call external services.

## Features

- **Workspace dashboard** with workflow summaries, activity and status indicators.
- **Visual workflow builder** that loads, creates and updates saved trigger, condition and action node definitions.
- **REST API** to list, create, update and delete workflow definitions.
- **Schema validation** for node identifiers, connections and workflow fields.
- **Execution queue foundation** using Redis and BullMQ with retries and exponential backoff.
- **Worker process** that records queued, running and completed simulation states and handles graceful shutdown.
- **Execution history** with database-backed run records, statuses, timestamps and durations.
- **Automated tests** for workflow graph validation.
- **Docker Compose** for local PostgreSQL and Redis services.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, CSS |
| API | Next.js Route Handlers, Zod |
| Data | PostgreSQL, Prisma ORM |
| Background jobs | Redis, BullMQ |
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

Review `DATABASE_URL`, `REDIS_URL` and `CRON_SECRET` in `.env`. Do not commit real credentials.

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

Open [http://localhost:3000](http://localhost:3000). Create a workflow, save it, reopen it from the workflow list, and update its definition.

### 6. Start the worker in a second terminal

```bash
npm run worker
```

The worker expects the same `DATABASE_URL` and `REDIS_URL` as the web app. Keep it running in a separate terminal while testing queued executions.

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
| `GET` | `/api/workflows` | List workflows |
| `GET` | `/api/runs` | List recent execution records |
| `POST` | `/api/workflows` | Validate and create a workflow |
| `GET` | `/api/workflows/:id` | Retrieve a workflow and recent runs |
| `PATCH` | `/api/workflows/:id` | Update supported workflow fields |
| `DELETE` | `/api/workflows/:id` | Delete a workflow |
| `POST` | `/api/workflows/:id/runs` | Queue an execution for an active workflow |

The run endpoint requires the `x-runlattice-secret` header when `CRON_SECRET` is configured. The browser editor does not expose this secret; leave it unset for local UI testing. Production use requires proper user authentication, workspace-level authorization, rate limiting and stricter execution policies.

## Project structure

```text
src/
  app/                 Next.js pages and API routes
  components/          Workspace shell, dashboard and builder
  lib/                 Database, queue, validation and shared types
prisma/                Database schema
worker/                 Background job worker
```

## Project status

This is an active learning and portfolio project, not a production-ready automation service. Workflow definitions and run records are persisted in PostgreSQL, and background jobs are processed through BullMQ. The worker currently records a simulated traversal of the graph; it does not send emails, call third-party APIs or perform external side effects. Authentication, workspace isolation, allow-listed action adapters, signed webhooks, scheduling and production observability remain to be implemented.

## Roadmap

- [x] Responsive workspace UI and demo workflows
- [x] Workflow definition validation and tests
- [x] PostgreSQL schema and CRUD API foundation
- [x] Redis/BullMQ queue and worker foundation
- [x] Persist editor changes through the API
- [ ] Implement safe, allow-listed action adapters
- [ ] Add authentication and workspace permissions
- [ ] Add signed webhook triggers and scheduling
- [ ] Add integration tests for API and worker behaviour
- [ ] Deploy a public demo with managed services

## Author

Built by [16alves02](https://github.com/16alves02) as a full-stack software engineering portfolio project.


## Launch audit notes

- The application interface is not a public marketing website. Fresha, contact forms and a marketing FAQ are not applicable to this product milestone.
- No analytics or advertising scripts are included. Reassess cookie consent if analytics, advertising or other non-essential storage is introduced.
- The app currently has no authentication or user accounts. Do not use it with personal or production data on a public deployment.
- A privacy notice must be written from the actual data controller, hosting provider and integrations before collecting personal data from external users. This repository does not invent those legal details.
- Open Graph metadata and a favicon are configured. A canonical URL and sitemap are intentionally deferred until a real production domain is selected.
- `robots.ts` allows public app routes and disallows API routes from crawling. This is not access control.
- The dashboard, workflow list and execution history read database records. The worker's node traversal remains simulated and is identified as such.
- The mobile workspace navigation and custom 404 page are included.
- External Google Fonts loading was removed in favour of system font fallbacks to avoid an unnecessary third-party request.

The launch audit is a code-level review. Browser-based accessibility checks, Lighthouse, dependency installation, automated tests and a production build must still be run in the target environment.
