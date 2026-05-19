// Survey adapter — questions become EditorStep rows. The data lives in
// the catalog body (`survey_template_catalog.body`) with optional per-org
// override (`survey_org_templates.body_override`). Auto-save writes
// drafts to studio_draft_payload on the org row; «Publiser» promotes
// the draft into body_override.

import { Megaphone, AlignLeft, BarChart3, CheckSquare, Vote, Star, List, Hash } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { ToggleSwitch } from '../../ui/FormToggles'
import {
  CatalogTemplateBodySchema,
  type CatalogQuestionType,
  type CatalogTemplateBody,
  type CatalogTemplateQuestion,
} from '../../../../modules/survey/surveyTemplateCatalogTypes'
import type { SurveyOrgTemplateRow } from '../../../../modules/survey/types'
import type {
  AdapterMeta,
  EditorStep,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

const QUESTION_TYPE_LABELS: Partial<Record<CatalogQuestionType, string>> = {
  text: 'Fritekst',
  short_text: 'Kort fritekst',
  long_text: 'Lang fritekst',
  number: 'Tall',
  likert_5: 'Likert 1–5',
  likert_7: 'Likert 1–7',
  scale_10: 'Skala 0–10',
  yes_no: 'Ja / Nei',
  single_select: 'Enkeltvalg',
  multi_select: 'Flervalg',
  multiple_choice: 'Multippelvalg',
  dropdown: 'Nedtrekk',
  rating_visual: 'Visuell skår',
  slider: 'Slider',
  nps: 'NPS',
  voting: 'Avstemning',
  consent: 'Samtykke',
  traffic_light: 'Trafikklys',
  priority_top3: 'Prioriter topp 3',
  signature: 'Signatur',
  photo: 'Foto',
}

const TYPE_ICONS: Partial<Record<CatalogQuestionType, typeof Megaphone>> = {
  text: AlignLeft,
  short_text: AlignLeft,
  long_text: AlignLeft,
  number: Hash,
  likert_5: BarChart3,
  likert_7: BarChart3,
  scale_10: BarChart3,
  yes_no: CheckSquare,
  single_select: List,
  multi_select: List,
  dropdown: List,
  rating_visual: Star,
  nps: BarChart3,
  voting: Vote,
  consent: CheckSquare,
}

type QuestionWithKey = CatalogTemplateQuestion & { _localKey: string }

export type SurveyDraft = {
  row: SurveyOrgTemplateRow & { studio_draft_payload?: unknown }
  catalogName: string
  catalogLawRef: string | null
  questions: QuestionWithKey[]
  version: number
  hasDraft: boolean
}

export type SurveyAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

let localCounter = 0
function nextLocalKey() {
  localCounter += 1
  return `q-${localCounter}-${Date.now()}`
}

function withLocalKeys(items: CatalogTemplateQuestion[]): QuestionWithKey[] {
  return items.map((q) => ({ ...q, _localKey: nextLocalKey() }))
}

function stripLocalKeys(items: QuestionWithKey[]): CatalogTemplateQuestion[] {
  return items.map(({ _localKey: _k, ...rest }) => rest)
}

export function createSurveyAdapter(
  deps: SurveyAdapterDeps,
): TemplateEditorAdapter<SurveyDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'survey',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('survey_org_templates')
        .select('*, survey_template_catalog!inner(id, name, body, law_ref)')
        .eq('id', rowId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error || !data) return null
      const raw = data as unknown as SurveyOrgTemplateRow & {
        studio_draft_payload?: unknown
        survey_template_catalog?: {
          id: string
          name: string
          body: unknown
          law_ref: string | null
        }
      }

      const catalog = raw.survey_template_catalog
      const draftPayload = raw.studio_draft_payload as CatalogTemplateBody | null | undefined
      const liveBodySource =
        (raw.body_override as CatalogTemplateBody | null | undefined) ?? catalog?.body

      const parsed = CatalogTemplateBodySchema.safeParse(draftPayload ?? liveBodySource ?? {})
      const body: CatalogTemplateBody = parsed.success
        ? parsed.data
        : { version: 1, questions: [] }

      const draft: SurveyDraft = {
        row: raw,
        catalogName: catalog?.name ?? '(uten katalog)',
        catalogLawRef: catalog?.law_ref ?? null,
        questions: withLocalKeys(body.questions),
        version: body.version,
        hasDraft: !!draftPayload,
      }

      const meta: AdapterMeta = {
        title: raw.name_override ?? draft.catalogName,
        subtitle: 'Undersøkelse — spørsmål til venstre, detaljer til høyre.',
        lawRefs: draft.catalogLawRef ? [draft.catalogLawRef] : [],
        versionLabel: draft.hasDraft
          ? 'Utkast (ulagrede endringer)'
          : `Publisert · v${draft.version}`,
        accent: 'violet',
        icon: Megaphone,
      }

      return { draft, canEdit, meta, escapeHatch: null }
    },

    buildSteps(draft) {
      return draft.questions.map((q) => {
        const Icon = (TYPE_ICONS[q.type] ?? Megaphone) as EditorStep['icon']
        const typeLabel = QUESTION_TYPE_LABELS[q.type] ?? q.type
        return {
          uiKey: `q:${q._localKey}`,
          kind: 'item' as const,
          title: q.text || '(uten tekst)',
          subtitle:
            `${typeLabel} ` +
            (q.is_mandatory ? '· lovpålagt ' : q.required ? '· obligatorisk ' : '') +
            (q.law_ref ? `· ${q.law_ref}` : ''),
          icon: Icon,
          accent: q.is_mandatory ? 'rose' : q.required ? 'violet' : ('slate' as const),
          locked: false,
          completed: !!q.text && !!q.text.trim(),
        }
      })
    },

    renderStepDetail(step, draft, patch) {
      const local = step.uiKey.replace(/^q:/, '')
      const idx = draft.questions.findIndex((q) => q._localKey === local)
      if (idx === -1) return null
      const q = draft.questions[idx]
      const setQ = (next: Partial<CatalogTemplateQuestion>) => {
        const updated = draft.questions.slice()
        updated[idx] = { ...q, ...next }
        patch({ ...draft, questions: updated })
      }
      const hasOptions = ['single_select', 'multi_select', 'multiple_choice', 'dropdown'].includes(
        q.type,
      )
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Spørsmål</label>
            <StandardTextarea
              value={q.text}
              onChange={(e) => setQ({ text: e.target.value })}
              rows={2}
              placeholder="Hvor enig er du i denne påstanden …"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL}>Spørsmålstype</label>
              <SearchableSelect
                value={q.type}
                options={(Object.keys(QUESTION_TYPE_LABELS) as CatalogQuestionType[]).map((k) => ({
                  value: k,
                  label: QUESTION_TYPE_LABELS[k] ?? k,
                }))}
                onChange={(v) => setQ({ type: v as CatalogQuestionType })}
              />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Lov-referanse</label>
              <StandardInput
                value={q.law_ref ?? ''}
                onChange={(e) => setQ({ law_ref: e.target.value || undefined })}
                placeholder="AML § 4-3"
              />
            </div>
          </div>
          {hasOptions && (
            <div className="space-y-1.5">
              <label className={LABEL}>Svaralternativer (én per linje)</label>
              <StandardTextarea
                value={(q.options ?? []).join('\n')}
                onChange={(e) =>
                  setQ({
                    options: e.target.value
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                rows={4}
              />
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <span className="text-sm text-neutral-700">Obligatorisk å svare</span>
            <ToggleSwitch
              checked={q.required}
              onChange={(v) => setQ({ required: v })}
              label="Obligatorisk"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50/40 px-3 py-2">
            <span className="text-sm text-rose-900">Lovpålagt (kan ikke fjernes)</span>
            <ToggleSwitch
              checked={!!q.is_mandatory}
              onChange={(v) => setQ({ is_mandatory: v })}
              label="Lovpålagt"
            />
          </div>
        </div>
      )
    },

    addStepOptions() {
      return [
        { id: 'likert_5', label: 'Likert 1–5', hint: 'Standard skala' },
        { id: 'yes_no', label: 'Ja / Nei' },
        { id: 'single_select', label: 'Enkeltvalg' },
        { id: 'multi_select', label: 'Flervalg' },
        { id: 'text', label: 'Fritekst' },
        { id: 'nps', label: 'NPS' },
        { id: 'voting', label: 'Avstemning' },
      ]
    },

    applyAddStep(draft, optionId) {
      const type = optionId as CatalogQuestionType
      const newQ: QuestionWithKey = {
        _localKey: nextLocalKey(),
        id: `auto-${Date.now()}`,
        text: '',
        type,
        required: true,
      }
      return { ...draft, questions: [...draft.questions, newQ] }
    },

    applyRemoveStep(draft, step) {
      const local = step.uiKey.replace(/^q:/, '')
      // Refuse to remove lovpålagt — surface the constraint here so the
      // shell's remove button does the right thing.
      const q = draft.questions.find((x) => x._localKey === local)
      if (q?.is_mandatory) return draft
      return { ...draft, questions: draft.questions.filter((x) => x._localKey !== local) }
    },

    validate(draft) {
      if (draft.questions.length === 0) return 'Undersøkelsen må ha minst ett spørsmål.'
      const blank = draft.questions.findIndex((q) => !q.text.trim())
      if (blank >= 0) return `Spørsmål ${blank + 1} mangler tekst.`
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const payload: CatalogTemplateBody = {
        version: draft.version,
        questions: stripLocalKeys(draft.questions),
      }
      const { error } = await supabase
        .from('survey_org_templates')
        .update({
          studio_draft_payload: payload as unknown as Record<string, unknown>,
          studio_draft_at: new Date().toISOString(),
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },

    async publish(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const payload: CatalogTemplateBody = {
        version: draft.version + 1,
        questions: stripLocalKeys(draft.questions),
      }
      const { error } = await supabase
        .from('survey_org_templates')
        .update({
          body_override: payload as unknown as Record<string, unknown>,
          studio_draft_payload: null,
          studio_draft_at: null,
          review_status: 'approved',
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },
  }
}
