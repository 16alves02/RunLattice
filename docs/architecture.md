# Architecture notes

## Current shape

RunLattice is split into three responsibilities:

1. **Web application** — Next.js App Router serves the workspace interface and route handlers.
2. **Persistence** — PostgreSQL stores workflow definitions and run records through Prisma.
3. **Background worker** — BullMQ consumes queued runs from Redis, so the request handler does not perform a workflow inline.

```text
Browser
  | HTTP
  v
Next.js UI + API ---- Prisma ---- PostgreSQL
  |                               ^
  | enqueue run                   | update run state
  v                               |
Redis / BullMQ queue ---> Worker -+
```

## Important boundaries

- API input is validated before data is written.
- Database and queue errors return a generic response; details are logged server-side.
- Workflow definitions are data, not executable JavaScript. Workflow definitions are data, not executable JavaScript. The worker validates a single linear path and dispatches only registered actions. The first live action sends a message through a workspace-scoped Discord webhook.
- A queue job uses the run ID as its job ID to reduce duplicate enqueueing for the same run record.
- The worker closes its queue consumer and database connection on `SIGINT` and `SIGTERM`.

## Before production

The current project intentionally does not claim to be production-ready. Conditions, branching, durable step checkpoints, stale-run recovery, signed inbound webhooks, scheduled triggers, provider OAuth, per-connection rate limits, audit retention and live provider integration tests remain outstanding. The current worker uses at-most-once claiming for each run; a worker crash can leave a run in RUNNING and requires recovery rather than an automatic retry that could duplicate an external side effect.
