# VComply feature-mining review for NewAMU

A multi-perspective review (senior engineer + UX designer + entrepreneur)
mining VComply (vcomply.com) for ideas applicable to our
Arbeidsmiljøloven / HMS platform. Date: 2026-05-19.

> Validity notes up front: VComply's G2 page returned 403 to automated
> fetches; review-site signal is paraphrased from search summaries and
> should be treated as directional, not statistical. Pricing figures
> come from a third-party reseller (pricingnow.com); VComply gates its
> own pricing behind sales. Their public "What's New" changelog runs
> through Feb 2025 — anything shipped Mar 2025 → May 2026 is invisible
> without an account. Frameworks library is cyber/finance heavy and
> contains zero Norwegian working-environment content, so we are
> mining patterns, not content.

---

## TL;DR (entrepreneur lens, 60 seconds)

VComply is a US/global GRC suite (ComplianceOps · PolicyOps · RiskOps ·
CaseOps) for SMB-to-enterprise. It is **not a competitor** in the
Norwegian Arbeidsmiljøloven market — wrong jurisdiction, wrong
frameworks, no verneombud/AMU concept. But three of their plays
translate directly to our wedge and would meaningfully lift NewAMU:

1. **AI Regulatory Updates Hub** bound to Lovdata / Arbeidstilsynet /
   Datatilsynet feeds. Norwegian SMBs cannot track regelverk changes
   manually; our `law_refs[]` infrastructure (five modules) is already
   the substrate. Highest-leverage feature on the list.
2. **Contextual AI assistant inside the editor** (their "Paula C.")
   that answers questions *about the page you're on* and cites AML §.
   Distinctive, not commoditised — the page-context grounding is what
   matters, not the chatbox.
3. **Anonymous case reporting with an embeddable widget** for the
   planned varsling/alerts module. Direct AML §2A-7 requirement.
   Embeddable iframe = a varslingskanal a customer can paste onto
   their public website in 30 seconds. Sales hook.

Three things explicitly **not** worth porting: bow-tie / Monte Carlo
risk modelling (overkill for SMB HMS), their 20+ cyber-framework
library (wrong content), and the phone-hotline channel (enterprise
toy).

We already have most of the platform infra they sell: dashboard
engine, audit logs, RLS-multi-org, workflow rules, evidence
attachments, Storage buckets. What we *lack* and they exploit:
contextual AI, regulatory-change tracking, version diffs, and an
"audit workroom" UX that bundles evidence + tasks + chat into one URL.

---

## 1. VComply at a glance

| | |
|---|---|
| **Suite name** | GRCOps |
| **Modules** | ComplianceOps · PolicyOps · RiskOps · CaseOps (+ Audit & Assurance sub-module) |
| **AI layer** | Paula C. (contextual assistant), AI Policy Generator, AI Regulatory Updates Hub, Gan.AI multilingual training videos |
| **Framework library** | 20+ frameworks (SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, NIST CSF, NIST AI RMF, DORA, CMMC, FedRAMP, …) |
| **Pricing** | Starter ~$1,199/mo · Pro ~$1,999/mo · Enterprise custom *(third-party source)* |
| **Reported weak spots** | Setup learning curve · inflexible reporting · sparse integrations beyond Microsoft/Slack · historically weak mobile · opaque pricing |

---

## 2. Feature-by-feature ratings

Each feature is rated on four axes (★☆☆ to ★★★):

- **V** — value to a Norwegian HMS SMB
- **F** — fit to Arbeidsmiljøloven / IK-forskriften context
- **B** — build feasibility on top of our current platform
- **D** — competitive differentiation vs. Norwegian alternatives (Simployer, Compendia, AMU-systemer, Workplace, Confluence-ad-hoc)

Composite **Score** = unweighted sum (max 12). Anything ≥ 9 is a
candidate for the next 1–2 sprints; 7–8 is a strong backlog item; ≤ 6
is parking-lot or a "do not port" call.

### 2.1 VComply core modules

