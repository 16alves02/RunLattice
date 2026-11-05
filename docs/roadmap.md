# Product roadmap

RunLattice is evolving into an approachable automation platform for non-technical users and developers.

## Product principles

- Make the first automation understandable without API, JSON or webhook knowledge.
- Keep an advanced path for custom logic, HTTP APIs and developer-defined integrations.
- Let users inspect and approve AI-generated workflows before activation.
- Make integrations explicit about permissions, connected accounts and available actions.
- Never imply that a workflow performed an external action unless an integration actually executed it.

## Foundation

- [x] Workspace dashboard and responsive layout
- [x] Workflow definition validation and persistence
- [x] Redis/BullMQ queue and live Discord webhook worker
- [x] Searchable template gallery
- [x] Integration catalog with provider capabilities and authentication requirements
- [x] Workspace-scoped encrypted Discord webhook connections
- [x] AI workflow planning endpoint with server-side key and schema validation
- [x] AI review interface that saves drafts only
- [ ] Improve visual builder configuration and graph editing

## Security and usable automation core

- [x] Email/password authentication and per-account workflow ownership
- [x] Organization-backed multi-user workspaces and owner/admin/member workflow permissions
- [ ] Invitation delivery and member administration UI
- [x] Encrypted workspace-scoped Discord webhook credentials
- [ ] OAuth connections for additional providers
- [ ] Request rate limiting and audit logs
- [x] First registered action adapter: Discord webhook message
- [ ] General integration adapter interface and additional providers
- [x] Restricted linear execution path, atomic run claiming, timeouts and step-level results
- [ ] Durable step checkpoints, stale-run recovery and safe retries
- [ ] Signed webhook triggers, schedules and replay protection

## AI-assisted workflow creation

- [x] Natural-language planning endpoint foundation
- [x] Structured workflow validation
- [x] Review and save generated workflow as draft
- [x] Require authenticated access for AI planning
- [ ] Add per-account AI quotas and spend controls before enabling publicly
- [ ] Explain required permissions and missing integrations
- [ ] Test generated workflows safely before activation

## Integration library

- [x] Catalog definitions for Gmail, Google Drive, Google Sheets, Discord, Slack, Shopify, Stripe, GitHub and HTTP
- [ ] OAuth and secure provider account connections
- [x] First live integration: Discord webhook message
- [ ] Provider end-to-end tests
- [ ] Community template publishing and versioning

## Launch

- [ ] Integration tests for API, queue and worker
- [ ] Security and privacy review
- [ ] Production observability and health checks
- [ ] Public demo with documented limitations

## Current limitations

Email/password authentication, organization membership and workspace-scoped workflow access are implemented. Owners and admins can manage workflows; members are read-only. Discord webhook connections are available with encrypted credentials and a live send-message action. Other provider entries remain catalog-only. The AI endpoint remains disabled by default pending usage quotas and a security review. The current worker supports a single linear path with a manual trigger and Discord send-message action. Branching, condition evaluation, arbitrary code, scheduled triggers and inbound webhooks are not implemented.
