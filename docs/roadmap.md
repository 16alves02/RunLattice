# Product roadmap

RunLattice is evolving from a workflow editor into an approachable automation platform for both non-technical users and developers.

## Product principles

- Make the first automation understandable without requiring API, JSON or webhook knowledge.
- Keep an advanced path for custom logic, HTTP APIs and developer-defined integrations.
- Let users inspect and approve AI-generated workflows before activation.
- Make integrations explicit about permissions, connected accounts and available actions.
- Never imply that a workflow performed an external action unless an integration actually executed it.

## Milestone 1 — Foundation

- [x] Workspace dashboard and responsive layout
- [x] Workflow definition validation and persistence
- [x] Redis/BullMQ queue and simulated worker
- [x] Editable workflow template gallery
- [ ] Improve visual builder configuration and graph editing

## Milestone 2 — Usable automation core

- [ ] Authentication and workspace ownership
- [ ] Secure connection and credential storage
- [ ] Integration framework with explicit triggers and actions
- [ ] First real integration, selected for a complete end-to-end use case
- [ ] Safe execution adapters, timeouts, retries and step-level logs
- [ ] Webhook triggers, schedules and replay protection

## Milestone 3 — AI-assisted workflow creation

- [ ] Natural-language workflow planning
- [ ] Structured workflow generation with schema validation
- [ ] Explain each generated step and required permissions
- [ ] Review, edit and test before activation
- [ ] Require explicit confirmation before enabling workflows or external side effects

## Milestone 4 — Integration library and templates

- [ ] Gmail and Google Drive
- [ ] Google Sheets
- [ ] Discord and Slack
- [ ] Shopify and Stripe
- [ ] Community template publishing and versioning

## Milestone 5 — Reliability and launch

- [ ] Integration tests for API, queue and worker
- [ ] Audit logs, rate limits and data retention controls
- [ ] Production observability and health checks
- [ ] Security review and privacy documentation
- [ ] Public demo with documented limitations

## Current limitations

The template gallery creates editable workflow definitions only. It does not connect external accounts or execute actions in Gmail, Google Drive, Discord, Shopify, Stripe or other services. The current worker simulates graph traversal. AI generation, authentication and production integrations are not implemented yet.
