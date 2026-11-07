# RunLattice — Privacy Policy (draft for legal review)

**Status:** Draft only. Not approved for publication. Complete placeholders, verify production processing and obtain qualified legal review before launch.

**Last reviewed:** 7 November 2026

## 1. Controller
The controller is **[LEGAL ENTITY / FULL NAME]**, registered in **[COUNTRY]**, with address **[REGISTERED ADDRESS]** and contact **[PRIVACY EMAIL]**. Confirm the legal entity and contact details before publication.

## 2. Service
RunLattice is a workflow-automation service. Depending on features used, it processes account and workspace data, workflow definitions, execution history, integration credentials and billing identifiers. AI-assisted planning is optional and must remain disabled until configured and reviewed.

## 3. Data processed
- Account: name, email, authentication records, session identifiers and preferences.
- Workspace: names, memberships, roles and invitations.
- Automation: workflow definitions, triggers, execution inputs/outputs, statuses, timestamps and error information.
- Integrations: provider identifiers and credentials/tokens supplied by workspace administrators. Credentials are encrypted before storage and accessed server-side.
- Security/diagnostics: rate-limit records, request metadata, IP address/user-agent where collected, security events and operational logs.
- Billing: Stripe customer/subscription identifiers, plan and billing status. Full card details are handled by Stripe and are not intended to be stored by RunLattice.
- AI: only if enabled, prompts and workflow context required to generate a proposal may be sent to the configured AI provider. Do not submit secrets or sensitive personal data.

Confirm exact fields, log contents and retention against the deployed application before publication.

## 4. Purposes and legal bases
The controller must document the applicable GDPR Article 6 basis for each purpose. Intended mapping, subject to review:
- Account, authentication and core service: contract (Article 6(1)(b)).
- Workspace administration, workflow execution and support: contract and, where appropriate, legitimate interests (Articles 6(1)(b)/(f)).
- Security, abuse prevention and troubleshooting: legitimate interests (Article 6(1)(f)), subject to balancing.
- Billing and accounting: contract and legal obligations (Articles 6(1)(b)/(c)).
- Optional AI: enable only after deciding and documenting the legal basis, provider terms, data-processing terms, transfer safeguards and retention.

## 5. Processors and recipients
Intended providers include Supabase (PostgreSQL; project region EU West/Ireland), Railway (application/worker hosting; current Redis service in a US region), Stripe (payments once implemented) and an AI provider only if selected and enabled. Verify provider legal entities, sub-processors, processing regions and DPAs before publication. Do not claim all processing remains in the EEA.

## 6. International transfers
Some providers or infrastructure regions may process data outside the EEA. Identify each transfer and confirm a GDPR Chapter V mechanism (adequacy decision or Standard Contractual Clauses), transfer impact assessment where required and supplementary measures. The current Railway Redis region requires specific review.

## 7. Retention
Retention periods are **not yet finalized**. Define and implement periods for inactive accounts and sessions, workflows and run history, integration credentials, security/diagnostic logs, billing records, and backups. Delete or anonymize data when no longer necessary, subject to legal duties and backup rotation. Publish concrete periods or criteria only after implementation.

## 8. Security
The design includes server-side authentication and workspace authorization, encrypted integration credentials, signed webhook verification, rate limiting and database access controls. These controls must be validated in production. No measure guarantees absolute security.

## 9. Rights and complaints
Subject to GDPR conditions, individuals may request access, rectification, erasure, restriction, portability and objection, and withdraw consent where applicable. Contact **[PRIVACY EMAIL]**. The controller must verify identity and respond within statutory deadlines. In Portugal, complaints may be made to CNPD: https://www.cnpd.pt/.

## 10. Children
The service is intended for business/professional use, not children. Confirm age-related requirements before launch.

## 11. Cookies
Document cookies and local storage actually used, including authentication/security cookies and any analytics/marketing technologies. Non-essential analytics/marketing must not run without required consent. Cookie inventory and consent implementation require verification.

## 12. Changes and contact
Policy updates will include a revised date. Contact: **[PRIVACY EMAIL]**.

---

## Internal publication checklist — remove from public copy
- [ ] Confirm controller legal identity, registered address and privacy contact.
- [ ] Map all fields, logs, cookies, analytics and AI-provider payloads.
- [ ] Complete processor agreements and sub-processor review.
- [ ] Assess Railway US-region Redis and other non-EEA transfers.
- [ ] Define and implement retention, deletion and backup periods.
- [ ] Implement data access, export, correction and deletion requests.
- [ ] Confirm lawful bases, legitimate-interest assessment and consent needs.
- [ ] Complete DPIA screening and records of processing where required.
- [ ] Obtain qualified Portuguese/EU privacy legal review.
