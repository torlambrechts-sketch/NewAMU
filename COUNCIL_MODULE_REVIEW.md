# Worker Council Module — Review & Enhancement Suggestions

> **Status:** Suggestions only — no code changes made.  
> **Scope:** CouncilModule.tsx, useCouncil.ts, useRepresentatives.ts, types/council.ts,  
> types/representatives.ts, data/meetingGovernance.ts, data/norwegianLabourCompliance.ts,  
> data/representativeRules.ts  
> **Law basis reviewed:** AML kap. 6–7, Internkontrollforskriften §5, Forskrift om organisering  
> ledelse og medvirkning, 2024 amendments, Simployer/Landax benchmark  

---

## 1. Legal Compliance Audit (Gaps vs. AML + IK-forskriften)

### 1.1 AMU threshold — 2024 change not reflected

**Current state:** The module hard-codes `MEETINGS_PER_YEAR = 4` as the sole threshold reference, but contains no check for the *establishment threshold* itself.

**Law:** From 1 January 2024 (AML §7-1 amended), the mandatory AMU threshold was **lowered from 50 to 30 employees**. Enterprises with 10–30 employees must establish AMU *on request* from either party.

**Gap:** The compliance checklist (c1 in `norwegianLabourCompliance.ts`) says "der lov eller avtale krever det" without surfacing the 30-employee threshold as a concrete warning. The module has no employee-count field, so it cannot flag "you are above/below the threshold". An auditor inspecting the system would expect this to be visible.

**Suggestion:** Add an optional `employeeCount` setting to the Council module settings (or pull from the Organisation module once that data exists). Compute and display: "Virksomheten med X ansatte er **lovpliktig** til å ha AMU (≥30)" or "**kan be om** AMU (10–30)". Show this in the Overview tab as a compliance badge, not buried in the checklist.

---

### 1.2 Verneombud threshold — also changed in 2024

**Current state:** The Representatives/Members tab tracks verneombud via the AMU composition panel but has **no threshold check for verneombud itself**.

**Law:** From 1 January 2024 (AML §6-1 amended), all workplaces with **5 or more employees** must elect at least one verneombud. Previously this was 10 employees.

**Gap:** The system tracks who the verneombud *is*, but never alerts if the organisation has ≥5 employees and no verneombud is registered. This is a material compliance gap.

**Suggestion:** In the "Styre og valg → AMU og sammensetting" panel, add a validation badge: if employee count ≥5 and no verneombud is registered → "**Mangler verneombud** — lovpålagt fra §6-1 (5+ ansatte)". The current `validation.ok` flag only checks 50/50-split; it should also check verneombud presence.

---

### 1.3 Verneombud posting obligation

**Law:** AML §6-1 requires that whoever functions as verneombud must be **publicly posted** at the workplace at all times.

**Gap:** There is no generated "Verneombudsoppslag" (notice) or export. Competitors like Simployer generate a printable notice that can be posted.

**Suggestion:** Add a "Generer oppslag" button that produces a print-styled page (CSS `@media print`) with the verneombud's name, role, area, contact, and election date — ready to print and post.

---

### 1.4 AMU term length — not validated

**Current state:** `RepresentativePeriod` has `startDate` and `endDate` fields, and `RepresentativeMember` has `termUntil`. But no rule enforces or warns about the standard 2-year term.

**Law:** AML §6-1 specifies verneombud terms of 2 years. For AMU members, the standard is aligned with the election period (typically 2 years per the Forskrift om organisering, ledelse og medvirkning §3-4).

**Gap:** A representative could be set to a 5-year term with no warning. When a term expires, the module shows no alert.

**Suggestion:** 
- Validate term length on creation: warn if `endDate - startDate > 2 years`.
- Add an "Utløpende verv"-badge in the overview and Årshjul for representatives whose term expires within the next 60 days.
- Add `termExpiry` events to the Årshjul module (they already pull from `hse.trainingRecords` — the same pattern should apply to representative terms).

---

### 1.5 AMU annual report (§7-4) — not present as a structured output

**Law:** AML §7-2 (6) requires AMU to submit an annual report to the company's governing bodies and employee organisations every year. The report must cover: committee composition, meeting activity, processed cases, sick leave statistics, HMS revisions, occupational accidents/diseases follow-up, and evaluation of work environment.

**Current state:** The "AMU-årsrapport" wiki template exists in the Documents module, but it is a free-text wiki page. There is **no structured form** in the Council module itself that generates this from the actual meeting/decision data.

**Gap:** Users must manually write the report. Enterprise systems auto-populate from meeting minutes, decision log, and sick-leave data. This is a major differentiator vs. Landax and Simployer.