| Feature | What it does | V | F | B | D | **Score** | Verdict |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| **ComplianceOps** (control + audit + evidence) | Manage controls, collect evidence, run field audits | ★★★ | ★★★ | ★★★ | ★☆☆ | **10** | Already covered by `compliance_checklist` + `vernerunde` patterns; nothing new to port at module level. |
| **PolicyOps** (policy lifecycle) | Draft → review → approve → distribute → attest, with versioning + multi-level approvals | ★★★ | ★★★ | ★★☆ | ★★☆ | **10** | `documents` covers draft/distribute; **missing**: explicit lifecycle stages, multi-level approval, attestation tracking with reminders. Port the lifecycle, keep the wiki backbone. |
| **RiskOps** (risk register) | Inherent/residual risk, treatment plans, heatmaps | ★★☆ | ★★☆ | ★★☆ | ★★☆ | **8** | Norwegian SMB does ROS-analyse + 5×5, not bow-tie. Build a thin `risiko` scope; don't copy the enterprise modelling. |
| **CaseOps / whistleblower** | Anonymous intake (form + hotline) + triage + investigation | ★★★ | ★★★ | ★★☆ | ★★★ | **11** | Direct AML §2A fit. Already planned as `alerts`/varsling. Their **embeddable widget** is the unique steal. |
| **Audit & Assurance** | Audit planning calendar + Audit Workroom + control effectiveness scoring | ★★☆ | ★★☆ | ★★☆ | ★★☆ | **8** | Internkontroll already does most of this; steal the **Workroom UX**. |
| **GRCOps composite suite** | Sold as bundle with cross-module dashboard | ★★★ | ★★★ | ★★★ | ★★☆ | **11** | We already ship this as `hms_overview` — validates the composite-dashboard thesis is a buyer ask, not a feature to build. |

### 2.2 Cross-cutting features

| Feature | What it does | V | F | B | D | **Score** | Verdict |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| **AI Regulatory Updates Hub** | Tracks regulatory changes, maps to affected controls/policies | ★★★ | ★★★ | ★★☆ | ★★★ | **11** | 🥇 **Port.** Wire to Lovdata + Arbeidstilsynet RSS. `law_refs[]` is the join column. |
| **Paula C. contextual AI** | Per-page Q&A + summarisation + draft generation | ★★★ | ★★★ | ★★☆ | ★★★ | **11** | 🥇 **Port.** Page-aware grounding is the differentiator; global chatbox isn't. |
| **Embeddable anonymous case widget** | iframe / JS snippet a customer pastes on their site | ★★★ | ★★★ | ★★☆ | ★★★ | **11** | 🥇 **Port.** AML §2A-7 hook. Public surface = sales demo. |
| **Framework Library (concept, not content)** | Pre-built imports of frameworks → controls → clauses, with cross-framework mappings | ★★★ | ★★★ | ★★★ | ★★☆ | **11** | We **have** this pattern (`law_refs[]` everywhere). Make it visible as a *Regelverk-bibliotek* surface. |
| **Custom dashboards + heatmaps + R.A.G.** | Drag-drop widgets with Red/Amber/Green status | ★★★ | ★★★ | ★★★ | ★★☆ | **11** | Dashboard engine done; **adopt R.A.G. status chips** as a universal convention across `task`, `sjekkliste`, `document`, `vernerunde`. |
| **Side-by-side version diff (documents)** | Coloured diffs between versions | ★★★ | ★★☆ | ★★☆ | ★★☆ | **9** | **Port.** Versioning infra exists; diff renderer missing. High AMU/verneombud value. |
| **Workflow Automation builder** | Visual routing/escalation/reminders | ★★☆ | ★★☆ | ★★☆ | ★★☆ | **8** | We have workflow rules in DB; the *visual builder* is the UX gap. Backlog. |
| **AI Policy Generator** | Drafts a policy from a prompt | ★★☆ | ★★☆ | ★★★ | ★☆☆ | **8** | Commoditising fast. Ship as a thin layer over the contextual AI; don't market it separately. |
| **Multi-region data residency (EU)** | Region-selectable storage | ★★★ | ★★★ | ★★★ | ★☆☆ | **10** | Already a Supabase EU region choice; *make this visible* in marketing + admin UI. |
| **Mobile field-audit app** | Native iOS/Android for vernerunde-style work | ★★☆ | ★★★ | ★☆☆ | ★★☆ | **8** | PWA suffices for vernerunde. Don't build native yet. |
| **MS Word round-trip editing** | Edit policies in Word, sync back with version history | ★☆☆ | ★★☆ | ★☆☆ | ★☆☆ | **5** | Norwegian SMBs draft in Word, but the round-trip engineering cost is huge. Skip; ship .docx export instead. |
| **Bulk Excel import** | CSV/XLSX import of users/controls/evidence | ★★☆ | ★★☆ | ★★★ | ★☆☆ | **8** | Table-stakes for partner-led onboarding. Cheap to ship. |
| **Slack/Teams/Outlook/SharePoint integrations** | Notifications + edit-in-place | ★★★ | ★★★ | ★★☆ | ★☆☆ | **9** | **Teams + Outlook** are the Norwegian SMB realities. Slack and SharePoint less so. |
| **Gan.AI multilingual training videos** | AI-generated personalised training videos tied to policies | ★★☆ | ★★☆ | ★☆☆ | ★★★ | **8** | Distinctive but heavy lift. Park behind verneombut/AMU certification courses. |
| **"What's New" public changelog** | Month-grouped, screenshot-rich release notes as marketing | ★★★ | ★★★ | ★★★ | ★☆☆ | **10** | Cheap. Ship `/oppdateringer` page. Pays for itself the first time a prospect asks "is this product alive?" |
| **Due-Diligence Score (composite KPI)** | Single number that buyers latch onto | ★★★ | ★★★ | ★★★ | ★★☆ | **11** | **Port.** Define **HMS-helse-score** = f(pålegg-lukket %, årshjul-cadence on-time %, attestasjon %, åpne avvik). Front-and-centre on `hms_overview`. |
| **Bow-tie / Monte Carlo risk** | Enterprise risk modelling | ★☆☆ | ★☆☆ | ★☆☆ | ★☆☆ | **4** | ❌ Skip. Wrong buyer. ROS + 5×5 is the canon. |
| **Phone hotline (varsling)** | Inbound 1-800 line | ★☆☆ | ★★☆ | ★☆☆ | ★☆☆ | **5** | ❌ Skip. Form + email enough for SMB. Re-evaluate at enterprise. |

