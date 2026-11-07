# CLAUDE.md - RunLattice

## Project objective

Build RunLattice into a universal, AI-first workflow automation and orchestration platform for individuals, freelancers, SMEs, developers, teams and enterprise customers.

The product must be approachable without programming and powerful enough for advanced users. It includes Web, Desktop (Windows/macOS/Linux) and Mobile (iOS/Android). Mobile must have a complete touch-adapted visual workflow editor, not only monitoring features.

Read these documents before planning or changing the product:
- `docs/PRD.md`
- `docs/ROADMAP.md`

## Mandatory working method

### 1. Inspect before changing
- Inspect the actual repository tree, relevant source files, package manifests, lockfiles, configuration, tests and git status before proposing edits.
- Never assume a filename, function, endpoint, database table, environment variable, dependency or architectural component exists.
- Read the full relevant code path before editing it.
- Treat the current implementation as the source of truth; documentation may be outdated.
- Preserve working features and current conventions unless a change is necessary and justified.
- Do not replace or rewrite the application wholesale to make the architecture look cleaner.
- Never overwrite unrelated user changes. Inspect `git status` and diffs first.

### 2. One phase at a time
The roadmap is divided into phases. Before implementing any phase:
1. State the objective and expected result.
2. List the exact files/modules expected to change, after inspecting them.
3. Give a short ordered implementation plan.
4. Identify risks, dependencies and migration implications.
5. State the validation commands and tests.

**Stop and wait for explicit user approval before implementing the phase.** Do not interpret a broad request to work on RunLattice as permission to skip this gate for a new phase.

Within an approved phase, work in small, reviewable steps. Do not silently expand scope.

### 3. Engineering quality
- TypeScript strict mode; avoid `any` unless unavoidable and documented.
- Prefer small, cohesive, testable functions and clear module boundaries.
- Use names that describe domain behaviour.
- Keep comments natural and useful; explain why, not obvious syntax.
- Do not add unnecessary abstractions or dependencies.
- Pin dependencies through the package manager and commit the correct lockfile.
- Do not introduce breaking changes without a migration plan.
- Avoid dead code, placeholder implementations and fake success states.
- Never claim a test, build, deployment or integration works unless it was actually run and verified.
- Report incomplete work and known limitations honestly.

### 4. Product and UX principles
- Prefer the option that expands addressable users and sustainable monetization, while keeping delivery realistic.
- Do not narrow the product to one audience; adapt onboarding, templates and interface complexity to each segment.
- AI Builder, Guided Builder, Visual Builder and Code Builder must create the same versioned workflow model.
- The AI must propose changes in a reviewable form. Activation and sensitive actions obey user/org policies.
- Never let an AI agent grant itself permissions or bypass approvals.
- Web, Desktop and Mobile share contracts, schemas, workflow semantics and design tokens.
- Do not force DOM-based components into React Native. Mobile interactions must be designed for touch and smaller screens.
- Accessibility, responsive behaviour, loading, empty, error and offline states are product requirements, not polish.
- Do not add decorative AI gradients or generic dashboard cards without a clear product purpose.

## Current repository baseline (verified 2026-11-05)

The repository is `16alves02/RunLattice`, default branch `main`.

Initial remote inspection found:
- Next.js 15, React 19 and TypeScript.
- Next.js Route Handlers and Zod.
- PostgreSQL with Prisma.
- Redis and BullMQ.
- Vitest.
- Docker Compose for PostgreSQL and Redis.
- Existing dashboard, workflow editor, CRUD API and execution history.
- The worker currently records a simulated workflow traversal; it does not yet perform real third-party side effects.
- The Prisma schema currently has `Workflow` and `WorkflowRun` models, without user/workspace tenancy.
- The README explicitly states that authentication, workspace isolation, real integrations, scheduling, signed webhooks and production observability remain incomplete.
- The README says tests/build/accessibility/Lighthouse must be validated in the target development environment.

These are initial remote observations. Re-check the current branch and actual files before acting. Do not assume the repository has not changed since this note.

## Architecture direction

The following is the target direction, not permission to perform a large migration immediately.

### Applications
- Web: preserve the current Next.js application as the first stable client and, initially, its backend-for-frontend.
- Mobile: Expo + React Native, with a complete touch-first workflow editor.
- Desktop: Tauri 2, initially wrapping the Web experience and later adding carefully scoped native features and Local Agent connectivity.
- Develop the platforms in parallel once stable shared contracts and APIs exist.

### Shared packages (introduce only when justified by the inspected repository)
- Workflow/domain contracts and versioned schemas.
- Workflow validation and graph utilities.
- API client and typed contracts.
- Integration SDK and connector contracts.
- AI provider/routing abstractions.
- Design tokens and platform-neutral domain logic.

A pnpm/Turborepo monorepo is the target once the second application is introduced. Migrate incrementally and preserve the current working app.

### Data and identity
- PostgreSQL is the canonical relational store.
- Prisma is the current ORM and should be retained unless a measured technical reason supports changing it.
- Supabase Auth/Storage may be used as managed services; verify current official docs before implementation.
- Every tenant-owned read/write must be authorized server-side.
- If Supabase tables are exposed through the Data API, enable and test RLS for every exposed table. Never use user-editable metadata for authorization. Never expose service-role or secret keys in browser code.
- A signed-in user is not automatically authorized for every organization. Check membership and role on every protected operation.
- Plan migrations, backups and restore tests before production data is introduced.

