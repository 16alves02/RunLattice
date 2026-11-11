# Backup and recovery runbook

**Status: procedure to implement and validate.** This document is an operational plan, not evidence that automated backups or a successful restore already exist.

## Recovery objectives

Choose and record service-specific targets before production:
- **RPO** (maximum acceptable data loss): decide based on the subscription and workflow guarantees.
- **RTO** (maximum acceptable recovery time): decide based on the service tier.
- Retention: define daily, weekly and monthly retention, including deletion and legal requirements.

Do not advertise an RPO/RTO until scheduled backups and restore drills have demonstrated them.

## What must be protected

| Asset | Why it matters | Required protection |
| --- | --- | --- |
| PostgreSQL database | Users, organizations, workflows, credentials ciphertext, runs and billing state | Automated encrypted backups plus point-in-time recovery where supported |
| INTEGRATION_ENCRYPTION_KEY | Decrypts stored integration credentials | Versioned secret-manager backup, separate from database backups |
| Better Auth secrets | Session and authentication security | Secret manager; never store in Git or in database dumps |
| Stripe and email provider secrets | Billing and transactional email | Secret manager with restricted access and rotation procedure |
| Redis/BullMQ | Pending/delayed jobs and scheduler state | Persistence and provider backups where available; define queue reconciliation after restore |
| Deployment configuration | Reproducible web and worker services | Version-controlled non-secret configuration and documented secret references |

A PostgreSQL dump without the matching integration encryption key is not a complete recovery set. Losing or rotating that key without re-encrypting existing credentials makes those credentials unreadable.

## Backup policy to configure

1. Enable automated PostgreSQL backups with encryption at rest and a retention policy.
2. Enable point-in-time recovery/WAL archiving if the database provider supports it and the chosen RPO requires it.
3. Keep at least one backup copy outside the primary database account or failure domain.
4. Enable Redis persistence (AOF or provider-managed persistence) if queued and scheduled jobs must survive Redis restarts. Confirm the provider's durability guarantees; a Redis snapshot alone is not a substitute for PostgreSQL backups.
5. Store all application secrets in a secret manager. Restrict access to named operators and record key versions.
6. Alert on failed or overdue backups. A green deployment is not proof that backups are running.
7. Never commit dumps, credentials, encryption keys, session secrets or production environment files.

## Restore procedure

Perform this in a staging environment first. A production restore requires an incident owner and an announced maintenance window.

1. Declare the incident, stop new workflow submissions and pause the worker/scheduler to prevent jobs running against inconsistent state.
2. Provision an isolated PostgreSQL instance and restore the selected backup/PITR target.
3. Restore the exact INTEGRATION_ENCRYPTION_KEY version that encrypted the stored credentials. Restore other required secrets from the secret manager.
4. Provision Redis and follow the chosen provider's documented recovery procedure. Do not blindly replay old BullMQ jobs: Discord delivery is non-idempotent and a message may already have been sent before the failure.
5. Deploy the matching application and worker version, apply only the migrations required by that release, then verify database connectivity and authentication.
6. Reconcile workflow runs against persisted run records and queue state. Treat ambiguous external side effects as requiring manual review; do not automatically replay them.
7. Verify a test workspace, workflow definitions, encrypted integration credentials, scheduler state, health endpoint and logs.
8. Resume workers and new submissions only after the incident owner approves the checks.

## Restore drill checklist

- [ ] Restore a recent PostgreSQL backup into an isolated environment.
- [ ] Confirm row counts and representative user, workspace, workflow and run records.
- [ ] Confirm the matching encryption key decrypts a test integration credential.
- [ ] Confirm credentials cannot be read through API responses or logs.
- [ ] Confirm Redis/BullMQ recovery does not duplicate non-idempotent Discord messages.
- [ ] Confirm scheduled triggers are reconciled and do not create duplicate schedules.
- [ ] Confirm authentication, authorization and billing state.
- [ ] Measure actual RPO and RTO.
- [ ] Record date, operator, backup identifier, application version, failures and corrective actions.

## Key rotation

Do not replace INTEGRATION_ENCRYPTION_KEY as a routine environment change. First implement and test a migration that decrypts each stored credential with the old key and re-encrypts it with the new key, with rollback and backup protection. Keep the old key available until the migration and restore tests are complete.

## Release gate

Do not describe RunLattice as production-ready until automated backup monitoring, secret recovery, a documented restore drill and security review have all been completed successfully.
