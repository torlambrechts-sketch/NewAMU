# E-Learning Module — Master Evaluation Summary

**Date:** 2026-04-29  
**Module:** Klarert e-learning (`src/pages/learning/`, `src/hooks/useLearning.ts`)  
**Evaluation passes:** Compliance · UI/UX · Developer · End User / Visual Design  
**Branch:** `claude/evaluate-elearning-module-avbIU`

---

## Overall verdict

The module is **feature-complete and structurally sound** for a v1 product, but has meaningful gaps in four areas before it can be used as a polished, production-ready Norwegian workplace tool:

1. **Legal compliance** — Certificate format does not meet Arbeidstilsynet documentation standards; leaderboard data may breach GDPR k-anonymity; no explicit legal basis notice.
2. **UI/UX** — ~30 English strings remain in a Norwegian-language product; cards diverge from the Klarert design system; key accessibility attributes are missing.
3. **Developer** — `useLearning.ts` is a 1,935-line monolith; one file-upload security gap; one missing DB filter; no route-level code splitting.
4. **End user experience** — Dashboard shows admin KPIs to all users; certificate flow uses browser `alert()`; duplicate progress bar in player; quiz wrong-answer colours are missing; no completion celebration; flashcard card too tall on desktop; many raw enum values exposed to users.

---

## Priority matrix (all gaps)

| ID | Pass | Title | Severity | Effort |
|----|------|-------|----------|--------|
| GAP-C01 | Compliance | Certificate mandatory fields | **Critical** | Low |
| GAP-C02 | Compliance | Verneombud 40h structured path | **Critical** | Medium |
| GAP-C03 | Compliance | GDPR legal basis notice | **Critical** | Low |
| GAP-DEV03 | Dev | File extension whitelist | **High** | Trivial |
| GAP-UX03 | End user | Player: nav, duplicate bar, Norwegian strings | **High** | Low |
| GAP-UX02 | End user | Dashboard role-split + English strings | **High** | Low |
| GAP-UX05 | End user | Certificate UX overhaul (alert, name, placement) | **High** | Low |
| GAP-UX07 | End user | Remaining English strings (Certs, Insights, etc.) | **High** | Low |
| GAP-UI01 | UI | Norwegian language throughout | **High** | Low |
| GAP-UI04 | UI | Compliance strip on dashboard | **High** | Low |
| GAP-C04 | Compliance | IK-forskriften competence record export | High | Medium |
| GAP-C05 | Compliance | AMU training tracking (§ 7-4) | High | Medium |
| GAP-UX04 | End user | Quiz wrong-answer colour (red highlight) | Medium | Trivial |
| GAP-UX06 | End user | Flashcard aspect ratio on desktop | Medium | Trivial |
| GAP-UX08 | End user | `bg-white` → `bg-[#fbf9f3]` on all cards | Medium | Trivial |
| GAP-UX01 | End user | Replace `#2D403A` magic colour with token | Medium | Trivial |
| GAP-UX09 | End user | External training: status labels, alert, loading | Medium | Low |
| GAP-UX11 | End user | `text-neutral-400` contrast fix | Medium | Trivial |
| GAP-DEV04 | Dev | `organization_id` on ILT attendance | Medium | Trivial |
| GAP-DEV02 | Dev | Batch reorderModules RPC | Medium | Low |
| GAP-DEV05 | Dev | Pagination on participants/certificates | Medium | Low |
| GAP-UI02 | UI | Card `bg-white` → `bg-[#fbf9f3]` | Medium | Trivial |
| GAP-UI03 | UI | Progress bar ARIA semantics | Medium | Trivial |
| GAP-UI05 | UI | Remove duplicate progress bar | Medium | Trivial |
| GAP-UI06 | UI | Certificate panel gating + auto-populate | Medium | Low |
| GAP-C06 | Compliance | Leaderboard k-anonymity | Medium | Low |
| GAP-C07 | Compliance | `lastAnswers` GDPR data minimisation | Medium | Low |
| GAP-C08 | Compliance | Webhook URL encryption | Medium | Low |
| GAP-DEV01 | Dev | Split useLearning monolith | Medium | High |
| GAP-DEV06 | Dev | Route-level code splitting | Medium | Low |
| GAP-UX10 | End user | Standardise empty states | Low | Trivial |
| GAP-UI07 | UI | Image alt text | Medium | Trivial |
| GAP-UI08 | UI | Module type labels Norwegian | Low | Trivial |
| GAP-DEV07 | Dev | Abort controller for async state | Low | Low |
| GAP-DEV08 | Dev | Zod validation at DB boundary | Low | Medium |

