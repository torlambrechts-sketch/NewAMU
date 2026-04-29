# Survey Module — Review Summary
*Date: 2026-04-29 · Three independent passes: Compliance, UI/UX, Code*

---

## Quick-reference: Priority matrix

| # | Finding | File(s) | Priority | Effort |
|---|---------|---------|----------|--------|
| C1 | Keyword AML § 4-3 detection duplicated + fragile | SurveyPage, useSurvey | 🔴 High | Medium |
| C2 | AMU signing not linked to authenticated identity | SurveyAmuTab | 🔴 High | Medium |
| C3 | k-anonymity only enforced in UI, not DB | surveyAnalytics, migrations | 🔴 High | High |
| C4 | External surveys have no vendor-side verification path | SurveyLeverandorerTab | 🔴 High | High |
| C5 | No data retention / GDPR deletion mechanism | migrations (all) | 🟠 Med | High |
| C6 | Anonymous surveys allow duplicate submissions | migrations | 🟠 Med | Low |
| C7 | Action plan due dates optional — IK-forskriften § 5 | SurveyTiltakTab | 🟡 Low | Low |
| C8 | Protocol editable after first signature (RLS gap) | migrations | 🟠 Med | Low |
| C9 | "Kampanjer" label — non-legal terminology | SurveyPage | 🟡 Low | Trivial |
| C10 | AMU tab shown on external (vendor) surveys | SurveyDetailView | 🟠 Med | Low |
| U1 | No respondent preview in builder | SurveyBuilderStage | 🔴 High | High |
| U2 | Raw JSON config for scale anchors — not user-friendly | SurveyDetailView | 🔴 High | Medium |
| U3 | Template "Bruk mal" teleports user to wrong tab | SurveyPage | 🟠 Med | Low |
| U4 | Badge count shows all surveys, not just active | SurveyPage | 🟡 Low | Trivial |
| U5 | "Kjør arbeidsflyt" debug buttons visible to managers | SurveyDetailView | 🟠 Med | Low |
| U6 | Tiltak form hidden until survey closed | SurveyTiltakTab | 🟠 Med | Trivial |
| U7 | Raw order_index field in question panel | SurveyDetailView | 🟡 Low | Low |
| U8 | Double empty state in Leverandører tab | SurveyLeverandorerTab | 🟡 Low | Trivial |
| U9 | No confirmation for destructive publish/close actions | SurveyDetailView | 🟠 Med | Low |
| U10 | Palette items not keyboard/click accessible | SurveyBuilderStage | 🔴 High | Low |
| U11 | Maler tab never refreshes after first load | SurveyPage | 🟡 Low | Low |
| U12 | Analysis bar shows % not raw avg for rating questions | SurveyDetailView | 🟠 Med | Low |
| U13 | Mandatory vs required questions look identical | SurveyBuilderStage | 🟠 Med | Low |
| U14 | Template picker hidden for external surveys | SurveyPage | 🟡 Low | Low |
| R1 | `useSurvey` is a 1334-line god-object | useSurvey.ts | 🔴 High | High |
| R2 | `reorderQuestions` fires N sequential DB calls | useSurvey.ts | 🔴 High | Low |
| R3 | `applyTemplateToSurvey` fires N sequential upserts | useSurvey.ts | 🟠 Med | Low |
| R4 | `PaletteItem` uses raw `<button>` (spec violation) | SurveyBuilderStage | 🟠 Med | Low |
| R5 | `isMandatoryAml4_3` duplicated in two files | SurveyPage, useSurvey | 🟠 Med | Trivial |
| R6 | `SurveyDetailView` at 784 lines — exceeds spec limit | SurveyDetailView | 🟠 Med | Medium |
| R7 | Detail load chains 6 queries serially | useSurvey.ts | 🟠 Med | Low |
| R8 | Legacy template path fires N sequential upserts | SurveyPage | 🟠 Med | Low |
| R9 | `saveOrgTemplate` generates unnecessary pseudo-random ID | useSurvey.ts | 🟡 Low | Trivial |
| R10 | Question delete has no optimistic update | SurveyDetailView, useSurvey | 🟡 Low | Low |
| R11 | OversiktTab loses edits on survey reload | SurveyDetailView | 🟡 Low | Low |
| R12 | `archived` status not in core migration constraint | migrations | 🟡 Low | Trivial |
| R13 | `upsertAmuReview` conflict target may fail | useSurvey.ts | 🟡 Low | Low |
| R14 | `created_by` never populated on AMU review | useSurvey, migrations | 🟡 Low | Low |
| R15 | Drag-to-insert race condition on reorder after insert | SurveyBuilderStage | 🟠 Med | Low |
| R16 | `surveyAdminSettingsSchema` parse error blocks survey creation | useSurvey | 🟠 Med | Low |

