// Dashboards embedder — Studio Builder Phase 2a Task 2a.1.
//
// Lists the org's saved dashboard_layouts and links out to the
// appropriate analyse page where the existing DashboardEditLayoutPanel
// is wired with its scope-specific datasets.
//
// Why not mount DashboardEditLayoutPanel directly: each layout is
// scope-bound (compliance_checklist / survey / tasks / learning / …)
// and the panel needs the live dataset + scope catalog from its host
// page. Studio's job is to make the saved layouts discoverable; the
// actual edit happens on the canonical analyse page.

import { useEffect, useState } from 'react'
import { Loader2, LayoutDashboard, ExternalLink } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

type LayoutRow = {
  id: string
  scope_id: string
  name: string
  slug: string | null
  kind: 'dashboard' | 'report' | 'report_template' | 'studio_preset_layout' | 'studio_pack_layout'
  is_default: boolean
  updated_at: string
}

// Map registered dashboard scope ids to the analyse page that hosts them.
const SCOPE_TO_ANALYSE_HREF: Record<string, string> = {
  compliance_checklist: '/compliance/checklists/analyse',
  survey: '/survey/analyse',
  tasks: '/tasks/management/analyse',
  learning: '/learning/analyse',
  documents: '/documents/analyse',
  meetings: '/meetings/analyse',
  hms_overview: '/overview/hms',
  registers: '/registers/analyse',
}

const KIND_LABEL: Record<LayoutRow['kind'], string> = {
  dashboard: 'Layout',
  report: 'Rapport',
  report_template: 'Rapportmal',
  studio_preset_layout: 'Studio-preset',
  studio_pack_layout: 'Pakkelayout',
}

export default function DashboardsEmbedder({ mode }: EmbedderProps) {
  const { supabase, organization } = useOrgSetupContext()
  const [layouts, setLayouts] = useState<LayoutRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !organization) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- terminate loading when prereqs missing
      setLoading(false)
      return
    }
    void (async () => {
      const { data } = await supabase
        .from('dashboard_layouts')
        .select('id, scope_id, name, slug, kind, is_default, updated_at')
        .eq('organization_id', organization.id)
        .order('updated_at', { ascending: false })
      if (!cancelled) {
        setLayouts((data ?? []) as LayoutRow[])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, organization])

  return (
    <div data-studio-mode={mode} className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 font-serif">Dashboards</h4>
        <p className="text-xs text-neutral-500">
          Lagrede analyse-layouts. Klikk «Åpne» for å redigere på modul-siden hvor scope-data lever.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster layouts…
        </div>
      ) : layouts.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Ingen lagrede dashboards enda. Opprett ett via Enkel-modus eller på Analyse-sidene.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {layouts.map((l) => {
            const href = SCOPE_TO_ANALYSE_HREF[l.scope_id] ?? '/overview/hms'
            return (
              <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {l.name}
                      {l.is_default ? (
                        <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0 text-[9.5px] uppercase text-emerald-800">
                          Standard
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {KIND_LABEL[l.kind]} · {l.scope_id}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    window.location.href = `${href}?layout=${encodeURIComponent(l.slug ?? l.id)}`
                  }}
                >
                  Åpne <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
