# Architecture notes

## Current shape

RunLattice separates the web application, persistence and background execution:

1. **Web application** — Next.js App Router serves the workspace interface and route handlers.
2. **Persistence** — PostgreSQL stores users, organizations, integration connections, workflow definitions and run records through Prisma.
3. **Queue** — Redis/BullMQ accepts workflow run jobs without executing external actions inside the HTTP request.
4. **Worker** — a separate Node.js process claims runs and dispatches registered action handlers.

```text
Browser
  | authenticated HTTP
  v
Next.js UI + API ---- Prisma ---- PostgreSQL
  |                               ^
  | enqueue run                   | run state and step output
  v                               |
Redis / BullMQ queue ---> Worker -+
                              |
                              | encrypted connection lookup
                              v
                         Discord webhook
```

## Execution boundary

Workflow definitions are data, not executable JavaScript. Before activation, the API validates the graph and confirms that every referenced integration connection belongs to the active workspace. The worker repeats the important checks before dispatching the action.

The current runtime accepts exactly one trigger and one connected linear path. It dispatches only the registered Discord send-message action. Conditions, branching, arbitrary code, inbound webhooks and schedules are not supported yet.

## Credential boundary

Discord webhook URLs are encrypted with AES-256-GCM before they are stored. The encryption context binds each credential to its organization and provider. The API returns connection metadata only. The worker decrypts a credential only after retrieving the matching connection from the workflow's organization. The destination is validated again, redirects are blocked and requests time out after 10 seconds.

## Queue and side-effect semantics

A queue job uses the database run ID as its BullMQ job ID. The worker claims a run through an atomic QUEUED-to-RUNNING update so duplicate delivery cannot normally execute the same run twice. Each completed step is persisted to the run output.

The Discord webhook action is non-idempotent, so automatic queue retries are disabled. This reduces duplicate messages but does not provide exactly-once delivery. A process crash after claiming a run can leave it in RUNNING; durable checkpoints, stale-run recovery and a transactional outbox are future reliability work.

## Before production

The current project is not production-ready. Outstanding work includes durable step checkpoints, stale-run recovery, safe retry policies, transactional outbox, condition evaluation, branching, signed inbound webhooks, scheduled triggers, provider OAuth, provider rate limits, audit retention, end-to-end provider tests, AI request budgets and a security review.
