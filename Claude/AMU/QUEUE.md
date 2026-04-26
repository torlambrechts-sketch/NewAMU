# AMU Implementation Queue — Cursor Instructions

## How to use this file

1. Open this file in Cursor.
2. Start at **Step 1** in the queue below.
3. Open the listed spec file and copy its **entire content**.
4. Paste it into a **new Cursor Composer session** (Cmd/Ctrl + I → new session).
5. Let Cursor implement everything in that spec.
6. Run `npm run build` — fix all errors before moving on.
7. Commit with the message format shown.
8. Move to the next step.

**Never combine two spec files in one Cursor session** unless the spec
explicitly says it depends on another (those are grouped below).

---

## Before you start

Read this file first — do not skip it:

```
Claude/INSTRUCTIONS.md
```

It contains the mandatory anti-hallucination rules that apply to every session.
Paste those rules at the top of your first Cursor message if Cursor doesn't
see the file automatically.

---

## Dependency map

```
P1.2  ──►  C_AMU-A          (implement P1.2 before C_AMU-A)
P1.4  ──►  C_AMU-D          (implement P1.4 before C_AMU-D)
P2.1  ──►  C_AMU-B          (implement P2.1 before C_AMU-B)
```

All other specs are independent of each other.

---

## The queue

### Step 1 — Fix broken UUID field (P0, do this first)

**File to paste into Cursor:**
```
Claude/AMU/P0.1_source_id_picker.md
```

What it does: Replaces the non-functional raw UUID text input for `source_id`
with a proper module-linked picker.

Files Cursor will touch:
- `modules/amu/AmuDetailView.tsx`
- `modules/amu/AmuModuleAdminPage.tsx`
- `modules/amu/AmuAgendaPlanningTable.tsx`
- `modules/amu/useAmu.ts`
- `modules/amu/types.ts`

Commit message: `feat(amu): replace raw UUID source-id field with module picker`

---

### Step 2 — Auto-save minutes

**File to paste into Cursor:**
```
Claude/AMU/P1.1_minutes_autosave.md
```

What it does: Adds 2-second debounce auto-save to the referat textarea with a
visual save indicator and a `beforeunload` warning.

Files Cursor will touch:
- `modules/amu/AmuDetailView.tsx`

Commit message: `feat(amu): add auto-save with debounce for meeting minutes`

---

### Step 3 — Participant balance warning (required before Step 4)

**File to paste into Cursor:**
```
Claude/AMU/P1.2_participant_balance_warning.md
```

What it does: Shows AML §7-3/§7-4 warnings when employer/employee
representation is unbalanced or no safety deputy is present. Adds a fifth
preflight checklist item.

Files Cursor will touch:
- `modules/amu/AmuParticipantsTable.tsx`
- `modules/amu/AmuDetailView.tsx`

Commit message: `feat(amu): add participant balance validation per AML §7-3`

---

### Step 4 — Block signing on composition violation (depends on Step 3)

**File to paste into Cursor:**
```
Claude/AMU/C_AMU-A_rolle_balanse.md
```

What it does: Disables the signing button when participant composition violates
AML §7-3 or §7-4. Adds an explanatory InfoBox in the signature tab.

> ⚠️ Do NOT start this step until Step 3 is committed and `npm run build`
> exits 0. `participantBalanceOk` state must already exist.

Files Cursor will touch:
- `modules/amu/AmuDetailView.tsx`

Commit message: `feat(amu): block signing when AML §7-3 composition violated`

---

### Step 5 — Agenda up/down reorder

**File to paste into Cursor:**
```
Claude/AMU/P1.3_agenda_reorder.md
```

What it does: Replaces the manual `order_index` number field with up/down
arrow buttons. Removes the numeric input from the agenda panel.

Files Cursor will touch:
- `modules/amu/AmuAgendaPlanningTable.tsx`
- `modules/amu/AmuDetailView.tsx`

Commit message: `feat(amu): replace order_index number input with reorder buttons`

---

### Step 6 — PDF / print export of signed minutes (required before Step 11)

**File to paste into Cursor:**
```
Claude/AMU/P1.4_meeting_pdf_export.md
```

What it does: Adds an "Eksporter referat" button that opens a print-optimised
HTML page with `window.print()` — no new npm packages.

Files Cursor will touch:
- `modules/amu/AmuDetailView.tsx`

Commit message: `feat(amu): add print/PDF export for signed meeting minutes`

---

### Step 7 — Annual cycle KPI and AML §7-3 frequency warning (required before Step 8)

**File to paste into Cursor:**
```
Claude/AMU/P2.1_annual_cycle_kpi.md
```