**Suggestion:** Add a "Generer årsrapport" wizard in the Meetings/Overview tab that:
1. Pre-fills sections from real data: number of meetings held, agenda topics processed, compliance checklist completion, decisions from audit trail, linked sick-leave stats from OrgHealth module.
2. Allows free-text augmentation.
3. Exports as PDF or renders as a printable wiki page.
4. Stores the completed report as a Document (linking to the wiki Documents module).

---

### 1.6 AMU agenda documentation — minimum required content missing

**Law:** The Forskrift om organisering, ledelse og medvirkning §3-2 specifies that AMU agendas must be **sent to members at least one week before the meeting**. The AML §7-2 itemises what topics AMU *must* address annually (HMS-plan, sykefravær, risk assessments, work environment surveys, etc.).

**Current state:** Agenda items are free-text with no check against mandatory topics. Meeting invitations are not tracked (sent/not sent, timestamp, recipients).

**Gap:** No enforcement of the 1-week notice rule; no coverage check for mandatory AMU topics.

**Suggestions:**
- Add `invitationSentAt` and `invitationRecipients[]` to `CouncilMeeting`.
- Add a compliance badge in the preparation tab: "Innkalling sendt [date] (X dager før møtet)" — red if < 7 days.
- Add a "Manglende obligatoriske saker"-check: compare this year's meeting agenda topics against the mandatory AML §7-2 annual checklist. Flag any uncovered items.

---

### 1.7 Absence of conflict-of-interest / impartiality tracking

**Law:** AML §7-3 establishes a chair rotation rule (alternating employer/employee side). The Forskrift also requires that AMU members declare conflicts of interest for specific agenda items.

**Current state:** No conflict-of-interest field on agenda items or meetings.

**Suggestion:** Add a `conflictOfInterest?: { memberId: string; reason: string }[]` to `AgendaItem`. Show in the meeting detail with a warning badge. Simple to implement, high compliance value.

---

## 2. Functional Gaps vs. Enterprise Systems (Landax / Simployer Benchmark)

### 2.1 Meeting invitations are not tracked

Landax and Simployer generate and track formal meeting invitations with: recipient list, sent timestamp, read receipts. The current system has no invitation workflow — the `preparationChecklist` has a "Innkalling sendt"-checkbox but nothing is generated or timestamped automatically.

**Suggestion:** Add an "Send innkalling"-action on the meeting card that:
- Generates a printable/exportable meeting invitation (title, date, location, agenda items, preparation notes).
- Records `invitationSentAt` on the meeting.
- Shows "Innkalling sendt [timestamp]" badge visible to all.

---

### 2.2 Meeting minutes (referat) are unstructured

**Current state:** `minutes` is a free-text string. Enterprise systems structure the minutes by agenda item: each item has a discussion record, decisions made, votes (if any), and action points assigned.

**Suggestion:** Replace or supplement the free-text `minutes` with a **per-agenda-item minutes structure**:
```
AgendaItem += {
  minutesSummary: string        // brief summary of discussion
  decision?: string             // formal decision if taken
  voteFor?: number              // number voting in favour
  voteAgainst?: number
  voteAbstain?: number
  actionItems: ActionPoint[]    // linked to tasks system
}
```
Each agenda item's action points should auto-create tasks in the Tasks/Action Board module.

---

### 2.3 Decision register — not searchable

**Current state:** Decisions are buried in the `auditTrail` per meeting (kind: 'decision'). There is no cross-meeting decisions list.

**Benchmark:** Every serious governance platform has a "Vedtaksregister" — a chronological list of all formal decisions across all meetings, searchable and filterable. This is critical for auditors and for tracking whether previous AMU decisions have been acted upon.

**Suggestion:** Add a "Vedtaksregister" sub-tab (or sidebar section) that aggregates all `auditTrail` entries with `kind === 'decision'` across all meetings into a searchable table with columns: Date, Meeting, Decision text, Follow-up status (linked to tasks).

---

### 2.4 Action point tracking from meetings

**Current state:** `AddTaskLink` is available in the meeting detail panel, allowing manual task creation. But there is no automatic tracking of whether meeting action points are actually resolved.

**Benchmark:** Landax shows a "Gjenstående tiltak fra forrige møte" section at the top of each new meeting — tasks from the previous meeting that are not yet closed. The AMU chair can see immediately what was promised and whether it was delivered.

**Suggestion:** In the meeting preparation panel, add a "Gjenstående fra forrige møte"-section that queries the Tasks module for tasks with `sourceType === 'council_meeting'` and `status !== 'done'`. Show them as a pre-filled checklist that the chair can review.

---

### 2.5 Election process lacks secret ballot mechanics

**Current state:** Votes are per-candidate buttons. In "anonymous" mode, candidate names are hidden until closure, but anyone can vote multiple times (prevented by a basic `voterToken` in localStorage). The vote is not truly secret — it is a demo approximation.