---

## 3. UX patterns worth borrowing

(From the designer's seat — these are interaction patterns, not
features. Most are cheap to land.)

1. **R.A.G. status chips, everywhere.** Red/Amber/Green is universal,
   translates, survives small screens. Today our status colours are
   per-module ad-hoc. Pick three colour tokens and use them across
   every module's status field. Pairs with `accent` per-scope without
   conflict.
2. **Audit Workroom = `vernerunde-rommet`.** One URL combines:
   sjekkliste-execution + photos + findings + signoff + chat + linked
   tasks. Today these are spread across `compliance` + `meetings` +
   `tasks`. A composite page that *bundles* them is the highest-impact
   UX move on our roadmap.
3. **Right-side timeline of changes** on every entity. Exposes the
   audit log as a *first-class UX element*, not a hidden DB table.
   We already have `hse_audit_log`, `task_activity_log`,
   `workflow_signing_audit_log` — wiring a generic
   `<EntityTimeline entityType entityId>` component is half a day.
4. **Side-bar AI assistant scoped to the current page.** Per-page
   context, not global chat. "Hva sier AML §4-3 om dette?", "Foreslå
   neste tiltak basert på funnene på denne siden". The page-context
   grounding is the differentiator.
5. **Side-by-side version diff** for documents and survey templates.
   Verneombud reviews are the killer use case — "hva endret seg siden
   vi godkjente sist?"
6. **Right-click AI in rich-text editor** — rewrite, translate (nb↔nn↔en),
   grammar, summarise. Low UX disruption, opt-in. Already feasible with
   a thin overlay over our existing rich-text component.
7. **Embeddable read-only attestation surface.** Public-URL page where
   innleide vikarer / underleverandører can attest a policy without an
   account. Big for Norwegian SMB realities (bygg, helse, mat).
8. **Single composite KPI on the landing dashboard.** Our `hms_overview`
   today shows widgets; it should *lead* with one number — HMS-helse
   75/100, trending +3. Buyers and CEOs latch onto a single score.
9. **Month-grouped public changelog** at `/oppdateringer`. Doubles as
   marketing surface and trust signal. Cheap.
10. **Pinned navigation chips** — already partially there via
    `useXxxNav` pinned templates; extend to surface a "today" view per
    role (verneombud / leder / HR / ansatt).

---

## 4. Where each port lands in our codebase

This is the senior-engineer mapping. Concrete file/scope paths so the
ports are not abstract.

| Port | New code | Reuses |
|---|---|---|
| AI Regulatory Updates Hub | new edge fn `regelverk-watch` (cron) → new table `regelverk_updates` with `law_refs text[]` + `affected_template_refs` → new widget kind `regelverk_feed` on `hms_overview` | `law_refs[]` across `compliance_checklist_templates`, `survey_template_catalog`, `document_system_templates`, `learning_system_courses`; existing notification infra (`compliance_notifications`, `wiki_mention_notifications` pattern) |
| Contextual AI (Paula-equivalent) | new edge fn `ai-assistant-context` (Anthropic SDK, **claude-sonnet-4-6** + prompt caching) + retrieval grounding from `page_payload` blocks + `law_refs[]` + entity audit log | `documents` page payloads, `compliance_checklist` execution context, `learning` course content. **Not** in codebase today — see Explore note "AI/LLM Integrations — None visible". |
| Embeddable varsling widget | new public page `/embed/varsling/:org_slug` + new edge fn for unauthenticated submission → existing `alerts` ingestion path | `alerts` module, `alert-attachments` storage bucket |
| HMS-helse composite KPI | new widget kind `composite_score` (the 7th kind — triggers the six-call-site update: union in `src/types/reportBuilder.ts`, schema in `useDashboardLayout.ts`, renderer in `ReportModuleWidget.tsx`, `KIND_LABELS`, `kindSwitch`, `defaultCompatibleKinds`) | `hms_overview` composite scope; aggregates existing dataset keys |
| R.A.G. chip system | shared `<StatusChip variant="rag" />` component + three CSS tokens; refactor existing status pills | All module list pages |
| Version-diff renderer | new `<DocumentVersionDiff/>` over existing `document_org_templates` history | `documents` versioning already in place |
| Audit Workroom (`vernerunde-rommet`) | new composite page `src/pages/compliance/vernerunde/VernerundeRoomPage.tsx` | `compliance` execution, `meetings` live mode, `tasks`, storage buckets — bundles them, doesn't replace |
| Right-side entity timeline | new `<EntityTimeline/>` reading from a unified `audit_logs` view that UNION-ALLs `hse_audit_log`, `task_activity_log`, `workflow_signing_audit_log` | Existing audit tables |
| Public changelog | new public route `/oppdateringer` reading from a `release_notes` table seeded via migration | None — net-new but small |
| Embeddable attestation | new public page `/embed/attest/:doc_token` with one-time tokens | `documents` + new `document_attestation_tokens` table |

