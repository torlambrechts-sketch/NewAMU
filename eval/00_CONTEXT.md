# E-Learning Module Evaluation — Shared Context

**Evaluated:** 2026-04-29  
**Branch:** `claude/evaluate-elearning-module-avbIU`  
**Design reference:** `https://claude.ai/design/p/06086519-60eb-4651-824f-e17832487886?file=E-learning+Mockup.html&via=share`  
**Design system source (local):** `Claude/AMU Mockup.html`

---

## Module scope

The e-learning module lives under `/learning/*` routes and consists of:

| File | Role |
|------|------|
| `src/components/learning/LearningLayout.tsx` | Shell, nav, breadcrumb |
| `src/pages/learning/LearningDashboard.tsx` | Overview / KPI |
| `src/pages/learning/LearningCoursesList.tsx` | Course catalogue |
| `src/pages/learning/LearningCourseBuilder.tsx` | Admin builder |
| `src/pages/learning/LearningPlayer.tsx` | Learner player (all module types) |
| `src/pages/learning/LearningFlowEntry.tsx` | QR / deep-link entry |
| `src/pages/learning/LearningCertifications.tsx` | Certificate registry |
| `src/pages/learning/LearningParticipants.tsx` | Progress table |
| `src/pages/learning/LearningComplianceMatrix.tsx` | Team heatmap |
| `src/pages/learning/LearningPathsPage.tsx` | Learning paths |
| `src/pages/learning/LearningExternalTraining.tsx` | External cert upload |
| `src/pages/learning/LearningInsights.tsx` | Stats |
| `src/pages/learning/LearningSettings.tsx` | Settings / export |
| `src/hooks/useLearning.ts` | Data layer (local + Supabase) |
| `src/types/learning.ts` | Type definitions |

## Design system tokens (from AMU Mockup)

```css
--forest:       #1a3d32   /* primary green — matches PIN_GREEN */
--forest-dark:  #14312a
--forest-soft:  #e7efe9
--forest-line:  #c5d3c8
--bg:           #f7f5ee   /* page background */
--paper:        #fbf9f3   /* card background */
--ink:          #1d1f1c
--muted:        #6b6f68
--line:         #e3ddcc
--critical:     #b3382a
--warn:         #c98a2b
--ok:           #2f7757
```

Typography: **Source Serif 4** (headings) + **Inter** (body, 14 px base)

## Three evaluation passes

1. `eval/compliance/` — Norwegian labour law & GDPR compliance officer  
2. `eval/ui/` — UI/UX designer aligned to the Klarert design system  
3. `eval/dev/` — Developer: architecture, security, data layer  

Each section has numbered files (`01_`, `02_`, …) ending with `_gaps_and_actions.md`.

## How to use with Cursor / AI coding

Each gap file follows this schema so Cursor can action them directly:

```md
## GAP-XXX — <title>

**Severity:** critical | high | medium | low  
**File(s):** `src/path/to/File.tsx` (line N)  
**Regulation/Design ref:** <law or design spec>  

### Current state
<what exists now>

### Required state
<what must be built>

### Cursor prompt
```
<exact prompt to paste into Cursor agent>
```
```
