// Registers adapter — metadata-only. The field-schema (metadata_schema)
// is best edited in the dedicated /registers/:typeId/edit panel today;
// this adapter exposes the row-level metadata (name, description,
// regulation_ids, cadence) for the unified /admin/templates UX. Auto-
// save writes to studio_draft_payload; «Publiser» promotes to the
// live columns.

import { Database, ExternalLink } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import type {
  AdapterMeta,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

export type RegistersDraft = {
  id: string
  name: string
  description: string
  regulationIds: string[]
  reviewCadenceMonths: number | null
  hasDraft: boolean
  isSystem: boolean
}

export type RegistersAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

export function createRegistersAdapter(
  deps: RegistersAdapterDeps,
): TemplateEditorAdapter<RegistersDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'registers',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('register_types')
        .select(
          'id, name, description, regulation_ids, default_review_cadence_months, is_system, studio_draft_payload',
        )
        .eq('id', rowId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error || !data) return null
      const row = data as {
        id: string
        name: string
        description: string | null
        regulation_ids: string[] | null
        default_review_cadence_months: number | null
        is_system: boolean
        studio_draft_payload: unknown
      }
      const draftPayload = row.studio_draft_payload as
        | {
            name?: string
            description?: string | null
            regulation_ids?: string[]
            default_review_cadence_months?: number | null
          }
        | null
        | undefined
      const meta: AdapterMeta = {
        title: row.name,
        subtitle: 'Register-mal — kjernemetadata her, felt-skjema i Register-admin.',
        lawRefs: row.regulation_ids ?? [],
        versionLabel: row.is_system
          ? 'System (skrivebeskyttet)'
          : draftPayload
            ? 'Utkast (ulagrede endringer)'
            : 'Publisert',
        accent: 'blue',
        icon: Database,
        metadataOnly: true,
      }
      return {
        draft: {
          id: row.id,
          name: draftPayload?.name ?? row.name,
          description: draftPayload?.description ?? row.description ?? '',
          regulationIds: draftPayload?.regulation_ids ?? row.regulation_ids ?? [],
          reviewCadenceMonths:
            draftPayload?.default_review_cadence_months ??
            row.default_review_cadence_months ??
            null,
          hasDraft: !!draftPayload,
          isSystem: row.is_system,
        },
        canEdit: canEdit && !row.is_system,
        meta,
      }
    },

    buildSteps: () => [],
    renderStepDetail: () => null,
    addStepOptions: () => [],
    applyAddStep: (draft) => draft,
    applyRemoveStep: (draft) => draft,

    renderMetadataOnly(draft, patch) {
      return (
        <>
          <div className="space-y-1.5">
            <label className={LABEL}>Navn</label>
            <StandardInput
              value={draft.name}
              onChange={(e) => patch({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Beskrivelse</label>
            <StandardTextarea
              value={draft.description}
              onChange={(e) => patch({ ...draft, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL}>Regelverk (komma-sep.)</label>
              <StandardInput
                value={draft.regulationIds.join(', ')}
                onChange={(e) =>
                  patch({
                    ...draft,
                    regulationIds: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="aml, gdpr"
              />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Revisjonsfrekvens (måneder)</label>
              <StandardInput
                type="number"
                min={0}
                value={draft.reviewCadenceMonths ?? ''}
                onChange={(e) =>
                  patch({
                    ...draft,
                    reviewCadenceMonths: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="12"
              />
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            <p className="font-medium">Felt-skjema</p>
            <p className="mt-1 text-xs">
              Hvilke felter registeret skal samle inn (tekst, dato, select, …) redigeres i
              Register-admin under «Felt-oppsett».
            </p>
            <Button
              variant="ghost"
              className="mt-2 inline-flex items-center gap-1 rounded-none border border-amber-300 bg-white p-1 px-2 text-xs hover:bg-amber-100"
              onClick={() =>
                typeof window !== 'undefined' &&
                window.open(
                  `/registers/${encodeURIComponent(draft.id)}/edit`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Åpne Register-admin <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </>
      )
    },

    validate(draft) {
      if (!draft.name.trim()) return 'Navn er påkrevd.'
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const payload = {
        name: draft.name,
        description: draft.description || null,
        regulation_ids: draft.regulationIds,
        default_review_cadence_months: draft.reviewCadenceMonths,
      }
      const { error } = await supabase
        .from('register_types')
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
      const { error } = await supabase
        .from('register_types')
        .update({
          name: draft.name,
          description: draft.description || null,
          regulation_ids: draft.regulationIds,
          default_review_cadence_months: draft.reviewCadenceMonths,
          studio_draft_payload: null,
          studio_draft_at: null,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },
  }
}
