# API reference

All endpoints return JSON. Error responses use an `error` string; validation responses may also include an `issues` array.

## Authentication and workspace access

All workflow, run and integration endpoints require a valid Better Auth session and verified membership in the active organization. Members can read. Owners and admins can create, update, delete and execute workflows, and manage integration connections. The server resolves workspace membership; clients cannot select an arbitrary organization by sending an ID.

## Health

`GET /api/health`

Returns basic web-process status. It does not currently test PostgreSQL or Redis connectivity.

## Workflows

`GET /api/workflows`

Lists workflows in the active workspace, newest first, with a count of associated runs.

`POST /api/workflows`

Creates a workflow from this shape:

```json
{
  "name": "Team notification",
  "description": "Notify a team when a manual workflow runs.",
  "definition": {
    "nodes": [
      { "id": "trigger-1", "kind": "trigger", "title": "Manual start", "detail": "Manual trigger", "x": 0, "y": 0 },
      { "id": "action-1", "kind": "action", "title": "Send Discord message", "detail": "Discord webhook", "config": { "integrationId": "discord", "actionId": "send_message", "connectionId": "connection-id", "message": "Workflow completed." }, "x": 240, "y": 0 }
    ],
    "edges": [
      { "id": "edge-1", "from": "trigger-1", "to": "action-1" }
    ]
  }
}
```

Names must contain 2–80 characters. A definition contains 1–100 nodes and up to 200 edges. Every edge must reference existing nodes and cannot point from a node to itself.

`GET /api/workflows/:id` retrieves a workflow and up to 20 recent runs.

`PATCH /api/workflows/:id` updates `name`, `description`, `status` or `definition`. Changing the status to ACTIVE validates that the workflow contains exactly one trigger, a connected workflow graph, valid condition rules with exactly one true and one false branch, and at least one configured supported action. Every action on either branch must be configured and connected to the active workspace. All action connections must belong to the active workspace.

`DELETE /api/workflows/:id` deletes a workflow and its run records.

## Queue a run

`POST /api/workflows/:id/runs` queues a run for an active workflow. An optional JSON object can be supplied as the request body and is stored as the run input; the body is limited to 32 KB. An empty body remains valid and creates an empty input object. Arrays, primitives, malformed JSON and oversized bodies are rejected. The input is persisted on the run record and is available to Discord message templates using `{{input.customer.name}}` path syntax. Only string, number and boolean values are inserted; missing paths, object values, prototype-related path segments and rendered messages over Discord’s 2,000-character limit fail the step. Templates do not evaluate JavaScript or arbitrary expressions. Condition nodes evaluate the stored run input using a restricted operator set: equals, not_equals, contains, greater_than, less_than and exists. A condition node must have exactly one outgoing true edge and one outgoing false edge; only the matching branch executes. The endpoint creates the run and its outbox event in one database transaction, then returns `202 Accepted`. The worker dispatcher delivers pending outbox events to BullMQ. The worker then claims the run atomically, validates the stored workflow and persists step-level results.

## Integration connections

`GET /api/integrations` lists the integration catalog and current workspace connections. Credential material is never included.

`POST /api/integrations` creates a Discord webhook connection for workspace owners/admins:

```json
{
  "provider": "discord",
  "name": "Team alerts",
  "webhookUrl": "https://discord.com/api/webhooks/..."
}
```

Only HTTPS webhook URLs on the official `discord.com` or `discordapp.com` hosts are accepted. The URL is encrypted at rest with AES-256-GCM. Configure `INTEGRATION_ENCRYPTION_KEY` as a unique base64-encoded 32-byte key before creating connections.

`DELETE /api/integrations/:id` removes a connection belonging to the active workspace. Owners/admins only.

## Live execution limits

The live worker supports a manual trigger, Discord send-message actions and declarative condition nodes. Conditions read the persisted run input through safe own-property paths and never evaluate JavaScript. Operators are equals, not_equals, contains, greater_than, less_than and exists. A condition must connect to exactly one true and one false branch; only the selected branch executes. Both branches are validated before activation. Arbitrary code, inbound webhooks, scheduled triggers and other integrations cannot be activated.

External actions are not automatically retried because the Discord webhook action does not provide an idempotency key. The worker updates a run heartbeat every 20 seconds. A recovery sweep marks runs with no heartbeat for more than five minutes as `FAILED`, with a warning that the external action may already have occurred. It never automatically replays an interrupted run. This is stale-run detection, not durable resumption or exactly-once delivery.

## AI workflow planning

`POST /api/ai/workflow-plan`

Requires an authenticated workspace owner/admin and `AI_ASSISTANT_ENABLED=true`. The endpoint accepts a JSON object with a `prompt` string of 10–2,000 characters; request bodies are limited to 10 KB. It returns a schema-validated proposal with rationale, assumptions, required integrations, side effects, missing/unconnected integration warnings and readiness status. It does not save, activate or execute the workflow.

Provider configuration is server-side:
- `AI_PROVIDER=openai` with `OPENAI_API_KEY`, or `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY`.
- `AI_MODEL` selects the model. OpenAI defaults to `gpt-4.1-mini`.
- `AI_MONTHLY_REQUEST_LIMIT` and `AI_MONTHLY_TOKEN_LIMIT` set per-workspace UTC monthly budgets (defaults: 100 requests and 100,000 tokens).

Requests reserve budget atomically before provider calls. Provider-reported token usage reconciles the reservation; if usage metadata is absent, the adapter estimates token counts from prompt and response length. Failed or timed-out provider calls keep their reservation charged because provider-side usage may be ambiguous. The legacy `AI_API_KEY` variable is an OpenAI-only fallback.

`POST /api/ai/workflow-plan/test`

Requires workspace membership. Accepts a workflow `definition` and optional JSON `input`; the request is limited to 64 KB. It validates and simulates graph traversal, including condition branch selection. It never reads integration credentials, calls adapters, queues runs or performs external side effects. The response explicitly marks the result as a simulation.
