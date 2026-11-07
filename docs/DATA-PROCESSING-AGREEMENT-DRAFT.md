# RunLattice — Data Processing Agreement (draft)

**Status:** Draft only. This is not a signed or legally approved Article 28 GDPR agreement. Complete the annexes, confirm subprocessors and security measures, and obtain qualified legal review before customer personal data is processed.

## 1. Parties and roles
This Agreement is between **[CUSTOMER LEGAL NAME]** ("Controller") and **[RUNLATTICE LEGAL ENTITY]**, **[REGISTERED ADDRESS / REGISTRATION]** ("Processor"). The Processor processes personal data on behalf of the Controller when the Controller uses RunLattice to build or execute workflows.

For account, billing, platform security and direct customer relationship data, RunLattice may act as an independent controller. The parties must map roles by processing purpose rather than assume all data is processor data.

## 2. Documented instructions
The Processor will process personal data only on documented instructions from the Controller, including instructions concerning transfers, unless required by applicable law. The Processor will inform the Controller of a legal requirement before processing unless law prohibits notice.

## 3. Processing description
- **Subject matter:** provision, hosting, security and support of the RunLattice workflow automation service.
- **Duration:** for the customer subscription and any agreed export/deletion period.
- **Nature and purpose:** storing workflow definitions and configuration, receiving trigger payloads, executing workflows, recording run status/results, and providing support/security.
- **Data subjects:** the Controller's users, employees, customers, suppliers and other individuals whose data the Controller places in workflows.
- **Personal data categories:** identifiers and contact details, account/workspace identifiers, user-generated workflow inputs/outputs, integration event payloads, technical identifiers and logs. Special-category data should not be submitted unless separately approved and legally supported.

## 4. Processor obligations
The Processor will:
- ensure persons authorized to process data are bound by confidentiality;
- implement appropriate technical and organizational measures;
- assist with data subject requests, security obligations, DPIAs and prior consultation where reasonably possible;
- notify the Controller without undue delay after becoming aware of a personal data breach affecting Controller data;
- make available information reasonably necessary to demonstrate compliance and allow audits on reasonable notice;
- delete or return personal data at the Controller's choice after service termination, unless law requires retention;
- not sell Controller personal data or use it for unrelated advertising.

## 5. Subprocessors
The Controller gives **[GENERAL / SPECIFIC]** authorization for subprocessors listed in Annex B. The Processor will provide advance notice of intended changes and a reasonable opportunity to object on data-protection grounds. The Processor remains responsible for subprocessors' performance of data-protection obligations.

The current intended provider categories include database hosting (Supabase), application/worker hosting and Redis (Railway), transactional email delivery (Resend), payment processing (Stripe, where applicable) and AI providers only where the Controller has explicitly enabled the feature. Confirm exact legal entities, locations, services, subprocessor lists and contract terms before execution.

## 6. International transfers
No transfer outside the EEA may occur without a valid GDPR Chapter V mechanism and required supplementary safeguards. The parties must document transfer locations, adequacy decisions or Standard Contractual Clauses, transfer impact assessments and supplementary measures in Annex B. Current infrastructure includes a Railway Redis service configured in a US region; this must be assessed and reflected in the final annex.

## 7. Security measures
The intended controls include:
- Better Auth authentication and server-side workspace authorization;
- role checks for owner/admin operations and workspace-scoped database predicates;
- PostgreSQL RLS enabled on all public application tables and no Data API table privileges for `anon`/`authenticated`;
- encryption of integration credentials at rest using AES-256-GCM;
- TLS for external service connections;
- signed HMAC webhook verification, replay-window checks and delivery deduplication;
- application rate limits, worker isolation and restricted secret access;
- operational logs and incident handling.

The Processor must verify which controls are active in the production environment before this Annex is signed. RLS and application controls do not replace one another.

## 8. Personal data breaches
The Processor will notify the Controller without undue delay after becoming aware of a breach, with available details including nature of the breach, affected categories/approximate numbers, likely consequences, mitigation and contact point. Information may be provided in phases as it becomes available.

## 9. Data retention and deletion
Retention periods and backup expiry must be defined in the service configuration and customer-facing documentation. At the end of services, the Controller may request export and deletion within **[DEFINED PERIOD]**, subject to legal retention duties and backup rotation of **[DEFINED PERIOD]**.

## 10. Audit and assistance
The Processor will provide reasonable information to demonstrate compliance and permit audits under agreed safeguards, including confidentiality, scope, frequency and cost allocation. The Processor will reasonably assist the Controller with data protection impact assessments and regulator consultations.

## Annex A — Processing details to complete
- Controller contact and DPO: **[DETAILS]**
- Processor contact and DPO: **[DETAILS]**
- Subject matter, duration, nature and purpose: confirm against actual customer workflows.
- Data subject categories and personal data types: confirm per customer use case.
- Special-category data: **[PROHIBITED / EXPLICITLY APPROVED WITH CONDITIONS]**
- Processing locations: **[VERIFIED REGIONS]**
- Retention/deletion periods: **[DEFINED PERIODS]**

## Annex B — Subprocessors and transfers to verify
| Provider | Service | Processing location | Transfer mechanism / DPA status |
|---|---|---|---|
| Supabase | PostgreSQL hosting | EU West (Ireland) project region | **[VERIFY LEGAL ENTITY, DPA AND SUBPROCESSORS]** |
| Railway | Web and worker hosting | **[VERIFY DEPLOYMENT REGION]** | **[VERIFY DPA AND TRANSFER MECHANISM]** |
| Railway | Redis | US region currently configured | **[TRANSFER ASSESSMENT REQUIRED]** |
| Resend | Verification and password-reset email | **[VERIFY]** | **[VERIFY DPA AND TRANSFER MECHANISM]** |
| Stripe | Subscription billing, when enabled | **[VERIFY]** | **[VERIFY DPA AND TRANSFER MECHANISM]** |
| AI provider | AI workflow planning, only if enabled | **[PROVIDER-DEPENDENT]** | **[VERIFY DPA, DATA USE AND TRANSFER TERMS]** |

## Annex C — Technical and organizational measures
Complete with verified production controls, access reviews, backup encryption, incident contacts, vulnerability management, recovery objectives and deletion procedures. Do not sign until the measures are tested and accurate.
