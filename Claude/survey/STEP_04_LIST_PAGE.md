# Step 4 — Survey List Page

**Replace** `modules/survey/SurveyPage.tsx` entirely.  
**Delete** `src/modules/survey/SurveyModuleView.tsx` after this step compiles cleanly.

Depends on: Step 3 (useSurvey must have final shape).

---

## Context

`modules/survey/SurveyPage.tsx` is already mostly compliant. Two things need upgrading:

1. **Template picker** — the page currently only allows creating a blank survey. It must also allow selecting from `src/data/surveyTemplates.ts` (UWES-9, re:Work, eNPS, Edmondson, HMS-klima). On template selection, seed the survey with the template's questions via `survey.upsertQuestion` in a loop.

2. **Shell pattern** — the page uses `WorkplacePageHeading1` + raw card div. It should use `ModulePageShell` + `ModuleSectionCard` to match `modules/ros/*` and `modules/inspection/*`.

The `src/modules/survey/SurveyModuleView.tsx` uses raw `<button>`, `<input>`, `<select>` — do NOT copy from it; it is being deleted.

---

## Layout

```
<ModulePageShell>
  breadcrumb: ['Arbeidsplass', 'Undersøkelser']
  title: 'Organisasjonsundersøkelser'
  description: 'Kartlegging av psykososialt arbeidsmiljø — opprett, publiser og analyser svar innenfor virksomheten.'
  headerActions: <Button variant="secondary" size="sm" onClick={() => navigate('/survey/admin')}>Modulinnstillinger</Button>  (only if canManage)

  <ComplianceBanner refs={['AML § 3-1', '§ 4-1', '§ 4-3', '§ 7-2', 'IK-forskriften § 5']}>
    Systematisk kartlegging er et lovkrav. Resultater presenteres for AMU og vernombud. GDPR: resultater vises aldri
    for grupper under 5 respondenter.
  </ComplianceBanner>

  {survey.error && <WarningBox>{survey.error}</WarningBox>}

  {/* Create section — only if canManage */}
  <ModuleSectionCard title="Ny undersøkelse">
    ... (see below)
  </ModuleSectionCard>

  {/* List section */}
  <ModuleSectionCard title="Registrerte undersøkelser">
    ... (see below)
  </ModuleSectionCard>
</ModulePageShell>
```

---

## Create section

Two-column form grid (same pattern as `modules/amu/tabs/ScheduleTab.tsx`):

**Left column (labels):**
- Title: "Grunnleggende"
- Description: "Velg en mal for å importere validerte spørsmål, eller start blank. Du legger til egne spørsmål og publiserer når undersøkelsen er klar."

**Right column (controls):**

```tsx
{/* Title */}
<label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-title">Tittel</label>
<StandardInput
  id="survey-title"
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  placeholder="F.eks. Psykososialt klima 2026"
/>

{/* Description */}
<label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-desc">Beskrivelse</label>
<StandardTextarea
  id="survey-desc"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  rows={3}
  placeholder="Valgfri introduksjon til deltakerne"
/>

{/* Anonymous toggle */}
<span className={WPSTD_FORM_FIELD_LABEL}>Anonym undersøkelse</span>
<p className="text-xs text-neutral-500">Når aktivert lagres ingen bruker-ID på svar (personvern / GDPR).</p>
<div className="max-w-xs mt-2">
  <YesNoToggle value={isAnonymous} onChange={setIsAnonymous} />
</div>

{/* Template picker */}
<span className={WPSTD_FORM_FIELD_LABEL}>Mal (valgfritt)</span>
<SearchableSelect
  value={selectedTemplate}
  options={templateOptions}  // built from ALL_SURVEY_TEMPLATES
  onChange={(v) => setSelectedTemplate(v)}
  placeholder="Velg mal eller la stå blank"
/>
{selectedTemplate && (
  <InfoBox>
    {/* Show template.description + template.scoringNote */}
    {templateInfo?.description} · Estimert tid: {templateInfo?.estimatedMinutes} min · {templateInfo?.scoringNote}
  </InfoBox>
)}

{/* Action */}
<Button
  type="button"
  variant="primary"
  disabled={creating || !title.trim()}
  onClick={() => void handleCreate()}
>
  {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Oppretter…</> : <><Plus className="h-4 w-4" /> Opprett kladd</>}
</Button>
```

### Template seeding logic

```ts
const handleCreate = useCallback(async () => {
  if (!title.trim()) return
  setCreating(true)
  const row = await survey.createSurvey({
    title: title.trim(),
    description: description.trim() || null,
    is_anonymous: isAnonymous,
  })
  if (row && selectedTemplate) {
    const tpl = ALL_SURVEY_TEMPLATES.find((t) => t.id === selectedTemplate)
    if (tpl) {
      for (let i = 0; i < tpl.questions.length; i++) {
        const q = tpl.questions[i]
        // Map template question type to SurveyQuestionType
        const qType: SurveyQuestionType =
          q.type === 'likert_5' || q.type === 'likert_7' || q.type === 'scale_10'
            ? 'rating_1_to_5'
            : q.type === 'yes_no'
              ? 'multiple_choice'
              : 'text'
        await survey.upsertQuestion({
          surveyId: row.id,
          questionText: q.text,
          questionType: qType,
          orderIndex: i,
          isRequired: q.required,
        })
      }
    }
  }
  setCreating(false)
  if (row) {
    setTitle('')
    setDescription('')
    setSelectedTemplate('')
    setIsAnonymous(false)
    navigate(`/survey/${row.id}`)
  }
}, [title, description, isAnonymous, selectedTemplate, survey, navigate])
```

Build `templateOptions` from `ALL_SURVEY_TEMPLATES`:
```ts
import { ALL_SURVEY_TEMPLATES } from '../../src/data/surveyTemplates'
const templateOptions = [
  { value: '', label: '— Start blank —' },
  ...ALL_SURVEY_TEMPLATES.map((t) => ({ value: t.id, label: `${t.name} (${t.estimatedMinutes} min)` })),
]
```

---

## List section

Use `LayoutTable1PostingsShell` (already used in current file). Keep existing table columns: Tittel, Status, Oppdatert, Handling. No changes needed beyond removing the old `WorkplacePageHeading1`/card wrapper.

Loading state: `<Loader2 className="h-5 w-5 animate-spin" />` centered.  
Empty state: `<Ghost>` + message.

---

## Imports to add

```ts
import { ModulePageShell, ModuleSectionCard } from '../../src/components/module'
import { ComplianceBanner, InfoBox, WarningBox, Button, Tabs } from '../../src/components/ui'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { ALL_SURVEY_TEMPLATES } from '../../src/data/surveyTemplates'
import type { SurveyQuestionType } from './types'
```

Remove imports that are no longer needed after switching to `ModulePageShell`:
- `WorkplacePageHeading1`
- `WORKPLACE_MODULE_CARD`, `WORKPLACE_MODULE_CARD_SHADOW`

---

## Validation checklist

- [ ] No `<button className=…>` anywhere
- [ ] No `<input className=…>` anywhere
- [ ] No `<select>` anywhere
- [ ] `ModulePageShell` wraps the whole page
- [ ] `ComplianceBanner` references AML § 3-1, § 4-1, § 4-3, § 7-2, IK-f § 5
- [ ] Template seeding loops through all questions with correct type mapping
- [ ] `isAnonymous` toggle uses `<YesNoToggle>` not a checkbox
- [ ] List uses `<Badge>` for status (already done — keep it)
- [ ] `src/modules/survey/SurveyModuleView.tsx` deleted

## Commit

```
feat(survey): list page — ModulePageShell + template picker
```
