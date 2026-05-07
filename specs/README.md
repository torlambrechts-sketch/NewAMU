# /specs

Architecture specs that describe work to be done, not how the system works
today (those live in repo-root `*.md` files).

## Files

| File | Status | Purpose |
|---|---|---|
| `PLAYBOOK.md` | ✅ stable | Generic process spec — slicing principle, task shape, checkpoints, architect review checklist. Read this first before any module port. |
| `survey-parity.md` | ✅ executed | Concrete plan to bring `modules/survey/` up to architectural parity with checklists. T1–T7 + 2.9 + 2.10 shipped (last commit `a3c1c77`). Spec preserved as a reference for future modules. |
| `tasks-parity.md` | ✅ executed | Tasks port T1–T3 shipped (commit `6bd167e`). |
| `elearning-parity.md` | ✅ executed (T6 completion-panel UI is a small follow-up) | Learning port T1–T7 shipped across `9a6b3d7` → `351c8fb` → `94eabeb` → `b970e4c`. The `kind: 'heatmap'` widget engine extension (E-1) is still a separate micro-feature. |

## How to execute one of these

1. Open the spec.
2. Run the architect-review checklist at its bottom — every item must pass.
3. Resolve every open question (table near the end of each spec).
4. Execute one task at a time, in the order the spec dictates.
5. Post a checkpoint comment between phases (Playbook §6).
6. Update the spec's status from `📋 ready` to `🚧 in flight` to `✅ done` as
   you go.
7. When done, mirror the change in repo-root `ROADMAP.md`.

## How to add a new spec

1. Copy `tasks-parity.md` (the simplest stub) as your starting point.
2. Run §1 pre-spec audit.
3. Replace §2 mapping table with module-specific one.
4. Use the survey spec's task shape verbatim — same headings, same fields.
5. Self-review against PLAYBOOK §7 before changing status to `📋 ready`.
