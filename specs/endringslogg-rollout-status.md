# Endringslogg rollout — status snapshot

Companion to `endringslogg-rollout-plan.md` and `endringslogg-spec.md`.
This file records the *current* state of the rollout so anyone
landing on the branch can tell at a glance what shipped and what's
still pending.

Last updated: 2026-05-19. Status: 🛠 W0–W5 implemented; W6 retirement
pending the 14-day clean-recon window.

---

## Coverage matrix

| Module | Scope registered | Mutations wired | Live in DB | Privileged-data classified |
|---|---|---|---|---|
| compliance_checklist | ✅ | ✅ (6 mutations) | ✅ events flowing | ✅ no |
| survey | ✅ | ✅ (create + update, publish + close via delegation) | ✅ verb accepted | ✅ no (default) |
| meetings | ✅ | ✅ (create / update / signProtocol / sendInvitations / castVote) | ✅ verbs accepted | ✅ yes — see privilege.ts |
| tasks | ✅ | ✅ (createItem + updateStatus) — refactor needed for full surface | ✅ verb accepted | ✅ yes — confidentiality-gated |
| documents | ✅ | ✅ (createPage + publishPage) — body diff + archive deferred | ✅ verb accepted | ✅ yes — legal_basis-gated |
| alerts | ✅ | ✅ (createCase + addNote + setStatus + closeCase) | ✅ privileged blur verified | ✅ yes — default-true |
| learning | ✅ | ✅ (createCourse) — version/publish/edit deferred | ✅ verb accepted | ✅ no |
| registers | ⏳ awaits parity spec | — | — | partial — helper exists |

## What's verified by the DB (via MCP)

- 26-value action enum present and accepted (8 new W0 verbs working).
- `audit_events_read` view runs in definer mode + has the privilege
  masking expression — base-table SELECT revoked (B1 sealed).
- `audit_events_recon` view returns row counts per (org × table × day);
  current state shows the expected historical gap (every pre-rollout
  CDC row counts as gap because the spec deliberately chose
  fresh-start over backfill in §13.2).
- Privileged blur path verified by smoke insert: `privileged=true`
  rows have summary_nb and diff masked in the view output for
  non-privileged readers.

## What's NOT verified

- **No live user mutations through the new emit_audit_event RPC**
  outside compliance. The scope files, summary presets, and per-
  mutation wiring all type-check + lint clean, but the actual
  function calls fire only when a real user clicks the relevant
  buttons in the new app. **W6 expects 14 days of real-user
  activity** before the next retirement step.
- The recon job is currently a manual SQL query; the cron-trigger
  wrapping (R-D mitigation) is still on the W6 backlog.

## W6 — retirement plan (next 14 days)

Operationally:

1. **Days 0–3**: Watch the recon view daily. Expect a small
   one-time spike in gap for newly-wired modules as users return
   from weekends and start mutating. Any sustained gap > 5 per day
   per table indicates a missed emit; treat as a bug + ship a fix.
2. **Days 3–7**: Pilot org sign-off — verneombud writes a
   one-paragraph review of what they can reconstruct from the
   panel alone for a fake compliance check + a fake survey + a
   fake meeting. Spec acceptance criteria #1–#8 from
   `endringslogg-spec.md §14`.
3. **Days 7–14**: Wire the deferred mutations per-module as
   capacity allows. Priority order: meetings (rest of mutation
   surface, since meetings is the most active room), tasks
   (`task_activity_log` co-exists; record any drift), alerts
   (severity / assignment / attachments).
4. **Day 14**: If recon stays clean, drop the INSERT trigger on
   `task_activity_log` (keep the table for archive). PR title:
   `endringslogg: deprecate task_activity_log INSERT trigger`.
5. **Backfill button**: Ship the admin-triggered last-30-days
   backfill (W0 deferral) so existing orgs see continuity for
   pre-rollout records.

## Open follow-ups (post-W6)

- **Cron-wrap the recon script**: hourly run; Slack-ping on
  `gap > 5`. Closes R-D + R-1 + R-5 from spec §11.
- **Tablet drawer overlay + filter chips**: P3 polish, real value
  once the panel hits 50+ events per room (meetings will hit this
  first).
- **Registers parity port** + wave: requires `specs/registers-parity.md`
  to be authored first (stub created in this branch).
- **Action verbs sign-off**: A Norwegian PM should proof-read the
  ~30 summary presets across all modules before GA. The strings are
  ready in `src/lib/audit/summaryTemplates.ts`.
- **`useDocuments` refactor**: the hook is large enough that the
  per-mutation wiring becomes hard to grow further; the spec
  identifies this as `useDocumentsMutations.ts` extraction. Land
  before wiring body-diff / archive / soft-delete events.
