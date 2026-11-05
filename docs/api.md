# API reference

All endpoints return JSON. Error responses use an `error` string; validation responses may also include an `issues` array.

## Health

`GET /api/health`

Returns a basic web-process health response. It does not currently test PostgreSQL or Redis connectivity.

## Workflows

`GET /api/workflows`

Lists workflows, newest first, with a count of associated runs.

`POST /api/workflows`

Creates a workflow from the following shape:

```json
{
  "name": "Lead capture",
  "description": "Validate and store new leads.",
  "definition": {
    "nodes": [
      { "id": "trigger-1", "kind": "trigger", "title": "New submission", "detail": "Webhook", "x": 0, "y": 0 }
    ],
    "edges": []
  }
}
```

Names must contain 2–80 characters. A definition contains 1–100 nodes and up to 200 edges. Every edge must point to existing nodes and cannot point from a node to itself.

`GET /api/workflows/:id` retrieves a workflow and up to 20 recent runs.

`PATCH /api/workflows/:id` updates `name`, `description`, `status` or `definition`.

`DELETE /api/workflows/:id` deletes a workflow and its run records.

## Queue a run

`POST /api/workflows/:id/runs` queues a run for an active workflow. If `CRON_SECRET` is configured, the request must include `x-runlattice-secret` with the matching value. The endpoint returns `202 Accepted` after the queue accepts the job.

The initial worker simulates traversing the workflow nodes. It does not yet call external services or execute user-provided code.


## Integration connections

`GET /api/integrations` lists the integration catalog and the current workspace's connected services. Credential material is never included.

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

The first live worker version supports a single trigger and a single linear path. It supports one action: send a static message to a connected Discord webhook. Condition nodes, branching, arbitrary code and other integrations cannot be activated. External actions are not automatically retried because the Discord webhook action does not provide an idempotency key. A worker crash after an external request may leave a run in `RUNNING`; automatic recovery is a later reliability milestone.
