# Tasks (Oppgaver) Architectural Parity — Stub

> Read `specs/PLAYBOOK.md` first. Read `specs/survey-parity.md` second — this
> stub copies its structure verbatim. Owner: human (decide whether tasks
> actually need the parity port, or only a subset).

**Status:** `🚧 draft` (stub only — concrete tasks pending audit).

---

## 1 · Pre-spec audit (the implementer fills this in before the human signs off)

Answer these by reading the codebase, then update §2–§5 from the survey
template:

- [ ] What's the equivalent of "templates" for tasks? (Recurring task templates? Workflow rules? `task_definitions`?)
- [ ] Do tasks have a "lock" event? (e.g. completion timestamp) Document the trigger contract analogous to survey close / checklist sign.
- [ ] What's the org-context already on tasks? Tasks often already carry `assigned_to`, possibly `department_id` — confirm and avoid duplication.
- [ ] Does tasks have an analyse surface today? (Likely the existing tasks dashboard.) Decide whether to migrate it onto `ModuleAnalyticsDashboard` or leave both.
- [ ] What dataset keys make sense? (Open-by-status, completion-rate-over-time, by-department, by-priority.)

---

## 2 · Mapping table (placeholder — fill in)

| Checklist (reference) | Tasks (target) | Notes |
|---|---|---|
| `compliance_checklist_executions` | `tasks` | TODO confirm |
| `compliance_checklist_templates` | … | TODO |
| `compliance_checklist_categories` | TODO | Probably needed if multiple workflow types coexist. |
| `signed_at` | `completed_at`? | Assumption — verify. |

---

## 3 · Capability map → tasks

Re-use the playbook §4 capability inventory. Most likely scope:

- **C-1 + C-2** Categories — only if there are clearly distinguishable
  groupings (e.g. avvik / SJA / generic todo). Otherwise skip.
- **C-3** Sidebar fixed Settings + Analyse children — always do.
- **C-4** `/tasks/analyse` page — always do (replaces / enriches existing dashboard).
- **C-5 / C-6 / C-7 / C-8 / C-9** — only if tasks gain genuinely
  template-driven workflows (e.g. SJA where "weather" / "asset" / "permit
  number" are template-specific fields).

If tasks turn out to be a flat "open / done with assignee" model, **only C-3
and C-4 apply**. Don't force the rest of the port.

---

## 4 · Open questions (block this spec from being ready)

| ID | Question | Default if unanswered |
|---|---|---|
| OQ-T1 | Are tasks template-driven enough to warrant categories + metadata_schema? | **No**, unless audit reveals a recurring-template surface. |
| OQ-T2 | Does the existing tasks dashboard need to be migrated, replaced, or left alone? | Migrate to `ModuleAnalyticsDashboard` to consolidate. |
| OQ-T3 | Does tasks already filter by department / location? | Audit-required. |

---

## 5 · Recommended next step

Before writing concrete T1…Tn, run the audit in §1 and update this file
with the actual mapping. Most modules will look like a *subset* of the
survey port, not a full copy.
