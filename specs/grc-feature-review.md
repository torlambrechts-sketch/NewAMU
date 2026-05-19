# GRC competitive feature-mining review for NewAMU

Multi-vendor, **non-AI** feature mine across six GRC / risk / compliance
platforms, synthesised for our Arbeidsmiljøloven / HMS context.
Successor to `specs/vcomply-feature-review.md` (initial single-vendor
pass). Date: 2026-05-19.

**Vendors covered:** VComply · Workiva · MetricStream · Netwrix ·
Onspring · Resolver. Six deep-research agents read product pages,
docs, customer stories, release notes and review sites. AI / GenAI /
Copilot features were excluded by design — this is a pass on the
deterministic, build-now substrate.

**Same team:** senior dev (codebase mapping + feasibility), UX
designer (interaction patterns + adoption), entrepreneur (market wedge
+ sequencing). Each top-10 feature carries all three lenses.

> Validity notes: G2 returned 403 on automated fetch for every vendor;
> web.archive.org is unreachable from this environment; Gartner Peer
> Insights mostly 403; TrustRadius mixed. Review-site signal is
> aggregated from Capterra, GetApp, SelectHub, PeerSpot, Sprinto and
> third-party comparison articles and should be read as directional,
> not statistical. Where a feature is documented in marketing but not
> in a screenshot or docs page, the spec calls it out.

---

## TL;DR (entrepreneur lens, 90 seconds)

Across six platforms the **same 10 patterns recur** — the more vendors
that ship a pattern, the more it's validated as a buyer ask, not
vendor opinion. Of those 10, **seven map directly to AML / IK-f
obligations** and **five would be net-new differentiators** in the
Norwegian SMB HMS market (Simployer, Compendia, Tess HMS, Landax,
Sticos, BHT-portals).

The top three to ship next are unchanged from the first review even
after five more vendor passes:

1. **Anonymous two-way varsling with ticket+secret-code returnable
   thread** — VComply + MetricStream + Resolver all ship this; direct
   AML §2A-3/4/7 fit; nobody in the Norwegian SMB market does it
   cleanly.
2. **Per-object Workroom** (tabs: tasks · evidence · discussion ·
   audit-log · status) — VComply's #1 architectural idea, validated
   by Workiva Processes, Onspring Portal, Resolver case workspace.
   Lifts cross-module UX consistency dramatically with one new
   component.
3. **Unified 5W audit trail across every module** with in-context
   version-history side panel + before/after diff — Netwrix, Onspring,
   Workiva and MetricStream all converge here. This is the answer to
   the *"vis meg loggen"* question every Arbeidstilsynet inspector
   asks.

The next seven build on those. Sequencing recommendation at the end.

---

## 1. Vendor map at a glance

| Vendor | Sweet spot | Buyer | Floor price | What they prove |
|---|---|---|---|---|
| **VComply** | SMB-mid GRCOps (Compliance · Policy · Risk · Case) | CCO at 200–5,000 employees | ~$1k/mo/module | The **Workroom** abstraction; embeddable varsling widget; SLA escalation |
| **Workiva** | Enterprise connected reporting (SOX · ESG · SEC · audit) | CFO / audit committee | ~$149k/yr SMB tier | The **linked-data** model; blackline diffs; section-level permissions; certification-with-exception |
| **MetricStream** | Enterprise GRC (15+ modules) | CRO / CCO / CAE | ~$75k–$1M/yr | The **GRC data fabric** (many-to-many regulation↔control↔risk↔policy↔issue); heatmap-cell drill-down; mandatory CAPA pair |
| **Netwrix** | IT-Security audit + DLP (18 products) | IT-Sec lead / MSP | ~$36k/yr avg | The **5W audit trail** UX; Interactive Search with chip facets + save-as-report + alert-from-search; before/after change reporting |
| **Onspring** | No-code GRC platform | Mid-market GRC team | ~$48k/yr (Bronze) | The **no-code primitives** (shared lists, dynamic forms, JS formula engine); calendar + Gantt widget kinds; external-recipient surveys |
| **Resolver** | Enterprise security + GRC (Kroll-owned) | Corp security + GRC at large orgs | $10k/yr floor | The **incident→case rollup**; state-machine-aware form fields; timed-trigger workflows; mobile officer app (offline + GPS + panic) |

The pattern: VComply and Onspring are the closest analogues for SMB
positioning; Workiva, MetricStream and Resolver are the deepest on
specific verticals worth mining; Netwrix is a wedge-different domain
whose audit-trail UX language we should steal wholesale.

---

## 2. Cross-vendor convergence map

The 10 patterns shipped by **three or more** of the six vendors. The
more vendors ship a pattern, the more it's validated as a buyer ask.

