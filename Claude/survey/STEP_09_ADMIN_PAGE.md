# Step 9 — Admin Settings Page

**Replace** `src/pages/SurveyModuleAdminPage.tsx` entirely.

Depends on: Step 3 (useSurvey must have `canManage` and `questionBank`/`loadQuestionBank`/`upsertQuestionBank`/`deleteQuestionBank`).

---

## Context

`src/pages/SurveyModuleAdminPage.tsx` currently exists but may use legacy patterns. Read it in full before editing. Replace the shell and any raw HTML elements.

The admin page manages two things:
1. **Module settings** — stored in `org_module_payloads` with `module_key = 'survey_settings'`. Schema: `{ intro_html?: string; default_anonymous?: boolean }` (see `modules/survey/surveyAdminSettingsSchema.ts`).
2. **Question bank** — org-level reusable questions (`survey_question_bank` table).

`canManage` is required to access this page. Redirect to `/survey` if not.

---

## File: `src/pages/SurveyModuleAdminPage.tsx`

### Shell

```tsx
<ModulePageShell
  breadcrumb={[
    { label: 'Arbeidsplass', to: '/workspace' },
    { label: 'Undersøkelser', to: '/survey' },
    { label: 'Modulinnstillinger' },
  ]}
  title="Modulinnstillinger — Undersøkelser"
  description="Konfigurer standardinnstillinger og administrer spørsmålsbanken for hele virksomheten."
  headerActions={
    <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
      <ArrowLeft className="h-4 w-4" />
      Tilbake
    </Button>
  }
>
  {!survey.canManage && (
    <WarningBox>Du har ikke tilgang til modulinnstillinger. Krever rollen «survey.manage» eller administrator.</WarningBox>
  )}

  {survey.canManage && (
    <>
      <ModuleSectionCard title="Generelle innstillinger">
        ... (settings form)
      </ModuleSectionCard>

      <ModuleSectionCard
        title="Spørsmålsbank"
        headerActions={
          <Button type="button" variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Legg til
          </Button>
        }
      >
        ... (question bank table)
      </ModuleSectionCard>
    </>
  )}
</ModulePageShell>
```

### Settings form

```tsx
{/* Default anonymous */}
<div className={WPSTD_FORM_ROW_GRID}>
  <div>
    <p className="text-sm font-medium text-neutral-800">Standardinnstilling — anonymitet</p>
    <p className="mt-1 text-sm text-neutral-600">
      Nye undersøkelser starter som anonyme. Kan overstyres per undersøkelse.
    </p>
  </div>
  <div>
    <span className={WPSTD_FORM_FIELD_LABEL}>Anonym som standard</span>
    <div className="mt-2 max-w-xs">
      <YesNoToggle
        value={defaultAnonymous}
        onChange={(v) => setDefaultAnonymous(v)}
      />
    </div>
  </div>
</div>

{/* Intro HTML */}
<div className={WPSTD_FORM_ROW_GRID}>
  <div>
    <p className="text-sm font-medium text-neutral-800">Innledningsekst</p>
    <p className="mt-1 text-sm text-neutral-600">
      HTML-tekst som vises øverst i respondentskjemaet. Kan inneholde formateringskoder.
    </p>
  </div>
  <div>
    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="intro-html">Innledning (HTML)</label>
    <StandardTextarea
      id="intro-html"
      rows={5}
      value={introHtml}
      onChange={(e) => setIntroHtml(e.target.value)}
      placeholder="<p>Kjære medarbeider…</p>"
    />
  </div>
</div>

<Button type="button" variant="primary" disabled={savingSettings} onClick={() => void handleSaveSettings()}>
  {savingSettings ? 'Lagrer…' : 'Lagre innstillinger'}
</Button>
```

Save settings via Supabase directly (not via survey hook, since settings live in `org_module_payloads`). Pattern from existing pages:

