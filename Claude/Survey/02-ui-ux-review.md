# Survey Module — UI/UX Design Review (v2)
*Perspective: Information architecture, user journey, usability, accessibility*
*Date: 2026-04-29 · Updated after main merge*

---

## U1 · No respondent preview in builder (partially improved)

**File:** `SurveySectionBuilder.tsx`

**Progress:** The new section builder replaces the flat canvas with a table-based view. Question rows show type badge, required status, and index. The section nav gives structural context. However, the core gap remains: there is still no way for a builder to see how a question will look to a respondent. A `rating_visual` with `shapeType: "star"` and a `matrix` with 5 rows and 4 columns will both show the same sparse table row in the builder.

**Impact:** High. Managers configure 22 question types — slider ranges, matrix rows/columns, star ratings — without any visual feedback of the respondent experience.

**Recommendation:** Add a "Forhåndsvisning" (preview) slide panel or drawer triggered from each question row. Render the question in respondent-mode using the same component used in `/survey-respond/`. A toggle button on the section table header to switch the whole table to preview mode would be the best UX.

---

## U2 · Raw JSON config — RESOLVED ✅

**File:** `SurveyQuestionFormFields.tsx`

The main update replaced the raw JSON textarea with purpose-built typed fields for every question type: anchor labels for sliders, min/max for numbers, row/column lists for matrices, image URLs for image choice, etc. The JSON field is now scoped only to `showIf` logic and `validation_rules`, with inline documentation. This fully resolves the original finding. The remaining JSON textarea is appropriate for its scope.

---

## U3 · Template "Bruk mal" teleports user to wrong tab (open)

**File:** `SurveyPage.tsx` `handleUseTemplate`

After clicking "Bruk mal" in the Maler tab, the user is silently switched to the Kampanjer tab and the create panel opens there. The context is lost; first-time users don't know where they are or how to go back.

**Recommendation:** Keep the user on the Maler tab when the panel opens. After successful creation, navigate directly to the new survey's detail page (`/survey/:id`). Do not programmatically switch tabs.

---

## U4 · Badge count shows all surveys, not just active (open)

**File:** `SurveyPage.tsx:218`

The Kampanjer tab badge shows `survey.surveys.length` — all surveys regardless of status. Badges should signal items needing attention.

**Recommendation:** Show only `active` count, or show only when there are unreviewed drafts pending publication.

---

## U5 · "Kjør arbeidsflyt" debug buttons visible to all managers (open)

**File:** `SurveyDetailView.tsx` OversiktTab

"Kjør arbeidsflyt (publisert)" and "Kjør arbeidsflyt (lukket)" appear inline next to "Publiser" and "Lukk undersøkelse". These are workflow re-trigger buttons not intended for regular managers and may fire duplicate notifications or automations.

**Recommendation:** Guard with `isAdmin` (not just `canManage`), or move to `/survey/admin`.

---

## U6 · Action plan creation locked until survey is closed (open)

**File:** `SurveyTiltakTab.tsx:151`

The "Nytt tiltak" form is hidden when `status !== 'closed'`. In practice, remediation work often begins during active collection.

**Recommendation:** Allow creating action plans for `status === 'active' || status === 'closed'`. Show an "Undersøkelsen er fortsatt aktiv" note on draft plans created before closing.

---

## U7 · Raw order_index field still present in question panel (open, moved file)

**File:** `SurveyQuestionFormFields.tsx:68-78`

The "Sortering (indeks)" number input moved from `SurveyDetailView` to `SurveyQuestionFormFields` but is still exposed. Drag-and-drop reordering in `SurveySectionBuilder` is the canonical ordering mechanism. The two systems will conflict when a user manually edits the index.

**Recommendation:** Remove the `orderIndex` field from `SurveyQuestionFormFields`. Order is managed exclusively through drag-and-drop.

---

## U8 · Double empty state in Leverandører tab (open)

**File:** `SurveyLeverandorerTab.tsx`

When there are no external surveys, both an `InfoBox` and an empty `LayoutTable1PostingsShell` with a ghost icon are rendered. Two competing empty states.

**Recommendation:** Show only the `InfoBox` + single prominent CTA button. Hide the table shell entirely when count is zero.

---

