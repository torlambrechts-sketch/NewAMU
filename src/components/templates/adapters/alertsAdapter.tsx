// Alerts adapter — metadata-only. Alert templates don't have an ordered
// content structure (no steps / items / questions), so the shell renders
// the adapter's renderMetadataOnly view instead of a step list. The
// chrome (drawer + fullscreen + auto-save indicator + Publiser) is
// reused for visual consistency across /admin/templates rows.

import { AlertTriangle, ExternalLink } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import type {
  AdapterMeta,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

export type AlertsDraft = {
  id: string
  name: string
  description: string
  kind: string
}

export type AlertsAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

export function createAlertsAdapter(
  deps: AlertsAdapterDeps,
): TemplateEditorAdapter<AlertsDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'alerts',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('alert_org_templates')
        .select('id, name, description, kind')
        .eq('id', rowId)
        .maybeSingle()
      if (error || !data) return null
      const row = data as { id: string; name: string; description: string | null; kind: string }
      const meta: AdapterMeta = {
        title: row.name,
        subtitle: 'Varslings-mal — metadata redigeres her, prosess-konfigurasjon i Varslings-admin.',
        lawRefs: [],
        versionLabel: 'Aktiv',
        accent: 'rose',
        icon: AlertTriangle,
        metadataOnly: true,
      }
      return {
        draft: {
          id: row.id,
          name: row.name,
          description: row.description ?? '',
          kind: row.kind,
        },
        canEdit,
        meta,
      }
    },

    // Metadata-only sources never call buildSteps / renderStepDetail /
    // addStepOptions / applyAddStep / applyRemoveStep — the shell guards
    // on meta.metadataOnly before invoking them. Return safe defaults
    // so the interface contract is still satisfied.
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
              rows={4}
            />
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            <p className="font-medium">Prosess-konfigurasjon</p>
            <p className="mt-1 text-xs">
              Konfidensialitet, frister, kategori og prosess-regler redigeres i Varslings-admin.
            </p>
            <Button
              variant="ghost"
              className="mt-2 inline-flex items-center gap-1 rounded-none border border-amber-300 bg-white p-1 px-2 text-xs hover:bg-amber-100"
              onClick={() =>
                typeof window !== 'undefined' &&
                window.open('/alerts/admin', '_blank', 'noopener')
              }
            >
              Åpne Varslings-admin <ExternalLink className="h-3 w-3" />
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
      // alert_org_templates has no studio_draft_payload — auto-save
      // writes straight to the live row.
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const { error } = await supabase
        .from('alert_org_templates')
        .update({
          name: draft.name,
          description: draft.description || null,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },

    async publish(rowId, draft) {
      // No separate publish — same write as saveDraft.
      return this.saveDraft(rowId, draft)
    },
  }
}
