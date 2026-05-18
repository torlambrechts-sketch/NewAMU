// Workflows embedder — Phase 1.5 builder for workflow rules.
//
// Modes:
//   1. ?template=<id> → WorkflowsBuilder for that rule
//   2. List the org's workflow_rules, click to open builder
//
// The full v3 graph canvas (workflow-engine-review.md Phase B) is the
// next step. This embedder gives users a real per-rule editor inside
// the consistent StudioCanvas chrome instead of a placeholder card.

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Workflow } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { WorkflowsBuilder } from './WorkflowsBuilder'

type RuleRow = {
  id: string
  name: string
  description: string | null
  trigger_event_name: string | null
  source_module: string | null
  is_active: boolean
}

export default function WorkflowsEmbedder({ mode }: EmbedderProps) {
  const { supabase, organization } = useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!supabase || !organization) return
    setLoading(true)
    const { data } = await supabase
      .from('workflow_rules')
      .select('id, name, description, trigger_event_name, source_module, is_active')
      .eq('organization_id', organization.id)
      .order('name')
      .limit(200)
    setRules((data ?? []) as RuleRow[])
    setLoading(false)
  }, [supabase, organization])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical fetch-on-mount
    void reload()
  }, [reload])

  const ruleId = searchParams.get('template')

  if (ruleId) {
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
            ← Tilbake til regler
          </Button>
        </div>
        <WorkflowsBuilder ruleId={ruleId} />
      </div>
    )
  }

  function openRule(id: string) {
    const next = new URLSearchParams(searchParams)
    next.set('template', id)
    setSearchParams(next, { replace: true })
  }

  return (
    <div data-studio-mode={mode} className="space-y-4">
      <CloneDeepLinkRedirect scopeId="workflows" />
      <div>
        <h4 className="text-sm font-semibold text-neutral-900 font-serif">Arbeidsflyt-regler</h4>
        <p className="text-xs text-neutral-500">
          Klikk en regel for å åpne i builder. Klon en mal fra «Klon fra system-mal» over for å starte.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster regler…
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Ingen regler enda. Klon en arbeidsflyt-mal fra panelet over.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {rules.map((r) => (
            <li key={r.id}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start py-3 font-normal"
                onClick={() => openRule(r.id)}
              >
                <div className="flex w-full items-start gap-3 text-left">
                  <Workflow className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{r.name}</p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {r.trigger_event_name ?? 'ingen trigger'} · {r.source_module ?? '?'}
                      {r.is_active ? ' · aktiv' : ' · inaktiv'}
                    </p>
                  </div>
                </div>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