---

## Phase 1 — Ship-blocker fixes (do this week)

These are trivial-to-low effort and fix critical or high-severity issues.

### 1. Certificate fields (GAP-C01)
`LearningCertifications.tsx` + `LearningPlayer.tsx`  
Add to every issued certificate: organisation name, law references (AML § 3-2, IK-forskriften § 5), instructor/role, course version, score (if quiz), expiry date (if recertification). Remove "Not a legally binding credential" or replace with Norwegian documentation language.

### 2. File extension whitelist (GAP-DEV03)
`src/hooks/useLearning.ts` ~line 1721  
Replace `ext.length <= 8` with `ALLOWED_EXTS.has(ext)`. One-liner fix.

### 3. Norwegian language pass (GAP-UI01)
All `src/pages/learning/*.tsx`  
Translate ~30 English UI strings. See `eval/ui/05_gaps_and_actions.md` for the full list.

### 4. GDPR legal basis notice (GAP-C03)
`LearningSettings.tsx` or a new `LearningPrivacyNotice.tsx`  
Add an Art. 13 notice: what data is collected, legal basis (berettiget interesse), retention period, right to erasure contact.

### 5. Missing org_id on ILT attendance (GAP-DEV04)
`LearningPlayer.tsx` — `EventModuleSection`  
Add `.eq('organization_id', organization.id)` to the attendance query. One-liner.

---

## Phase 2 — Quality improvements (next sprint)

### 6. Compliance strip on dashboard (GAP-UI04)
`LearningDashboard.tsx`  
Add the AML § 3-1 · § 6-5 · IK-forskriften § 5 compliance status strip. Cursor prompt in `eval/ui/05_gaps_and_actions.md`.

### 7. Verneombud 40h structured path (GAP-C02)
`LearningPathsPage.tsx` + learning path data  
Create a tagged learning path for verneombud training. Add `metadata_key: 'role', expected_value: 'verneombud'` rule. Curriculum mapping in `eval/compliance/02_training_obligations.md`.

### 8. Batch reorderModules (GAP-DEV02)
`useLearning.ts` + Supabase migration  
Replace 30-round-trip loop with single `learning_reorder_modules` RPC. SQL in `eval/dev/05_gaps_and_actions.md`.

### 9. Pagination (GAP-DEV05)
`useLearning.ts` — progress and certificate queries  
Add `.limit(500)` and `.limit(200)` guards. Show truncation notice in UI.

### 10. Progress bar ARIA + image alt text (GAP-UI03, GAP-UI07)
`LearningPlayer.tsx`  
Add `role="progressbar" aria-valuenow` to ProgressBar. Use `c.caption` as `alt` on image modules.

### 11. Card colour alignment (GAP-UI02)
All learning pages  
Replace `bg-white` with `bg-[#fbf9f3]` on card/panel elements.

### 12. Leaderboard k-anonymity (GAP-C06)
`LearningDashboard.tsx` + `learning_department_leaderboard` RPC  
Suppress individual names in groups < 5 users.

---

## Phase 3 — Architectural improvements (next quarter)

### 13. Split useLearning monolith (GAP-DEV01)
Extract into 5 domain hooks. Full prompt in `eval/dev/05_gaps_and_actions.md`.

