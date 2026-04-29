# Survey Module — UI/UX Design Review
*Perspective: Information architecture, user journey, usability, accessibility*
*Date: 2026-04-29*

---

## U1 · Survey builder has no respondent preview

**File:** `SurveyBuilderStage.tsx`, `SurveyDetailView.tsx` (ByggerTab)

The builder shows question metadata (type badge, required badge, index) but not how the question will actually appear to a respondent. A user dragging in a `rating_1_to_5` question sees:

> `1. [Vurdering 1–5] [Påkrevd]  Vurder på skala 1–5`

They have no idea if the anchor labels are correct, whether the scale renders as stars, radio buttons, or a slider, or whether the question text makes sense in context.

**Impact:** High — managers publish surveys without knowing what respondents will experience. Leads to poor question phrasing and misconfigured scales.

**Recommendation:** Add a "Forhåndsvisning" (preview) toggle in the builder that renders each question in respondent-mode. A `SurveyQuestionPreview` component rendered in a side drawer would suffice. At minimum, show scale anchors and options inline on the question card.

---

## U2 · JSON config editor is developer-hostile

**File:** `SurveyDetailView.tsx:746-761`

The question edit panel exposes a raw JSON textarea for "Avansert (JSON: skala, ankere…)" config. Real users — HR managers, verneombud, AMU members — cannot reasonably fill in:

```json
{"scaleMin":1,"scaleMax":5,"anchors":{"low":"Svært uenig","high":"Svært enig"}}
```

**Impact:** High for configured question types. Scale anchors are critical for validated instruments (QPS-Nordic, UWES) but managers will leave them blank or corrupt the JSON.

**Recommendation:** Replace the JSON textarea with purpose-built fields based on `qType`:
- For `rating_*`: two text inputs (anchor low / anchor high) + min/max number inputs.
- For `single_select / multi_select / multiple_choice`: the existing options textarea is correct.
- Hide the raw JSON field entirely; keep only as an "ekspert-modus" toggle for admins.

---

## U3 · Template selection navigation is disorienting

**File:** `SurveyPage.tsx:182-206` (`handleUseTemplate`)

When a user clicks "Bruk mal" in the Maler tab, the code:
1. Sets form state (title, description, type, template).
2. Switches the active tab to `kampanjer`.
3. Opens the SlidePanel.

The user is transported to a different tab with a panel already open, having no idea how they got there. The Maler tab context is lost.

**Impact:** Medium — disorienting for first-time users. They expect to stay in the Maler tab with a preview, not be teleported.

**Recommendation:** Keep the user on the Maler tab. Open the SlidePanel there. After the survey is created, navigate to the new survey's detail page. Do not switch tabs programmatically.

---

## U4 · "Kampanjer" badge count shows all surveys, not just active

**File:** `SurveyPage.tsx:218`

```ts
badgeCount: survey.surveys.length > 0 ? survey.surveys.length : undefined,
```

The badge on the Kampanjer tab shows the total count of all surveys (draft + active + closed + archived). Users expect a badge to signal something requiring attention — active or unreviewed items.

**Recommendation:** Show only `active` surveys in the badge, or remove the badge entirely and show it only when there are drafts pending publication.

---

## U5 · "Kjør arbeidsflyt" buttons visible to all managers

**File:** `SurveyDetailView.tsx:186-195`, `209-215`

The "Kjør arbeidsflyt (publisert)" and "Kjør arbeidsflyt (lukket)" buttons are debugging/re-trigger tools. They appear in the regular Oversikt tab next to "Publiser" and "Lukk undersøkelse", creating confusion about their purpose.

**Impact:** Medium — a manager clicking "Kjør arbeidsflyt" expecting it to publish the survey will be confused. Double-firing workflow events may have side effects (notifications, automations).

**Recommendation:** Move these buttons to an admin-only debug panel (inside `/survey/admin`) or guard them with `isAdmin` rather than `canManage`.

---

## U6 · Action plan creation only available when survey is closed

**File:** `SurveyTiltakTab.tsx:151`

```tsx
{survey.canManage && s.status === 'closed' && (
  <ModuleSectionCard ...> {/* Nytt tiltak form */}
```

In practice, action items often emerge during the active data collection phase — "we already know from qualitative feedback that X is a problem." The form being hidden until the survey closes frustrates early responders.

**Recommendation:** Allow creating action plans when `status === 'active' || status === 'closed'`. Optionally, show a note "Undersøkelsen er fortsatt aktiv — tiltaket er foreløpig." to make the timing clear.

---

## U7 · Sortering (indeks) field in question panel should not exist

**File:** `SurveyDetailView.tsx:712-723`