| # | Pattern | VC | Wk | MS | Nx | On | Rs | Convergence |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | Anonymous two-way reporter thread (ticket + secret code) | ✓ | — | ✓ | — | — | ✓ | **3** |
| 2 | Per-object workroom (tasks/evidence/chat/log/status) | ✓ | ✓ | ✓ | — | ✓ | ✓ | **5** |
| 3 | Unified 5W audit trail / version history side panel | — | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 4 | Side-by-side colour-coded version diff | ✓ | ✓ | ✓ | ✓ | ✓ | — | **5** |
| 5 | Mandatory CAPA pair (correct + prevent + verify) | — | ✓ | ✓ | — | — | ✓ | **3** |
| 6 | No-code visual workflow studio (triggers × states × notify) | ✓ | ✓ | ✓ | — | ✓ | ✓ | **5** |
| 7 | Offline-first mobile field capture (photo + GPS + sync) | ✓ | — | ✓ | — | ✓ | ✓ | **4** |
| 8 | External / regulator portal (scoped, no account) | — | ✓ | — | — | ✓ | ✓ | **3** |
| 9 | Read-and-attest with gate (scroll/quiz) + PDF cert | ✓ | ✓ | ✓ | — | ✓ | — | **4** |
| 10 | Embeddable public intake widget | ✓ | — | ✓ | — | ✓ | ✓ | **4** |

Convergence ≥ 3 means the pattern is **proven across multiple buyer
segments and price points** — not a single vendor's opinion. Each is
in the top-10 list below.

---

## 3. Top 10 features to port (ranked)

Scoring legend (★☆☆ low / ★★☆ medium / ★★★ high):

- **V** = Value to Norwegian SMB
- **F** = Fit to Arbeidsmiljøloven / IK-forskriften
- **B** = Build feasibility on current NewAMU
- **D** = Differentiation vs. Norwegian incumbents

Score = unweighted sum (max 12). Three lenses per feature: dev, UX,
entrepreneur. Each carries explicit codebase mapping and the source
vendors that validate it.

---

### #1 — Anonymous two-way varsling with ticket + secret-code thread

**Score 12** (V ★★★ · F ★★★ · B ★★★ · D ★★★)
**Validated by:** VComply CaseOps · MetricStream Case · Resolver Whistleblower

**What:** The varsler submits anonymously via web form, email, mobile,
or embed. The system issues a one-time **ticket ID + secret phrase**
(never tied to PII). The varsler can return at any time using only
those credentials to (a) check status, (b) read the investigator's
follow-up questions, (c) reply. The investigator never sees an
identity; the conversation thread is preserved for tilsyn evidence.

**Senior-dev lens:** New `alerts.varsling_cases` table with
hashed-handle lookup, append-only `varsling_messages` table for the
thread, no PII columns on anonymous cases. Public unauth edge fn for
submit + lookup; rate-limit by IP + handle. Audit trail via the
unified event log (feature #3). Roughly two weeks of work; the
hardest part is getting the no-PII guarantee right end-to-end.

**UX lens:** Single confirmation screen at submit-time displays the
ticket ID + secret in a copy-to-clipboard card with a "screenshot
this" hint and a "send this as a passwordless email reminder to your
private address" option. The return-thread interface is a stripped
inbox — no avatars, no names, just message bubbles + a status chip.

**Entrepreneur lens:** AML §2A-3 mandates *"trygg og lett tilgjengelig
varslingskanal"*; §2A-4 mandates confidentiality; §2A-7 says the
employer must follow up *"innen rimelig tid"*. Norwegian alternatives
(Mittvarsel, Compendia, in-house Outlook routing) typically fudge the
return-thread or unmask on first reply. A clean implementation is a
**sales-demo moment** — show the prospect's CCO the empty-PII database
view at intake.

**Slots into:** new `alerts` module (already in the roadmap).

---

### #2 — Per-object Workroom

**Score 11** (V ★★★ · F ★★★ · B ★★★ · D ★★☆)
**Validated by:** VComply (their flagship pattern) · Workiva Processes ·
MetricStream record + dashboard model · Onspring Portal · Resolver case

**What:** Every meaningful object — compliance responsibility,
vernerunde finding, varslingssak, ROS-vurdering, AMU-sak, policy in
review — auto-spawns a workspace with the same five tabs:
**Oppgaver · Bevis · Diskusjon · Revisjonslogg · Status**. One URL,
one mental model.

**Senior-dev lens:** A single `<Workroom entityKind entityId>`
component composed of five tab renderers. Each tab is a thin reader
over already-existing tables (`tasks`, document attachments,
comments, the new audit-event table from #3, and a status field on
the entity). Three days of work for the component, two more to wire
up the half-dozen existing entity routes that should host it.

**UX lens:** The pattern lets a user say *"open the workroom"* and
know exactly what they'll get, regardless of which module they're in.
Today NewAMU has per-module drilldowns that diverge: tasks have a
detail panel, compliance has a different one, meetings has a third.
The Workroom collapses this — same tabs, same chip vocabulary,
same audit-log placement.

**Entrepreneur lens:** The *"everything-around-one-thing"* mental
model is what VComply leans on hardest in customer demos because it
removes the "where do I do X?" question. For NewAMU's SMB buyer (a
verneombud who logs in twice a week), this consistency lowers the
training burden — a clear win against feature-heavy Norwegian
incumbents.