---

## Recommended sprint order

### Sprint 1 — Legal risk (do immediately)
1. **C2** · Link AMU signatures to `auth.uid()` in DB + prepopulate name from profile.
2. **C8** · Fix RLS policy to block protocol edits after any signature.
3. **C6** · Add anonymous-submission deduplication (token or rate-limit).
4. **C10** · Hide AMU + Tiltak tabs for `survey_type === 'external'`.
5. **R2** · Batch `reorderQuestions` into single upsert.

### Sprint 2 — Usability (most impactful for end users)
6. **U2** · Replace JSON textarea with typed fields (anchors, scale bounds).
7. **U10** · Add click-to-add on palette items (accessibility).
8. **U9** · Add confirmation dialogs for Publiser and Lukk.
9. **U1** · Add respondent preview mode in builder.
10. **U3** · Fix template selection to stay on Maler tab.

### Sprint 3 — Architecture (technical debt)
11. **R1** · Split `useSurvey` into three focused hooks.
12. **R6** · Move inline tab components to `tabs/` files.
13. **C1** + **R5** · Replace keyword detection with template-body flag; remove duplication.
14. **R3** + **R8** · Batch template application into single insert.
15. **C3** · Add server-side k-anonymity enforcement via Postgres view.

### Sprint 4 — Polish
16. Remaining UI/UX items (U4, U5, U6, U7, U8, U11, U12, U13, U14).
17. Remaining code items (R4, R7, R9, R10, R11, R12, R13, R14, R15, R16).
18. **C4** · Vendor-link flow with public token (larger feature, plan separately).
19. **C5** · Data retention mechanism (GDPR — requires Supabase scheduled job).

---

## Files reviewed
- `modules/survey/SurveyPage.tsx`
- `modules/survey/SurveyDetailView.tsx`
- `modules/survey/SurveyBuilderStage.tsx`
- `modules/survey/useSurvey.ts`
- `modules/survey/types.ts`
- `modules/survey/surveyAnalytics.ts`
- `modules/survey/surveyLabels.ts`
- `modules/survey/surveyLegalReferences.tsx`
- `modules/survey/surveyQuestionDefaults.ts`
- `modules/survey/surveyTemplateApply.ts`
- `modules/survey/surveyTemplateCatalogTypes.ts`
- `modules/survey/tabs/SurveyAmuTab.tsx`
- `modules/survey/tabs/SurveyTiltakTab.tsx`
- `modules/survey/tabs/SurveyOversiktModuleTab.tsx`
- `modules/survey/tabs/SurveyKampanjerTab.tsx`
- `modules/survey/tabs/SurveyMalerTab.tsx`
- `modules/survey/tabs/SurveyLeverandorerTab.tsx`
- `supabase/migrations/20260101000000_enterprise_survey_module_core.sql`
- `supabase/migrations/20260801100000_survey_additions.sql`
- `supabase/migrations/20260801110000_survey_type_and_external.sql`
- `supabase/migrations/20260802120000_survey_template_catalog_and_question_types.sql`