Two systemic things to check before any AI work begins:

- **Anthropic SDK is not yet in the codebase** (per Explore). Setting
  this up needs a secrets-inventory entry, an EU residency call
  (Anthropic on AWS EU), and prompt caching from day one — see the
  `claude-api` skill if/when implementing.
- **Cron infra exists** (per `specs/cron-scheduling.md`), so the
  regelverk-watch fn slots in cleanly.

---

## 5. Recommended next-3-sprints picks

Picked by score, leverage on existing infra, and demo-ability.
Sequenced so each one *makes the next one easier or more credible*.

**Sprint A — "Buyer wow"** (1–2 weeks):
- 🥇 HMS-helse composite KPI on `hms_overview` (1 new widget kind, ~3 days)
- 🥇 R.A.G. chips system + audit-log → `<EntityTimeline/>` (~3 days)
- Public `/oppdateringer` changelog page (~1 day)

Outcome: the demo lands a single number, a status-language a CEO
recognises, and a "this product ships" signal — without any AI risk.

**Sprint B — "Varsling wedge"** (2 weeks):
- Embeddable varsling widget (`/embed/varsling/:org`) + unauth submit fn
- Embeddable read-only attestation surface (`/embed/attest/:token`)

Outcome: a *paste-this-on-your-website* moment. Strongest standalone
sales demo we can run. Pure AML §2A-7 fit, no AI dependency.

**Sprint C — "AI moat"** (3–4 weeks, gated on sprint A landing):
- Contextual AI assistant on `documents` + `compliance_checklist`
  execution + `learning` (page-grounded, AML §-citing)
- AI Regulatory Updates Hub (Lovdata + Arbeidstilsynet feed → diff
  matcher against `law_refs[]` → notification + `regelverk_feed` widget)

Outcome: the two highest-score features on the list, both bound to
the `law_refs[]` substrate we've spent months building. This is where
the platform becomes durably distinctive.

**Parking lot** (do not start until A–C land): visual workflow
builder, version-diff renderer, mobile PWA polish, multilingual AI
training video, Word round-trip, vendor module, native iOS/Android.

---

## 6. What this is *not*

- Not a "rebuild as VComply" plan. They're enterprise GRC; we're
  Norwegian SMB HMS. ~70% of their surface is irrelevant.
- Not a marketing-copy steal. The four points of differentiation we
  build (Norwegian regelverk, verneombud/AMU first-class, page-grounded
  AI, single HMS-helse score) are ours, not theirs.
- Not a competitive teardown of *Norwegian* incumbents (Simployer,
  Compendia, ComplyControl). That review is overdue and a separate
  document — see `specs/PLAYBOOK.md` "next steps".

---

## Sources

- VComply homepage — https://www.v-comply.com/
- ComplianceOps — https://www.v-comply.com/compliance-management-software/
- PolicyOps — https://www.v-comply.com/policy-management-software/
- RiskOps — https://www.v-comply.com/risk-management-software/
- CaseOps — https://www.v-comply.com/case-management-software/
- Audit & Incident — https://www.v-comply.com/audit-and-incident-software/
- Frameworks — https://www.v-comply.com/frameworks/
- What's New — https://www.v-comply.com/whats-new/
- AI Policy Generator — https://www.v-comply.com/ai-policy-generator/
- GRC Dashboard blog — https://www.v-comply.com/blog/grc-dashboard-steps-insights-effective-reporting/
- Pricing (3rd-party reseller) — https://pricingnow.com/question/vcomply-pricing/
- G2 reviews (403 on automated fetch — verify manually) — https://www.g2.com/products/vcomply/reviews
- Capterra reviews (low N) — https://www.capterra.com/p/142406/V-Comply/reviews/
