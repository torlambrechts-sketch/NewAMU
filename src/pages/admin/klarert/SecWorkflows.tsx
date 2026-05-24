// Arbeidsflyt-seksjonen.
// Lister workflow_rules per organisasjon + statistikk fra
// workflow_runs (kjøringer + feilfrekvens). Toggle for aktiv/utkast
// går direkte mot workflow_rules.is_active. Editor-rutekast videre
// til workflow-builderen (/workflow?rule=…).

import { useState } from 'react'
import {
  ArrowRight,
  ChevronRight,
  GitFork,
  Plus,
  Power,
  PowerOff,
  Zap,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { AdminCard, AdminError, AdminInfoBanner, AdminLoading } from './AdminShared'
import { useAdminWorkflows, type AdminWorkflowSummary } from './useAdminWorkflows'
import type { AdminSectionProps, RouteName } from './types'

interface SecWorkflowsProps extends AdminSectionProps {
  route: RouteName
  setRoute: (route: RouteName) => void
}

export function SecWorkflows({ easy, setRoute }: SecWorkflowsProps) {
  const { summaries, loading, error, toggleActive } = useAdminWorkflows()
  const [toggleErr, setToggleErr] = useState<string | null>(null)

  if (loading) return <AdminLoading />

  const activeCount = summaries.filter((w) => w.enabled).length
  const totalRuns = summaries.reduce((a, w) => a + w.runs, 0)

  async function handleToggle(id: string, nextActive: boolean) {
    setToggleErr(null)
    const errMsg = await toggleActive(id, nextActive)
    if (errMsg) setToggleErr(errMsg)
  }

  return (
    <div className="space-y-4">
      <AdminInfoBanner
        icon={<GitFork className="h-4 w-4" aria-hidden="true" />}
        title="Arbeidsflyt"
        description="Når hendelser inntreffer i Klarert-modulene, kan arbeidsflyter automatisk varsle, opprette oppgaver, sende e-post, eller starte møter. Lovpålagte oppfølgingsplikter blir aldri glemt."
      />

      {error ? <AdminError message={error} /> : null}
      {toggleErr ? <AdminError message={toggleErr} /> : null}

      <AdminCard>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {summaries.length} arbeidsflyt{summaries.length === 1 ? '' : 'er'}
            </h3>
            <p className="text-[11px] text-neutral-500">
              {activeCount} aktive · {totalRuns} kjøringer totalt
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-3 w-3" />}
            onClick={() => setRoute({ name: 'wf-edit', ruleId: 'new' })}
          >
            Ny arbeidsflyt
          </Button>
        </div>

        {summaries.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-neutral-500">
            Ingen arbeidsflyter enda. Bruk &laquo;Ny arbeidsflyt&raquo; for å lage din første.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {summaries.map((w) => (
              <WorkflowRow
                key={w.id}
                wf={w}
                easy={easy}
                onToggle={() => void handleToggle(w.id, !w.enabled)}
                onOpen={() => setRoute({ name: 'wf-edit', ruleId: w.id })}
              />
            ))}
          </ul>
        )}
      </AdminCard>

      {!easy && summaries.length > 0 ? (
        <p className="text-[11px] text-neutral-500">
          For avansert redigering (forgreninger, planlagte triggere og signering) bruk
          arbeidsflyt-byggeren under{' '}
          <a href="/workflow" className="font-semibold text-[#1a3d32] hover:underline">
            /workflow
          </a>
          .
        </p>
      ) : null}
    </div>
  )
}

function WorkflowRow({
  wf,
  easy,
  onToggle,
  onOpen,
}: {
  wf: AdminWorkflowSummary
  easy: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <li className="cursor-pointer px-5 py-3 hover:bg-neutral-50/60" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-transparent transition-colors ' +
            (wf.enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200')
          }
          aria-label={wf.enabled ? 'Slå av' : 'Slå på'}
        >
          {wf.enabled ? (
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{wf.name}</span>
            {!wf.enabled && (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                Utkast
              </span>
            )}
            {wf.lawRefs.slice(0, 2).map((l) => (
              <span
                key={l}
                className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
              >
                {l}
              </span>
            ))}
          </div>
          {!easy && wf.description ? (
            <p className="mt-0.5 text-[12px] text-neutral-600">{wf.description}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-800">
              <Zap className="h-2.5 w-2.5" aria-hidden="true" /> {wf.triggerEventLabel}
            </span>
            <ArrowRight className="h-2.5 w-2.5 text-neutral-400" aria-hidden="true" />
            <span className="text-neutral-600">
              {wf.actionCount} {wf.actionCount === 1 ? 'handling' : 'handlinger'}
            </span>
            {!easy && (
              <span className="ml-2 tabular-nums text-neutral-500">
                {wf.runs} kjøringer · {wf.failed} feilet
                {wf.lastRun ? ` · sist ${formatShortDate(wf.lastRun)}` : ''}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className="mt-1 h-4 w-4 text-neutral-300"
          aria-hidden="true"
        />
      </div>
    </li>
  )
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}.${d.getFullYear()}`
  } catch {
    return iso
  }
}
