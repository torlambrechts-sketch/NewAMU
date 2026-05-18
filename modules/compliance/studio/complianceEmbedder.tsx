// Compliance embedder — Studio Builder Phase 2a Task 2a.1.
//
// Three modes:
//   1. ?template=<id> in URL → mount the full ComplianceBuilder canvas
//      for that template (drag-drop items + property inspector)
//   2. Otherwise → list templates with PublishBar per-row expander +
//      "Ny mal" Button (compliance's own list view, kept consistent with
//      the rest of the scopes' list shape)
//   3. Clicking a row → navigates to ?template=<id> which triggers (1)
//
// The legacy slide-panel TemplateEditorPanel is dropped in favour of
// the builder canvas. For "Ny mal" we navigate via the existing
// /compliance/checklists/admin?new=… flow so the slide-panel still
// covers create-from-scratch (slug + initial wiring needs handling we
// don't want to duplicate).

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useActivePack } from '../../../src/context/packContextValue'
import { useChecklistModule } from '../useChecklistModule'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { PublishBar } from '../../../src/components/studio/shell/PublishBar'
import { ComplianceBuilder } from './ComplianceBuilder'

export default function ComplianceEmbedder({ mode }: EmbedderProps) {
  const { supabase } = useOrgSetupContext()
  const pack = useActivePack()
  const cl = useChecklistModule({ supabase })
  const [searchParams, setSearchParams] = useSearchParams()
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const filtered = useMemo(
    () => cl.templates.filter((t) => (pack ? t.pack === pack.slug : true)),
    [cl.templates, pack],
  )

  const templateId = searchParams.get('template')

  // Mode 1: ?template=<id> → full builder canvas
  if (templateId) {
    return (
      <div data-studio-mode={mode}>
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('template')
              setSearchParams(next, { replace: true })
            }}
          >
            ← Tilbake til mal-liste
          </Button>
        </div>
        <ComplianceBuilder templateId={templateId} />
      </div>
    )
  }

  // Mode 2: list templates with per-row PublishBar expander
  function openTemplate(id: string) {
    const next = new URLSearchParams(searchParams)
    next.set('template', id)
    setSearchParams(next, { replace: true })
  }

  return (
    <div data-studio-mode={mode} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900 font-serif">
            Sjekkliste-maler{pack ? ` · ${pack.shortName}` : ''}
          </h4>
          <p className="text-xs text-neutral-500">
            Klikk en mal for å åpne i builder, eller opprett en ny via «Klon fra system-mal» over.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = '/compliance/checklists/admin?new=1'
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Ny tom mal
        </Button>
      </div>

      {cl.loading ? (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster maler…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Ingen maler for valgt pakke. Klikk «Klon fra system-mal» over for å komme i gang.
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
                    onClick={() => openTemplate(t.id)}
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
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