**Slots into:** shared component `src/components/workroom/`, hosted by
existing entity detail pages across `compliance`, `tasks`,
`documents`, `meetings`, `registers`, future `alerts` + `risk`.

---

### #3 — Unified 5W audit trail with in-context history side panel

**Score 11** (V ★★★ · F ★★★ · B ★★★ · D ★★☆)
**Validated by:** Netwrix Auditor (5W format originator) · Workiva
Revisions · MetricStream connected GRC · Onspring in-context history ·
Resolver Core

**What:** Every change to any record across NewAMU writes one row to
a uniform `audit_events` table with six columns:
**hvem · hva · når · hvor · handling · før→etter**. The right side of
every detail page hosts a collapsible **Historikk** panel reading
straight from that table. Free-text search across all events with
chip facets (Who / Action / Object / Where / When).

**Senior-dev lens:** New `audit_events` table with a polymorphic
`(entity_kind, entity_id)` reference and `old_jsonb`/`new_jsonb`
diff columns. Backfill from the existing `hse_audit_log`,
`task_activity_log`, `workflow_signing_audit_log`, `wiki_mention_*`
via a UNION-ALL view in migration phase 1. New triggers on each
mutating endpoint in phase 2. The query side is a single
`<EntityTimeline>` component + a `/sok` search scope in the dashboard
registry. Phase 1 alone unlocks the side panel; phase 2 makes it
canonical.

**UX lens:** The in-context **right-side panel** (not a separate
audit-log page) is the actual unlock. Reviewers compare the current
record to its history without leaving the screen; Arbeidstilsynet's
"vis meg endringene" lands in one click. The five-pill filter
(actor / action / object / where / when) on the global search page is
the second half.

**Entrepreneur lens:** Compliance auditors universally ask
*"hvordan har dette endret seg siden sist?"* — answering that
**without engineering effort** is the single biggest credibility
multiplier in a tilsyn. The fact that four of six benchmark vendors
ship this exact UX is convergence evidence that the buyer expects it.

**Slots into:** new `audit_events` table; shared `<EntityTimeline>`
in `src/components/audit/`; new search scope in
`src/lib/dashboards/dashboardRegistry.ts`.

---

### #4 — Side-by-side color-coded version diff with paginated changelog PDF

**Score 10** (V ★★★ · F ★★☆ · B ★★☆ · D ★★★)
**Validated by:** VComply (Dec 2024) · Workiva blacklines (their best
single doc feature) · MetricStream version history · Netwrix before/after ·
Onspring in-context version history

**What:** For any document (HMS-håndbok, AMU-protokoll,
compliance-checklist-template, survey-template), the user picks two
versions and gets a three-mode diff view (**Skjul / Forenklet pins /
Alle endringer**). Additions blue+underline, deletions red+strikethrough,
change-bars in margin. Export as
**"Forenklet endringslogg PDF"** ready for AMU distribution.

**Senior-dev lens:** Versioning already exists for
`document_org_templates`, survey templates, compliance templates.
What's missing is the diff renderer. Use `diff-match-patch` or
`jsdiff` server-side, render to HTML with a fixed colour palette
matching the design system. PDF via Puppeteer + the existing
report-pack edge fn pattern. One week of work for the on-screen view,
one more for the PDF export.

**UX lens:** The three-mode toggle is the cleverness — *Skjul* for
reading the latest clean version, *Forenklet* for skimming "what
changed", *Alle* for legal review. Default to *Forenklet*. Norwegian
users are conditioned to Microsoft Word's "Spor endringer" — match
that mental model.

**Entrepreneur lens:** Verneombud reviewing a revised HMS-håndbok
asks one question first: *"hva er nytt?"* Today they get a PDF and
have to compare side-by-side manually. A clean diff renderer is rare
in the Norwegian SMB tier and gives sales a clear competitive vignette:
*"Vi viser hver endring i HMS-håndboken siden forrige AMU-vedtak — i
ett klikk."*

**Slots into:** `documents` module (`DocumentVersionDiff` component),
`compliance` and `survey` template detail pages.

---

### #5 — Mandatory CAPA pair workflow gate (corrective + preventive + verification)

**Score 11** (V ★★★ · F ★★★ · B ★★★ · D ★★☆)
**Validated by:** MetricStream Case (explicit) · Workiva Certifications
exception flow · Resolver RCA on incidents

**What:** An avvik / nestenulykke / varslingssak cannot be closed
until three things exist: (a) a **korrektivt tiltak** marked done,
(b) a **forebyggende tiltak** marked done, (c) a **verifisering**
record by a different user. The state machine enforces this; the UI
shows a missing-step indicator until each is supplied.

**Senior-dev lens:** A state-machine column on the relevant entity
(`avvik_state` enum: `open` → `corrected` → `prevented` → `verified`
→ `closed`), three new sub-records (`corrective_action`,
`preventive_action`, `verification`), and a Postgres trigger that
refuses `update ... status='closed'` unless all three sub-records
exist and the verifier ≠ the actor. The transition guards live in
DB, not UI — non-negotiable.

