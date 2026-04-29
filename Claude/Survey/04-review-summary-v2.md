# Survey Module — Review Summary (v2)

*Date: 2026-04-29 · Updated after main merge — 11 new migrations, distribution engine, section builder, 22 question types*

Full detail lives alongside: `01-compliance-review.md`, `02-ui-ux-review.md`, `03-code-review.md`.

---

## What changed in main

| Area | Change | Impact on v1 review |
|------|--------|---------------------|
| `SurveyQuestionFormFields.tsx` | Purpose-built typed UI for every question type (slider, matrix, NPS, etc.) | Resolves U2 |
| `SurveySectionBuilder.tsx` | Wiki-folder section nav replaces flat `SurveyBuilderStage` | Partially resolves U1, U10 |
| `tabs/SurveyDistribusjonTab.tsx` | Full distribution + invitation token engine | Partially resolves C4 |
| `surveyRespondValidation.ts` | `showIf` logic jumps + full answer validation | New capability — no v1 finding |
| `SurveyPendingInvitesBanner.tsx` | Banner for pending invitations per user | New capability |
| `surveyInviteLink.ts` | Token URL builder | New capability |
| `types.ts` | 22 `SurveyQuestionType` variants, `SurveySectionRow`, `SurveyDistributionRow`, `SurveyInvitationRow` | Scope expanded |
| `useSurvey.ts` | Grew from 1 334 → **2 153 lines**, 40+ methods | R1 worsened |
| `reorderQuestions` | N sequential DB calls **unchanged** | R2 still open |
| `SurveyDetailView.tsx` | 926 lines (was 784) | R6 worsened |
| `surveyAnalytics.ts` | Only handles 7 of 22 types | New finding |

---

## Priority matrix (v2)

| # | Finding | File(s) | Priority | Status vs v1 |
|---|---------|---------|----------|--------------|
| C1 | Keyword AML § 4-3 detection duplicated + fragile | SurveyPage, useSurvey | High | Open |
| C2 | AMU signing not linked to auth identity | SurveyAmuTab | High | Open |
| C3 | k-anonymity UI-only, no DB enforcement | surveyAnalytics, migrations | High | Open |
| C4 | Vendor surveys: distribution engine exists but no vendor-side token enforcement | SurveyDistribusjonTab | Med | Partial |
| C5 | No data retention / GDPR deletion mechanism | migrations | Med | Open |
| C6 | Anonymous survey duplicate submissions not blocked | migrations | Med | Open |
| C7 | Action plan due dates optional (IK-forskriften § 5) | SurveyTiltakTab | Low | Open |
| C8 | Protocol editable after first AMU signature (RLS gap) | migrations | Med | Open |
| C9 | "Kampanjer" — non-legal terminology | SurveyPage | Low | Open |
| C10 | AMU + Tiltak tabs shown on vendor surveys | SurveyDetailView | Med | Open |
| U1 | No respondent preview in builder | SurveySectionBuilder | High | Partial |
| U2 | Raw JSON config — resolved by `SurveyQuestionFormFields` | — | Resolved | Closed |
| U3 | Template "Bruk mal" teleports user to wrong tab | SurveyPage | Med | Open |
| U4 | Badge count shows all surveys, not just active | SurveyPage | Low | Open |
| U5 | "Kjør arbeidsflyt" debug buttons visible to managers | SurveyDetailView | Med | Open |
| U6 | Tiltak form hidden until survey closed | SurveyTiltakTab | Med | Open |
| U7 | Raw order_index field in question panel | SurveyQuestionFormFields | Low | Open (moved file) |
| U8 | Double empty state in Leverandører tab | SurveyLeverandorerTab | Low | Open |
| U9 | No confirmation for destructive publish/close | SurveyDetailView | Med | Open |
| U10 | Palette items not keyboard accessible | SurveySectionBuilder | Med | Partial |
| U11 | Maler tab never refreshes | SurveyPage | Low | Open |
| U12 | Analysis bar shows % not raw avg for ratings | SurveyDetailView | Med | Open |
| U13 | Mandatory vs required questions look identical | SurveySectionBuilder | Med | **Partial** — Lovkrav column added |
| U14 | Template picker hidden for external surveys | SurveyPage | Low | Open |
| U15 | Section `order_index` field exposed as raw number | SurveySectionBuilder | Low | New |
| R1 | `useSurvey` god-object: 2153 lines, 40+ methods | useSurvey.ts | High | Worsened |
| R2 | `reorderQuestions` N sequential DB calls | useSurvey.ts | High | Open |
| R3 | `applyTemplateToSurvey` N sequential upserts | useSurvey.ts | Med | Open |
| R4 | `PaletteDragItem` raw `<button>` in SurveySectionBuilder | SurveySectionBuilder | Med | Persists |
| R5 | `isMandatoryAml4_3` duplicated | SurveyPage, useSurvey | Med | Open |
| R6 | `SurveyDetailView` 926 lines — exceeds spec | SurveyDetailView | Med | Worsened |
| R7 | Detail load chains queries serially | useSurvey.ts | Med | Open |
| R8 | Legacy template path N sequential upserts | SurveyPage | Med | Open |
| R9 | `saveOrgTemplate` pseudo-random ID fallback | useSurvey.ts | Low | Open |
| R10 | Question delete no optimistic update | SurveyDetailView | Low | Open |
| R11 | OversiktTab loses edits on survey reload | SurveyDetailView | Low | Open |
| R12 | `archived` status not in core migration | migrations | Low | Open |
| R13 | `upsertAmuReview` conflict target risk | useSurvey.ts | Low | Open |
| R14 | `created_by` never populated on AMU review | useSurvey, migrations | Low | Open |
| R15 | Drag-insert race condition on reorder | SurveySectionBuilder | Med | Open (moved file) |
| R16 | `surveyAdminSettingsSchema` parse error blocks creation | useSurvey | Med | Open |
| R17 | `surveyAnalytics` handles only 7 of 22 question types | surveyAnalytics.ts | High | New |
| R18 | `SurveyPendingInvitesBanner` makes 2 serial queries that could JOIN | SurveyPendingInvitesBanner | Low | New |
| R19 | `reorderSections` also N sequential DB calls | useSurvey.ts | High | New |
| R20 | `loadSurveyDetail` doesn't load `surveySections` or `distributions` | useSurvey.ts | Med | New |

