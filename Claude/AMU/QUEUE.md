# AMU Implementation Queue — Cursor Instructions

## Status: fullført

Alle **11 steg** i køen er implementert og **merget til `main`** (inkl. avhengigheter P1.2→C_AMU-A, P1.4→C_AMU-D, P2.1→C_AMU-B). Spesifikasjonsfilene under `Claude/AMU/*.md` er fortsatt nyttige som referanse, men køen krever ikke lenger nye implementeringsøkter.

**Etter deploy:** sørg for at migrasjonene er kjørt i målmiljøet:

- `supabase/migrations/20260731270000_amu_chair_side.sql`
- `supabase/migrations/20260731280000_amu_distributed_at.sql`

---

## How to use this file (historisk)

Denne filen beskrev opprinnelig rekkefølgen for manuell implementering. Ved nye AMU-oppgaver: les `Claude/INSTRUCTIONS.md`, opprett egen spes eller issue, og følg vanlig git-/PR-flyt i repoet.

1. Les `Claude/INSTRUCTIONS.md` først.
2. Åpne aktuell spes ved behov (listen nedenfor).
3. Kjør `npm run build` og rett feil før merge.
4. Commit-meldinger som ble brukt, står fortsatt listet per steg (anbefalt format: `feat(amu): …` / `fix(compliance): …`).

**Kombinering av spes:** ikke slå sammen to spes i én økt med mindre spes uttrykkelig krever det (avhengigheter er gruppert nedenfor).

---

## Before you start

Les alltid:

```
Claude/INSTRUCTIONS.md
```

---

## Dependency map

```
P1.2  ──►  C_AMU-A          (implement P1.2 before C_AMU-A)
P1.4  ──►  C_AMU-D          (implement P1.4 before C_AMU-D)
P2.1  ──►  C_AMU-B          (implement P2.1 before C_AMU-B)
```

Øvrige spes var uavhengige av hverandre (med unntak av kjedene over).

---

## The queue (ferdig)

### Step 1 — Fix broken UUID field (P0) — ferdig

**Spec:** `Claude/AMU/P0.1_source_id_picker.md`

Erstatter rå UUID-felt for `source_id` med modulkoblet plukker.

Filer som ble berørt (inkl. faktisk sti der det avvek fra spes):

- `modules/amu/AmuDetailView.tsx`
- `src/pages/AmuModuleAdminPage.tsx` *(spes sa `modules/amu/AmuModuleAdminPage.tsx` — faktisk fil ligger under `src/pages/`)*  
- `modules/amu/AmuAgendaPlanningTable.tsx`
- `modules/amu/useAmu.ts`
- `modules/amu/types.ts`

Commit: `feat(amu): replace raw UUID source-id field with module picker`

---

### Step 2 — Auto-save minutes — ferdig

**Spec:** `Claude/AMU/P1.1_minutes_autosave.md`

Auto-lagring av referat (debounce), indikator og `beforeunload`.

- `modules/amu/AmuDetailView.tsx`

Commit: `feat(amu): add auto-save with debounce for meeting minutes`

---

### Step 3 — Participant balance warning — ferdig

**Spec:** `Claude/AMU/P1.2_participant_balance_warning.md`

Advarsler AML §7-3/§7-4 og femte preflight-punkt.

- `modules/amu/AmuParticipantsTable.tsx`
- `modules/amu/AmuDetailView.tsx`

Commit: `feat(amu): add participant balance validation per AML §7-3`

---

### Step 4 — Block signing on composition violation — ferdig

**Spec:** `Claude/AMU/C_AMU-A_rolle_balanse.md`

Blokkerer signering ved brudd på sammensetning; InfoBox.

- `modules/amu/AmuDetailView.tsx`

Commit: `feat(amu): block signing when AML §7-3 composition violated`

---

### Step 5 — Agenda up/down reorder — ferdig

**Spec:** `Claude/AMU/P1.3_agenda_reorder.md`

Piler for rekkefølge; fjernet manuelt `order_index`-felt i panelet.

- `modules/amu/AmuAgendaPlanningTable.tsx`
- `modules/amu/AmuDetailView.tsx`

Commit: `feat(amu): replace order_index number input with reorder buttons`

---