The question edit panel has a "Sortering (indeks)" number input. This exposes raw `order_index` integers to the user. The builder already supports drag-and-drop reordering. These two systems will conflict: a user edits order_index to 2, but drag-and-drop later sets it to 5.

**Impact:** Low friction now, high confusion when order gets out of sync.

**Recommendation:** Remove the `order_index` input from the question panel entirely. Order is managed exclusively through drag-and-drop on the builder canvas.

---

## U8 · Dual empty states in Leverandører tab

**File:** `SurveyLeverandorerTab.tsx:48-64`

When there are no external surveys, the component renders:
1. An `InfoBox` with explanatory text.
2. An empty `LayoutTable1PostingsShell` with a ghost icon and another CTA button.

These two empty states fight each other. The InfoBox says "Ingen leverandørundersøkelser" and then the table shell also says "Ingen leverandørundersøkelser ennå."

**Recommendation:** Show only one empty state. Prefer the InfoBox + a single prominent CTA button. Remove the empty table shell when there are zero records.

---

## U9 · Survey status change flow has no confirmation for destructive actions

**File:** `SurveyDetailView.tsx:181-215`

"Publiser" locks the questions permanently. "Lukk undersøkelse" stops all response collection. Neither action has a confirmation dialog. A manager can accidentally publish a half-finished survey or close an active survey prematurely.

**Recommendation:**
- "Publiser": show a confirmation modal summarizing question count, date range, anonymity setting. Require the user to type the survey title or click a clearly labeled "Bekreft publisering" button.
- "Lukk undersøkelse": show response count received so far and ask "Er du sikker på at du vil avslutte innsamlingen?"

---

## U10 · Builder palette has no keyboard / click-to-add path

**File:** `SurveyBuilderStage.tsx:35-68` (`PaletteItem`)

Palette items can only be added to the canvas by drag-and-drop. There is no click handler. On touch devices, drag-and-drop via `PointerSensor` with a 6px distance threshold may be unreliable.

**Impact:** Accessibility failure — keyboard-only and screen reader users cannot add questions.

**Recommendation:** Add an `onClick` handler to each `PaletteItem` that appends the question type to the end of the list (same behaviour as dropping onto an empty stage). The drag metaphor becomes an enhancement, not the only path.

---

## U11 · "Maler" tab only loads on first visit — no refresh mechanism

**File:** `SurveyPage.tsx:106-108`

```ts
useEffect(() => {
  if (tab === 'maler') void loadTemplateCatalog()
}, [tab, loadTemplateCatalog])
```

The template catalog loads once when the Maler tab is first visited. If an admin adds a new template in another session, the current user will not see it without a page reload. There is no refresh button.

**Recommendation:** Add a "Last inn på nytt" button in the Maler tab header, or add a `refetchInterval` to reload templates every 5 minutes when the tab is active.

---

## U12 · Analysis bar chart has no labelled axis or scale context

**File:** `SurveyDetailView.tsx:77-92` (`AnalyseBar`)

The `AnalyseBar` component shows a label and a percentage, with a green bar. For rating questions, the bar represents `(avg - min) / range`. A manager seeing a bar at 60% for a 1–5 scale question needs to know: is 60% good? What does the average of 3.6 mean in context?

**Recommendation:**
- For rating questions: show the numeric average prominently (e.g. "3.6 / 5") rather than a progress bar percentage.
- Include standard deviation or response distribution when n ≥ threshold.
- For choice questions: show absolute counts alongside percentages (e.g. "12 svar (48%)").

---

## U13 · No visual distinction between mandatory (AML) and required questions in builder

**File:** `SurveyBuilderStage.tsx:128-145`

The builder shows two badges: `[Påkrevd]` (is_required) and `[AML § 4-3]` (is_mandatory). Both appear in red (`variant="danger"`). Managers may not understand the distinction.

**Recommendation:**
- Use a distinct orange/amber badge for `[AML § 4-3]` with a tooltip explaining "Dette spørsmålet er lovpålagt og kan ikke slettes."
- Show a lock icon on mandatory questions.
- Group mandatory questions visually at the top of the list or mark them with a permanent pin indicator.

---

## U14 · Survey create panel: template selector hidden for external surveys

**File:** `SurveyPage.tsx:448-477`

When `surveyType === 'external'`, the template selector and anonymity toggle are hidden. But there are external-audience templates in the catalog (e.g. HMS-egenerklæring, Åpenhetsloven). The user must create the survey, then apply the template from the Maler tab — a multi-step workaround.

**Recommendation:** Show the template selector for external surveys, but filter the `templateOptions` to only show templates where `audience === 'external' || audience === 'both'`.
