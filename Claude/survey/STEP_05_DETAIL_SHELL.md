# Step 5 — Detail View Shell + 4 Core Tabs

**Replace** `modules/survey/SurveyDetailView.tsx` entirely.  
**Delete** after compile: `src/modules/survey/index.ts`, `src/modules/survey/SurveyBuilderTab.tsx`, `src/modules/survey/SurveyResultsTab.tsx`, `src/modules/survey/SurveyAnalysisPage.tsx`.

Depends on: Step 3 (useSurvey must have final shape).

---

## Context

The current `modules/survey/SurveyDetailView.tsx` (439 lines) already uses design-system components correctly for the 4-tab layout (Oversikt, Bygger, Svar, Analyse). What must change:

1. **Add 2 more tabs**: `amu` (AMU-gjennomgang) and `tiltak` (Handlingsplan). The tab components for these are created in Steps 6 and 7; this step only wires them into the shell.
2. **Switch shell from `WorkplacePageHeading1` + card div to `ModulePageShell`**.
3. **Load AMU review and action plans** when detail loads (hook handles this — just add the tab imports).
4. **Tab badge counts** on `svar` and `tiltak` tabs from live data.

---

## Tab definition

```tsx
import type { TabItem } from '../../src/components/ui/Tabs'

type DetailTab = 'oversikt' | 'bygger' | 'svar' | 'analyse' | 'amu' | 'tiltak'

function buildTabs(
  responseCount: number,
  actionCount: number,
  amuReview: SurveyAmuReviewRow | null,
): TabItem[] {
  return [
    { id: 'oversikt', label: 'Oversikt' },
    { id: 'bygger',   label: 'Bygger' },
    { id: 'svar',     label: 'Svar', badgeCount: responseCount > 0 ? responseCount : undefined },
    { id: 'analyse',  label: 'Analyse' },
    {
      id: 'amu',
      label: 'AMU-gjennomgang',
      badgeCount: amuReview && !amuReview.amu_chair_signed_at ? 1 : undefined,
    },
    {
      id: 'tiltak',
      label: 'Handlingsplan',
      badgeCount: actionCount > 0 ? actionCount : undefined,
    },
  ]
}
```

---

## Page shell skeleton

Replace `WorkplacePageHeading1` + card wrapper with:

```tsx
<ModulePageShell
  breadcrumb={[
    { label: 'Arbeidsplass', to: '/workspace' },
    { label: 'Undersøkelser', to: '/survey' },
    { label: s.title },
  ]}
  title={s.title}
  description={s.description ?? 'Detaljert visning — innstillinger, spørsmål, svar og analyse.'}
  headerActions={
    <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey')}>
      <ArrowLeft className="h-4 w-4" />
      Tilbake
    </Button>
  }
  tabs={<Tabs items={tabs} activeId={tab} onChange={(id) => setTab(id as DetailTab)} />}
  loading={survey.loading && !s}
  notFound={!survey.loading && !s ? true : undefined}
>
  <ComplianceBanner title="Arbeidsmiljøloven Kap. 4 — Psykososialt arbeidsmiljø">
    Systematisk kartlegging støtter vurdering av psykososiale forhold. Ved anonyme undersøkelser
    knyttes ikke svar til identifiserbare brukere i databasen (GDPR).
  </ComplianceBanner>

  {survey.error && <WarningBox>{survey.error}</WarningBox>}

  {tab === 'oversikt' && <OversiktTab survey={survey} s={s} onTabChange={setTab} />}
  {tab === 'bygger'   && <ByggerTab survey={survey} s={s} />}
  {tab === 'svar'     && <SvarTab survey={survey} s={s} nameByUserId={nameByUserId} />}
  {tab === 'analyse'  && <AnalyseTab survey={survey} s={s} />}
  {tab === 'amu'      && <SurveyAmuTab survey={survey} s={s} />}
  {tab === 'tiltak'   && <SurveyTiltakTab survey={survey} s={s} />}
</ModulePageShell>
```

Import `SurveyAmuTab` from `./tabs/SurveyAmuTab` and `SurveyTiltakTab` from `./tabs/SurveyTiltakTab` — these will be created in Steps 6 and 7. Until those steps run, add placeholder components inline:

```tsx
function SurveyAmuTab({ survey: _s }: { survey: UseSurveyState; s: SurveyRow }) {
  return <ModuleSectionCard title="AMU-gjennomgang"><p className="text-sm text-neutral-500">Kommer i neste steg.</p></ModuleSectionCard>
}
function SurveyTiltakTab({ survey: _s }: { survey: UseSurveyState; s: SurveyRow }) {
  return <ModuleSectionCard title="Handlingsplan"><p className="text-sm text-neutral-500">Kommer i neste steg.</p></ModuleSectionCard>
}
```

Replace these with the real imports after Steps 6 and 7.

---

## Oversikt tab (inline — keep current content)

