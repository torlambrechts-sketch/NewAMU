# /specs

Architecture specs that describe work to be done, not how the system works
today (those live in repo-root `*.md` files).

## Files

| File | Status | Purpose |
|---|---|---|
| `PLAYBOOK.md` | ✅ stable | Generic process spec — slicing principle, task shape, checkpoints, architect review checklist. Read this first before any module port. |
| `survey-parity.md` | ✅ executed | Concrete plan to bring `modules/survey/` up to architectural parity with checklists. T1–T7 + 2.9 + 2.10 shipped (last commit `a3c1c77`). Spec preserved as a reference for future modules. |
| `tasks-parity.md` | 📋 ready to execute | Tasks port (significantly reduced scope: only C-3 + C-4 + C-9 apply). ~1 day. |
| `elearning-parity.md` | 📋 ready to execute (after OQ-L1/L3/L6 sign-off) | E-learning port + the `kind: 'heatmap'` widget engine extension. Most parity-friendly of the three. ~2 days for the port; heatmap widget +1 day. |

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
