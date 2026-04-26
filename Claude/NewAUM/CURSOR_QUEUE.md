# NewAMU — Cursor Implementation Queue

Paste **one step file** at a time into Cursor. Commit after each step before moving on.

## Before you start

**Set Cursor timeout:** Settings → AI → Request Timeout → **300** (seconds).

**Visual reference:** `Claude/NewAUM/AMU Mockup.html` — open in browser. Layout, copy, IA only — ignore its inline styles and colors.

**Design rules:** Every rule in `Claude/NewAUM/AI_INSTRUCTION_SET.md` is mandatory.

**Target directory:** `modules/amu/` — all files below live there unless stated otherwise.

---

## Step order

| # | File to paste | Creates / replaces | Commit message |
|---|---|---|---|
| 1 | `STEP_01_DB_TABLES.md` | `supabase/migrations/…_amu_redesign_tables.sql` | `feat(amu): migration — new committees/members/attendance/proposals/reports tables` |
| 2 | `STEP_02_DB_VIEWS.md` | `supabase/migrations/…_amu_redesign_views.sql` | `feat(amu): migration — compliance_status, meeting_summary, critical_queue views` |
| 3 | `STEP_03_TYPES.md` | `modules/amu/types.ts` (replace) | `feat(amu): replace types with new Zod schemas` |
| 4 | `STEP_04_HOOK.md` | `modules/amu/useAmu.ts` (replace) | `feat(amu): replace useAmu hook` |
| 5 | `STEP_05_PAGE_SHELL.md` | `modules/amu/AmuPage.tsx` (replace) | `feat(amu): page shell with 6-tab routing` |
| 6 | `STEP_06_OVERSIKT.md` | `modules/amu/tabs/OverviewTab.tsx` | `feat(amu): Oversikt tab — KPI row + next-meeting + compliance + critical cards` |
| 7 | `STEP_07_MEMBERS.md` | `modules/amu/tabs/MembersTab.tsx` | `feat(amu): Medlemmer tab — roster + composition check` |
| 8 | `STEP_08_SCHEDULE.md` | `modules/amu/tabs/ScheduleTab.tsx` | `feat(amu): Møteplan tab — timeline + topic proposal` |
| 9 | `STEP_09_MEETINGROOM.md` | `modules/amu/tabs/MeetingRoomTab.tsx` | `feat(amu): Møterom tab — live agenda cards + attendance + sign-off` |
| 10 | `STEP_10_CRITICAL.md` | `modules/amu/tabs/CriticalTab.tsx` | `feat(amu): Kritiske saker tab — avvik + whistleblowing + signatures` |
| 11 | `STEP_11_ANNUAL.md` | `modules/amu/tabs/AnnualReportTab.tsx` | `feat(amu): Årsrapport tab — 5-section draft + dual signatures` |
| 12 | `STEP_12_REVIEW.md` | — (checklist only) | `chore(amu): self-review pass — no raw HTML, all Norwegian, RLS gating` |

---

## Dependency notes

- Steps 1 and 2 must run before everything else.
- Step 3 must run before Step 4.
- Step 4 must run before Steps 5–11.
- Steps 6–11 are independent of each other but all depend on Step 5.
- Step 12 runs last.

## Old files to delete after Step 5

```
modules/amu/AmuDetailView.tsx
modules/amu/AmuAgendaPlanningTable.tsx
modules/amu/AmuParticipantsTable.tsx
modules/amu/AmuMeetingRoomTab.tsx
modules/amu/schema.ts
```
