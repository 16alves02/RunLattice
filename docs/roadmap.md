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
- [x] Redis/BullMQ queue and simulated worker
- [x] Searchable template gallery
- [x] Integration catalog with provider capabilities and auth requirements
- [x] AI workflow planning endpoint with server-side key and schema validation
- [x] AI review interface that saves drafts only
- [ ] Improve visual builder configuration and graph editing

## Security and usable automation core

- [x] Email/password authentication and per-account workflow ownership
- [ ] Multi-user workspaces, roles and invitations
- [ ] Secure OAuth connection and encrypted credential storage
- [ ] Request rate limiting and audit logs
- [ ] Integration adapter interface and first real provider
- [ ] Safe execution adapters, timeouts, retries and step-level logs
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
- [ ] First end-to-end integration
- [ ] Community template publishing and versioning

## Launch

- [ ] Integration tests for API, queue and worker
- [ ] Security and privacy review
- [ ] Production observability and health checks
- [ ] Public demo with documented limitations

## Current limitations

Email/password authentication and per-account workflow ownership are implemented. The integration library is descriptive only: it does not connect provider accounts or execute external actions. The AI endpoint remains disabled by default pending usage quotas and a security review. The current worker simulates graph traversal.
