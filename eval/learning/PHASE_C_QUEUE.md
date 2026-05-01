# Fase C — layout-primitiver og layout-kit (e-læring) ✅

**Status:** Implementert i kode.

## Utført

| # | Oppgave | Filer |
|---|---------|-------|
| C1 | `ModulePageShell` for e-læringsskall (krem, max-width, heading) | `LearningLayout.tsx` |
| C2 | `ModuleSectionCard` for hovedpaneler | `LearningDashboard.tsx`, `LearningCertifications.tsx`, `LearningParticipants.tsx` |
| C3 | `LayoutTable1PostingsShell` + `layoutTable1PostingsKit` for tabeller | `LearningCertifications.tsx`, `LearningParticipants.tsx` |
| C4 | `LayoutScoreStatRow` for KPI-rad | `LearningDashboard.tsx` (erstatter `KpiCard`-rutenett) |
| C5 | `ComplianceBanner` for AML/IK-stripe på oversikt | `LearningDashboard.tsx` |

## Merknader

- `LearningPlayer` og `LearningFlowEntry` ligger utenfor `LearningLayout` i ruteren; de beholder egen layout.
- `HubMenu1Bar` beholdes som `tabs` i `ModulePageShell` (samme mønster som øvrig arbeidsflate).

## Verifisering

```bash
rg "ModulePageShell|ModuleSectionCard|LayoutScoreStatRow|LayoutTable1PostingsShell|ComplianceBanner" src/components/learning/LearningLayout.tsx src/pages/learning/LearningDashboard.tsx src/pages/learning/LearningCertifications.tsx src/pages/learning/LearningParticipants.tsx
```
