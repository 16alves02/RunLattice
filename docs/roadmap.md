# Roadmap

## Milestone 1 — Foundation

- [x] Workspace dashboard and responsive layout
- [x] Interactive draft editor
- [x] PostgreSQL schema and Prisma client setup
- [x] Workflow CRUD API with schema validation
- [x] Redis/BullMQ queue and worker process
- [x] Validation tests and CI workflow

## Milestone 2 — Persistence and execution

- [ ] Save and reload complete graph edits, including edges and node configuration
- [ ] Load real workflow and run records in the workspace views
- [ ] Add supported action adapters (for example, HTTP request and email provider)
- [ ] Add per-step input/output logs, timeouts and failure states
- [ ] Add integration tests against PostgreSQL and Redis

## Milestone 3 — Security and collaboration

- [ ] Add authentication and workspace ownership
- [ ] Add role-based permissions
- [ ] Add signed webhook triggers and replay protection
- [ ] Add scheduling and safe secret storage
- [ ] Add rate limiting, audit logs and retention rules

## Milestone 4 — Public demo

- [ ] Seed a dedicated demo workspace
- [ ] Add deployment health checks and observability
- [ ] Deploy web app, database, Redis and worker as separate services
- [ ] Document limits and known issues on the live demo
