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
- Workflow definitions are data, not executable JavaScript. The initial worker records a simulated path rather than evaluating arbitrary user code.
- A queue job uses the run ID as its job ID to reduce duplicate enqueueing for the same run record.
- The worker closes its queue consumer and database connection on `SIGINT` and `SIGTERM`.

## Before production

The current project intentionally does not claim to be production-ready. A public deployment needs authentication, workspace ownership checks, rate limits, signed webhooks, secret management, stricter queue retry/dead-letter handling, action allow-lists, audit retention and integration tests. External actions should run with least privilege and explicit timeouts.