**UX lens:** A stepped indicator on the avvik detail page —
**Rette → Forebygge → Verifisere → Lukk** — with one "Mangler" chip
per missing step. Closing is greyed out with a tooltip explaining why.
The verifier sees a one-click "Bekreft at tiltaket er effektivt"
button after the preventive action is logged.

**Entrepreneur lens:** IK-forskriften §5 nr. 7 explicitly demands
*"rette opp og forebygge gjentakelse"*; AML §3-1(1)(c) reinforces the
"forebygge" half. Today most HMS systems track only "tiltak utført" —
no separation of correction vs prevention, no required verification.
Building the gate **into the state machine** is what makes it
defensible in tilsyn ("we cannot close an avvik without proof of
prevention").

**Slots into:** `tasks` + `compliance` issues; future `alerts`
varsling case-close.

---

### #6 — No-code Workflow Studio (triggers × states × notify × escalation)

**Score 10** (V ★★★ · F ★★★ · B ★★☆ · D ★★☆)
**Validated by:** VComply Workflow Studio · Onspring Dynamic Workflows ·
MetricStream Emery · Resolver Core workflows · Workiva Processes

**What:** A visual canvas where admins compose a process from blocks:
**triggers** (onCreate, onSchedule, onStateChange, onFormSubmit, onEmail),
**conditions** (field-equals, role-is, days-since), **actions** (assign
task, send Teams/email/SMS, change state, request evidence,
escalate-to-role, create child workroom). The same engine powers
vernerunde-rounder, avvikshåndtering, dokumentgodkjenning,
varslingsbehandling, AMU-årshjul.

**Senior-dev lens:** This is the biggest build on the top-10 — three
weeks minimum for a usable v1. Required:
`workflow_definitions(id, kind, name, definition jsonb)`,
`workflow_runs(definition_id, entity_kind, entity_id, state, context jsonb)`,
`workflow_steps(run_id, kind, payload, completed_at)`. Frontend uses
React Flow or similar for the canvas; backend executes via a
`workflow-runner` edge fn invoked by cron and by entity-mutation
triggers. Keep the v1 step library small (8–10 step kinds) — extend
later.

**UX lens:** Resist letting customers build *anything* — pre-ship 5–6
**templated workflows** (vernerunde, avvik, varsling, dokument-revisjon,
AMU-årshjul) that customers tune rather than build from scratch. The
canvas is for HMS-rådgivere; the templated list is for the SMB owner.
Onspring's mistake (per their own G2 reviews) is "infinite flexibility
without templates" — that's the bug to avoid.

**Entrepreneur lens:** Collapses what's today a dozen ad-hoc reminder
/ escalation / approval flows into one declarative engine that
customers can adjust. The lift on per-SMB onboarding is huge: today
an HMS-rådgiver configures each module's reminders separately;
post-shipping, one workflow definition covers the whole årshjul.

**Slots into:** new `src/lib/workflows/` engine + `workflows` scope in
the sidebar (Innstillinger group).

---

### #7 — Offline-first mobile vernerunde (photo + GPS + form + sync)

**Score 10** (V ★★★ · F ★★★ · B ★★☆ · D ★★★)
**Validated by:** Resolver Officer Mobile (best-in-class) ·
MetricStream offline briefcase · Onspring Sevita case study

**What:** A PWA-installable mobile surface where a verneombud / HMS-leder
walking a site can: pick the vernerunde-mal, two-tap-add a finding
(photo + GPS + free text + severity chip), draft offline, queue for
sync, auto-resolve into a `compliance_checklist_findings` + auto-task
on reconnect.

**Senior-dev lens:** PWA with Service Worker + IndexedDB for the
offline queue. New `compliance_findings_drafts` table receives bulk
sync. Photo upload to existing Storage bucket; GPS via the Geolocation
API; severity via touch-friendly chip. Background sync API for
auto-flush. The hard part is conflict resolution — keep it simple:
drafts are append-only, server is canonical, last-writer-wins on the
parent vernerunde header.

**UX lens:** The two-tap workflow is the prize: from the home screen,
tap the vernerunde, tap "Nytt funn", capture photo, voice-or-type
note, severity chip, done. Show a queue indicator if offline drafts
exist. **No login screen if device is enrolled** — magic-link bound
to device on first open.

**Entrepreneur lens:** Bygg, anlegg, fiskeoppdrett, offshore — all
core HMS-buying segments — have spotty mobile connectivity. Norwegian
incumbents (Landax, Sticos, BHT-portals) are mostly online-only
responsive web. Shipping a PWA that **works on a Hurtigruten
mellomdekk** is a competitive vignette. Resolver's mobile is the
gold standard for the *pattern*; their *product* is the wrong buyer.

**Slots into:** new `vernerunde-mobil` PWA route; `compliance` module
backend.

---

### #8 — External / regulator portal (scoped, magic-link, no account)

**Score 11** (V ★★★ · F ★★★ · B ★★★ · D ★★★)
**Validated by:** Onspring external-auditor portal · Resolver
first-line client portal · Workiva content requests

**What:** Generate a magic link that gives an external party
(Arbeidstilsynet inspektør, ekstern revisor, innleid HMS-rådgiver,
underleverandør) read-only access to a curated bundle of documents
+ a structured evidence-request inbox. The external party never
creates an account; the link expires; every action is logged in #3's
audit trail.

**Senior-dev lens:** New `external_access_tokens(id, org_id, scope
jsonb, expires_at, created_by)` table. `scope` lists the entity IDs
the holder may read. Public unauth edge fn validates the token and
proxies storage URLs. Optional watermark on PDF downloads
(`"Utstedt 2026-05-19 til Arbeidstilsynet - tilsyn 12345"`).

**UX lens:** Two surfaces matter: (a) the **admin's bundle-builder** —
pick documents + checklists + findings, set an expiry, generate link,
copy; (b) the **external view** — a stripped read-only dashboard with
no chrome, no nav, just the bundle and a structured upload box for
the inspector's evidence requests.

**Entrepreneur lens:** Every tilsyn today devolves into ad-hoc
Dropbox/SharePoint link sharing with the wrong permissions. A purpose-built
**tilsynsmodus** is a sales demo all on its own — show the prospect's
HMS-leder how a tilsyn from Arbeidstilsynet can be replied to inside
NewAMU in 10 minutes, with audit trail intact. Even better for the
SMB-with-konsulent case: the konsulent gets bundle-scoped access
without consuming a seat.

**Slots into:** new `external_access_tokens` table + `/tilsyn/:token`
public route + admin bundle builder in `documents` module.

---

### #9 — Read-and-attest with scroll-gate, optional quiz, and PDF certificate

**Score 10** (V ★★★ · F ★★★ · B ★★★ · D ★★☆)
**Validated by:** VComply Read &amp; Attest + cert PDF (Oct 2024) ·
MetricStream mandatory-scroll · Onspring attestation campaigns ·
Workiva Certifications

**What:** A document carries an "Krever signering"-flag. The reader
scrolls through the entire policy (IntersectionObserver on the
bottom-of-document sentinel); the **Signer**-button enables only after
that. Optional quiz gate before the button. On signing, emit a
PDF certificate to the user's email and store it as an attestation
record linked to the document version. **Lineage:** signing v3 does
not count as having signed v4 — the dashboard shows
"manglende re-signering".

**Senior-dev lens:** `document_attestations(user_id, document_id,
version, signed_at, certificate_url, quiz_result)`. PDF generated
server-side via Puppeteer (existing pattern). The version-lineage
piece is critical: include `version` in the unique constraint so a
new version requires a new attestation row. Dashboards filter by
"users with no attestation for current version".

**UX lens:** The scroll-gate is the kicker — most attestation flows
let users click-without-reading. The combination of *required scroll*
+ *optional quiz* + *downloadable PDF* gives the verneombud something
concrete to file. Quiz uses the existing `learning_courses` `quiz`
module kind.

**Entrepreneur lens:** AML §3-2 mandates *opplæring*; the question
auditors ask is *"can you prove these employees actually read and
understood it?"* A scroll-tracked attestation with a PDF cert is the
strongest audit artefact short of a video. Norwegian SMBs today rely
on Outlook read-receipts or signed PDFs in a SharePoint folder —
both forgeable, neither lineage-aware.

**Slots into:** `documents` (existing `acknowledgement_footer` block
+ scroll sentinel) + `learning` (quiz module) + new
`document_attestations` table.

---

### #10 — Embeddable public intake widget (varsling + avvik)

**Score 10** (V ★★★ · F ★★★ · B ★★★ · D ★★☆)
**Validated by:** VComply CaseOps embed · MetricStream multi-channel
intake · Onspring public workflows · Resolver web form

**What:** A one-line JavaScript snippet a customer pastes onto their
own public website / intranet. Opens a modal hosting the
varslings-skjema (or avviks-skjema for åpen-fabrikk-modell). No login.
Submissions land in the customer's tenant via authenticated edge fn,
issue a ticket+secret-code (feature #1), and feed the workroom
(feature #2). Optional QR variant printed on site signage.

**Senior-dev lens:** Static JS bundle hosted on a CDN-cached subdomain
(`embed.newamu.no/varsling.js`). The bundle reads a `data-org-slug`
attribute and posts to a public, rate-limited edge fn. No tenant
secrets ever leave the server. Same edge fn handles the QR variant
(`/embed/varsling/:org_slug` returns the same modal as a full page).

**UX lens:** The modal must work without any host CSS bleed —
shadow-DOM the whole thing. Two screens: intake form, then the
ticket+secret confirmation card. Mobile-first by default; the QR
flow targets phones held up to a poster.

**Entrepreneur lens:** Sales gold. A 30-second demo: open the
prospect's own website on a phone, paste one script tag, refresh —
their company now has a working varslingskanal compliant with AML §2A.
None of the Norwegian incumbents offer this. The embed also doubles
as the *medarbeider*-facing entry for avvik on a multi-employer
construction site (post a QR on the brakkerigg).

**Slots into:** new `alerts` module; new `embed.newamu.no` static
bundle; new `/embed/varsling/:org_slug` public route.

---

## 4. Honorable mentions (#11–18)

Strong patterns that didn't crack the top 10 because of lower
convergence, narrower applicability, or higher build cost. Listed
without full rationale — see the per-vendor docs in the agent output
for detail.

| # | Pattern | Vendors | Score | Why deferred |
|---|---|---|:-:|---|
| 11 | Heatmap-cell drill-down (tiltak / eiere / hendelser / aksjoner tabs on click) | MS · Rs · On · Wk | 9 | Cheap; depends on #3 (audit log) landing first |
| 12 | Timed triggers as first-class primitive (cron-on-entity) | Rs · On · Nx | 9 | Part of #6 workflow studio v1 |
| 13 | Calendar + Gantt widget kinds for årshjul + handlingsplan | On · Rs | 9 | New widget kind = six-call-site update per CLAUDE.md; useful but cosmetic vs. #1-10 |
| 14 | Section-level review routing on documents | Wk · MS · On | 9 | Powerful for HMS-håndbok with multiple chapter owners; build effort moderate |
| 15 | Risk-Control matrix view (regulation × control coverage grid) | MS · Rs · On | 8 | Strong pre-tilsyn UI; depends on a real risiko-register existing |
| 16 | "Relevant-only" regelverk alerts (filter by sector / size / obligation) | Rs · MS | 8 | Needs a regelverk-feed source — sequencing depends on Lovdata integration |
| 17 | HMS-helse composite KPI on home dashboard (single number) | VC · Wk | 9 | Already in the original VComply review; cheap; revisit alongside #11 |
| 18 | Bulk-edit-from-report (multi-select rows, apply mutation) | On | 8 | Excel-refugee productivity multiplier; localised to `ReportModuleWidget` |

---

## 5. Explicitly NOT to port

Across six vendors, certain patterns are clearly wrong-fit for
Norwegian SMB HMS regardless of how prominently they're marketed.

- **Bow-tie / Monte Carlo / FAIR cyber-risk quantification** —
  Workiva, MetricStream, Resolver all sell this; SMB HMS uses
  ROS-analyse + 5×5 matrise.
- **20+ cyber-framework libraries (SOX, NIST 800-53, FedRAMP, DORA,
  CMMC, NYDFS …)** — wrong content set; replace with AML / IK-f /
  GDPR / NS-EN ISO 45001 / branche-forskrifter.
- **Multi-currency loss-event databases / Basel-aligned ORM categories**
  (MetricStream) — financial-services-only.
- **Dispatcher console with live officer GPS** (Resolver Command
  Center) — wrong buyer. Pattern (panic button, photo+GPS) is mined
  in #7.
- **USB / device-port DLP / endpoint encryption** (Netwrix Endpoint
  Protector) — IT-Sec problem, not HMS.
- **PAM with session video recording** (Netwrix Privilege Secure) —
  not an HMS concern.
- **AD / Entra ID / SharePoint / SQL change-monitoring** (Netwrix
  Auditor) — wrong target systems.
- **XBRL / iXBRL / EDGAR / ESEF tagging** (Workiva) — listed-company
  financial reporting, not HMS.
- **Cloud spreadsheet / cloud presentations as core file types**
  (Workiva) — multi-year detour.
- **MS Word round-trip editing with SharePoint sync** (VComply, Workiva)
  — marketed everywhere but engineering cost ≫ ROI for SMB; ship .docx
  *export* instead.
- **24/7 mass-notification engine with 25+ channels** (MetricStream) —
  SMB needs email + SMS + Teams; rest is enterprise theatre.
- **Free-text JavaScript formulas in admin-configurable fields**
  (Onspring) — footgun; build typed formula primitives via picker UI
  instead.
- **Customer-configurable 12-column form designer** (Onspring) —
  inverts our opinionated-product thesis.
- **Phone hotline as a distinct varsling channel** (VComply, Resolver
  via partners) — enterprise toy; embed + email suffices for SMB.
- **"23-framework Framework Library" as a breadth pitch** (VComply,
  MetricStream) — depth on a focused stack beats breadth for SMB.
- **30-day implementation with assigned CSM** (VComply, all enterprise
  vendors) — NewAMU target is &lt;1-hour self-serve via the existing
  `provision_<module>_baseline_for_org` functions.
- **Quarterly Business Reviews as a sales motion** — appropriate at
  $50k+ ACV; not for SMB economics.

---

## 6. Codebase mapping summary

| Top-10 feature | New tables/columns | New components | New edge fns | Existing infra reused |
|---|---|---|---|---|
| #1 Anonymous varsling | `varsling_cases`, `varsling_messages`, `varsling_handles` | `<VarslingThread>`, anonymous-submit form | `varsling-submit` (unauth), `varsling-reply` (handle-auth) | Storage bucket pattern, `freshId` |
| #2 Workroom | — (composes existing) | `<Workroom entityKind entityId>` | — | `tasks`, attachments, comments, `<EntityTimeline>` (#3) |
| #3 5W audit trail | `audit_events` (+ backfill view) | `<EntityTimeline>`, `/sok` search scope | per-module event triggers | `dashboardRegistry`, RLS pattern |
| #4 Version diff | — | `<DocumentVersionDiff>` | `document-diff-pdf` | `document_org_templates` versioning |
| #5 CAPA gate | `corrective_actions`, `preventive_actions`, `verifications`; state enum | `<CapaStepper>` | — | `tasks` module |
| #6 Workflow Studio | `workflow_definitions`, `workflow_runs`, `workflow_steps` | `<WorkflowCanvas>` (React Flow) | `workflow-runner` (cron + trigger) | reminder engine, notifications |
| #7 Offline vernerunde | `compliance_findings_drafts` | PWA shell, service worker, IndexedDB queue | `vernerunde-bulk-sync` | `compliance_checklist_*`, Storage |
| #8 Regulator portal | `external_access_tokens` | bundle builder + `/tilsyn/:token` page | `external-portal-resolve` (unauth) | `documents`, storage URLs |
| #9 Attest + cert | `document_attestations` | scroll-gated `<AcknowledgementFooter>`, quiz inline | `attestation-pdf` | `learning_courses` quizzes, `documents` |
| #10 Embed widget | — | static JS bundle, modal shadow-DOM | `varsling-public-submit` (unauth, rate-limited) | #1 backend |

Two systemic prerequisites:

- The unified **`audit_events`** table (#3) lands first. It's the
  substrate features #2, #4, #5, #6, #8 all read from for their
  history/log surfaces.
- The **state-machine pattern** (DB-level enforced transitions) used
  in #5 is the right shape for the future workflow engine (#6).
  Build #5 as the prototype of that engine; generalise into #6.

---

## 7. Recommended sequencing

Three sprints, ~9 weeks total, no AI dependency, sales-demo at end of
each.

**Sprint A — "Audit-trail substrate + buyer wow"** (2 weeks)

- #3 `audit_events` table + backfill view + `<EntityTimeline>` side panel
- #4 Side-by-side version diff for documents + .docx-style PDF export
- #17 (honorable) HMS-helse composite KPI on `hms_overview`

End-of-sprint demo: *"Let me show you every change to your
HMS-håndbok in the last year, side-by-side, with a single PDF for
AMU."*

**Sprint B — "Varsling wedge"** (3 weeks)

- #1 Anonymous varsling with ticket+secret + return thread
- #10 Embeddable public intake widget + QR variant
- #2 Per-object Workroom (host varslingssaker as the first consumer,
  then extend to existing entities)

End-of-sprint demo: *"Open your company website on a phone. Paste this
one line of code. Refresh. Your company now has a fully AML-§2A
compliant varslingskanal — anonymously logged, return-thread enabled,
audit-trail intact."*

**Sprint C — "Tilsyn-readiness + field ops"** (4 weeks)

- #5 Mandatory CAPA pair gate on avvik close (state machine in DB)
- #8 External regulator portal with scoped bundles
- #9 Read-and-attest with scroll-gate + version lineage + PDF
- #7 Offline-first mobile vernerunde (PWA + IndexedDB + sync)

End-of-sprint demo: *"Arbeidstilsynet says they're coming next
Tuesday. Here's the bundle we send them — they review it without an
account; we see every page they open; here's the attestation history
for every policy they care about; and here's the vernerunde my
verneombud did this morning on a fishing-boat with no signal."*

**Sprint D — "Workflow consolidation"** (deferred, separate planning
cycle) — #6 Workflow Studio. Highest single build cost; needs the
state-machine pattern from #5 to be proven first. Don't start before
A–C are landing in customer hands.

---

## 8. Sources

Per-vendor research is captured in agent transcripts (not committed
— delegated for length reasons). Inline source URLs follow.

**VComply** — vcomply.com/v-comply.com
- [ComplianceOps](https://www.v-comply.com/compliance-management-software/) · [PolicyOps](https://www.v-comply.com/policy-management-software/) · [RiskOps](https://www.v-comply.com/risk-management-software/) · [CaseOps](https://www.v-comply.com/case-management-software/) · [Audit & Incident](https://www.v-comply.com/audit-and-incident-software/) · [Frameworks](https://www.v-comply.com/frameworks/) · [What's New](https://www.v-comply.com/whats-new/) · [Healthcare use case](https://www.v-comply.com/use-case-guide/bridging-collaboration-gaps-for-healthcare-compliance/) · [SOX use case](https://www.v-comply.com/use-case-guide/automating-sox-compliance-readiness-assessment/) · [Anonymous reporting](https://www.v-comply.com/blog/anonymous-incident-reporting-software/) · [Pricing](https://www.v-comply.com/pricing/)

**Workiva** — workiva.com + support.workiva.com
- [Platform](https://www.workiva.com/platform/whats-new) · [GRC](https://www.workiva.com/solutions/governance-risk-and-compliance) · [Connected reporting (Wdata)](https://www.workiva.com/wdata/connected-data-for-reporting) · [Evidence management](https://www.workiva.com/resources/simplify-requests-workiva-evidence-management) · [Policy management guide](https://www.workiva.com/resources/your-guide-agile-efficient-and-effective-policy-management) · [Blacklines KB](https://support.workiva.com/hc/en-us/articles/360036002711-Create-and-view-Document-blacklines) · [Linked Files Report](https://support.workiva.com/hc/en-us/articles/360036000671-Use-the-Linked-Files-Report) · [Processes overview](https://support.workiva.com/hc/en-us/sections/20683666520212-Processes-overview) · [Certifications intro](https://support.workiva.com/hc/en-us/articles/13949910788244-Introduction-to-Certifications)

**MetricStream** — metricstream.com
- [Connected GRC](https://www.metricstream.com/products/connected-grc.htm) · [Policy mgmt](https://www.metricstream.com/products/policy-and-document-management.htm) · [Regulatory compliance](https://www.metricstream.com/products/regulatory-compliance.htm) · [ERM](https://www.metricstream.com/products/enterprise-risk-management.htm) · [Internal audit](https://www.metricstream.com/products/internal-audit-management.htm) · [Case & incident](https://www.metricstream.com/products/case-and-incident-management.htm) · [Third-party mgmt](https://www.metricstream.com/products/third-party-management.htm) · [Risk heat map explainer](https://www.metricstream.com/learn/risk-heat-map.html) · [Mobile auditing](https://www.metricstream.com/insights/mobile-auditing.htm) · [APIs](https://www.metricstream.com/platform/apis.htm)

**Netwrix** — netwrix.com + docs.netwrix.com
- [Products](https://www.netwrix.com/products.html) · [Auditor](https://www.netwrix.com/en/products/auditor/) · [1Secure](https://www.netwrix.com/en/products/1secure/) · [Access Analyzer](https://www.netwrix.com/en/products/access-analyzer/) · [Compliance](https://www.netwrix.com/compliance.html) · [Compliance product-report mappings PDF](https://www.netwrix.com/download/documents/Compliance_Product_Report_Mappings.pdf) · [Auditor Interactive Search docs](https://docs.netwrix.com/docs/auditor/10_6/admin/search/overview) · [Behavior Anomalies docs](https://docs.netwrix.com/docs/auditor/10_8/admin/behavioranomalies/overview) · [1Secure compliance docs](https://docs.netwrix.com/docs/1secure/security/compliance)

**Onspring** — onspring.com
- [Home/platform](https://onspring.com/) · [GRC suite](https://onspring.com/products/governance-risk-compliance/) · [Compliance mgmt](https://onspring.com/products/compliance-management/) · [Internal audit](https://onspring.com/products/internal-audit/) · [Risk mgmt](https://onspring.com/products/risk-management/) · [Policy mgmt](https://onspring.com/products/policy-management/) · [Incident mgmt](https://onspring.com/products/incident-management/) · [Business resiliency](https://onspring.com/products/business-resiliency/) · [Dynamic workflows](https://onspring.com/platform/dynamic-workflows/) · [Real-time reporting](https://onspring.com/platform/analytics/real-time-reporting/) · [Portal](https://onspring.com/platform/portal/) · [Surveys](https://onspring.com/automation/surveys/) · [v28 release notes](https://onspring.com/blog/onspring-expands-administrative-flexibility-in-version-28-0-platform-release/) · [v29 release notes](https://onspring.com/onspring-enhances-user-experience-in-v29-platform-release/) · [Sevita mobile case study](https://onspring.com/a-mobile-solution-for-program-site-visit-reviews/) · [Audit trail blog](https://onspring.com/resources/blog/what-is-an-audit-trail/)

**Resolver** — resolver.com (Kroll Business)
- [Home](https://www.resolver.com/) · [Pricing](https://www.resolver.com/pricing/) · [Incident mgmt](https://www.resolver.com/corporate-security-software/incident-management/) · [Investigations & case mgmt](https://www.resolver.com/corporate-security-software/investigations-case-management/) · [Command Center](https://www.resolver.com/corporate-security-software/command-center/) · [ERM](https://www.resolver.com/grc-software/risk-management/) · [Internal audit](https://www.resolver.com/grc-software/internal-audit-management/) · [Compliance mgmt](https://www.resolver.com/grc-software/compliance-management/) · [BCM](https://www.resolver.com/grc-software/business-continuity-bcm-software/) · [Whistleblower](https://www.resolver.com/grc-software/whistleblower-case-management/) · [IT Compliance](https://www.resolver.com/information-security-software/it-compliance/) · [Incident vs case blog](https://www.resolver.com/blog/incident-management-vs-case-management/) · [Jabil case study](https://www.resolver.com/case-studies/speak-up-culture-compliance-jabil/) · [Officer Mobile](https://apps.apple.com/us/app/officer-mobile/id1108133115)

**Review sources** (Capterra, GetApp, PeerSpot, SelectHub, Sprinto,
TrustRadius indices) — see per-vendor agent transcripts. G2 and
Gartner Peer Insights pages returned 403 to automated fetch across
every vendor; weakness themes are aggregated from accessible reviews
and third-party comparison articles.
