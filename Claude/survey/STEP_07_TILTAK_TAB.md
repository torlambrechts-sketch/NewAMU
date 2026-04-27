# Step 7 — Handlingsplan Tab

**Create** `modules/survey/tabs/SurveyTiltakTab.tsx` (new file).  
**Delete** `src/modules/survey/SurveyActionTab.tsx` after this step compiles cleanly.  
**Update** `modules/survey/SurveyDetailView.tsx`: replace the placeholder `SurveyTiltakTab` import with the real one.

Depends on: Step 5.

---

## Context

The legacy `src/modules/survey/SurveyActionTab.tsx` renders action plans but:
- Uses raw `<button>` for expand/collapse and status-change buttons → must become `<Button>`
- Severity left-border classes are already correct — keep them

This step rewrites the tab with the design-system components and adds the ability to manually create action plans (in addition to auto-generated ones from result computation).

---

## File: `modules/survey/tabs/SurveyTiltakTab.tsx`

### Imports

```ts
import { useState } from 'react'
import { CheckSquare, Plus, Loader2 } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { ComplianceBanner, WarningBox, Button, Badge } from '../../../src/components/ui'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { SurveyDetailTab } from './types'
import type { SurveyActionPlanRow, SurveyActionPlanStatus, SurveyPillar } from '../types'
import { ACTION_PLAN_STATUS_LABEL, SURVEY_PILLAR_LABEL } from '../types'
```

### Props

```ts
export function SurveyTiltakTab({ survey, s }: SurveyDetailTab) { ... }
```

### Layout

```
<div className="space-y-6">
  <ComplianceBanner refs={['AML § 3-1', 'IK-forskriften § 5']}>
    Tiltak skal iverksettes der undersøkelsesresultater avdekker avvik. Handlingsplaner presenteres for AMU og vernombud.
    Auto-genererte planer opprettes der score er under grenseverdien.
  </ComplianceBanner>

  {survey.error && <WarningBox>{survey.error}</WarningBox>}

  {/* Create new plan (canManage only) */}
  {survey.canManage && s.status === 'closed' && (
    <ModuleSectionCard title="Nytt tiltak">
      ... (create form — see below)
    </ModuleSectionCard>
  )}

  {/* Open plans */}
  <ModuleSectionCard
    title="Åpne tiltak"
    headerActions={
      openPlans.length > 0
        ? <Badge variant="danger">{openPlans.length} åpne</Badge>
        : undefined
    }
  >
    {openPlans.length === 0 ? (
      <EmptyPlans message="Ingen åpne tiltak." />
    ) : (
      <div className="divide-y divide-neutral-100">
        {openPlans.map((p) => <ActionPlanRow key={p.id} plan={p} survey={survey} />)}
      </div>
    )}
  </ModuleSectionCard>

  {/* Closed plans */}
  {closedPlans.length > 0 && (
    <ModuleSectionCard title={`Lukkede tiltak (${closedPlans.length})`}>
      <div className="divide-y divide-neutral-100">
        {closedPlans.map((p) => <ActionPlanRow key={p.id} plan={p} survey={survey} />)}
      </div>
    </ModuleSectionCard>
  )}
</div>
```

### `EmptyPlans`

```tsx
function EmptyPlans({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <CheckSquare className="h-10 w-10 text-neutral-300" strokeWidth={1.25} />
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  )
}
```

### `ActionPlanRow`

Each row has severity left-border based on status, and is expandable via `<Button variant="ghost">` (not raw `<button>`):

```tsx
function ActionPlanRow({
  plan: p,
  survey,
}: {
  plan: SurveyActionPlanRow
  survey: UseSurveyState
}) {
  const [expanded, setExpanded] = useState(false)

  const borderClass =
    p.status === 'closed'
      ? 'border-l-4 border-l-emerald-400'
      : p.status === 'in_progress'
        ? 'border-l-4 border-l-orange-400 bg-orange-50/20'
        : 'border-l-4 border-l-red-400 bg-red-50/30'

  return (
    <div className={borderClass}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-800">{p.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span>{SURVEY_PILLAR_LABEL[p.pillar]}</span>
            <span>·</span>
            <span>{p.category}</span>
            {p.score !== null && (
              <span className="font-semibold">Score: {p.score}</span>
            )}
          </div>
        </div>
        <Badge
          variant={
            p.status === 'closed'
              ? 'success'
              : p.status === 'in_progress'
                ? 'warning'
                : 'danger'
          }
        >
          {ACTION_PLAN_STATUS_LABEL[p.status]}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Lukk' : 'Detaljer'}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/50 px-4 py-3">
          {p.description && (
            <p className="text-sm text-neutral-600">{p.description}</p>
          )}
          {p.responsible && (
            <p className="text-xs text-neutral-500">Ansvarlig: {p.responsible}</p>
          )}
          {p.due_date && (
            <p className="text-xs text-neutral-500">
              Frist: {new Date(p.due_date).toLocaleDateString('nb-NO')}
            </p>
          )}

          {/* Status buttons — canManage only */}
          {survey.canManage && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(['open', 'in_progress', 'closed'] as SurveyActionPlanStatus[]).map((st) => (
                <Button
                  key={st}
                  type="button"
                  variant={p.status === st ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={p.status === st}
                  onClick={() => void survey.updateActionPlanStatus(p.id, st)}
                >
                  {ACTION_PLAN_STATUS_LABEL[st]}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### Create form (inside ModuleSectionCard)

Inline create form for manual action plans. Only shown when `canManage` and survey is `closed`.

```tsx
const pillarOptions = (Object.keys(SURVEY_PILLAR_LABEL) as SurveyPillar[]).map((k) => ({
  value: k,
  label: SURVEY_PILLAR_LABEL[k],
}))

