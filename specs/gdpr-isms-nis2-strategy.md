# GDPR · ISMS · Digitalsikkerhetsloven · NIS2 — Strategy & Implementation Plan

> **Prepared by:** Senior Architect + Senior Developer + PM + UX Designer + Entrepreneur review  
> **Date:** 2026-05-18  
> **Status:** `📋 draft — ready for team review`  
> **Branch:** `claude/gdpr-compliance-review-qyYkQ`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Standards Deep-Dive](#2-standards-deep-dive)
3. [Current System Audit — What We Already Have](#3-current-system-audit)
4. [Gap Analysis — Architect View](#4-gap-analysis)
5. [Architecture Extension Plan](#5-architecture-extension-plan)
6. [UX Design — New Surfaces](#6-ux-design)
7. [Competitor Analysis](#7-competitor-analysis)
8. [Entrepreneur Perspective — Business Value & Monetisation](#8-entrepreneur-perspective)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Open Questions](#10-open-questions)

---

## 1. Executive Summary

The platform already contains substantial GDPR and compliance infrastructure —
breach notifications to Datatilsynet, immutable audit logs, HMAC fingerprinting,
DPIA meeting templates, confidentiality levels, and a two-level taxonomy that
includes GDPR as a regulation. However, the coverage is fragmented and reactive
(bolt-on per feature) rather than structured around the three frameworks that
matter most to Norwegian organisations in 2026:

| Framework | Norwegian anchor | Who it hits |
|---|---|---|
| **GDPR / Personopplysningsloven** | Datatilsynet-veileder | Every org with personal data |
| **Digitalsikkerhetsloven (DSL)** | NSM + Nkom | Operators of essential services + DSPs |
| **NIS2 Directive (EU 2022/2555)** | Transposition deadline Sept 2024 | Same as DSL + expanded sectors |
| **ISO/IEC 27001:2022 (ISMS)** | Certification body | Orgs seeking certification / supplier approval |

**The strategic move:** build a unified **Trust & Security** module cluster that
sits _above_ the existing compliance, documents, meetings, tasks, and learning
modules — wiring them together as evidence sources — rather than recreating
their data in a silo.

Key new surfaces to build:
- **Privacy Hub** (GDPR/ROPA manager, DPIA tracker, subject-rights portal)  
- **ISMS Hub** (ISO 27001 Annex A control catalogue, risk register, SoA)  
- **NIS2 Hub** (incident management, supply-chain register, regulatory reporting)  
- **Trust Dashboard** (unified board-level KPI view across all three frameworks)

Estimated commercial uplift: **2–3× ARPU** for enterprise and regulated-sector
customers who today buy separate specialist tools (OneTrust, Riskmanager, etc.)
at €5 000–50 000/year. Payback on development: within 2 product quarters if
bundled into a "Sikkerhetsmodul" add-on at ~€299/month per org.

---

## 2. Standards Deep-Dive

### 2.1 GDPR + Personopplysningsloven

**What it requires (controller obligations):**

| Article | Obligation | Artefact type |
|---|---|---|
| Art. 5 | Seven principles (lawfulness, fairness, transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity/confidentiality, accountability) | Policy document |
| Art. 13/14 | Privacy notices to data subjects | Published document |
| Art. 15–22 | Data subject rights (access, rectification, erasure, portability, restriction, objection, profiling) | Request workflow |
| Art. 25 | Privacy by design & default | Architecture decision log |
| Art. 28 | Data processor agreements (DPA) with sub-processors | Contract register |
| Art. 30 | Records of Processing Activities (ROPA) | Structured register |
| Art. 32 | Technical & organisational measures (TOMs) | Control catalogue |
| Art. 33 | Breach notification to supervisory authority within 72h | Incident workflow |
| Art. 34 | Breach notification to data subjects | Notification log |
| Art. 35 | Data Protection Impact Assessment (DPIA) | Assessment workflow |
| Art. 36 | Prior consultation with authority when DPIA shows high risk | Authority comms log |
| Art. 37–39 | DPO appointment, tasks, contact | Person + calendar |
| Art. 44–49 | Cross-border transfer mechanisms (SCCs, BCRs, Adequacy) | Transfer register |
| Art. 83 | Fines up to €20M / 4% global turnover | Risk register input |

**Datatilsynet-specific guidance (Norwegian):**
- Veileder: Internkontroll og informasjonssikkerhet
- Veileder: Behandlingsgrunnlag
- Veileder: Databehandleravtaler
- Krav: Annual reporting for certain controllers
- Krav: DPO registration in Datatilsynet's portal (API available)

### 2.2 Digitalsikkerhetsloven (DSL) — NIS implementation in Norway

Enacted 2019, implements the original NIS Directive. Applies to:
- **Operators of essential services (OES):** energy, transport, health, water, banking, financial market infrastructure, digital infrastructure
- **Digital service providers (DSPs):** cloud, online marketplace, search engines

**Core security requirements (§ 10):**
1. Risk analysis — proportionate technical + organisational measures
2. Incident management — detection, response, recovery
3. Business continuity — backup, disaster recovery, crisis management
4. Supply chain — security in procurement and vendor management
5. Network/system security — acquisition, development, maintenance
6. Vulnerability and patch management
7. Encryption and cryptographic controls
8. Human resources security + access control + asset management

**Incident reporting (§ 11):** significant incidents to NSM (National Security Authority)
within 24h (early warning) + 72h full report + 1 month final.

### 2.3 NIS2 Directive (EU 2022/2555)

Replaces NIS1. Norwegian implementation expected through DSL amendment.

**Expanded scope** — 18 sectors split into:
- **Essential entities (EE):** energy, transport, banking, financial markets, health, drinking water, wastewater, digital infrastructure, ICT service management, public administration, space
- **Important entities (IE):** postal, waste management, chemicals, food, manufacturing (medical devices, electronics, machinery, motor vehicles), digital providers, research

**Enhanced requirements:**
- **Art. 21 — Cybersecurity risk-management measures (10 categories):**
  1. Policies for risk analysis + information system security
  2. Incident handling
  3. Business continuity, backup, DR, crisis management
  4. Supply chain security (including software dependencies)
  5. Security in network/system acquisition, development, maintenance (incl. vulnerability handling + disclosure)
  6. Policies to assess effectiveness of cybersecurity measures
  7. Basic cyber hygiene practices + cybersecurity training
  8. Cryptography + encryption policies
  9. Human resources security + access control + asset management
  10. Multi-factor authentication + continuous authentication + secure communications

- **Art. 23 — Incident reporting:** 
  - 24h: early warning ("significant incident")
  - 72h: incident notification (initial assessment + severity)
  - 1 month: final report (full description, impact, root cause, remediation)

- **Art. 20 — Governance:**
  - Management bodies approve + oversee cybersecurity risk-management
  - Board-level training on cybersecurity risks
  - Board members personally liable for non-compliance

- **Art. 32/33 — Supervision:** EEs subject to ex-ante supervision; IEs to ex-post.

- **Art. 26 — Peer reviews:** Voluntary EU-wide peer review mechanism.

### 2.4 ISO/IEC 27001:2022 — ISMS

**Clause structure (must implement all):**

| Clause | Requirement |
|---|---|
| 4. Context | Internal/external issues, interested parties, scope definition |
| 5. Leadership | Policy, roles/responsibilities, board commitment |
| 6. Planning | Risk assessment methodology, risk treatment plan, objectives |
| 7. Support | Resources, competence, awareness, communication, documented information |
| 8. Operation | Risk assessment execution, risk treatment execution |
| 9. Performance evaluation | Monitoring, measurement, internal audit, management review |
| 10. Improvement | Nonconformity + corrective action, continual improvement |

**Annex A (2022 edition — 93 controls in 4 themes):**

| Theme | Controls | Examples |
|---|---|---|
| 5. Organisational (37) | Policies, roles, threat intelligence, supplier relations, BCP | 5.1 InfoSec policies, 5.9 Asset inventory, 5.19 Supplier security, 5.29 BCP |
| 6. People (8) | Screening, terms, awareness, training, disciplinary, offboarding | 6.3 InfoSec awareness, 6.5 Responsibilities after termination |
| 7. Physical (14) | Perimeter, entry, offices, equipment, media | 7.1 Physical security perimeter, 7.14 Secure disposal |
| 8. Technological (34) | Endpoint, identity, crypto, backup, vulnerability, monitoring | 8.2 Privileged access, 8.8 Vulnerability management, 8.16 Monitoring |

**Statement of Applicability (SoA):** Every control must be marked applicable/not-applicable with justification. Exclusions must be documented and risk-justified.

---

## 3. Current System Audit

### 3.1 What Already Exists (mapped to standards)

#### GDPR Coverage — Current State

| GDPR Requirement | Current Coverage | Assessment |
|---|---|---|
| Art. 30 ROPA | ❌ No dedicated register | Gap — need privacy_processing_activities register type |
| Art. 28 Processor agreements | ❌ No contract register | Gap |
| Art. 33 Breach notification | ✅ **Alerts module** + `gov-datatilsynet-breach` Edge Function + 72h workflow | Strong — already sends to Datatilsynet |
| Art. 34 Subject notification | ⚠ Partial — alerts can log it, no templated subject letter | Partial |
| Art. 35 DPIA | ✅ **Meetings module** — `gdpr-dpia` meeting template | Partial — template exists, no DPIA workflow |
| Art. 37 DPO | ⚠ Partial — no DPO register or calendar integration | Partial |
| Art. 13/14 Privacy notices | ✅ **Documents module** — privacy notice templates | Good — system template exists |
| Art. 32 TOMs | ⚠ Partial — compliance checklists can cover this | Fragmented |
| Art. 44 Transfer register | ❌ Missing | Gap |
| Data subject rights (15–22) | ❌ No DSR workflow | Gap |
| Art. 25 Privacy by design | ❌ No design decision log | Gap |
| Retention management | ✅ `next_revision_due_at` on wiki_pages, deletion footer | Good |
| Consent management | ❌ No consent register | Gap |

#### ISO 27001 Coverage — Current State

| Clause / Annex A Control | Current Coverage | Assessment |
|---|---|---|
| 5.1 InfoSec policy | ✅ Documents module + policy templates | Good |
| 5.9 Asset inventory | ⚠ Register module can hold assets but no dedicated type | Partial |
| 5.19 Supplier security | ❌ No supplier register | Gap |
| 5.29 Business continuity | ❌ No BCP register | Gap |
| 6. Planning — risk assessment | ✅ **Risk module** (ROS register) | Strong |
| 7.2 Competence | ✅ **E-learning** — completions + certifications | Strong |
| 7.3 Awareness | ✅ E-learning awareness courses | Good |
| 7.5 Documented information | ✅ Documents + wiki + version control | Good |
| 8.1 Operational planning | ✅ Tasks + workflow engine | Good |
| 9.1 Monitoring | ✅ Analytics dashboard engine | Good |
| 9.2 Internal audit | ⚠ Compliance checklists approximate this | Partial |
| 9.3 Management review | ✅ Meetings module — ISO 27001 §9.3.2 template (gated) | Partial |
| 10. Improvement | ✅ Tasks for nonconformities | Good |
| 8.2 Privileged access rights | ❌ Not tracked in system | Gap |
| 8.8 Vulnerability management | ❌ No vulnerability register | Gap |
| 8.16 Monitoring activities | ❌ Alerts/log monitoring not tracked | Gap |
| Statement of Applicability | ❌ No SoA builder | Gap — critical for certification |

#### NIS2 / DSL Coverage — Current State

| NIS2 Art. 21 Category | Current Coverage | Assessment |
|---|---|---|
| 1. Risk analysis + security policies | ✅ Risk module + compliance checklists | Strong |
| 2. Incident handling | ✅ Alerts module + workflow | Good |
| 3. BCP/DR/backup | ❌ No BCP register | Gap |
| 4. Supply chain security | ❌ No supplier security register | Gap |
| 5. System security (acquisition/dev/maintenance) | ❌ No SDLC control register | Gap |
| 6. Effectiveness assessment | ⚠ Analytics dashboard approximates this | Partial |
| 7. Cyber hygiene + training | ✅ E-learning + compliance checklists | Strong |
| 8. Cryptography + encryption | ❌ No crypto policy tracker | Gap |
| 9. HR security + access + assets | ⚠ Partial (tasks, org chart, no formal register) | Partial |
| 10. MFA + secure communications | ❌ No MFA compliance checker | Gap |
| Art. 23 Incident reporting | ✅ Alerts + gov reporting Edge Functions | Good |
| Art. 20 Board governance | ⚠ Meetings module board review template | Partial |
| Art. 26 Peer review | ❌ No peer-review coordination | Gap |

### 3.2 Existing Strengths to Build On

1. **Alerts module** — GDPR breach workflow + Datatilsynet integration is production-ready.  
   Extend: add subject-rights request workflow, add NIS2 incident timeline.

2. **Workflow engine** — TSA-anchored, tamper-evident, confidentiality-gated.  
   Extend: wire DPIA approval workflow, SoA change-control workflow.

3. **Registers (catalogue)** — `register_types` with `regulation_ids[]` already supports GDPR, AML, ISO 45001.  
   Extend: add 8 new system register types (ROPA, DPA contracts, assets, vulnerabilities, suppliers, transfers, DSR, crypto-keys).

4. **Documents module** — `legal_basis text[]` + system templates + version history.  
   Extend: add GDPR-specific document types (DPIA template v2, SCCs, Art. 13/14 notices).

5. **Risk module (ROS)** — existing risk register.  
   Extend: wire into ISO 27001 §6 risk treatment plan + NIS2 risk assessment cadence.

6. **Two-level taxonomy** — GDPR already in `regulations` table.  
   Extend: add ISO 27001, NIS2, Digitalsikkerhetsloven as regulation rows.

7. **Meeting templates** — ISO 27001 §9.3.2 (gated), GDPR DPIA, GDPR Art. 30 review.  
   Extend: complete gated templates, add ISMS internal audit template, NIS2 board review.

8. **Gap planner** — data layer exists, UI planned.  
   Extend: make multi-regulation from day one (OQ-P1 answer: parameterise now — GDPR + ISO 27001 + NIS2 are all natural consumers).

---

## 4. Gap Analysis — Architect View

### 4.1 Critical Gaps (certification blockers)

These must exist before an org can claim GDPR compliance or ISO 27001 certification:

| Gap | Impact | Effort | Priority |
|---|---|---|---|
| **ROPA (Art. 30)** — no Records of Processing Activities | Datatilsynet inspection blocker | M | P0 |
| **SoA builder** — no Statement of Applicability | ISO 27001 certification impossible | L | P0 |
| **DSR workflow** — no Data Subject Rights request tracking | GDPR compliance gap | M | P0 |
| **DPIA workflow** — template exists but no structured workflow | Art. 35 gap | M | P1 |
| **Supplier/DPA register** — no Art. 28 contract register | GDPR + NIS2 gap | M | P1 |
| **Asset inventory** — no ISO 27001 §5.9 register | ISMS prerequisite | S | P1 |
| **Vulnerability register** — no §8.8 control | ISMS + NIS2 gap | S | P1 |
| **NIS2 incident timeline** — 24h/72h/1-month reporting structure | DSL §11 / NIS2 Art. 23 | S | P1 |

### 4.2 Significant Gaps (hamper completeness scores)

| Gap | Impact | Effort |
|---|---|---|
| Transfer mechanism register (Art. 44) | Third-country transfer compliance | S |
| Consent register | GDPR completeness | M |
| Crypto/key management policy tracker | ISO 27001 §8.12, NIS2 Art. 21(8) | S |
| BCP/DR register | NIS2 Art. 21(3) + ISO 27001 §5.29 | M |
| Internal audit scheduling + report | ISO 27001 Clause 9.2 | M |
| Board training tracker (NIS2 Art. 20) | Board liability | S |
| DPO contact register + task calendar | Art. 37–39 | S |
| Privacy notice version registry | Art. 13/14 + accountability | S |
| Cross-border transfer register | Art. 44–49 | S |

### 4.3 Architecture Decisions

**Decision 1: Don't build a silo — wire existing modules as evidence.**

The platform already has the execution layer. New modules should be
_coordination layers_ that pull evidence from existing sources rather than
duplicating data. Pattern: same as the Compliance Gap Planner (5.1–5.5)
where the gap matrix reads `law_refs[]` from 5 existing tables.

**Decision 2: Answer OQ-P1 from compliance-planner.md now.**

The planner should be multi-regulation from day one. Parameterise on
`regulation_id` (already a FK concept via `regulations.id`). The same
gap matrix UI works for AML, GDPR, ISO 27001, and NIS2 — just filter by
regulation. This is the better abstraction.

**Decision 3: Three new Hub pages, one Trust Dashboard.**

```
/trust                      ← Board-level Trust Dashboard (composite scope)
/trust/privacy              ← Privacy Hub (GDPR + Datatilsynet)
/trust/isms                 ← ISMS Hub (ISO 27001)
/trust/nis2                 ← NIS2 / DSL Hub
```

All three hubs follow the existing module architecture:
`<Hub>AnalysePage` + `use<Hub>Datasets` + registered dashboard scope.

**Decision 4: Extend Register module, not replace it.**

Add 8 new system register types via seed migration. Same `register_types`
engine, same `register_records` table. Zero new schema for the data layer.

**Decision 5: ROPA gets a first-class form, not a free-form register.**

Art. 30 requires specific fields (controller, purpose, legal basis, categories of
data subjects, categories of recipients, retention periods, technical measures).
Model as a structured register type with `field_schema` (like `metadata_schema`
on templates). ROPA records render in a dedicated ROPA view, not the generic
register UI.

---

## 5. Architecture Extension Plan

### 5.1 New Regulation Seeds

```sql
-- supabase/migrations/20260920120000_regulations_gdpr_isms_nis2.sql
insert into regulations (id, organization_id, name, short_name, url, sort_order)
values
  ('iso-27001',        null, 'ISO/IEC 27001:2022',              'ISO 27001',    'https://www.iso.org/standard/27001', 10),
  ('nis2',             null, 'NIS2-direktivet (EU 2022/2555)',   'NIS2',         'https://eur-lex.europa.eu/nis2', 11),
  ('digitalsikkerhetslov', null, 'Digitalsikkerhetsloven',       'DSL',          'https://lovdata.no/dsl', 12),
  ('personopplysingsloven', null, 'Personopplysningsloven 2018', 'POL',          'https://lovdata.no/pol', 13)
on conflict (id) do update set name = excluded.name;
```

### 5.2 New Register Types (8 system types)

Seeded via migration following the `register_types` pattern from `registers-engine.md`.

| slug | Name | Key fields | law_refs |
|---|---|---|---|
| `gdpr_ropa` | Behandlingsaktiviteter (Art. 30) | controller, purpose, legal_basis, data_categories, recipients, retention, technical_measures, cross_border | GDPR Art. 30 |
| `gdpr_dpa_contracts` | Databehandleravtaler (Art. 28) | processor_name, processor_country, processing_purpose, dpa_date, sub_processors, termination_date, risk_level | GDPR Art. 28 |
| `gdpr_dsr_requests` | Personvernhenvendelser (Art. 15–22) | subject_name, request_type, received_at, deadline_at, status, response_sent_at, legal_basis_for_refusal | GDPR Art. 15–22 |
| `gdpr_transfers` | Overføringer til tredjeland (Art. 44) | recipient_country, transfer_mechanism, scc_version, adequacy_decision, safeguards | GDPR Art. 44–49 |
| `isms_assets` | Informasjonsmidler (ISO 27001 §5.9) | asset_name, asset_type, owner, classification, location, criticality, last_reviewed_at | ISO 27001 Annex A 5.9 |
| `isms_vulnerabilities` | Sårbarheter (ISO 27001 §8.8) | cve_id, affected_asset, severity, cvss_score, discovered_at, remediation_status, patched_at | ISO 27001 Annex A 8.8 |
| `isms_suppliers` | Leverandørsikkerhet (NIS2 Art. 21 §4) | supplier_name, criticality, security_assessment_date, contract_expiry, sla_security_requirements, last_audit_at | NIS2 Art. 21(4), ISO 27001 A5.19 |
| `nis2_incidents` | Hendelsesregister (NIS2 Art. 23) | incident_title, severity, detected_at, early_warning_sent_at, notification_sent_at, final_report_sent_at, affected_services, root_cause | NIS2 Art. 23, DSL §11 |

### 5.3 ROPA — Structured View

Because Art. 30 ROPA has a fixed schema required by regulators, wrap the
`gdpr_ropa` register type in a dedicated ROPA page that renders a formatted
table matching Datatilsynet's recommended layout. Export to PDF + Excel.

File targets:
```
src/pages/trust/privacy/RopaPage.tsx
src/hooks/useRopaRecords.ts
```

ROPA view columns: Aktivitet → Formål → Rettslig grunnlag → Kategorier registrerte
→ Mottakere → Overføringer → Slettefrist → Tekniske tiltak → Status

### 5.4 Statement of Applicability (SoA) Builder

ISO 27001 certification requires a SoA covering all 93 Annex A controls.
Each control: Applicable (yes/no) + Justification + Implementation status
+ Evidence link (to register record, document, checklist execution, or task).

New table:
```sql
create table isms_soa_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  control_id text not null,              -- e.g. 'A.5.1', 'A.8.8'
  control_name text not null,
  theme text not null,                   -- 'organisational'|'people'|'physical'|'technological'
  applicable boolean not null default true,
  exclusion_justification text,
  implementation_status text,            -- 'not_started'|'planned'|'partial'|'implemented'|'verified'
  evidence_type text,                    -- 'checklist'|'document'|'register'|'task'|'meeting'
  evidence_id uuid,
  owner_user_id uuid references auth.users(id),
  last_reviewed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Seeded with all 93 controls (hardcoded ISO 27001:2022 Annex A catalogue).
Org-specific rows created by `provision_isms_baseline_for_org()`.

### 5.5 DPIA Workflow

A DPIA is a structured 8-step process (Art. 35). Model as a workflow instance,
not a free-form document:

```
Step 1: Necessity check (threshold assessment — is DPIA required?)
Step 2: Describe processing (purpose, nature, scope, context)
Step 3: Assess necessity + proportionality
Step 4: Identify + assess risks (to data subjects)
Step 5: Define measures (technical + organisational)
Step 6: DPO consultation
Step 7: Final approval (by controller management)
Step 8: Monitor + review schedule
```

Model: new `gdpr_dpias` table with `workflow_run_id` FK — the workflow engine
drives the DPIA through approval gates. Meeting template `gdpr-dpia` → trigger
the DPIA workflow.

### 5.6 NIS2 Incident Timeline

The alerts module handles GDPR breaches. Extend it to handle NIS2 security
incidents with the three-stage reporting timeline:

```
T+0h:  Incident detected → create nis2_incident record
T+24h: Early warning deadline → auto-task + workflow notification
T+72h: Full notification deadline → NSM report submission
T+30d: Final report deadline → Nkom/NSM follow-up
```

New alert type: `nis2_incident` (alongside existing `gdpr_breach`, `whistleblowing`).
The `gov-outbox-worker` Edge Function handles submission routing.

### 5.7 Trust Dashboard — Composite Scope

New composite dashboard scope pulling KPIs from all three hubs:

```typescript
// src/pages/trust/dashboards/trustDashboardScope.ts
registerDashboardScope({
  scopeId: 'trust',
  label: 'Trust & Security',
  compositeMembers: ['trust_privacy', 'trust_isms', 'trust_nis2'],
  accent: '#1e1b4b',  // Deep indigo — "security layer"
  defaultLayout: [...]
})
```

KPI widgets:
- GDPR: ROPA coverage %, open DSR requests, DPIA backlog, days since last breach
- ISMS: SoA completion %, open nonconformities, days until next internal audit, risk treatment completion
- NIS2: Incident response time (last), supplier assessment coverage %, training completion for board

---

## 6. UX Design

### 6.1 Information Architecture — Updated Sidebar

```
HMS-oversikt
Sjekklister
Undersøkelser
Dokumenter
Møter
Register
Oppgaver
Læring
─────────────────── NEW ───────────────────
🔒 Trust & Security          ← new top-level group
   ├─ Oversikt                (Trust Dashboard — composite)
   ├─ Analyse
   ├─ Personvern              (Privacy Hub — GDPR)
   │   ├─ Behandlingsprotokoll (ROPA)
   │   ├─ DPIA-register
   │   ├─ Personvernhenvendelser (DSR)
   │   ├─ Databehandleravtaler
   │   └─ Overføringer
   ├─ Informasjonssikkerhet   (ISMS Hub — ISO 27001)
   │   ├─ Styringssystem (SoA)
   │   ├─ Risikostyring
   │   ├─ Informasjonsmidler
   │   ├─ Sårbarheter
   │   └─ Internrevisjoner
   ├─ NIS2 / Digital sikkerhet
   │   ├─ Hendelsesregister
   │   ├─ Leverandørsikkerhet
   │   ├─ BKP & Kontinuitet
   │   └─ Rapportering
   └─ Innstillinger
```

### 6.2 Trust Dashboard — Board-Level View

```
╔══════════════════════════════════════════════════════════════════════╗
║  🔒 Trust & Security                              [Eksporter PDF]   ║
║  Compliance-oversikt for styret — Q2 2026                           ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  PERSONVERN (GDPR)              INFORMASJONSSIKKERHET (ISMS)        ║
║  ┌──────────┐ ┌──────────┐      ┌──────────┐ ┌──────────┐         ║
║  │ ROPA     │ │ Åpne DSR │      │ SoA      │ │ Risiko-  │         ║
║  │ 87%      │ │ 3        │      │ 71%      │ │ behandl. │         ║
║  │ dekning  │ │ henvendel│      │ fullført  │ │ 82%      │         ║
║  └──────────┘ └──────────┘      └──────────┘ └──────────┘         ║
║                                                                      ║
║  ┌──────────┐ ┌──────────┐      ┌──────────┐ ┌──────────┐         ║
║  │ DPIA     │ │ Siden    │      │ Neste    │ │ Åpne     │         ║
║  │ backlog  │ │ siste    │      │ intern-  │ │ avvik    │         ║
║  │ 2        │ │ brudd:   │      │ revisjon │ │ 5        │         ║
║  │          │ │ 127 d    │      │ 23 d     │ │          │         ║
║  └──────────┘ └──────────┘      └──────────┘ └──────────┘         ║
║                                                                      ║
║  NIS2 / DIGITAL SIKKERHET       OPPLÆRING & BEVISSTHET             ║
║  ┌──────────┐ ┌──────────┐      ┌──────────────────────┐          ║
║  │ Hendels- │ │ Leveran- │      │ Cybersecurity-kurs   │          ║
║  │ er (90d) │ │ dør-     │      │ Styre: 3/5 fullført  │          ║
║  │ 1        │ │ dekning  │      │ Ansatte: 89%         │          ║
║  │          │ │ 68%      │      │ ████████░░ 89%       │          ║
║  └──────────┘ └──────────┘      └──────────────────────┘          ║
║                                                                      ║
║  Reguleringsdekning per rammeverk                                   ║
║  ┌─────────────────────────────────────────────────────────┐       ║
║  │ GDPR        ████████████████░░░░░ 78%  (18/23 krav)    │       ║
║  │ ISO 27001   ████████████░░░░░░░░ 61%  (57/93 kontroll) │       ║
║  │ NIS2        ███████████████░░░░░ 73%  (8/11 kategorier)│       ║
║  │ DSL         ████████████████████ 90%  (9/10 krav)      │       ║
║  └─────────────────────────────────────────────────────────┘       ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 6.3 Privacy Hub — ROPA View

```
╔══════════════════════════════════════════════════════════════════════╗
║  Behandlingsprotokoll (Art. 30)         [+ Ny aktivitet] [Eksport] ║
╠══════════════════════════════════════════════════════════════════════╣
║  Filter: [Alle formål ▼] [Alle rettslige grunnlag ▼] [Status ▼]   ║
╠══════════════════════════════════════════════════════════════════════╣
║  Aktivitet               Formål          Grunnlag      Slettefrist ║
║  ────────────────────────────────────────────────────────────────── ║
║  ▶ HR-personaldata        Ansettelse      Art. 6(1)(b)  7 år      ║
║    Lønnsbehandling        Lønn            Art. 6(1)(c)  5 år      ║
║    Kundedata CRM          Salg            Art. 6(1)(a)  3 år      ║
║  ▶ Rekruttering           Utvelgelse      Art. 6(1)(b)  6 mnd     ║
║    Kursgjennomføring      Opplæring       Art. 6(1)(b)  2 år      ║
║    Varslingskanal         Undersøkelse    Art. 6(1)(c)  3 år      ║
║    Sykefraværsoppfølging  Personalledelse Art. 9(2)(b)  Varig     ║
╠══════════════════════════════════════════════════════════════════════╣
║  7 aktiviteter  |  3 med høy risiko  |  2 mangler DPIA  |  1 utløpt║
╚══════════════════════════════════════════════════════════════════════╝
```

### 6.4 ISMS Hub — SoA Builder

```
╔══════════════════════════════════════════════════════════════════════╗
║  Anvendelseserklæring (SoA)  ISO 27001:2022    [Eksporter SoA PDF] ║
╠══════════════════════════════════════════════════════════════════════╣
║  [Organisatorisk ●] [Personell] [Fysisk] [Teknologisk]  Søk: ___ ║
╠══════════════════════════════════════════════════════════════════════╣
║  Implementert: 34/37   Delvis: 2   Ikke påbegynt: 1  Utelatt: 0   ║
║  ████████████████████████████████░░░░░ 92%                          ║
╠══════════════════════════════════════════════════════════════════════╣
║  Kontroll               Status         Eier          Bevis         ║
║  ─────────────────────────────────────────────────────────────────  ║
║  5.1  Retningslinjer    ✅ Implementert  Lars N.       [Dokument →] ║
║  5.2  Informasjonssikk. ✅ Implementert  Maria K.      [Dokument →] ║
║  5.9  Eiendelsinventar  🟡 Delvis        —             [Register →] ║
║  5.19 Leverandørsikkert ✅ Implementert  IT-avd        [Register →] ║
║  5.29 BCP              ⚪ Ikke påbegynt  —             [+ Legg til] ║
║  8.2  Privilegert tilg. ✅ Implementert  IT-avd        [Oppgave →]  ║
║  8.8  Sårbarhetsstyring ✅ Implementert  IT-avd        [Register →] ║
╠══════════════════════════════════════════════════════════════════════╣
║  [< Forrige]  Kontroll 5.9 av 37 org.   [Neste kontroll >]        ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 6.5 NIS2 Incident Timeline

```
╔══════════════════════════════════════════════════════════════════════╗
║  Hendelse: Ransomware-forsøk 2026-05-12         [Lukk hendelse]    ║
╠══════════════════════════════════════════════════════════════════════╣
║  Alvorlighet: 🔴 Kritisk   Status: Pågående                        ║
╠══════════════════════════════════════════════════════════════════════╣
║  Rapporteringsfrist                                                  ║
║                                                                      ║
║  T+0h   ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●     ║
║  12. mai ┃                                               T+30d      ║
║  14:32   ┃                                               Sluttrapport║
║          ┃                                                           ║
║         T+24h                   T+72h                               ║
║     ✅ Tidlig varsling     ✅ Hendelsesmelding             📋 Venter║
║     13. mai 08:15          14. mai 14:32                             ║
║     NSM mottatt            NSM mottatt                               ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  Tidslinje                                                           ║
║  12.05 14:32  Hendelse oppdaget av SOC-alarm                        ║
║  12.05 15:00  Isolert kompromitterte systemer                       ║
║  13.05 08:15  ✅ Tidlig varsling sendt til NSM                       ║
║  13.05 10:00  Forensic-analyse startet                              ║
║  14.05 14:32  ✅ Fullstendig hendelsesmelding sendt til NSM          ║
║  Pågående     Sluttrapport forfaller 11. juni 2026                  ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 6.6 DSR Portal — Data Subject Rights Workflow

```
╔══════════════════════════════════════════════════════════════════════╗
║  Personvernhenvendelser (Art. 15–22)       [+ Registrer henvendelse]║
╠══════════════════════════════════════════════════════════════════════╣
║  3 åpne  |  Snitt svartid: 8 d  |  Alle løst i tide: 94%          ║
╠══════════════════════════════════════════════════════════════════════╣
║  Ref.      Type         Mottatt       Frist         Status          ║
║  ──────────────────────────────────────────────────────────────────  ║
║  DSR-2026-031  Innsyn   2026-05-10   2026-06-09   🟡 Under beh.    ║
║  DSR-2026-029  Sletting 2026-05-03   2026-06-02   ✅ Bekreftet      ║
║  DSR-2026-028  Portabil 2026-04-30   2026-05-30   🔴 Forfaller om 3d║
║  DSR-2026-025  Innsyn   2026-04-15   2026-05-15   ✅ Besvart        ║
╠══════════════════════════════════════════════════════════════════════╣
║  Workflow for DSR-2026-031 (Innsynsbegjæring)                       ║
║  [1. Mottatt] → [2. Identitetsverifisering] → [3. Datainnsamling]  ║
║                → [4. Jurist-review] → [5. Svar] → [6. Lukket]     ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 6.7 GDPR Compliance Score Widget (for HMS-oversikt composite)

```
┌────────────────────────────────────────┐
│  🔒 GDPR-status                        │
│                                         │
│  ROPA          ████████░░  78%         │
│  DPIA          ██████████  100%        │
│  DSR-respons   █████████░  94%         │
│  Opplæring     ████████░░  89%         │
│                                         │
│  Samlet score  ████████░░  88%         │
│  Sist oppdatert: i dag                 │
└────────────────────────────────────────┘
```

---

## 7. Competitor Analysis

### 7.1 Market Landscape

The compliance/ISMS SaaS market is large and fragmented. Key segments:

**Tier 1 — Enterprise (€20k–200k/year):**
- **OneTrust** — Privacy + GRC. Market leader. Bloated UI, complex setup. Weakness: overkill for SME.
- **ServiceNow GRC** — Integrated with ITSM. Weakness: requires ServiceNow platform.
- **IBM OpenPages** — Deep audit/risk. Weakness: legacy architecture, expensive.

**Tier 2 — Mid-market (€3k–20k/year):**
- **Qualys VMDR** — Vulnerability management. No compliance narrative.
- **Vanta** — SOC2/ISO compliance automation. Strong developer focus. Weakness: no Norwegian regulations, no Norwegian language.
- **Sprinto** — Compliance automation (SOC2, ISO 27001). Fast-growing. Weakness: no GDPR depth, no NIS2, no Norwegian.
- **Drata** — Compliance automation. US-focused.
- **TrustCloud** — Trust center + compliance. Weakness: English-only, US-law focus.

**Tier 3 — Norwegian/Nordic market (€1k–10k/year):**
- **Riskmanager.no** — Norwegian ROS/risk. Feature-poor, dated UI. Market incumbent.
- **Compilo** — Norwegian HMS + quality + risk. AML + ISO 45001 focus. Closest competitor.
- **Qm+ (Quality Manager)** — Norwegian quality + HSE. Long-established.
- **Safetec** — Consulting + tool. No self-service.
- **Infoguard / Tripwire** — NIS2/ISMS tools. Enterprise pricing, no NB.

**Niche competitors:**
- **Cookiebot/CookiePro** — Consent management only.
- **DataGrail** — DSR automation. English-only.
- **Osano** — Privacy management. English-only.
- **Aptible** — Healthcare compliance. Niche.

### 7.2 Features Worth Copying (and improving)

| Feature | Source | Our advantage |
|---|---|---|
| **Evidence automation** — auto-pull evidence from integrations (GitHub, AWS, Jira) | Vanta, Drata | We already have evidence from our own modules — compliance checklist executions, meetings, e-learning completions, tasks. Zero integration needed. |
| **Compliance score % by framework** | Sprinto, Vanta | Implement with our gap planner + regulation coverage. Add drill-down (competitors don't have this). |
| **Trust center** — public-facing compliance status page | TrustCloud, Vanta | Build as a public `/trust/:org-slug` page. Powered by auditor-token mechanism already in our alerts module. |
| **Control library** — pre-mapped controls to frameworks | Vanta | Our SoA builder + register types cover this. Pre-map our controls to GDPR/ISO 27001/NIS2 from day one. |
| **Vendor risk assessments** — send questionnaire to suppliers | OneTrust, Sprinto | Use our Survey module — send vendor security questionnaire as an org-external survey. |
| **NIS2 incident 24/72h timeline** | None do this well | Build the visual timeline (see UX 6.5). Competitors only have generic "incident" forms. |
| **Board training tracking** | Sprinto | Wire e-learning completion into NIS2 Art. 20 board compliance check. |
| **DPO dashboard** | OneTrust | Build a DPO-role view within Privacy Hub. |
| **Automated ROPA from system analysis** | OneTrust | V2: scan document templates + checklist law_refs to suggest ROPA entries. |
| **Certification readiness report** | Vanta, Drata | PDF export of SoA + evidence map. The auditor-token mechanism already exists. |

### 7.3 Our Competitive Moats

1. **Norwegian-first:** We are the only platform with Norwegian language, Norwegian law references (AML, IK-f, DSL, Personopplysningsloven), and direct government integrations (Datatilsynet, NSM, Altinn).

2. **Module integration:** Evidence flows automatically from compliance checklists, meetings, e-learning, and tasks into the GDPR/ISMS gap matrix. Competitors require you to manually link evidence or build integrations.

3. **Workflow engine:** Our TSA-anchored, tamper-evident workflow engine is enterprise-grade. Competitors (especially tier 2) use simple status fields.

4. **Meeting templates:** Our 19 system meeting templates (including ISO 27001 §9.3.2 management review) generate evidence automatically. No competitor does this.

5. **Price:** Targeting €99–299/month SME tier vs. €3 000–20 000/year for comparable tools. 10–30× cheaper.

---

## 8. Entrepreneur Perspective — Business Value & Monetisation

### 8.1 Market Timing

**NIS2 transposition** deadline was October 2024. Norwegian implementation via DSL amendment is actively in progress (2025–2026). Thousands of Norwegian organisations are now legally required to implement NIS2 measures and face €10M / 2% global turnover fines. **There is a compliance deadline driving immediate demand.**

GDPR enforcement is escalating: Datatilsynet issued record fines in 2024–2025. The market has moved from "nice to have" to "we need this before the inspection."

ISO 27001 certification is now required for:
- Public sector suppliers (Norway's public procurement rules tightening)
- Healthcare data processors
- Financial services vendors
- Any org that wants to sell to enterprise customers

### 8.2 Revenue Model

**Recommended: Feature tier add-on**

```
Base tier (existing):         €49/month   — HMS + checklists + e-learning
Professional tier (existing): €99/month   — + surveys + meetings + documents
Security add-on (new):       +€149/month  — Trust & Security module cluster
Enterprise bundle:            €299/month  — everything + audit export + API + priority support
```

The Security add-on targets compliance officers, DPOs, and IT security managers.
At €149/month it is **20× cheaper than OneTrust** and **5× cheaper than Sprinto**.

**Market size estimate (Norway):**
- ~15 000 Norwegian companies with 50+ employees
- ~5 000 are NIS2 essential or important entities
- ~3 000 are actively pursuing ISO 27001 certification
- Target: 500 paying Security add-on customers in Year 1 = €894k ARR

### 8.3 Upsell / Cross-sell Triggers

| Trigger event | Upsell message |
|---|---|
| Org adds GDPR as a regulation in taxonomy | "Aktiver Personvernmodulen — opprett ROPA og DPIA på minutter" |
| Datatilsynet breach filed via alerts | "Kom i forkant — strukturer personvernarbeidet ditt med Privacy Hub" |
| ISO 27001 meeting template used | "Du er i gang med ISMS — Informasjonssikkerheitsmodulen hjelper deg fullføre sertifiseringen" |
| 50+ employees hit | "Din bedrift er nå over NIS2-terskelen — er du klar for tilsyn?" |
| Supplier register grows past 10 entries | "Vurder leverandørsikkerhet automatisk — send ut sikkerhetsspørreskjema" |

### 8.4 Viral / Network Effects

**Trust Center (public page):** Customers publish `/trust/acme-corp` showing their compliance
status to their own customers. Each published page is a product demo for potential buyers.
This is the Vanta/Drata "compliance as a sales tool" play — extremely effective for B2B SaaS.

**Auditor workflow:** Our auditor-token mechanism lets customers share a read-only compliance
view with their auditor/revisor. The auditor becomes a product user, sees the quality,
and recommends it to their other clients. Same pattern as DocuSign's auditor referral loop.

**Supplier questionnaire:** When a customer sends our vendor security survey to their suppliers,
those suppliers see the platform and may want it for themselves.

### 8.5 Key Product Metrics to Track

- SoA completion rate (% of controls implemented) — drives urgency to upgrade
- ROPA coverage % — Datatilsynet benchmark
- Incident response time vs. 24h/72h deadlines — reduces fine risk visibly
- Days until next audit — creates urgency
- Time-to-certification — the ultimate success metric for ISO 27001 customers

---

## 9. Implementation Roadmap

### Phase 1 — Foundation (Sprint 1–2, ~3 weeks)

**Goal:** Ship the data layer + first visible surface. No new UI paradigm — extend
what exists.

| # | Item | Files | Priority |
|---|---|---|---|
| P1.1 | Regulation seeds (ISO 27001, NIS2, DSL, POL) | `20260920120000_regulations_gdpr_isms_nis2.sql` | P0 |
| P1.2 | 8 new system register types | `20260920120001_trust_register_types.sql` | P0 |
| P1.3 | Multi-regulation gap planner (extend 5.6 from deferred to P0) | `specs/compliance-planner.md` OQ-P1 answer | P0 |
| P1.4 | `isms_soa_controls` table + provision fn | `20260920120002_isms_soa_controls.sql` | P0 |
| P1.5 | NIS2 incident type on alerts module | extend `alerts` types + migration | P1 |
| P1.6 | Trust navigation group in AticsShell | `src/components/layout/AticsShell.tsx` | P1 |
| P1.7 | TRUST_NAV_PERMS permission keys | `src/types/permissions.ts` (or equiv) | P1 |

Acceptance: ROPA register entries creatable, SoA table exists, NIS2 incident
type selectable in alerts, sidebar shows Trust group.

### Phase 2 — Privacy Hub (Sprint 3–4, ~2 weeks)

**Goal:** GDPR-complete surface. Target: DPO and privacy officer personas.

| # | Item | Files |
|---|---|---|
| P2.1 | ROPA page — structured view of `gdpr_ropa` register | `src/pages/trust/privacy/RopaPage.tsx` |
| P2.2 | ROPA form (structured fields per Art. 30) | `src/components/trust/RopaRecordForm.tsx` |
| P2.3 | DSR workflow page | `src/pages/trust/privacy/DsrPage.tsx` |
| P2.4 | DSR status timeline component | `src/components/trust/DsrTimeline.tsx` |
| P2.5 | Transfer register page (Art. 44) | `src/pages/trust/privacy/TransfersPage.tsx` |
| P2.6 | DPA contract register page (Art. 28) | `src/pages/trust/privacy/DpaContractsPage.tsx` |
| P2.7 | Privacy Hub landing (hub tile grid) | `src/pages/trust/privacy/PrivacyHubPage.tsx` |
| P2.8 | Privacy dashboard scope + datasets | `src/pages/trust/privacy/dashboards/` |
| P2.9 | GDPR ROPA export PDF (via existing compliance-audit-pdf Edge Function extension) | `supabase/functions/compliance-audit-pdf/` |

Acceptance: DPO can manage full ROPA, log DSRs with workflow, track DPA contracts.

### Phase 3 — ISMS Hub (Sprint 5–7, ~3 weeks)

**Goal:** ISO 27001 certification support. Target: ISMS manager, IT security, consultants.

| # | Item | Files |
|---|---|---|
| P3.1 | SoA builder page | `src/pages/trust/isms/SoaPage.tsx` |
| P3.2 | SoA control editor (applicable/excluded, status, evidence link) | `src/components/trust/SoaControlRow.tsx` |
| P3.3 | 93-control seed (ISO 27001:2022 Annex A complete catalogue) | `20260925120000_isms_annex_a_controls_seed.sql` |
| P3.4 | Asset inventory page (wraps `isms_assets` register) | `src/pages/trust/isms/AssetsPage.tsx` |
| P3.5 | Vulnerability register page (wraps `isms_vulnerabilities`) | `src/pages/trust/isms/VulnerabilitiesPage.tsx` |
| P3.6 | Internal audit scheduling (meetings template: `isms-internal-audit`) | seed migration |
| P3.7 | ISMS risk assessment wiring (bridge to existing risk module) | `src/hooks/useIsmsRiskBridge.ts` |
| P3.8 | SoA PDF export ("Certification readiness report") | extend Edge Function |
| P3.9 | ISMS dashboard scope + datasets | `src/pages/trust/isms/dashboards/` |
| P3.10 | Fix gated 8.17 ISO 27001 §9.3.2 meeting template | `specs/meetings-lovdata-verification.md §7` |

Acceptance: SoA shows all 93 controls, status tracks, evidence links resolve,
PDF export is auditor-readable.

### Phase 4 — NIS2 Hub (Sprint 8–9, ~2 weeks)

**Goal:** NIS2 / DSL compliance surface. Target: CISO, IT security, compliance officer.

| # | Item | Files |
|---|---|---|
| P4.1 | NIS2 incident timeline page | `src/pages/trust/nis2/IncidentsPage.tsx` |
| P4.2 | 24h/72h/30d countdown timers + NSM submission trigger | `src/components/trust/Nis2IncidentTimeline.tsx` |
| P4.3 | NSM/Nkom report Edge Function | `supabase/functions/gov-nsm-incident-report/` |
| P4.4 | Supplier security register page | `src/pages/trust/nis2/SuppliersPage.tsx` |
| P4.5 | Supplier security questionnaire template (uses Survey module) | seed in `survey_template_catalog` |
| P4.6 | BCP/DR register page | `src/pages/trust/nis2/BcpPage.tsx` |
| P4.7 | Board training tracker (wires e-learning completion + NIS2 Art. 20) | `src/hooks/useNis2BoardTraining.ts` |
| P4.8 | NIS2 dashboard scope + datasets | `src/pages/trust/nis2/dashboards/` |
| P4.9 | Crypto policy document template | seed in `document_system_templates` |

Acceptance: Organisation can log NIS2 incident, track 24h/72h deadlines, send
NSM report, manage supplier security with automated questionnaire.

### Phase 5 — Trust Dashboard + Trust Center (Sprint 10–11, ~2 weeks)

**Goal:** Board-level visibility + public trust centre for commercial differentiation.

| # | Item | Files |
|---|---|---|
| P5.1 | Trust composite dashboard scope | `src/pages/trust/dashboards/trustDashboardScope.ts` |
| P5.2 | Trust overview page | `src/pages/trust/TrustOverviewPage.tsx` |
| P5.3 | Regulation coverage bar chart (GDPR/ISO 27001/NIS2/DSL) | new widget dataset |
| P5.4 | Trust Center — public facing page | `src/pages/public/TrustCenterPage.tsx` |
| P5.5 | Trust Center admin (enable/disable, customise) | `src/pages/trust/settings/TrustCenterSettings.tsx` |
| P5.6 | Auditor view extension to cover ISMS + NIS2 (extend existing token system) | `supabase/functions/workflow-auditor-view/` |
| P5.7 | Certification readiness PDF (SoA + evidence map + gap summary) | extend Edge Function |
| P5.8 | Board report PDF (executive summary of Trust Dashboard) | new Edge Function |

Acceptance: Board can view compliance status in one page. Trust Center is publicly
accessible at `/trust/:slug`. Auditor token covers all three hubs.

### Phase 6 — Intelligence Layer (Sprint 12+, ongoing)

**Goal:** Competitive differentiation through automation and proactive compliance.

| # | Item | Notes |
|---|---|---|
| P6.1 | ROPA auto-suggest from system scan | Scan document templates + checklist law_refs to suggest ROPA entries |
| P6.2 | SoA auto-evidence matching | When a checklist execution or meeting has law_refs matching an Annex A control, auto-link as evidence |
| P6.3 | Datatilsynet DPO API integration | Register/update DPO contact info directly from the platform |
| P6.4 | Altinn NIS2 reporting integration | Submit NIS2 incident reports via Altinn API |
| P6.5 | Peer review coordination (NIS2 Art. 26) | Multi-org shared review workflow |
| P6.6 | CVE feed integration | Auto-populate vulnerability register from NVD/CVE feed |
| P6.7 | AI-assisted DPIA risk scoring | Suggest risk level based on processing purpose + data categories |

---

## 10. Open Questions

| # | Question | Owner | Deadline |
|---|---|---|---|
| OQ-T1 | Should `/trust` be a module in `modules/` or a separate `src/pages/trust/` subtree? Recommendation: `src/pages/trust/` because it is a meta-module over existing modules, not a standalone module. | Architect | Before P1 starts |
| OQ-T2 | Trust & Security add-on: gate behind a feature flag / org plan tier? Which entitlement model? | PM | Before P2 |
| OQ-T3 | NSM incident reporting: does Norway have an API endpoint yet, or is this PDF upload + email? Research required. | Developer | Before P4.3 |
| OQ-T4 | Should ROPA be a dedicated table or a register_type with structured field_schema? Recommendation: dedicated table — Art. 30 has regulatory-prescribed fields, not user-definable schema. | Architect | Before P2.1 |
| OQ-T5 | SoA controls: hardcode 93 controls in seed migration, or pull from a versioned catalogue table that could track ISO 27001 amendments? Recommendation: seed migration + `isms_control_catalogue` static table (never changes without a new standard version). | Developer | Before P3.3 |
| OQ-T6 | Trust Center: self-hosted page (within our app) or a separate static site? Recommendation: within-app route, same CDN, but with public (no-auth) RLS policies on a new `trust_center_settings` table. | Architect | Before P5.4 |
| OQ-T7 | Multi-org / conglomerate scope for ISMS/NIS2? (enterprise holding-company view across subsidiaries) | PM | Defer to post-P5 |
| OQ-T8 | Should the supplier questionnaire use our existing Survey module survey_invitation_tokens, or a new dedicated vendor portal? Recommendation: Survey module first — it's already built. | Architect | Before P4.5 |

---

## Appendix A: Law Reference Strings for New Seeds

Format follows the existing convention (`'GDPR Art. 30'`, `'ISO 27001 A.5.1'`):

```
GDPR Art. 5          — Seven principles
GDPR Art. 6          — Legal basis
GDPR Art. 13         — Privacy notice (direct collection)
GDPR Art. 14         — Privacy notice (indirect collection)
GDPR Art. 15         — Right of access
GDPR Art. 17         — Right to erasure
GDPR Art. 20         — Right to data portability
GDPR Art. 25         — Privacy by design
GDPR Art. 28         — Processor agreements
GDPR Art. 30         — Records of processing activities
GDPR Art. 32         — Security of processing
GDPR Art. 33         — Breach notification (authority)
GDPR Art. 34         — Breach notification (data subjects)
GDPR Art. 35         — DPIA
GDPR Art. 37         — DPO designation
GDPR Art. 44         — Transfer to third countries
ISO 27001 A.5.1      — Information security policies
ISO 27001 A.5.9      — Inventory of information and other associated assets
ISO 27001 A.5.19     — Information security in supplier relationships
ISO 27001 A.5.29     — Information security during disruption
ISO 27001 A.6.3      — Information security awareness, education and training
ISO 27001 A.8.2      — Privileged access rights
ISO 27001 A.8.8      — Management of technical vulnerabilities
ISO 27001 A.8.12     — Data leakage prevention
ISO 27001 A.8.16     — Monitoring activities
NIS2 Art. 20         — Governance
NIS2 Art. 21         — Cybersecurity risk-management measures
NIS2 Art. 23         — Reporting obligations
DSL § 10             — Sikkerhetskrav
DSL § 11             — Varsling av hendelser
```

## Appendix B: Migration Timestamp Sequence

Next available timestamp after `20260913100000`:

```
20260920120000  — Regulations seeds (ISO 27001, NIS2, DSL, POL)
20260920120001  — Trust register types (8 system types)
20260920120002  — isms_soa_controls table + provision fn
20260920120003  — gdpr_dpias table
20260920120004  — trust_center_settings table
20260925120000  — ISO 27001:2022 Annex A 93-control seed
20260925120001  — NIS2 Art. 21 category requirements seed
20260925120002  — NIS2/GDPR meeting templates seed
20260925120003  — ROPA + DSR document system templates seed
```

## Appendix C: File Targets Summary

```
# New pages
src/pages/trust/
  TrustOverviewPage.tsx              ← composite dashboard
  privacy/
    PrivacyHubPage.tsx               ← hub landing
    RopaPage.tsx                     ← Art. 30 records
    DsrPage.tsx                      ← data subject rights
    DpaContractsPage.tsx             ← Art. 28 contracts
    TransfersPage.tsx                ← Art. 44 transfers
    DpiaTrackerPage.tsx              ← DPIA workflow
  isms/
    IsmsHubPage.tsx                  ← hub landing
    SoaPage.tsx                      ← SoA builder
    AssetsPage.tsx                   ← asset inventory
    VulnerabilitiesPage.tsx          ← vuln register
    InternalAuditsPage.tsx           ← audit schedule
  nis2/
    Nis2HubPage.tsx                  ← hub landing
    IncidentsPage.tsx                ← NIS2 incident timeline
    SuppliersPage.tsx                ← supplier register
    BcpPage.tsx                      ← BCP register
    BoardTrainingPage.tsx            ← Art. 20 board tracking
  settings/
    TrustSettingsPage.tsx            ← admin + trust center toggle
src/pages/public/
  TrustCenterPage.tsx                ← public /trust/:slug

# New components
src/components/trust/
  RopaRecordForm.tsx
  DsrTimeline.tsx
  Nis2IncidentTimeline.tsx
  SoaControlRow.tsx
  TrustScoreWidget.tsx               ← for HMS-oversikt composite
  RegulationCoverageBar.tsx

# New hooks
src/hooks/
  useRopaRecords.ts
  useDsrRequests.ts
  useIsmsControls.ts                 ← SoA data
  useIsmsRiskBridge.ts               ← wires risk module
  useNis2Incidents.ts
  useNis2BoardTraining.ts
  useTrustScore.ts                   ← composite KPI

# New dashboard scopes
src/pages/trust/
  privacy/dashboards/privacyDashboardScope.ts
  isms/dashboards/ismsDashboardScope.ts
  nis2/dashboards/nis2DashboardScope.ts
  dashboards/trustDashboardScope.ts  ← composite

# New Edge Functions
supabase/functions/
  gov-nsm-incident-report/           ← NIS2 incident to NSM
  trust-center-public/               ← public trust center API

# Extended Edge Functions
supabase/functions/
  compliance-audit-pdf/              ← extend for ROPA + SoA exports
  workflow-auditor-view/             ← extend token scope to ISMS/NIS2
```
