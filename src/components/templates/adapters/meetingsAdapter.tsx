// Meetings adapter — agenda items become EditorStep rows. Auto-save
// writes a draft definition to studio_draft_payload; «Publiser»
// promotes the draft to the live `definition` column and clears
// studio_draft_payload.

import { CalendarDays, CheckSquare, FileText, ListChecks } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { ToggleSwitch } from '../../ui/FormToggles'
import type {
  MeetingOrgTemplateRow,
  MeetingTemplateAgendaItem,
  MeetingTemplateDefinition,
} from '../../../../modules/meetings/types'
import type {
  AdapterMeta,
  EditorStep,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

type AgendaWithKey = MeetingTemplateAgendaItem & { _localKey: string }

export type MeetingsDraft = {
  row: MeetingOrgTemplateRow
  agenda: AgendaWithKey[]
  /** Other fields of the definition we don't edit here but must preserve. */
  passthroughDefinition: Omit<MeetingTemplateDefinition, 'agendaItems'>
  hasDraft: boolean
}

export type MeetingsAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

let localCounter = 0
function nextLocalKey() {
  localCounter += 1
  return `ag-${localCounter}-${Date.now()}`
}

function withLocalKeys(items: MeetingTemplateAgendaItem[] | undefined): AgendaWithKey[] {
  return (items ?? []).map((it) => ({ ...it, _localKey: nextLocalKey() }))
}

function stripLocalKeys(items: AgendaWithKey[]): MeetingTemplateAgendaItem[] {
  return items.map(({ _localKey: _k, ...rest }) => rest)
}

export function createMeetingsAdapter(
  deps: MeetingsAdapterDeps,
): TemplateEditorAdapter<MeetingsDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'meetings',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('meeting_org_templates')
        .select('*')
        .eq('id', rowId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error || !data) return null
      const row = data as MeetingOrgTemplateRow

      // Prefer draft payload over the live definition when one exists.
      const draftPayload = (row as unknown as { studio_draft_payload: unknown })
        .studio_draft_payload
      const definitionSource =
        (draftPayload as MeetingTemplateDefinition | null) ?? row.definition

      const { agendaItems, ...rest } = definitionSource ?? {
        agendaItems: [],
        preparationChecklist: [],
        requiredAttendees: [],
        protocolRoles: ['chair'],
      }

      const draft: MeetingsDraft = {
        row,
        agenda: withLocalKeys(agendaItems),
        passthroughDefinition: rest,
        hasDraft: !!draftPayload,
      }

      const meta: AdapterMeta = {
        title: row.name,
        subtitle: 'Møte-mal — agenda-punkter til venstre, detaljer til høyre.',
        lawRefs: row.law_refs ?? [],
        versionLabel: draft.hasDraft ? 'Utkast (ulagrede endringer)' : 'Publisert',
        accent: 'teal',
        icon: CalendarDays,
      }

      return { draft, canEdit, meta, escapeHatch: null }
    },

    buildSteps(draft) {
      const steps: EditorStep[] = []
      draft.agenda.forEach((item) => {
        const completed = !!item.title && !!item.title.trim()
        steps.push({
          uiKey: `agenda:${item._localKey}`,
          kind: 'item',
          title: item.title || '(uten tittel)',
          subtitle:
            (item.lawRef ? `${item.lawRef} · ` : '') +
            (item.isMandatory ? 'obligatorisk' : 'valgfri') +
            (item.defaultDurationMinutes ? ` · ${item.defaultDurationMinutes} min` : ''),
          icon: item.isMandatory ? CheckSquare : ListChecks,
          accent: item.isMandatory ? 'green' : 'teal',
          locked: false,
          completed,
        })
      })
      return steps
    },

    renderStepDetail(step, draft, patch) {
      const local = step.uiKey.replace(/^agenda:/, '')
      const idx = draft.agenda.findIndex((a) => a._localKey === local)
      if (idx === -1) return null
      const item = draft.agenda[idx]
      const setItem = (next: Partial<MeetingTemplateAgendaItem>) => {
        const updated = draft.agenda.slice()
        updated[idx] = { ...item, ...next }
        patch({ ...draft, agenda: updated })
      }
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Tittel</label>
            <StandardInput
              value={item.title}
              onChange={(e) => setItem({ title: e.target.value })}
              placeholder="Sak 1 — Status fra forrige møte"
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Beskrivelse</label>
            <StandardTextarea
              value={item.description ?? ''}
              onChange={(e) => setItem({ description: e.target.value || undefined })}
              rows={3}
              placeholder="Hva skal saken dekke? Hvem deltar?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL}>Lov-referanse</label>
              <StandardInput
                value={item.lawRef ?? ''}
                onChange={(e) => setItem({ lawRef: e.target.value || undefined })}
                placeholder="AML § 7-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Varighet (min)</label>
              <StandardInput
                type="number"
                min={0}
                value={item.defaultDurationMinutes ?? ''}
                onChange={(e) =>
                  setItem({
                    defaultDurationMinutes: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-neutral-700">
              <FileText className="h-4 w-4" />
              Obligatorisk sak
            </span>
            <ToggleSwitch
              checked={item.isMandatory}
              onChange={(v) => setItem({ isMandatory: v })}
              label="Obligatorisk"
            />
          </div>
        </div>
      )
    },

    addStepOptions() {
      return [
        { id: 'agenda', label: 'Nytt agenda-punkt', hint: 'Valgfri sak' },
        { id: 'mandatory', label: 'Obligatorisk agenda-punkt', hint: 'Lov-pålagt sak' },
      ]
    },

    applyAddStep(draft, optionId) {
      const isMandatory = optionId === 'mandatory'
      const newItem: AgendaWithKey = {
        _localKey: nextLocalKey(),
        key: `auto-${Date.now()}`,
        title: '',
        description: '',
        lawRef: '',
        isMandatory,
        defaultPosition: (draft.agenda.length + 1) * 10,
      }
      return { ...draft, agenda: [...draft.agenda, newItem] }
    },

    applyRemoveStep(draft, step) {
      const local = step.uiKey.replace(/^agenda:/, '')
      return { ...draft, agenda: draft.agenda.filter((a) => a._localKey !== local) }
    },

    validate(draft) {
      if (draft.agenda.length === 0) return 'Møtemalen må ha minst ett agenda-punkt.'
      const blank = draft.agenda.findIndex((a) => !a.title.trim())
      if (blank >= 0) return `Agenda-punkt ${blank + 1} mangler tittel.`
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const payload: MeetingTemplateDefinition = {
        ...draft.passthroughDefinition,
        agendaItems: stripLocalKeys(draft.agenda),
      }
      const { error } = await supabase
        .from('meeting_org_templates')
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
      const payload: MeetingTemplateDefinition = {
        ...draft.passthroughDefinition,
        agendaItems: stripLocalKeys(draft.agenda),
      }
      const { error } = await supabase
        .from('meeting_org_templates')
        .update({
          definition: payload as unknown as Record<string, unknown>,
          studio_draft_payload: null,
          studio_draft_at: null,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },
  }
}
