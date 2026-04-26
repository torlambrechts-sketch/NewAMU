# Step 12 — Self-Review Checklist

Run this checklist on every file in `modules/amu/` before marking the implementation done.

---

## Component rules (from `AI_INSTRUCTION_SET.md`)

- [ ] Zero `<button className="…">` anywhere — all must be `<Button variant="…">`
- [ ] Zero `<input className="…">` or `<textarea className="…">` — all must be `<StandardInput>` / `<StandardTextarea>`
- [ ] Zero `<select>` — all must be `<SearchableSelect>`
- [ ] Zero raw status pill `<div className="…rounded…">` — all must be `<Badge variant="…">`
- [ ] Every legal reference is inside `<ComplianceBanner refs={[…]}>` or `<Badge>`, never plain text
- [ ] Every page is wrapped in `<ModulePageShell>` — each card uses `<ModuleSectionCard>`
- [ ] All UI text is Norwegian Bokmål — no English copy visible to the user
- [ ] All Supabase calls are in `useAmu.ts` — UI files do not import `supabase` except the two approved exceptions (WhistleblowingStats RPC, annual report section autosave)
- [ ] Errors render via `<WarningBox>` — no `console.log`, no `alert()`
- [ ] `canManage` gates every mutating button or form
- [ ] `canChair` gates sign-off buttons
- [ ] Severity left-border classes applied to all risk/critical rows

---

## AML compliance (from `05_LEGAL_RULES.md`)

- [ ] `amu_compliance_status` view covers all 12 rules in the table
- [ ] Immutability: `signed` and `archived` rows blocked by RLS on all 8 tables
- [ ] Whistleblowing: only `amu_privacy_whistleblowing_stats()` RPC used — never raw `whistleblowing_cases`
- [ ] Sick-leave: only aggregate counts displayed — never individual records
- [ ] Årsrapport sign-off requires both leader AND deputy signature (`signed_by_leader` + `signed_by_deputy`)
- [ ] `canManage = isAdmin || can('amu.manage')` — this exact expression, never just `isAdmin`

---

## Database

- [ ] Migration Step 1 runs without error on a fresh schema
- [ ] Migration Step 2 views compile (check in Supabase SQL editor)
- [ ] RLS policies exist on all 8 new/altered tables
- [ ] `organization_id` auto-fill trigger on every new table
- [ ] `updated_at` trigger on every table that has the column
- [ ] Audit trigger on `amu_committees`, `amu_meetings`, `amu_decisions`, `amu_annual_reports`

---

## Types

- [ ] `modules/amu/types.ts` has no leftover types from old file (`AmuParticipantRole`, `AmuMeetingChairSide`, `AvvikOption`, `distributed_at`)
- [ ] `modules/amu/schema.ts` deleted
- [ ] All Zod schemas match DB column names exactly

---

## Hook

- [ ] `useAmu.ts` exports `canManage`, `canChair`, `canPropose` as the first three return values
- [ ] `refresh()` wraps all fetches in `Promise.all` and catches errors via `getSupabaseErrorMessage`
- [ ] All mutations call `await refresh()` after successful write
- [ ] `loadMeetingDetail` is lazy — only called from MeetingRoomTab on mount

---

## Deleted files (confirm gone)

- [ ] `modules/amu/AmuDetailView.tsx` — deleted
- [ ] `modules/amu/AmuAgendaPlanningTable.tsx` — deleted
- [ ] `modules/amu/AmuParticipantsTable.tsx` — deleted
- [ ] `modules/amu/AmuMeetingRoomTab.tsx` — deleted
- [ ] `modules/amu/schema.ts` — deleted

---

## Commit (if any fixes applied)

```
chore(amu): self-review pass — component rules, RLS, Norwegian copy
```