### 14. Route-level code splitting (GAP-DEV06)
Wrap all `/learning/*` routes in `React.lazy()` + `Suspense`.

### 15. IK-forskriften competence export (GAP-C04)
Add a structured CSV/PDF export from `LearningParticipants.tsx` meeting Arbeidstilsynet inspection format.

### 16. AMU training tracking (GAP-C05)
Mark learning paths or course tags as `aml_paragraph: '7-4'`. Surface AMU completion status on compliance matrix.

### 17. GDPR data minimisation — lastAnswers (GAP-C07)
Strip `lastAnswers` from `module_progress` JSONB after `dismissed_at` on the associated quiz review.

### 18. Webhook URL encryption (GAP-C08)
Move Teams/Slack webhook URLs from plaintext DB column to Supabase Vault or Edge Function environment variables.

### 19. Zod validation at DB boundary (GAP-DEV08)
Validate `ModuleContent` JSONB with Zod schema on read. Graceful fallback on malformed content.

---

## Files produced by this evaluation

```
eval/
├── 00_CONTEXT.md
├── MASTER_SUMMARY.md                  ← this file
├── compliance/
│   ├── 01_legal_framework.md
│   ├── 02_training_obligations.md
│   ├── 03_data_privacy.md
│   ├── 04_certificate_requirements.md
│   └── 05_gaps_and_actions.md        ← GAP-C01 to GAP-C08 with Cursor prompts
├── ui/
│   ├── 01_design_system_alignment.md
│   ├── 02_navigation_structure.md
│   ├── 03_course_player_ux.md
│   ├── 04_accessibility.md
│   └── 05_gaps_and_actions.md        ← GAP-UI01 to GAP-UI08 with Cursor prompts
├── dev/
│   ├── 01_architecture.md
│   ├── 02_data_layer.md
│   ├── 03_security.md
│   ├── 04_performance.md
│   └── 05_gaps_and_actions.md        ← GAP-DEV01 to GAP-DEV08 with Cursor prompts
└── ux/
    ├── 01_end_user_experience.md      ← full end-user walkthrough
    ├── 02_visual_design.md            ← visual design best practice audit
    └── 03_gaps_and_actions.md        ← GAP-UX01 to GAP-UX11 with Cursor prompts
```

---

## Quick-start for Cursor

Run these gaps in order for maximum impact with minimum risk:

```
1. GAP-DEV03  (file ext whitelist — security, trivial)
2. GAP-DEV04  (ILT org_id filter — security, trivial)
3. GAP-UX11   (text-neutral-400 contrast fix — a11y, trivial)
4. GAP-UX01   (replace #2D403A with PIN_GREEN token — consistency, trivial)
5. GAP-UX04   (quiz wrong-answer red highlight — clarity, trivial)
6. GAP-UX06   (flashcard aspect ratio — layout, trivial)
7. GAP-UI07   (image alt text — accessibility, trivial)
8. GAP-UX08   (card bg colour — design system, trivial)
9. GAP-UI05   (remove duplicate progress bar — UX, trivial)  ← covered by GAP-UX03
10. GAP-UI03  (progress bar ARIA — accessibility, trivial)
11. GAP-UX10  (standardise empty states — consistency, trivial)
12. GAP-UX07  (Norwegian strings: Certs, Insights, Participants — i18n, low effort)
13. GAP-UX03  (player: nav, remove dup bar, Norwegian strings — usability, low effort)
14. GAP-UX02  (dashboard role-split + English strings — usability, low effort)
15. GAP-UI01  (remaining Norwegian strings — i18n, low effort)
16. GAP-UX09  (external training UX: status labels, alert, loading — usability, low effort)
17. GAP-UX05  (certificate UX overhaul — user satisfaction, low effort)
18. GAP-C01   (certificate mandatory fields — compliance, low effort)
19. GAP-C03   (GDPR notice — legal, low effort)
```

Each gap's Cursor prompt is self-contained — paste it directly into Cursor agent mode with no additional context needed.