### Workflow runtime
- Keep the workflow definition independent from the editor UI.
- Version schemas and node definitions.
- Validate node types, connections, input/output contracts and execution policies before running.
- Use Temporal TypeScript SDK as the target durable orchestrator for long-running workflows, approvals, retries and recovery after validating local development and operational costs.
- Redis/BullMQ may remain for short auxiliary jobs where it is simpler; do not create two competing sources of truth for workflow state.
- Assume at-least-once delivery. Use idempotency, deduplication and reconciliation for external side effects; never promise universal exactly-once execution.
- Record the workflow version, connector version, execution policy and correlation IDs for every run.
- Support cancellation, timeouts, rate limits, concurrency controls and safe retries.

### Integrations and security
Initial connector priorities:
1. HTTP and Webhooks
2. Gmail
3. Google Sheets
4. Discord
5. Slack
6. GitHub
7. Supabase
8. Stripe

Start with a narrow, tested subset of actions per connector. Do not claim full API coverage.

- Store credentials encrypted server-side; never return secrets to clients or logs.
- Request minimum OAuth scopes.
- Support revocation and rotation.
- Protect HTTP nodes against SSRF, private-network access, unsafe redirects and DNS rebinding.
- Use allow-listed tools and validate all tool arguments.
- Code execution must use an isolated sandbox with explicit resource/network/filesystem limits. Never run user code in the main application process or with unrestricted host access.
- Treat workflow content, external documents, web pages and integration payloads as untrusted input.
- Apply prompt-injection defenses and keep authorization outside model decisions.
- Redact sensitive input/output fields from logs by default.

### AI system
- Use a provider-agnostic abstraction; avoid locking product logic to one model vendor.
- Vercel AI SDK is the preferred TypeScript toolkit candidate; verify its current stable API and license before adopting.
- Implement structured outputs, tool schemas, explicit budgets, rate limits and usage metering.
- Route models by task complexity, quality, latency, cost and privacy.
- Keep human approval and policy evaluation in deterministic application code, never only in prompts.
- AI-generated workflows must pass the same schema validation and tests as manually created workflows.
- Record model/provider, usage, estimated cost and relevant decision metadata without logging secrets.
- Knowledge retrieval must enforce the same access controls as the source data.

### Desktop and Local Agent
- Tauri capabilities must follow least privilege.
- Do not expose unrestricted shell execution, filesystem access or arbitrary commands to the WebView.
- Local Agent permissions must be granular by device, folder, command, application and workflow.
- Sensitive local actions require explicit approval or a policy configured by the owner.
- Pair devices securely, use short-lived credentials and maintain an activity audit.
- The agent must be independently revocable.

### Commercial platform
- Plans: Free, Pro, Teams, Business and Enterprise.
- Revenue sources: subscriptions, usage-based execution, AI credits, marketplace and enterprise services.
- Keep plan limits and pricing configurable; do not hardcode commercial values across the codebase.
- Billing webhooks must be authenticated, idempotent and replay-safe.
- Display quotas, budgets and costs transparently; never create unexpected charges.
- Marketplace payments and creator commissions are future scope, not part of the first MVP.

## MVP boundaries

The first integrated MVP must support a complete user journey:
1. Sign up and create a workspace.
2. Connect an integration.
3. Create a workflow using AI or the visual editor.
4. Review and edit the generated workflow.
5. Validate and test it.
6. Activate and execute it in the cloud.
7. Inspect run status, logs and outputs.
8. Pause, edit and run a new version.
9. See usage and plan limits.

Initial integrations are the eight listed above, but each may start with a deliberately limited, documented set of actions.

The full Agent Studio, multi-agent collaboration, Marketplace transactions, advanced Knowledge Hub sync, full Local Agent, on-prem, SSO and enterprise SLAs are later roadmap capabilities. Do not simulate them as completed.

## Testing and validation

Use the test stack already present before adding alternatives:
- Vitest for unit and domain tests.
- Integration tests for database, API, queue and workflow runtime.
- Playwright for Web end-to-end flows.
- Maestro (or a verified current alternative) for Mobile E2E.
- Tauri-specific tests and platform smoke tests for Desktop.
- Typecheck, lint, tests and production build for every relevant application.
- Security tests for tenant isolation, authorization, SSRF, credential handling, webhook signatures, idempotency and approval policies.

Before adding a dependency, inspect the existing package manifest and verify compatibility with current framework versions.

## Git and delivery rules

- Work on a feature branch for meaningful changes.
- Use small commits with descriptive messages.
- Never force-push or rewrite shared history without explicit authorization.
- Do not commit secrets, local database files, build artifacts or user data.
- Keep `.env.example` limited to variable names and safe placeholders.
- Update docs when commands, environment variables, APIs or architecture change.
- Do not deploy to production or change billing/domain settings without explicit user approval.
- Provide a concise summary of changed files, tests actually run, test results, remaining risks and next step.

## Communication

- Respond in Portuguese (Portugal) unless the user asks otherwise.
- Keep explanations direct, structured and manageable.
- Give one next action at a time when the user needs to act.
- Do not repeatedly ask the user to choose between options. Make the best decision based on the agreed priorities: broad market reach, monetization potential, scalable architecture and realistic delivery.
- Ask for user input only for decisions that require personal/legal/financial authorization or cannot be responsibly inferred.
