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
- [x] Application-level AI per-user/per-workspace request throttling
- [ ] General API edge rate limiting and audit logs
- [x] First registered action adapter: Discord webhook message
- [ ] General integration adapter interface and additional providers
- [x] Restricted graph execution with declarative true/false branches, atomic run claiming, timeouts and step-level results
- [x] Bounded manual trigger input and safe scalar templates for Discord messages
- [x] Stale-run detection with heartbeat monitoring (does not resume or replay interrupted runs)
- [x] Durable step ledger, lease fencing and stale-run outcome classification (no automatic replay or exactly-once guarantee)
- [x] Signed webhook triggers, schedules and replay protection

## AI-assisted workflow creation

- [x] Natural-language planning endpoint foundation
- [x] Structured workflow validation
- [x] Review and save generated workflow as draft
- [x] Require authenticated access for AI planning
- [x] Workspace-level monthly request and token budgets with atomic reservations
- [x] Explain required integrations and identify missing/unconnected providers
- [x] Side-effect-free graph simulation endpoint

### Phase 3 implementation in progress

- [x] Server-side provider abstraction for OpenAI and Anthropic
- [x] Workspace-scoped AI usage ledger and monthly quotas
- [x] Structured, explainable plans with assumptions and side-effect declarations
- [x] Review and edit proposal details before saving
- [x] Side-effect-free simulation that never invokes integrations
- [ ] Provider routing by cost, latency and privacy preferences
- [ ] Adversarial prompt-injection evaluation suite and automated regression scoring

## Integration library

- [x] Catalog definitions for Gmail, Google Drive, Google Sheets, Discord, Slack, Shopify, Stripe, GitHub and HTTP
- [ ] OAuth and secure provider account connections
- [x] First live integration: Discord webhook message
- [ ] Provider end-to-end tests
- [ ] Community template publishing and versioning

## Launch

- [x] PostgreSQL/Redis integration tests for signed webhooks, scheduling and worker failure handling
- [ ] Multi-worker crash-window and recovery integration tests
- [ ] Security and privacy review
- [ ] Production observability and health checks
- [ ] Public demo with documented limitations

## Current limitations

Email/password authentication, organization membership and workspace-scoped workflow access are implemented. Owners and admins can manage workflows; members are read-only. Discord webhook connections are available with encrypted credentials and a live send-message action. Other provider entries remain catalog-only. The AI endpoint remains disabled by default pending deployment-edge protection, production monitoring, provider privacy review and a full security review. The current worker supports manual, signed-webhook and cron-scheduled triggers, Discord send-message actions, bounded run input, safe scalar templates and declarative condition nodes with true/false branches. Conditions support equals, not-equals, contains, greater-than, less-than and exists against run input paths. Only the selected branch executes; both branches must be structurally valid and all action nodes must be configured before activation. Arbitrary code execution and additional provider actions are not implemented. Signed webhook deliveries require timestamped HMAC-SHA256 signatures and unique delivery IDs; scheduled triggers use BullMQ schedulers with IANA timezones.
