# Phase 3 — AI Builder and AI Architect

Status: implementation and initial automated validation are in progress on `feature/phase-3-ai-architect`. The Phase 3 CI quality job and PostgreSQL migration job passed for commit `83f0698`; subsequent evaluation and readiness changes require a fresh CI run. This is a stacked branch; it does not merge Phase 2 or Phase 1.

## Product outcome

A user describes an automation, RunLattice creates an explainable proposal, validates it against the supported runtime, shows missing integrations and permissions, allows edits and safe tests, then saves only after explicit approval. AI never activates or executes a workflow by itself.

## Existing implementation to preserve

- `src/app/api/ai/workflow-plan/route.ts`: authenticated planning endpoint, feature flag, server-side provider key, bounded prompt, JSON response parsing and schema validation.
- `src/lib/ai-workflow.ts`: request/plan schemas and prompt construction.
- `src/components/ai-workflow-assistant.tsx`: prompt UI, plan review, save-as-draft flow.
- `src/lib/validation.ts` and `src/lib/types.ts`: authoritative workflow contracts.
- Phase 2 runtime and execution history: source of truth for supported actions and safe tests.

Do not replace the existing planner wholesale. Evolve it behind stable contracts.

## Work packages

### 3.1 Provider abstraction and structured generation
- Add a server-only provider interface and model registry.
- Introduce Vercel AI SDK only after validating current package compatibility and supported structured-output APIs.
- Support configurable provider/model selection without exposing provider keys to clients.
- Keep provider selection, model name, timeout and token limits server-controlled.
- Return schema-validated plans; reject unsupported nodes and unknown integrations.

### 3.2 Plan-first AI Architect
- Split planning into intent extraction, capability/permission analysis, graph proposal and validation.
- Return an explanation for each trigger, condition and action.
- Identify integrations that are missing or disconnected; never imply a catalog entry is connected.
- Explain data required, expected side effects, estimated complexity and permissions.
- Preserve user prompt as untrusted input; treat connected content and retrieved data as untrusted too.

### 3.3 Review, editing and safe tests
- Present a human-readable plan and graph diff before saving.
- Let the user edit nodes, conditions and messages before accepting.
- Validate all changes with the same server schemas used by the editor and runtime.
- Add a dry-run/test path that cannot send external messages or mutate third-party services.
- Require a separate explicit user action to save a draft; activation remains a separate action.

### 3.4 Workspace quotas and cost controls
- Persist AI usage by workspace, provider, model, request and time window.
- Track provider-reported token usage where available; estimate and label cost when exact billing data is unavailable.
- Enforce per-workspace request/token budgets and concurrency limits server-side.
- Reject over-budget requests before provider calls where possible; reserve and reconcile usage to avoid parallel overspend.
- Keep limits configurable by plan for the later billing phase.

### 3.5 Security and evaluations
- Add rate limiting and request size limits.
- Prevent prompt injection from overriding system policy or invoking tools.
- Do not pass secrets, raw credentials or unrelated workspace data into model prompts.
- Redact provider errors and avoid logging prompts or sensitive outputs by default.
- Add adversarial and regression evaluations for schema validity, unsupported integrations, permission explanation, prompt injection and cost enforcement.

## Initial file areas

- Existing AI route, library and assistant component listed above.
- New server-only provider/routing module under `src/lib` after confirming project conventions.
- Prisma schema and a new migration for workspace AI usage/budget records.
- Unit tests beside AI schemas/provider/quota helpers.
- API integration tests and updated security/AI documentation.

Exact new filenames and model names are implementation decisions to be confirmed against the current repository before creating them.

## Exit criteria

- Multi-provider abstraction works with at least two configured providers or one provider plus a tested mock adapter.
- Generated plans are schema-valid, explainable and editable.
- The same supported workflow validator is used for AI proposals and user-authored workflows.
- Dry-run tests cannot execute external side effects.
- AI usage and budgets are enforced per workspace, including concurrent requests.
- Human approval is required before saving; activation and external execution require their existing separate permissions/actions.
- CI, migration tests, adversarial tests and evaluation suite pass on the final head SHA.

## Current implementation notes\n\nThe evaluation module is a deterministic regression harness used by automated tests. It does not call a model and is not a runtime security filter or a guarantee that a model will resist prompt injection. The planning endpoint continues to validate every generated plan against the authoritative workflow schema and the integration catalog. Provider selection remains explicitly configured; cost/latency/privacy routing is intentionally deferred until measurable provider metadata and policy requirements are available.\n\n## Dependencies and explicit exclusions

- Phase 2 execution contracts and migrations must pass CI before implementation is considered ready.
- Phase 1 workspace membership and authorization remain prerequisites.
- Public AI enablement stays off until quota, abuse and privacy controls pass review.
- Autonomous agent tools, multi-agent orchestration, Knowledge Hub/RAG and marketplace capabilities remain Phase 6 scope.
