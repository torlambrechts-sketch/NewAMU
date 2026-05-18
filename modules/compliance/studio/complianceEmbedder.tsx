// Compliance embedder — Studio Builder Phase 2a Task 2a.1.
//
// First real embedder shipped. Wraps the existing TemplateEditorPanel
// (the slide-panel form already used at /compliance/checklists/admin)
// so the studio shell hosts it inline in Advanced mode without forking
// the editor.
//
// Design pattern (the canonical adapter shape per spec §4 "Embedder
// adapter contract"):
//   1. Browse: list templates from useChecklistModule, let the user
//      pick one or click "Ny" to create.
//   2. Edit: mount TemplateEditorPanel with mode={'edit'|'create'} and
//      the selected template row. The panel owns its own state, save
//      semantics and close gesture.
//   3. Forward: the panel calls onClose/onSaved to bubble lifecycle
//      back into the shell. We use those callbacks to refresh the
//      template list and notify the shell's onDirty (Phase 2a doesn't
//      need autosave wiring yet; reserved for the conflict modal in 2a).
//
// The EmbedderProps.value/onChange/lockState are not threaded here yet
// because the existing TemplateEditorPanel owns its persistence path.
// Wiring those into the wrapper means lifting the panel's internal
// state into the shell — which the spec explicitly says NOT to do
// (§4: "The adapter is a thin shim — it does NOT lift the editor's
// internal state into the shell"). We keep the panel self-contained
// and rely on the shell's row-selection state.

import { useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { TemplateEditorPanel } from '../admin/TemplateEditorPanel'
import { Button } from '../../../src/components/ui/Button'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useActivePack } from '../../../src/context/packContextValue'
import { useChecklistModule } from '../useChecklistModule'
import type { ComplianceTemplateRow } from '../types'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { PublishBar } from '../../../src/components/studio/shell/PublishBar'

type EditorState =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; template: ComplianceTemplateRow }

export default function ComplianceEmbedder({ mode }: EmbedderProps) {
  const { supabase } = useOrgSetupContext()
  const pack = useActivePack()
  const cl = useChecklistModule({ supabase })
  const [editor, setEditor] = useState<EditorState>({ kind: 'idle' })
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const filtered = useMemo(
    () => cl.templates.filter((t) => (pack ? t.pack === pack.slug : true)),
    [cl.templates, pack],
  )

  function handleSaved() {
    setEditor({ kind: 'idle' })
    setReloadKey((k) => k + 1)
    // useChecklistModule reload runs via internal effect on reloadKey-keyed pack change.
    void cl.reloadAggregates?.()
  }

  return (
    <div data-studio-mode={mode} className="space-y-4" key={reloadKey}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900 font-serif">
            Sjekkliste-maler{pack ? ` · ${pack.shortName}` : ''}
          </h4>
          <p className="text-xs text-neutral-500">
            Klikk en mal for å redigere, eller opprett en ny.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditor({ kind: 'create' })}>
          <Plus className="h-3.5 w-3.5" /> Ny mal
        </Button>
      </div>

      {cl.loading ? (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster maler…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Ingen maler for valgt pakke. Klikk «Ny mal» for å opprette en.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {filtered.map((t) => {
            const expanded = expandedRowId === t.id
            return (
              <li key={t.id} className="space-y-0">
                <div className="flex w-full items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start py-3 font-normal"
                    onClick={() => setEditor({ kind: 'edit', template: t })}
                  >
                    <div className="flex w-full items-start justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900">{t.name}</p>
                        <p className="truncate text-[11px] text-neutral-500">
                          {t.slug} · {t.cadence_hint ?? 'ingen kadens'}
                        </p>
                      </div>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mr-2 text-[11px] text-neutral-500"
                    onClick={() => setExpandedRowId(expanded ? null : t.id)}
                    aria-expanded={expanded}
                    aria-controls={`publishbar-${t.id}`}
                  >
                    {expanded ? '▴ Status' : '▾ Status'}
                  </Button>
                </div>
                {expanded ? (
                  <div id={`publishbar-${t.id}`} className="border-t border-neutral-100 px-3 py-2">
                    <PublishBar
                      rowTable="compliance_checklist_templates"
                      rowId={t.id}
                      scopeId="compliance"
                      kindId="baseline"
                      currentStatus={t.review_status}
                      onStatusChange={() => setReloadKey((k) => k + 1)}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {editor.kind !== 'idle' ? (
        <TemplateEditorPanel
          mode={editor.kind === 'create' ? 'create' : 'edit'}
          template={editor.kind === 'edit' ? editor.template : null}
          onClose={() => setEditor({ kind: 'idle' })}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}
