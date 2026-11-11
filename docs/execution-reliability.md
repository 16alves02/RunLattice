# Execution reliability

Status: implemented baseline for Phase 2. The guarantees and limitations below are explicit; this is not an exactly-once execution system.

## Transactional run enqueue

- The run API creates a `WorkflowRun` and its `WorkflowRunOutbox` event in one PostgreSQL transaction.
- The worker process polls pending events and dispatches BullMQ jobs using the run ID as a deterministic job ID.
- An event is marked dispatched only after BullMQ accepts the job. Failed dispatches remain pending and store a bounded error message and attempt count.
- The dispatcher runs at startup and every two seconds. Multiple dispatchers may race; BullMQ's deterministic job ID prevents duplicate logical jobs while the original job remains retained.
- Keep completed and failed BullMQ jobs retained (currently 500 and 1,000 respectively). This is not an exactly-once guarantee if an old queue job is removed and a very delayed duplicate dispatch occurs.

PostgreSQL is the source of truth for run intent. Redis is a delivery mechanism.

## Worker leases and fencing

- A worker claims a queued run atomically and assigns a random lease token.
- Heartbeats, run progress, terminal state changes and step-ledger writes are conditioned on the active lease token.
- Stale-run recovery marks expired running runs failed and clears the lease token. A worker with an old token can no longer update run or step state.
- Recovery does not replay external actions.

Fencing protects database state from stale workers. It cannot revoke a request already accepted by an external provider.

## Durable step ledger

Each node attempt is persisted in `WorkflowRunStep` with its node identity, kind, attempt number, status, timestamps, sanitized result metadata and error. Successful steps are checkpointed before execution proceeds.

If recovery finds an action step still running, it records `OUTCOME_UNKNOWN`; it does not assume the external request failed. Interrupted non-action steps are marked failed. There is no automatic resume or replay in this phase.

During a live worker execution, a received provider/API rejection or a preflight/configuration error is recorded as `FAILED`. A network interruption or timeout after an external request has started is recorded as `OUTCOME_UNKNOWN`, because the provider may have processed it without returning a response.

## Retry and idempotency policy

- BullMQ delivery uses one attempt; Discord actions are not automatically retried.
- Discord webhook message delivery is non-idempotent. A timeout or worker interruption can leave delivery outcome unknown.
- Unknown external outcomes require operator review. The platform does not claim exactly-once delivery.

## Validation and remaining operational work

- Unit tests cover input validation, condition routing, safe templates, encryption, lease recovery and outbox dispatch behavior.
- PostgreSQL migration CI validates the schema migrations.
- Full PostgreSQL/Redis crash-window and multi-worker integration tests, production metrics/alerts, and a real Discord delivery test with a private user-owned webhook remain deployment validation tasks.
- Never log credentials or persist webhook URLs in run outputs.

## Scope

Phase 2 supports manual, scheduled and signed inbound webhook triggers; Discord webhook message actions and bounded HTTPS API request actions; bounded JSON input; safe scalar templates; and one declarative condition node with true/false branches. It does not include OAuth providers, arbitrary code execution, automatic retries for external actions or exactly-once delivery.
