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

The interface uses sample data until the database and queue services are configured. Demo metrics are illustrative and are not presented as live production data.

## Features

- **Workspace dashboard** with workflow summaries, activity and status indicators.
- **Visual workflow draft builder** with trigger, condition and action nodes.
- **REST API** to list, create, update and delete workflow definitions.
- **Schema validation** for node identifiers, connections and workflow fields.
- **Execution queue foundation** using Redis and BullMQ with retries and exponential backoff.
- **Worker process** that records execution state and handles graceful shutdown.
- **Run history interface** with clear labels for illustrative data.
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

Open [http://localhost:3000](http://localhost:3000). The dashboard and builder can be explored in demo mode.

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
| `POST` | `/api/workflows` | Validate and create a workflow |
| `GET` | `/api/workflows/:id` | Retrieve a workflow and recent runs |
| `PATCH` | `/api/workflows/:id` | Update supported workflow fields |
| `DELETE` | `/api/workflows/:id` | Delete a workflow |
| `POST` | `/api/workflows/:id/runs` | Queue an execution for an active workflow |

The run endpoint accepts an `x-runlattice-secret` header when `CRON_SECRET` is configured. Before deploying publicly, add user authentication, workspace-level authorization, rate limiting and stricter execution policies.

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

This is an active learning and portfolio project, not a production-ready automation service. In this first milestone, the UI builder edits a local draft and the worker records a simulated path through workflow nodes. External action adapters, durable visual-editor persistence, authentication, tenant isolation, webhook verification and production observability remain planned work.

## Roadmap

- [x] Responsive workspace UI and demo workflows
- [x] Workflow definition validation and tests
- [x] PostgreSQL schema and CRUD API foundation
- [x] Redis/BullMQ queue and worker foundation
- [ ] Persist editor changes through the API
- [ ] Implement safe, allow-listed action adapters
- [ ] Add authentication and workspace permissions
- [ ] Add signed webhook triggers and scheduling
- [ ] Add integration tests and CI checks
- [ ] Deploy a public demo with managed services

## Author

Built by [16alves02](https://github.com/16alves02) as a full-stack software engineering portfolio project.
