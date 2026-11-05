# Execution reliability design

Status: design proposal for the Phase 2 reliability work. This document does not claim that the mechanisms below are implemented.

## Current gaps confirmed in the worker and run API

- The API creates a `WorkflowRun` row and then enqueues a BullMQ job in a separate operation. A process crash between those operations can leave a run permanently queued without a corresponding job.
- A worker claims a run with an atomic `QUEUED -> RUNNING` update, but subsequent heartbeat, step-output and terminal-state writes are guarded only by run ID (and sometimes status). A stale worker can therefore write after the recovery process has marked the run failed.
- Step output is persisted after a step completes, but there is no durable per-step execution ledger from which a worker can safely resume.
- A remote provider may accept a request even if the worker loses its connection before receiving the response. The outcome is then unknown; blindly retrying a non-idempotent action can duplicate the side effect.

## Target design

### 1. Transactional enqueue (outbox)

Create the run and an outbox event in one PostgreSQL transaction. A dispatcher claims pending outbox rows, enqueues jobs using the run ID as a deterministic BullMQ job ID, and marks the event dispatched only after Redis confirms the enqueue.

The dispatcher must be safe to run concurrently. If it crashes after enqueue but before marking the outbox row dispatched, the deterministic job ID must prevent a second logical job from being created. Keep outbox rows until dispatch is confirmed and define bounded retry/backoff plus an observable terminal error state.

PostgreSQL is the source of truth for run intent. Redis is a delivery mechanism, not the only record that work exists.

### 2. Worker lease and fencing

Add a per-claim random lease token and lease expiry to each running attempt. Claiming is a conditional database operation that succeeds only for a queued run (or a specifically eligible retry). Every heartbeat, checkpoint and terminal-state update must include the current lease token in its database predicate.

Recovery may fail an expired lease only when the stored lease is still expired at the time of the conditional update. A worker whose token no longer matches must stop processing and must not write further state. Refreshes must never resurrect a terminal run.

Check lease ownership immediately before beginning each external action. Use bounded provider request timeouts shorter than the lease safety window and cancel in-flight work when ownership is lost where the provider client supports cancellation.

Fencing protects database state from stale workers. It cannot revoke a request already accepted by an external provider, so it is not an exactly-once delivery guarantee.

### 3. Durable step ledger

Persist one record per step attempt, with a unique identity scoped to run, node and attempt. Record states such as pending, running, succeeded, failed and outcome-unknown, plus timestamps and sanitized result metadata.

Commit a successful checkpoint before moving to the next step. On worker restart, resume only from a checkpoint whose semantics are safe. Never infer that an external action failed merely because its response was lost.

### 4. Retry policy and idempotency

Classify actions by retry safety:
- Read-only/idempotent actions may use bounded retries with exponential backoff and jitter.
- Actions with provider-supported idempotency keys may retry using the same stable key for the same logical step.
- Non-idempotent actions without provider idempotency support must not be retried automatically after an ambiguous outcome. Mark the step outcome unknown and require operator review.

Discord webhook message delivery remains non-idempotent in this implementation. Keep automatic retries disabled unless a documented provider capability changes that assessment.

### 5. Operational requirements

- Expose queue lag, oldest pending outbox age, active leases, expired leases, run duration, step failures and unknown external outcomes.
- Add integration tests using PostgreSQL and Redis for concurrent claims, duplicate queue delivery, dispatcher crash windows, lease expiry, stale-worker writes and worker restart.
- Keep secrets out of logs and persisted step results.
- Retain a clear audit trail for manual retries and operator resolution.

## Completion criteria

This reliability work is complete only when the transactional outbox and lease fencing are implemented, the step ledger supports the explicitly documented resume policy, and the crash/concurrency tests pass. Until then, the current stale-run process is detection and failure marking only; it is not safe resumption.
