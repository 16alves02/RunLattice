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

`PATCH /api/workflows/:id` updates `name`, `description`, `status` or `definition`. Changing the status to ACTIVE validates that the workflow contains exactly one trigger, a single connected linear path and at least one configured supported action. All action connections must belong to the active workspace.

`DELETE /api/workflows/:id` deletes a workflow and its run records.

## Queue a run

`POST /api/workflows/:id/runs` queues a run for an active workflow. The endpoint returns `202 Accepted` after Redis accepts the job. The worker then claims the run atomically, validates the stored workflow and persists step-level results.

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

The first live worker version supports a manual trigger and a single linear path. It supports one action: send a static message to a connected Discord webhook. Condition nodes, branching, arbitrary code, inbound webhooks, scheduled triggers and other integrations cannot be activated.

External actions are not automatically retried because the Discord webhook action does not provide an idempotency key. The worker updates a run heartbeat every 20 seconds. A recovery sweep marks runs with no heartbeat for more than five minutes as `FAILED`, with a warning that the external action may already have occurred. It never automatically replays an interrupted run. This is stale-run detection, not durable resumption or exactly-once delivery.
