// Documents adapter — chrome-only. The TipTap block-tree editor at
// /documents/templates/org/:id/edit is the canonical place to edit
// document templates; trying to flatten the block tree into a step list
// would only frustrate authors. The shell instead renders metadata
// (label, description, category, legal_basis) plus a deep-link to the
// rich editor, preserving the /admin/templates row-click → drawer UX.

import { ExternalLink, FileText } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import type {
  AdapterMeta,
  TemplateEditorAdapter,
} from '../editor/types'

const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

export type DocumentsDraft = {
  id: string
  label: string
  description: string
  category: string
  legalBasis: string[]
}

export type DocumentsAdapterDeps = {
  supabase: SupabaseClient | null
  canEdit: boolean
}

export function createDocumentsAdapter(
  deps: DocumentsAdapterDeps,
): TemplateEditorAdapter<DocumentsDraft> {
  const { supabase, canEdit } = deps

  return {
    source: 'documents',

    async hydrate(rowId) {
      if (!supabase) return null
      const { data, error } = await supabase
        .from('document_org_templates')
        .select('id, label, description, category, legal_basis')
        .eq('id', rowId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error || !data) return null
      const row = data as {
        id: string
        label: string
        description: string | null
        category: string | null
        legal_basis: string[] | null
      }
      const meta: AdapterMeta = {
        title: row.label,
        subtitle: 'Dokument-mal — metadata redigeres her, rikt innhold i fullversjonen.',
        lawRefs: row.legal_basis ?? [],
        versionLabel: 'Aktiv',
        accent: 'teal',
        icon: FileText,
        metadataOnly: true,
      }
      return {
        draft: {
          id: row.id,
          label: row.label,
          description: row.description ?? '',
          category: row.category ?? '',
          legalBasis: row.legal_basis ?? [],
        },
        canEdit,
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
            <label className={LABEL}>Tittel</label>
            <StandardInput
              value={draft.label}
              onChange={(e) => patch({ ...draft, label: e.target.value })}
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
          <div className="space-y-1.5">
            <label className={LABEL}>Kategori</label>
            <StandardInput
              value={draft.category}
              onChange={(e) => patch({ ...draft, category: e.target.value })}
              placeholder="prosedyrer / rutiner / retningslinjer"
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL}>Lov-grunnlag (komma-separert)</label>
            <StandardInput
              value={draft.legalBasis.join(', ')}
              onChange={(e) =>
                patch({
                  ...draft,
                  legalBasis: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="AML § 3-1, IK-f § 5"
            />
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            <p className="font-medium">Rikt innhold</p>
            <p className="mt-1 text-xs">
              Dokumentteksten med blokker, moduler og levende data redigeres i den fulle
              dokument-redigereren (TipTap-basert).
            </p>
            <Button
              variant="ghost"
              className="mt-2 inline-flex items-center gap-1 rounded-none border border-amber-300 bg-white p-1 px-2 text-xs hover:bg-amber-100"
              onClick={() =>
                typeof window !== 'undefined' &&
                window.open(
                  `/documents/templates/org/${encodeURIComponent(draft.id)}/edit`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Åpne dokument-redigerer <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </>
      )
    },

    validate(draft) {
      if (!draft.label.trim()) return 'Tittel er påkrevd.'
      return null
    },

    async saveDraft(rowId, draft) {
      if (!supabase) return { ok: false, error: 'Ingen DB-tilkobling.' }
      const { error } = await supabase
        .from('document_org_templates')
        .update({
          label: draft.label,
          description: draft.description || null,
          category: draft.category || null,
          legal_basis: draft.legalBasis,
        })
        .eq('id', rowId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },

    async publish(rowId, draft) {
      // Documents publishes via review_status=approved when the rich
      // content is finalised in the TipTap workbench; this adapter only
      // touches metadata, so saveDraft == publish here.
      return this.saveDraft(rowId, draft)
    },
  }
}
