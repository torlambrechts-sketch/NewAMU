# E-learning Architectural Parity — Stub

> Read `specs/PLAYBOOK.md` first. Read `specs/survey-parity.md` second — this
> stub copies its structure. Owner: human.

**Status:** `🚧 draft` (stub only — concrete tasks pending audit).

---

## 1 · Pre-spec audit (run before going `📋 ready`)

- [ ] Where does e-learning live in the codebase? (`modules/learning/`? `src/components/learning/`?)
- [ ] What's the unit of "instance"? A course assignment? A completed module? A learning path?
- [ ] What's the "lock" event? (`completed_at`, `passed_at`, `certified_at`?)
- [ ] What's the unit of "template"? A course definition? A learning module? A path template?
- [ ] What categories exist today (or are needed)? Likely candidates:
  HMS-grunnopplæring, Brann, Førstehjelp, Verneombud, Pakke-spesifikke kurs.
- [ ] What dataset keys make sense?
  - completion-rate-over-time
  - by-course
  - by-department
  - per-user progress
  - certification-expiry-window (the genuinely e-learning-specific one)
- [ ] Is there a per-user progress concept that doesn't fit the
  "instances filtered by chip" pattern? If yes, the analyse page may
  need a different per-user-grid widget kind.

---

## 2 · Likely scope

E-learning is almost certainly the *most* template-driven of the three
modules and benefits most from the full port:

- **C-1 + C-2** Categories — yes; HMS-grunnopplæring vs Brann vs Verneombud is exactly the use case.
- **C-3** Sidebar Settings + Analyse — yes.
- **C-4** `/learning/analyse` — yes; this is probably the highest-value
  analytics surface in the product.
- **C-5** Editable instance metadata post-completion — needed for "I
  passed but the cert was issued to my old name" use cases. Trigger
  contract similar to checklists.
- **C-6** Org-context — yes, especially `department_id` and
  `participant_member_ids` (who completed what).
- **C-7 + C-8** `metadata_schema` — yes; courses vary wildly (some need
  practical-test scores, some need hours, some need an external cert ID).
  This is where the schema-driven panel earns its keep.
- **C-9** Analytics filter dimensions — yes.

E-learning likely also wants **two additions** that surveys don't:

- **Certification-expiry dimension** for filter chips (`expires_within` vs `expired`).
- **Per-user heatmap widget** (matrix of users × courses with cells coloured by completion). This is a new widget kind for the dashboard runtime — adding it would also benefit other modules eventually.

---

## 3 · Open questions

| ID | Question | Default if unanswered |
|---|---|---|
| OQ-L1 | Does the "instance" represent a course attempt, an enrolment, or a completed certificate? | Audit-required. |
| OQ-L2 | Are categories scoped per pack, or global to e-learning? | Per pack if e-learning has packs; else org-global. |
| OQ-L3 | Does the analytics page need a heatmap widget kind? | Yes — but this is a dashboard-engine extension, not in scope for the parity port. Spec it out separately and either ship it before or scope it to "users × courses table widget" using the existing `kind: 'table'`. |
| OQ-L4 | How much of the existing learning UI is there? | Run the audit first; treat any port that touches > 1500 LOC as two separate phases. |

---

## 4 · Recommended next step

Run §1 audit. If the audit reveals e-learning is genuinely template-driven
with org-context relevance (likely), this spec gets fleshed out with concrete
T1…Tn tasks following the survey-parity.md template. Expect ~4 days for the
full port (1 day longer than survey because of the heatmap consideration).