### Step 6 — PDF / print export of signed minutes — ferdig

**Spec:** `Claude/AMU/P1.4_meeting_pdf_export.md`

«Eksporter referat» med print-vennlig HTML / `window.print()`.

- `modules/amu/AmuDetailView.tsx`

Commit: `feat(amu): add print/PDF export for signed meeting minutes`

---

### Step 7 — Annual cycle KPI and AML §7-3 frequency warning — ferdig

**Spec:** `Claude/AMU/P2.1_annual_cycle_kpi.md`

KPI «Fullført i år» og varsel under terskel.

- `modules/amu/AmuPage.tsx`

Commit: `feat(amu): add annual meeting frequency KPI and AML §7-3 warning`

---

### Step 8 — Compliance dashboard meeting count — ferdig

**Spec:** `Claude/AMU/C_AMU-B_motefrekvens.md`

Teller fra `amu_meetings`, ikke wiki-publikasjoner.

- `src/pages/documents/ComplianceDashboard.tsx`

Commit: `fix(compliance): use amu_meetings table for AMU frequency check`

---

### Step 9 — Show source case title in agenda — ferdig

**Spec:** `Claude/AMU/P2.2_source_module_case_lookup.md`

Viser faktisk sakstittel (f.eks. avvik) i agenda.

- `modules/amu/useAmu.ts`
- `modules/amu/AmuDetailView.tsx`

Commit: `feat(amu): display source module case title in agenda table`

---

### Step 10 — Chair rotation tracking (AML §7-5) — ferdig

**Spec:** `Claude/AMU/C_AMU-C_moteleder_rotasjon.md`

Kolonne `chair_side`, velger i signering-fanen, info i admin.

Migrasjon (faktisk filnavn):

- `supabase/migrations/20260731270000_amu_chair_side.sql`

Øvrige filer:

- `modules/amu/types.ts`
- `modules/amu/schema.ts`
- `modules/amu/useAmu.ts`
- `modules/amu/AmuDetailView.tsx`
- `src/pages/AmuModuleAdminPage.tsx`

Commit: `feat(amu): track chair-side rotation per AML §7-5`

---

### Step 11 — Distribution confirmation (AML §7-2(6)) — ferdig

**Spec:** `Claude/AMU/C_AMU-D_referat_distribusjon.md`

`distributed_at`, «Bekreft distribusjon», InfoBox i arbeidsflyt-fanen (admin).

Migrasjon (faktisk filnavn):

- `supabase/migrations/20260731280000_amu_distributed_at.sql`

Øvrige filer:

- `modules/amu/types.ts`
- `modules/amu/schema.ts`
- `modules/amu/useAmu.ts`
- `modules/amu/AmuDetailView.tsx`
- `src/pages/AmuModuleAdminPage.tsx`

Commit: `feat(amu): add distribution confirmation stamp per AML §7-2(6)`

---

## Summary table

| Step | File | Priority | Depends on | Migration? | Status |
|------|------|----------|------------|------------|--------|
| 1 | P0.1_source_id_picker.md | P0 | — | No | Ferdig |
| 2 | P1.1_minutes_autosave.md | P1 | — | No | Ferdig |
| 3 | P1.2_participant_balance_warning.md | P1 | — | No | Ferdig |
| 4 | C_AMU-A_rolle_balanse.md | Critical | Step 3 | No | Ferdig |
| 5 | P1.3_agenda_reorder.md | P1 | — | No | Ferdig |
| 6 | P1.4_meeting_pdf_export.md | P1 | — | No | Ferdig |
| 7 | P2.1_annual_cycle_kpi.md | P2 | — | No | Ferdig |
| 8 | C_AMU-B_motefrekvens.md | High | Step 7 | No | Ferdig |
| 9 | P2.2_source_module_case_lookup.md | P2 | — | No | Ferdig |
| 10 | C_AMU-C_moteleder_rotasjon.md | Medium | — | `20260731270000_amu_chair_side.sql` | Ferdig |
| 11 | C_AMU-D_referat_distribusjon.md | High | Step 6 | `20260731280000_amu_distributed_at.sql` | Ferdig |

**Totalt:** 11 spes, 2 migrasjoner, implementert og merget til `main`.