Extract the current `tab === 'oversikt'` block into a `OversiktTab` component. Content is unchanged except:
- Wrap in `<ModuleSectionCard>` instead of bare div
- The publish / close panels remain as-is (already uses `<Button>`)

```tsx
function OversiktTab({
  survey,
  s,
  onTabChange,
}: {
  survey: UseSurveyState
  s: SurveyRow
  onTabChange: (tab: DetailTab) => void
}) { ... }
```

---

## Bygger tab (inline — keep current content)

Extract to `ByggerTab` component. Content unchanged:
- `LayoutTable1PostingsShell` + question table + `SlidePanel` for edit
- All controls already use `<Button>`, `<StandardInput>`, `<StandardTextarea>`, `<SearchableSelect>`, `<YesNoToggle>` — keep them

---

## Svar tab (inline — keep current content)

Extract to `SvarTab` component. Content unchanged. Pass `nameByUserId` as a prop (it is resolved in the parent).

---

## Analyse tab (inline — REQUIRES k-anonymity upgrade)

Extract to `AnalyseTab` component. The current content renders raw averages with no GDPR suppression. This **must** be upgraded:

```tsx
import { SURVEY_K_ANONYMITY_MIN } from '../../../src/lib/orgSurveyKAnonymity'
import { EyeOff } from 'lucide-react'

function AnalyseTab({ survey, s }: SurveyDetailTab) {
  const threshold = s.anonymity_threshold ?? SURVEY_K_ANONYMITY_MIN  // never go below 5

  return (
    <div className="space-y-6">
      <ComplianceBanner refs={['GDPR Art. 25', 'GDPR Art. 9']}>
        Resultater vises kun for spørsmål med {threshold} eller flere svar. Fritekst-svar vises aldri
        i klartekst. Grupper under grenseverdien vises som skjult.
      </ComplianceBanner>

      {survey.questions.map((q) => {
        const a = analyticsByQuestion[q.id]
        const n = q.question_type === 'rating_1_to_5'
          ? (a?.numbers.length ?? 0)
          : q.question_type === 'multiple_choice'
            ? Object.values(a?.choiceCounts ?? {}).reduce((s, v) => s + v, 0)
            : 0

        // GDPR suppression: never show results for groups below threshold
        if (q.question_type !== 'text' && n < threshold) {
          return (
            <div key={q.id} className="rounded-lg border border-neutral-200 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
              <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
              <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                <EyeOff className="h-4 w-4" />
                <span>Skjult — under {threshold} svar (n={n}). GDPR Art. 25.</span>
              </div>
            </div>
          )
        }

        // Text questions: show count ONLY, never the content
        if (q.question_type === 'text') {
          return (
            <div key={q.id} className="rounded-lg border border-neutral-200 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
              <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
              <p className="mt-2 text-sm text-neutral-500">
                Fritekst · {a?.textCount ?? 0} utfylt svar. Individuelle svar vises ikke (GDPR).
              </p>
            </div>
          )
        }

        // ... existing rating / multiple_choice rendering unchanged
      })}
    </div>
  )
}
```

**Rules for AnalyseTab:**
- `threshold = Math.max(s.anonymity_threshold, SURVEY_K_ANONYMITY_MIN)` — never allow threshold < 5
- Text questions: always show count only, never content
- `n < threshold` → show `<EyeOff>` suppression card, never show data
- `n >= threshold` → show chart/bar as before

---

## `tabs` variable in parent

Build tabs from live data:

```ts
const tabs = buildTabs(
  survey.responses.length,
  survey.actionPlans.filter((p) => p.status !== 'closed').length,
  survey.amuReview,
)
```

---

## Prop type shared across tab components

Create `modules/survey/tabs/types.ts`:

```ts
import type { UseSurveyState } from '../useSurvey'
import type { SurveyRow } from '../types'

export type SurveyDetailTab = {
  survey: UseSurveyState
  s: SurveyRow
}
```

All tab components receive `{ survey: UseSurveyState; s: SurveyRow }`.

---

## Validation checklist

- [ ] 6 tabs declared: oversikt, bygger, svar, analyse, amu, tiltak
- [ ] Tab badge counts wired from live data
- [ ] `ModulePageShell` wraps the page
- [ ] `ComplianceBanner` present above tabs content
- [ ] Placeholder tab components compile without error
- [ ] `SlidePanel` (question editor) still works in Bygger tab
- [ ] `nameByUserId` side-effect (profiles fetch) is still inside the parent component, not in `SvarTab`
- [ ] `src/modules/survey/SurveyBuilderTab.tsx` deleted
- [ ] `src/modules/survey/SurveyResultsTab.tsx` deleted
- [ ] `src/modules/survey/SurveyAnalysisPage.tsx` deleted
- [ ] `src/modules/survey/index.ts` deleted (or updated to point to `modules/survey/`)

## Commit

```
feat(survey): detail view — 6-tab shell, Oversikt, Bygger, Svar, Analyse
```
