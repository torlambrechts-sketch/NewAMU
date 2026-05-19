// Compliance checklist adapter — `definition.items[]` become EditorStep
// rows. Auto-save writes to studio_draft_payload; «Publiser» promotes
// the draft into the live `definition` jsonb.

import { ClipboardList, CheckSquare, Camera, FileSignature, Hash, AlignLeft, Calendar } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { ToggleSwitch } from '../../ui/FormToggles'
import { parseChecklistDefinition } from '../../../../modules/compliance/schema'
import type {
  ChecklistDefinition,
  ChecklistItem,
  ComplianceTemplateRow,
} from '../../../../modules/compliance/types'
import type {
  AdapterMeta,
  EditorStep,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

const TYPE_LABELS: Record<ChecklistItem['type'], string> = {
  yes_no_na: 'Ja / Nei / I/A',
  text: 'Fritekst',
  number: 'Tall',
  photo: 'Foto',
  signature: 'Signatur',
  date: 'Dato',
}

const TYPE_ICONS: Record<ChecklistItem['type'], typeof ClipboardList> = {
  yes_no_na: CheckSquare,
  text: AlignLeft,
  number: Hash,
  photo: Camera,
  signature: FileSignature,
  date: Calendar,
}

type ItemWithKey = ChecklistItem & { _localKey: string }

export type ComplianceDraft = {
  row: ComplianceTemplateRow
  items: ItemWithKey[]
  hasDraft: boolean
}

export type ComplianceAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

let localCounter = 0
function nextLocalKey() {
  localCounter += 1
  return `item-${localCounter}-${Date.now()}`
}

function withLocalKeys(items: ChecklistItem[]): ItemWithKey[] {
  return items.map((it) => ({ ...it, _localKey: nextLocalKey() }))
}

function stripLocalKeys(items: ItemWithKey[]): ChecklistItem[] {
  return items.map(({ _localKey: _k, ...rest }) => rest)
}

export function createComplianceAdapter(
  deps: ComplianceAdapterDeps,
): TemplateEditorAdapter<ComplianceDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'compliance',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('compliance_checklist_templates')
        .select('*')
        .eq('id', rowId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error || !data) return null
      const row = data as unknown as ComplianceTemplateRow & {
        studio_draft_payload?: unknown
      }

      const draftPayload = row.studio_draft_payload as ChecklistDefinition | null | undefined
      const definitionSource = draftPayload ?? parseChecklistDefinition(row.definition)

      const draft: ComplianceDraft = {
        row,
        items: withLocalKeys(definitionSource.items ?? []),
        hasDraft: !!draftPayload,
      }

      const meta: AdapterMeta = {
        title: row.name,
        subtitle: 'Sjekkliste-mal — punkter til venstre, detaljer til høyre.',
        lawRefs: (row as unknown as { law_refs?: string[] }).law_refs ?? [],
        versionLabel: draft.hasDraft
          ? 'Utkast (ulagrede endringer)'
          : `Publisert · ${row.review_status ?? 'godkjent'}`,
        accent: 'green',
        icon: ClipboardList,
      }

      return { draft, canEdit, meta, escapeHatch: null }
    },

    buildSteps(draft) {
      return draft.items.map((it) => {
        const Icon = TYPE_ICONS[it.type] ?? ClipboardList
        return {
          uiKey: `item:${it._localKey}`,
          kind: 'item' as const,
          title: it.prompt || '(uten ledetekst)',
          subtitle:
            `${TYPE_LABELS[it.type]} ` +
            (it.required ? '· obligatorisk ' : '') +
            (it.law_ref ? `· ${it.law_ref}` : ''),
          icon: Icon,
          accent: it.required ? 'green' : ('slate' as const),
          locked: false,
          completed: !!it.prompt && !!it.prompt.trim(),
        }
      })
    },

    renderStepDetail(step, draft, patch) {
      const local = step.uiKey.replace(/^item:/, '')
      const idx = draft.items.findIndex((i) => i._localKey === local)
      if (idx === -1) return null
      const item = draft.items[idx]
      const setItem = (next: Partial<ChecklistItem>) => {
        const updated = draft.items.slice()
        updated[idx] = { ...item, ...next }
        patch({ ...draft, items: updated })
      }
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Ledetekst (prompt)</label>
            <StandardTextarea
              value={item.prompt}
              onChange={(e) => setItem({ prompt: e.target.value })}
              rows={2}
              placeholder="Er HMS-systemet gjennomgått i året?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL}>Svartype</label>
              <SearchableSelect
                value={item.type}
                options={(Object.keys(TYPE_LABELS) as ChecklistItem['type'][]).map((k) => ({
                  value: k,
                  label: TYPE_LABELS[k],
                }))}
                onChange={(v) => setItem({ type: v as ChecklistItem['type'] })}
              />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Lov-referanse</label>
              <StandardInput
                value={item.law_ref ?? ''}
                onChange={(e) => setItem({ law_ref: e.target.value || undefined })}
                placeholder="AML § 3-1 / IK-f § 5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL}>Alvorlighet ved avvik</label>
              <SearchableSelect
                value={item.severity_default ?? ''}
                options={[
                  { value: '', label: '— ikke satt —' },
                  { value: 'low', label: 'Lav' },
                  { value: 'medium', label: 'Middels' },
                  { value: 'high', label: 'Høy' },
                  { value: 'critical', label: 'Kritisk' },
                ]}
                onChange={(v) =>
                  setItem({
                    severity_default: (v || undefined) as ChecklistItem['severity_default'],
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>ISO-paragraf</label>
              <StandardInput
                value={item.iso_clause ?? ''}
                onChange={(e) => setItem({ iso_clause: e.target.value || undefined })}
                placeholder="9.3.2"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Hjelpetekst</label>
            <StandardTextarea
              value={item.help ?? ''}
              onChange={(e) => setItem({ help: e.target.value || undefined })}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <span className="text-sm text-neutral-700">Obligatorisk svar</span>
            <ToggleSwitch
              checked={!!item.required}
              onChange={(v) => setItem({ required: v })}
              label="Obligatorisk"
            />
          </div>
        </div>
      )
    },

    addStepOptions() {
      return [
        { id: 'yes_no_na', label: 'Ja/Nei/I-A-spørsmål' },
        { id: 'text', label: 'Fritekst-spørsmål' },
        { id: 'number', label: 'Tall-spørsmål' },
        { id: 'photo', label: 'Foto-dokumentasjon' },
        { id: 'signature', label: 'Signatur' },
        { id: 'date', label: 'Dato' },
      ]
    },

    applyAddStep(draft, optionId) {
      const type = optionId as ChecklistItem['type']
      const newItem: ItemWithKey = {
        _localKey: nextLocalKey(),
        key: `auto-${Date.now()}`,
        prompt: '',
        type,
        required: false,
      }
      return { ...draft, items: [...draft.items, newItem] }
    },

    applyRemoveStep(draft, step) {
      const local = step.uiKey.replace(/^item:/, '')
      return { ...draft, items: draft.items.filter((i) => i._localKey !== local) }
    },

    validate(draft) {
      if (draft.items.length === 0) return 'Sjekklisten må ha minst ett punkt.'
      const blank = draft.items.findIndex((i) => !i.prompt.trim())
      if (blank >= 0) return `Punkt ${blank + 1} mangler ledetekst.`
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const payload: ChecklistDefinition = { items: stripLocalKeys(draft.items) }
      const { error } = await supabase
        .from('compliance_checklist_templates')
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
      const payload: ChecklistDefinition = { items: stripLocalKeys(draft.items) }
      const { error } = await supabase
        .from('compliance_checklist_templates')
        .update({
          definition: payload as unknown as Record<string, unknown>,
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