**Benchmark:** Real election systems use:
- Single-use vote tokens (tied to authenticated users)
- Cryptographic proof of vote uniqueness without linking voter identity to candidate
- Vote verification without disclosure

**Suggestion (realistic for this architecture):**
- Add a **voter eligibility list** (pull from Organisation module employees) — only listed employees can vote.
- Generate a unique **QR code or one-time PIN** per eligible voter per election.
- Display aggregate vote counts only after closure — never reveal individual votes.
- Add a "Ugyldig stemme"-category for votes with no eligible token.

This gets significantly closer to the legal requirement in AML §6-1 (anonymt valg) without full cryptographic PKI.

---

### 2.6 No notification or reminder system

**Current state:** Meetings, compliance deadlines, and term expiries exist but generate no proactive alerts outside the Årshjul and Action Board.

**Benchmark:** Simployer sends email/push notifications for: upcoming meeting, overdue compliance item, representative term expiring, 40-hour training not completed.

**Suggestion:** Add a "Varslingsinnstillinger" section under Council Settings (tie into the existing settings modal). Configure which events generate dashboard badges. For production: hook into an email/push system. For the current architecture: show a persistent "Varsler" panel in the Overview tab driven by computed `overdue` / `upcoming` lists.

---

### 2.7 40-hour training tracking not connected to Representatives

**Current state:** `trainingChecklist` on `RepresentativeMember` is a boolean map. The Learning module has proper course tracking with certificates. There is no connection between the two.

**Benchmark:** Simployer's "HMS for verneombud og AMU — 40 timer" is directly linked to the HR profile. Completion is confirmed by a certificate.

**Gap:** A representative could be marked "opplæring fullført" in the checklist without any corresponding Learning certificate.

**Suggestion:** Add an optional `learningCertificateId?: string` to `RepresentativeMember`. In the training checklist, show a "Koble til e-læringssertifikat"-button that lets the user select a certificate from `useLearning().certificates`. Display the certificate date and verify code as proof.

---

## 3. UX and Architecture Observations

### 3.1 Module is a 1 869-line monolith

The entire Council module is a single file with 7 tabs, all state in one component, and sub-components (`MemberColumn`, `PreparationPanel`, `MeetingDetailPanel`, `RepElectionCard`, `ElectionCard`) defined at the bottom of the same file.

**Implication:** The component is approaching the point where it will be difficult to maintain. State management in a 130-line `CouncilModule()` function means every tab re-renders when any tab's state changes.

**Suggestion:** Split into:
```
src/pages/council/
  CouncilOverview.tsx
  CouncilBoard.tsx        (Styre og valg + AMU)
  CouncilElection.tsx     (Valg representanter)
  CouncilRequirements.tsx
  CouncilMeetings.tsx
  CouncilPreparation.tsx
  CouncilCompliance.tsx
```
Keep `CouncilModule.tsx` as a thin router that renders the active tab. This is the same pattern used in the Learning module.

---

### 3.2 Two parallel election systems (council + representatives) create conceptual confusion

**Current state:** There are two separate election flows:
- `useCouncil` → `Election` type → elects `BoardMember[]` (3 roles: leader/deputy/member)
- `useRepresentatives` → `RepElection` type → elects `RepresentativeMember[]` (6 roles, 50/50 split)

In practice, these serve overlapping purposes. The Council board election is a simplified version; the Representatives election is the legally correct AMU composition model.

**Gap:** An admin could run both elections for the same people with no cross-reference. There is no validation that the council `BoardMember` list and the representative `RepresentativeMember` list are consistent.

**Suggestion:** Consider consolidating to a single election model that produces both the `BoardMember` list and the `RepresentativeMember` list from the same vote. If both models must coexist, add a "Synkroniser styre med AMU-representanter"-function that copies results between the two.

---

### 3.3 Audit trail is per-meeting but decisions need a global view

**Current state:** Each `CouncilMeeting` has its own `auditTrail: AuditEntry[]`. There is no global audit trail for Council/Representatives state changes.

