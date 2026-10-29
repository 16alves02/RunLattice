# RunLattice

**Workflow Automation & Orchestration** - build, connect, execute, and monitor workflows from one place.

RunLattice is an evolving full-stack workflow automation platform. The goal is to grow it into both a strong software-engineering portfolio project and a useful product, with production quality improved incrementally.

## Product direction

RunLattice will support multiple real integrations, delivered in stages:

1. **Webhooks and HTTP APIs** - receive events, make requests, and connect external services.
2. **Email** - send workflow notifications.
3. **GitHub** - react to repository events and automate development tasks.
4. **Slack** - send workflow alerts and messages.

The long-term aim is to let users compose these actions into workflows, run them asynchronously, inspect execution logs, and retry failed steps safely.

## Planned stack

- Next.js, React, and TypeScript for the web application.
- Node.js API routes for workflow management.
- PostgreSQL with Prisma for persistent data.
- Redis and BullMQ for background execution.
- Docker Compose for local development.
- Vitest and GitHub Actions for tests and continuous integration.

## Development principles

- Build in small, reviewable increments.
- Validate inputs at API boundaries.
- Keep secrets in environment variables; never commit real credentials.
- Add tests for critical behaviour and failure paths.
- Document setup, architecture, API contracts, and known limitations.
- Do not describe an integration as production-ready until it has been implemented and tested.

## Getting started

1. Install a current LTS version of Node.js and Docker.
2. Copy `.env.example` to `.env` and set local development values.
3. Start the supporting services with `docker compose up -d`.
4. Install dependencies with `npm install`.
5. Generate the Prisma client and apply the schema using the scripts in `package.json`.
6. Start the development server with `npm run dev`.

Check the current scripts and the architecture documentation before running commands; this project is under active development.

## Project status

**Early development.** Some areas may still use demo data or simulated execution. Integration coverage, tests, and deployment readiness must be verified as implementation progresses.

See [docs/architecture.md](docs/architecture.md), [docs/api.md](docs/api.md), and [docs/roadmap.md](docs/roadmap.md) for more detail.