---

## Recommended sprint order (updated)

### Sprint 1 — Critical correctness

1. **R17** · Extend `surveyAnalytics` to handle all 22 question types.
2. **R1 + R19** · Split `useSurvey` into focused hooks; batch `reorderSections` & `reorderQuestions`.
3. **C2** · Link AMU signatures to `auth.uid()`.
4. **C8** · Fix RLS to block protocol edits after any signature.
5. **R20** · `loadSurveyDetail` must load sections + distributions in parallel.

### Sprint 2 — Compliance

6. **C1 + R5** · Replace keyword detection with template body flag; remove duplication.
7. **C3** · Server-side k-anonymity view.
8. **C6** · Anonymous deduplication token.
9. **C10** · Hide AMU/Tiltak tabs for external surveys.
10. **C4** · Complete vendor token enforcement (vendor fills in via personal link, status tracked).

### Sprint 3 — UX

11. **U1** · Respondent preview panel in builder.
12. **U9** · Publish/close confirmation dialogs.
13. **U3** · Stay on Maler tab after template selection.
14. **U13** · Continue distinct visual for AML-mandatory questions (Lovkrav column started).
15. **U5** · Move "Kjør arbeidsflyt" to admin-only.

### Sprint 4 — Polish + debt

16. **R6** · Split `SurveyDetailView` tab components to `tabs/` files.
17. **R2** · Batch `reorderQuestions` into single upsert.
18. **R3 + R8** · Batch template application.
19. **R4** · Forward `ref` on `Button` to support dnd-kit in `PaletteDragItem`.
20. Remaining low-priority items.

---

## Files reviewed (v2 — includes all new files on main)

- `modules/survey/SurveyPage.tsx`
- `modules/survey/SurveyDetailView.tsx` (926 lines)
- `modules/survey/SurveyBuilderStage.tsx`
- `modules/survey/SurveySectionBuilder.tsx` (new)
- `modules/survey/SurveyQuestionFormFields.tsx` (new)
- `modules/survey/SurveyPendingInvitesBanner.tsx` (new)
- `modules/survey/useSurvey.ts` (2153 lines)
- `modules/survey/types.ts`
- `modules/survey/surveyAnalytics.ts`
- `modules/survey/surveyLabels.ts`
- `modules/survey/surveyLegalReferences.tsx`
- `modules/survey/surveyInviteLink.ts` (new)
- `modules/survey/surveyRespondValidation.ts` (new)
- `modules/survey/surveyQuestionConfigHelpers.ts` (new)
- `modules/survey/surveyQuestionDefaults.ts`
- `modules/survey/surveyQuestionGlobalOrder.ts` (new)
- `modules/survey/surveyTemplateApply.ts`
- `modules/survey/surveyTemplateCatalogTypes.ts`
- `modules/survey/surveyTemplateCatalogHelpers.ts` (new)
- `modules/survey/tabs/SurveyAmuTab.tsx`
- `modules/survey/tabs/SurveyTiltakTab.tsx`
- `modules/survey/tabs/SurveyDistribusjonTab.tsx` (new)
- `modules/survey/tabs/SurveyOversiktModuleTab.tsx`
- `modules/survey/tabs/SurveyKampanjerTab.tsx`
- `modules/survey/tabs/SurveyMalerTab.tsx`
- `modules/survey/tabs/SurveyLeverandorerTab.tsx`
- `supabase/migrations/` — survey-related migrations through section builder and distributions