**Suggestion:** Add a global `councilAuditLog: AuditEntry[]` to the `CouncilState` (parallel to `useHse`'s audit trail) that captures all significant events: elections created/closed, representatives added/updated, compliance items ticked, protocol signed.

---

### 3.4 Protocol signatures are demo-only and not clearly labelled

**Current state:** The protocol signature UI says "Registrerer navn og tid (demonstrasjon). Juridisk signatur krever eSignatur." This is correct, but the data model stores `protocolSignatures` on the meeting object in localStorage without any legal weight.

**In production**, a legally binding protokoll must be signed via an eSignature service (BankID, Verified, SigniCat). The current model should be clearly labelled as a **workflow pre-step** (confirmation of intent to sign), not a signature.

**Suggestion:** Rename the field `workflowConfirmations` and the UI label to "Bekreftelse (forhåndsregistrering — ikke juridisk signatur)". Add a prominent link to integrate an eSignature service in production. This avoids any misunderstanding that the checkbox constitutes a legal signature.

---

## 4. Data Model Gaps

### 4.1 `CouncilMeeting` missing fields

| Missing field | Why needed | Law/best practice |
|---|---|---|
| `invitationSentAt?: string` | Track 7-day notice rule | Forskrift om org. ledelse og medvirkning §3-2 |
| `invitationRecipients?: string[]` | Who was invited | Meeting governance best practice |
| `quorum?: boolean` | Was meeting quorate | Required for valid decisions |
| `attendees?: string[]` | Who actually attended | Protocol best practice |
| `nextMeetingProposed?: string` | Date proposed for next meeting | AMU årshjul continuity |
| `decisionCount?: number` (computed) | For annual report auto-generation | §7-2 (6) |

### 4.2 `RepresentativeMember` missing fields

| Missing field | Why needed | Law/best practice |
|---|---|---|
| `isVerneombud: boolean` | Distinguish verneombud from AMU member | AML §6-1 vs §7-1 |
| `verneombudArea?: string` | Which section/area they cover | AML §6-1 (verneområde) |
| `learningCertificateId?: string` | Link to 40-hr HMS course | AML §6-5 / §7-4 |
| `postingConfirmedAt?: string` | Date of workplace posting | AML §6-1 posting obligation |

### 4.3 No `WorkplaceSettings` for organisation parameters

The system needs: `employeeCount: number`, `hasCollectiveAgreement: boolean`, `collectiveAgreementName?: string` to correctly compute legal thresholds and display accurate compliance badges.

---

## 5. Prioritised Suggestion List

High impact, low complexity first:

| # | Suggestion | AML basis | Effort |
|---|---|---|---|
| 1 | Employee count setting → auto-compute AMU/verneombud threshold badges | §6-1, §7-1 (2024) | Low |
| 2 | Verneombud presence validation in AMU-sammensetting | §6-1 (2024) | Low |
| 3 | Term expiry warnings (60-day) in Overview + Årshjul | §6-1, org. forskrift §3-4 | Low |
| 4 | "Generer verneombudsoppslag" print page | §6-1 posting obligation | Low |
| 5 | Decision register (Vedtaksregister) tab | AMU governance best practice | Medium |
| 6 | "Gjenstående tiltak fra forrige møte" in preparation | Landax best practice | Medium |
| 7 | Meeting invitation tracking + 7-day badge | Org. forskrift §3-2 | Medium |
| 8 | Structured per-agenda-item minutes | §7-2 best practice | Medium |
| 9 | Auto-generate AMU årsrapport from data | §7-2 (6) — legally required | Medium |
| 10 | Connect representative training checklist to Learning certificates | §6-5 / §7-4 | Medium |
| 11 | Quorum + attendees tracking on meetings | Protocol best practice | Low |
| 12 | Split CouncilModule.tsx into sub-pages | Architecture / maintainability | Medium |
| 13 | Voter eligibility list for elections | §6-1 anonymt valg | High |
| 14 | Rename protocol signatures to "workflow confirmations" + eSign link | Legal accuracy | Low |
| 15 | Consolidate two election systems | Architecture consistency | High |

---

## 6. Competitive Positioning Summary

| Feature | Current state | Simployer | Landax | Suggestion |
|---|---|---|---|---|
| AMU threshold computation | ❌ None | ✅ | ✅ | Add employee count → threshold badge |
| Verneombud threshold (5+) 2024 | ❌ None | ✅ | ✅ | Add validation |
| Meeting invitation tracking | ❌ Checkbox only | ✅ Auto-send | ✅ | Add sent timestamp + print |
| Per-item minutes structure | ❌ Free text | ✅ | ✅ | Add per-item minutes model |
| Decision register | ❌ None | ✅ | ✅ | New Vedtaksregister tab |
| AMU annual report (§7-4) | Partial (wiki template) | ✅ Auto-generate | ✅ | Wizard + data pre-fill |
| Term expiry alerts | ❌ None | ✅ Email | ✅ | Badges + Årshjul events |
| Training → certificate link | ❌ Manual checkbox | ✅ Integrated | ✅ | Link to Learning module |
| eSignature ready | ❌ Clearly demo | ✅ BankID | ✅ | Label + integration point |
| Conflict of interest tracking | ❌ None | Partial | ✅ | Add to AgendaItem |
| Voter eligibility list | ❌ localStorage token | ✅ HR-integrated | ✅ | Link to Organisation module |

The module is already **considerably ahead of most open-source alternatives** in structure and law coverage. The gaps are primarily in the 2024 threshold changes, meeting protocol depth, and output/export features. The suggestions above, implemented in priority order, would bring it to enterprise compliance software standard.
