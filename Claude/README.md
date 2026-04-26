# Handoff: AMU (Arbeidsmiljøutvalg) Module

## Overview

This handoff specifies a complete AMU module for the **NewAMU** platform — the partssammensatte arbeidsmiljøutvalg required by **AML kapittel 7** for virksomheter med ≥50 ansatte. The module manages medlemmer, møteplan, saksliste, vedtak, kritiske saker (avvik / varsling / sykefravær — aggregert), and den lovpålagte årsrapporten.

The reference design is `AMU Mockup.html` (clickable HTML prototype, viewport 1440px, six tabs).

---

## About the Design Files

The HTML in this bundle is a **design reference** — a clickable prototype communicating intended layout, information architecture, copy and interaction. It is **not production code**. The implementation MUST follow the platform rules in `AI_INSTRUCTION_SET.md` (the project's own rulebook):

- Database-first; migrations + RLS + audit triggers come before UI.
- All UI is built from `src/components/ui/` and `src/components/module/` primitives. **No raw HTML for interactive elements.** No copy-pasted Tailwind strings for inputs/buttons.
- Page shell uses `<ModulePageShell>`, `<ModuleSectionCard>`, `<ModuleSignatureCard>`, `<ModulePreflightChecklist>`.
- All UI text in **Norwegian Bokmål**.

The mockup uses ad-hoc colors and inline CSS purely for prototyping speed. **Discard those styles** — re-render against the existing design tokens (`bg-[#F9F7F2]`, Forest Green `#1a3d32`, white cards, Tabs primitive) so this module is visually indistinguishable from `modules/ros/*` and `modules/inspection/*`.

## Fidelity

**High-fidelity for layout, information architecture, copy and interaction.** Pixel-level styling is intentionally left to the design system primitives — do not re-implement the mockup's bespoke palette, badge colors, or typography. Lift structure, copy, and behavior; render with `<Button>`, `<Badge>`, `<Tabs>`, `<StandardInput>`, `<ComplianceBanner>`, etc.

---

## Execution order (per § 6 of the instruction set)

1. **Database** — migrations + RLS policies + audit triggers (see `01_DATABASE.md`)
2. **Types & Zod schemas** (see `02_TYPES.md`)
3. **Hook** — `modules/amu/useAmu.ts` with mandatory `canManage = isAdmin || can('amu.manage')` (see `03_HOOK.md`)
4. **UI** — six tab views built only from `src/components/ui/` + `src/components/module/` primitives (see `04_UI_VIEWS.md`)
5. **Self-review** — grep for `<button className=`, `<input className=`, raw `<table>` styling. Rewrite.

---

## Module map

| Tab id | Label (NB) | Purpose | Source data |
|---|---|---|---|
| `overview` | Oversikt | KPI-er, neste møte med auto-saksliste, lovkrav-sjekkliste | `amu_meetings`, `amu_compliance_status` |
| `members` | Medlemmer | Roster, valgperiode, paritet, HMS-kursstatus, frammøte | `amu_members`, `amu_attendance` |
| `schedule` | Møteplan | Tidslinje for året, beram nye møter, ansattes saksforslag | `amu_meetings`, `amu_topic_proposals` |
| `meetingroom` | Møterom | Live møteavvikling, saksbehandling, vedtaksprotokoll | `amu_meetings` + `amu_agenda_items` + `amu_decisions` + `amu_attendance` |
| `critical` | Kritiske saker | Aggregerte avvik, varslingsstatistikk (anonymisert), manglende signaturer | `deviations`, `whistleblowing_aggregates`, `signatures` |
| `report` | Årsrapport | Auto-sammenstilt årsrapport (§ 7-2 (6)), versjonshistorikk | `amu_annual_reports` |

---

## Files in this bundle

| File | Purpose |
|---|---|
| `README.md` | This document — overview + execution order |
| `AI_INSTRUCTION_SET.md` | The project's own rules (verbatim from user) |
| `01_DATABASE.md` | Tables, RLS, triggers, audit |
| `02_TYPES.md` | TypeScript types + Zod schemas |
| `03_HOOK.md` | `useAmu` hook spec |
| `04_UI_VIEWS.md` | Per-tab view spec, component-by-component |
| `05_LEGAL_RULES.md` | AML rules encoded as validation logic |
| `AMU Mockup.html` | The clickable design reference |

---

## Norwegian terminology contract

| English | Norwegian (Bokmål) — use this |
|---|---|
| Required | Påkrevd |
| Draft / Active / Signed | Kladd / Aktiv / Signert |
| Finding / Deviation | Avvik |
| Cancel / Save / Delete | Avbryt / Lagre / Slett |
| Meeting | Møte |
| Agenda item | Sak / saksliste |
| Decision | Vedtak |
| Member | Medlem |
| Chair / Deputy chair | Leder / Nestleder |
| Working environment committee | Arbeidsmiljøutvalg (AMU) |
| BHT representative | Representant for bedriftshelsetjenesten |
| Annual report | Årsrapport |
| Whistleblowing | Varsling |
| Sick leave | Sykefravær |
| Election period | Valgperiode |

Never mix English into the UI.
