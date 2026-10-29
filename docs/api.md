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