## U9 · No confirmation for destructive publish/close actions (open)

**File:** `SurveyDetailView.tsx` OversiktTab

"Publiser" permanently locks questions. "Lukk undersøkelse" stops all response collection. Neither has a confirmation dialog. A misclick can lock a half-finished survey or prematurely end data collection.

**Recommendation:**
- **Publiser:** Modal summarizing question count, date range, anonymity setting. Require a labelled "Bekreft publisering" button.
- **Lukk:** Show responses received so far. Require confirmation.

---

## U10 · Palette items not keyboard/click accessible (partially improved)

**File:** `SurveySectionBuilder.tsx` (`PaletteDragItem`)

**Progress:** The section builder adds a "Nytt spørsmål" button at the top of each section's table view, which opens the question panel. This gives a keyboard-accessible path to add questions. However, the palette items themselves still have no `onClick` handler — they can only be added via drag-and-drop.

**Remaining gap:** Users on touch devices or with motor impairments cannot add question types other than those available via the "Nytt spørsmål" panel (which defaults to `rating_1_to_5`). They cannot initiate a specific type without dragging.

**Recommendation:** Add an `onClick` to each `PaletteDragItem` that opens the question panel with that type pre-selected. This mirrors the "add blank then configure" flow already used by the button.

---

## U11 · Maler tab never refreshes after first load (open)

**File:** `SurveyPage.tsx:106-108`

Template catalog loads once on first Maler tab visit. No refresh button or interval.

**Recommendation:** Add a "Last inn på nytt" refresh button in the Maler tab header.

---

## U12 · Analysis shows percentage bars, not numeric averages for rating questions (open)

**File:** `SurveyDetailView.tsx` AnalyseTab

For `rating_1_to_5` and `rating_1_to_10`, the bar represents `(avg - min) / range * 100%`. The actual mean is shown as a small caption. Managers need the score prominently — the bar percentage is misleading.

**Additionally:** 15 of the 22 new question types (`matrix`, `ranking`, `nps`, `slider`, `likert_scale`, `rating_visual`, etc.) produce **no analytics at all** — they fall through to the choice-count path and show empty or incorrect results. See **R17** in the code review.

**Recommendation:**
- Show the numeric average prominently (e.g. "3.6 / 5") as the headline. The bar is a secondary visual.
- NPS should show a proper promoter/passive/detractor breakdown.
- Matrix and ranking need dedicated result renderers.

---

## U13 · Mandatory (AML) questions look identical to required questions (open)

**File:** `SurveySectionBuilder.tsx` question table rows

The builder table shows "Ja" / "Nei" in the Påkrevd column. There is no visible distinction between an `is_mandatory` (legally required, cannot delete) question and a regular `is_required` question.

**Recommendation:** Add an AML badge or lock icon in the table row for mandatory questions. Include a tooltip: "Lovpålagt spørsmål — kan ikke slettes."

---

## U14 · Template picker hidden for external surveys (open)

**File:** `SurveyPage.tsx:448-477`

External survey creation hides both the template selector and anonymity toggle. The template catalog contains vendor-audience templates (HMS-egenerklæring, Åpenhetsloven) which cannot be selected from the create panel for external surveys.

**Recommendation:** Show the template selector for external surveys, filtered to `audience === 'external' || audience === 'both'`.

---

## U15 · Section order_index exposed as raw number in section panel (new)

**File:** `SurveySectionBuilder.tsx` `saveSection` form

The section edit panel has a "Rekkefølge (indeks blant seksjoner)" number input. Sections can already be reordered via drag-and-drop on the nav sidebar. The raw index field creates the same conflict as U7 for questions.

**Recommendation:** Remove the order index field from the section panel. Section order is managed exclusively by drag-and-drop on the sidebar.

---

## U16 · Distribution tab shows no response rate per distribution (new)

**File:** `tabs/SurveyDistribusjonTab.tsx`

The distribution rows show audience, status, and invite count but no response rate (invitations sent vs. responses received). For compliance reporting, HR managers need to know "we sent to 120 employees, 87 responded (72.5%)".

**Recommendation:** Add a "Svarprosent" column: `completed_invitations / total_invitations * 100`. This can be computed from `survey_invitations` grouped by `distribution_id`.