// Form state
const [newTitle, setNewTitle] = useState('')
const [newCategory, setNewCategory] = useState('')
const [newPillar, setNewPillar] = useState<SurveyPillar>('psychosocial')
const [newDesc, setNewDesc] = useState('')
const [newResponsible, setNewResponsible] = useState('')
const [newDueDate, setNewDueDate] = useState('')
const [creating, setCreating] = useState(false)

const handleCreate = async () => {
  if (!newTitle.trim() || !newCategory.trim()) return
  setCreating(true)
  await survey.upsertActionPlan({
    surveyId: s.id,
    category: newCategory.trim(),
    pillar: newPillar,
    title: newTitle.trim(),
    description: newDesc.trim() || null,
    responsible: newResponsible.trim() || null,
    due_date: newDueDate || null,
  })
  setCreating(false)
  setNewTitle('')
  setNewCategory('')
  setNewDesc('')
  setNewResponsible('')
  setNewDueDate('')
}

// Form JSX:
<div className={WPSTD_FORM_ROW_GRID}>
  <div>
    <p className="text-sm font-medium text-neutral-800">Manuelt tiltak</p>
    <p className="mt-1 text-sm text-neutral-600">
      Auto-genererte tiltak opprettes ved resultatberegning. Her kan du legge til tiltak manuelt.
    </p>
  </div>
  <div className="space-y-4">
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="np-title">Tittel *</label>
      <StandardInput id="np-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
    </div>
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="np-cat">Kategori *</label>
      <StandardInput id="np-cat" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="F.eks. Jobbkrav" />
    </div>
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="np-pillar">Pilar</label>
      <SearchableSelect value={newPillar} options={pillarOptions} onChange={(v) => setNewPillar(v as SurveyPillar)} />
    </div>
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="np-desc">Beskrivelse</label>
      <StandardTextarea id="np-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
    </div>
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="np-resp">Ansvarlig</label>
      <StandardInput id="np-resp" value={newResponsible} onChange={(e) => setNewResponsible(e.target.value)} placeholder="Navn eller stilling" />
    </div>
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="np-due">Frist</label>
      <StandardInput id="np-due" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
    </div>
    <Button
      type="button"
      variant="primary"
      disabled={creating || !newTitle.trim() || !newCategory.trim()}
      onClick={() => void handleCreate()}
    >
      {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Oppretter…</> : <><Plus className="h-4 w-4" /> Legg til tiltak</>}
    </Button>
  </div>
</div>
```

### In parent component

```ts
const openPlans = survey.actionPlans.filter((p) => p.status !== 'closed')
const closedPlans = survey.actionPlans.filter((p) => p.status === 'closed')
```

---

## Validation checklist

- [ ] No `<button className=…>` anywhere
- [ ] No `<input className=…>` or `<textarea className=…>` or `<select>` anywhere
- [ ] `<ComplianceBanner refs={['AML § 3-1', 'IK-forskriften § 5']}>` present
- [ ] Severity left-border classes applied per status (red/orange/emerald)
- [ ] `canManage` gates create form and status-change buttons
- [ ] `survey.canManage && s.status === 'closed'` gates the create form
- [ ] `ACTION_PLAN_STATUS_LABEL` used for all status labels (no hardcoded strings)
- [ ] `SURVEY_PILLAR_LABEL` used for pillar names
- [ ] `src/modules/survey/SurveyActionTab.tsx` deleted
- [ ] Placeholder in `SurveyDetailView.tsx` replaced with real import

## Commit

```
feat(survey): Handlingsplan tab — auto-generated action items
```