```ts
const handleSaveSettings = async () => {
  if (!supabase || !orgId) return
  setSavingSettings(true)
  try {
    const { error } = await supabase
      .from('org_module_payloads')
      .upsert(
        {
          organization_id: orgId,
          module_key: 'survey_settings',
          payload: { default_anonymous: defaultAnonymous, intro_html: introHtml.trim() || undefined },
        },
        { onConflict: 'organization_id,module_key' }
      )
    if (error) throw error
  } catch (err) {
    setSavingSettings(false)
    // show error
  }
  setSavingSettings(false)
}
```

Load settings on mount via `fetchOrgModulePayload` (import from `src/lib/orgModulePayload`).

### Question bank

Table with columns: Kategori, Spørsmål, Type, Handlinger.

Use `LayoutTable1PostingsShell` + `<table>` with `LAYOUT_TABLE1_POSTINGS_*` constants.

Delete button: `<Button variant="ghost" size="icon">` with `<Trash2>` icon, calls `survey.deleteQuestionBank(id)`.

Add form (shown when `showAdd` is true): use `SlidePanel` pattern (matching `SurveyDetailView`).

```tsx
<SlidePanel open={showAdd} onClose={() => setShowAdd(false)} title="Nytt spørsmål i bank" titleId="qbank-panel-title"
  footer={
    <div className="flex gap-2 justify-end w-full">
      <Button variant="secondary" onClick={() => setShowAdd(false)}>Avbryt</Button>
      <Button variant="primary" disabled={qbSaving || !qbText.trim() || !qbCategory.trim()} onClick={() => void handleSaveBank()}>
        {qbSaving ? 'Lagrer…' : 'Lagre'}
      </Button>
    </div>
  }
>
  <div className="space-y-5">
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-cat">Kategori *</label>
      <StandardInput id="qb-cat" value={qbCategory} onChange={(e) => setQbCategory(e.target.value)} placeholder="F.eks. Jobbkrav" />
    </div>
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-text">Spørsmålstekst *</label>
      <StandardTextarea id="qb-text" value={qbText} onChange={(e) => setQbText(e.target.value)} rows={3} />
    </div>
    <div>
      <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-type">Type</label>
      <SearchableSelect
        value={qbType}
        options={QUESTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) => setQbType(v as SurveyQuestionType)}
      />
    </div>
  </div>
</SlidePanel>
```

Import `QUESTION_TYPE_OPTIONS` from `modules/survey/surveyLabels.ts`.

---

## Imports required

```ts
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../src/components/module'
import { ComplianceBanner, WarningBox, Button } from '../../src/components/ui'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { Badge } from '../../src/components/ui/Badge'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../src/components/layout/layoutTable1PostingsKit'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { fetchOrgModulePayload } from '../../src/lib/orgModulePayload'
import { parseSurveyModuleSettings } from '../../modules/survey/surveyAdminSettingsSchema'
import { useSurvey } from '../../modules/survey/useSurvey'
import { questionTypeLabel, QUESTION_TYPE_OPTIONS } from '../../modules/survey/surveyLabels'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseBrowserClient } from '../../src/lib/supabaseClient'
import type { SurveyQuestionType } from '../../modules/survey/types'
```

---

## Validation checklist

- [ ] Non-`canManage` users see `<WarningBox>` not a broken page
- [ ] No `<button className=…>`, `<input className=…>`, `<textarea className=…>`, `<select>` anywhere
- [ ] `<ModulePageShell>` wraps the page
- [ ] Settings load from `org_module_payloads` on mount
- [ ] Question bank loads via `survey.loadQuestionBank()` on mount
- [ ] Delete uses `survey.deleteQuestionBank(id)` with confirm (at minimum an aria-label)
- [ ] `SlidePanel` used for add-question form
- [ ] `QUESTION_TYPE_OPTIONS` from `surveyLabels.ts` (not hardcoded strings)

## Commit

```
feat(survey): admin settings — intro html, default anonymous, question bank
```