What it does: Adds a "Fullført i år" KPI card and a WarningBox when the org
hasn't held 4 meetings in the current calendar year.

Files Cursor will touch:
- `modules/amu/AmuPage.tsx`

Commit message: `feat(amu): add annual meeting frequency KPI and AML §7-3 warning`

---

### Step 8 — Compliance dashboard meeting count fix (depends on Step 7)

**File to paste into Cursor:**
```
Claude/AMU/C_AMU-B_motefrekvens.md
```

What it does: Updates the Compliance Dashboard to count meetings from
`amu_meetings` (not wiki publications) and shows AML §7-3 status.

> ⚠️ Read `src/pages/documents/ComplianceDashboard.tsx` in full before
> Cursor edits it. The spec tells Cursor to search for existing AMU rows —
> the exact line numbers depend on the current file.

Files Cursor will touch:
- `src/pages/documents/ComplianceDashboard.tsx`

Commit message: `fix(compliance): use amu_meetings table for AMU frequency check`

---

### Step 9 — Show source case title in agenda

**File to paste into Cursor:**
```
Claude/AMU/P2.2_source_module_case_lookup.md
```

What it does: Fetches the actual case title from the linked module (e.g. avvik
title) and displays it in the agenda table instead of just "Avvik".

Files Cursor will touch:
- `modules/amu/useAmu.ts`
- `modules/amu/AmuDetailView.tsx`

Commit message: `feat(amu): display source module case title in agenda table`

---

### Step 10 — Chair rotation tracking (AML §7-5)

**File to paste into Cursor:**
```
Claude/AMU/C_AMU-C_moteleder_rotasjon.md
```

What it does: Adds a `chair_side` column to `amu_meetings`, a side-selector in
the signature tab, and an info panel in the admin page.

> ⚠️ This step requires a new migration file. Cursor must create it in
> `supabase/migrations/` with a timestamp *after* `20260731120200`. Use the
> current date/time in `YYYYMMDDHHMMSS` format.

Files Cursor will touch:
- `supabase/migrations/YYYYMMDDHHMMSS_amu_chair_side.sql` ← new file
- `modules/amu/types.ts`
- `modules/amu/schema.ts`
- `modules/amu/useAmu.ts`
- `modules/amu/AmuDetailView.tsx`
- `src/pages/AmuModuleAdminPage.tsx`

Commit message: `feat(amu): track chair-side rotation per AML §7-5`

---

### Step 11 — Distribution confirmation (AML §7-2(6)) (depends on Step 6)

**File to paste into Cursor:**
```
Claude/AMU/C_AMU-D_referat_distribusjon.md
```

What it does: Adds a `distributed_at` timestamp to `amu_meetings`, a
"Bekreft distribusjon" button in the signature tab, and a compliance InfoBox
in the workflow admin tab.

> ⚠️ This step requires a new migration file with a timestamp after the
> Step 10 migration.
>
> ⚠️ Do NOT start until Step 6 (PDF export) is committed — the spec assumes
> the export button already exists next to the distribution confirmation.

Files Cursor will touch:
- `supabase/migrations/YYYYMMDDHHMMSS_amu_distributed_at.sql` ← new file
- `modules/amu/types.ts`
- `modules/amu/schema.ts`
- `modules/amu/useAmu.ts`
- `modules/amu/AmuDetailView.tsx`
- `src/pages/AmuModuleAdminPage.tsx`

Commit message: `feat(amu): add distribution confirmation stamp per AML §7-2(6)`

---

## Summary table

| Step | File | Priority | Depends on | Migration? |
|------|------|----------|------------|------------|
| 1 | P0.1_source_id_picker.md | P0 | — | No |
| 2 | P1.1_minutes_autosave.md | P1 | — | No |
| 3 | P1.2_participant_balance_warning.md | P1 | — | No |
| 4 | C_AMU-A_rolle_balanse.md | Critical | Step 3 | No |
| 5 | P1.3_agenda_reorder.md | P1 | — | No |
| 6 | P1.4_meeting_pdf_export.md | P1 | — | No |
| 7 | P2.1_annual_cycle_kpi.md | P2 | — | No |
| 8 | C_AMU-B_motefrekvens.md | High | Step 7 | No |
| 9 | P2.2_source_module_case_lookup.md | P2 | — | No |
| 10 | C_AMU-C_moteleder_rotasjon.md | Medium | — | Yes |
| 11 | C_AMU-D_referat_distribusjon.md | High | Step 6 | Yes |

**Total: 11 specs, 2 migration files, ~20 files touched.**
