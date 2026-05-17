// RunHistoryPanel — searchable, confidentiality-aware run log.
//
// Reads workflow_runs (substrate-hardened in migration _20260905120400).
// Shows input_snapshot + output_snapshot + checksum when available; hides
// body of confidential runs unless the viewer has
// workflows.view_confidential (RLS already enforces this — the UI just
// reflects it gracefully).

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, Clock, Eye, EyeOff, Lock, PlayCircle } from 'lucide-react'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { useWorkflowRunDetail } from '../../../hooks/useWorkflowRunDetail'
import type { WorkflowRunRow } from '../../../types/workflow'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { MissedFireWidget } from './MissedFireWidget'

const statusTint: Record<string, { bg: string; fg: string }> = {
  completed: { bg: '#ecfdf5', fg: '#047857' },
  skipped: { bg: '#f5f5f4', fg: '#525252' },
  failed: { bg: '#fef2f2', fg: '#b91c1c' },
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'fullført',
  skipped: 'hoppet over',
  failed: 'feilet',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle statuser' },
  { value: 'completed', label: 'Fullført' },
  { value: 'skipped', label: 'Hoppet over' },
  { value: 'failed', label: 'Feilet' },
]

export function RunHistoryPanel({ ruleId }: { ruleId?: string }) {
  const { runs, loading, error, canViewConfidential } = useWorkflows()
  const [, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  /**
   * Replay-from-real: navigate to the Dry-Run tab with `?fromRun=<id>` so
   * DryRunPanel hydrates the form from the recorded `input_snapshot` (with
   * fallbacks). Preserves the `rule` deep-link so the rule picker is still
   * scoped if the user came in via a per-rule deep link.
   */
  const replayAsDryRun = (run: WorkflowRunRow) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set('tab', 'dry-run')
        params.set('fromRun', run.id)
        if (run.rule_id) params.set('rule', run.rule_id)
        return params
      },
      { replace: false },
    )
  }

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (ruleId && r.rule_id !== ruleId) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (search) {
        const hay = `${r.source_module} ${r.event} ${JSON.stringify(r.detail ?? {})}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [runs, ruleId, statusFilter, search])

  if (loading && runs.length === 0) {
    return <div className="p-6 text-sm text-neutral-500">Laster kjøringer …</div>
  }
  if (error) {
    return <div className="p-6 text-sm text-red-700">Kunne ikke laste kjøringer: {error}</div>
  }

  return (
    <div className="space-y-4">
      <MissedFireWidget />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">Kjøringer</h2>
          <span className="text-xs text-neutral-500">{filtered.length} treff</span>
          <span className="flex-1" />
          <div className="w-56">
            <StandardInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i hendelse / detalj …"
              aria-label="Søk i kjøringer"
            />
          </div>
          <div className="w-48">
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Tidspunkt</th>
                <th className="px-3 py-2 text-left">Modul · hendelse</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Konfidensialitet</th>
                <th className="px-3 py-2 text-right">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((r) => {
                const isConfidential = r.confidentiality_level && r.confidentiality_level !== 'standard'
                const canReadBody = !isConfidential || canViewConfidential
                const tint = statusTint[r.status] ?? { bg: '#f5f5f4', fg: '#525252' }
                return (
                  <tr
                    key={r.id}
                    className={`cursor-pointer hover:bg-neutral-50 ${selected === r.id ? 'bg-emerald-50' : ''}`}
                    onClick={() => setSelected(r.id)}
                  >
                    <td className="px-3 py-2 text-xs text-neutral-700">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {new Date(r.created_at).toLocaleString('nb-NO')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-neutral-900">{r.source_module}</div>
                      <div className="text-xs text-neutral-500">{r.event}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: tint.bg, color: tint.fg }}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      {r.dry_run && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                          tørrløp
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {isConfidential ? (
                        canReadBody ? (
                          <Eye className="inline h-3.5 w-3.5 text-amber-700" />
                        ) : (
                          <EyeOff className="inline h-3.5 w-3.5 text-neutral-400" />
                        )
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.rule_id && canReadBody ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          icon={<PlayCircle className="h-3.5 w-3.5" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            replayAsDryRun(r)
                          }}
                          aria-label="Kjør på nytt som tørrløp"
                        >
                          Kjør på nytt som tørrløp
                        </Button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-neutral-500">
                    Ingen kjøringer matcher filtrene.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <RunDetailCard runId={selected} runs={runs} canViewConfidential={canViewConfidential} />
      </div>
    </div>
  )
}

function RunDetailCard({
  runId,
  runs,
  canViewConfidential,
}: {
  runId: string | null
  runs: WorkflowRunRow[]
  canViewConfidential: boolean
}) {
  const { evidence, loading } = useWorkflowRunDetail(runId)
  const run = runId ? runs.find((r) => r.id === runId) ?? null : null

  if (!runId || !run) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
        <ChevronRight className="mx-auto mb-2 h-5 w-5" />
        Velg en kjøring for detaljer
      </div>
    )
  }

  const isConfidential = run.confidentiality_level && run.confidentiality_level !== 'standard'
  const canReadBody = !isConfidential || canViewConfidential

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">Detaljer</h3>
        <span className="text-xs text-neutral-500">{run.id.slice(0, 8)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span className="text-neutral-500">Modul</span>
        <span>{run.source_module}</span>
        <span className="text-neutral-500">Hendelse</span>
        <span>{run.event}</span>
        <span className="text-neutral-500">Status</span>
        <span>{STATUS_LABEL[run.status] ?? run.status}</span>
        <span className="text-neutral-500">Sjekksum</span>
        <code className="break-all text-[10px] text-neutral-600">{run.input_checksum ?? '—'}</code>
      </div>
      {!canReadBody && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Lock className="mr-1 inline h-3 w-3" />
          Kjøringen er klassifisert som «{run.confidentiality_level}». Du har ikke tilgang til å se
          payload — du kan se sjekksum og tellinger.
        </div>
      )}
      {canReadBody && (
        <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-xs">
          <summary className="cursor-pointer font-medium text-neutral-700">Vis tekniske detaljer</summary>
          <div className="mt-2 space-y-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Inn-data (snapshot)
              </p>
              <pre className="overflow-x-auto rounded bg-white p-2 text-[11px] text-neutral-700">
                {JSON.stringify(run.input_snapshot ?? run.detail, null, 2)}
              </pre>
            </div>
            {run.output_snapshot && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Ut-data (snapshot)
                </p>
                <pre className="overflow-x-auto rounded bg-white p-2 text-[11px] text-neutral-700">
                  {JSON.stringify(run.output_snapshot, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}
      <div>
        <h4 className="mb-1 text-xs font-medium text-neutral-700">Bevis-artefakter</h4>
        {loading ? (
          <div className="text-xs text-neutral-500">Laster …</div>
        ) : evidence.length === 0 ? (
          <div className="text-xs text-neutral-500">Ingen artefakter</div>
        ) : (
          <ul className="space-y-1 text-xs">
            {evidence.map((e) => (
              <li key={e.id} className="rounded border border-neutral-200 bg-white px-2 py-1">
                <div className="font-medium">{e.artefact_kind}</div>
                <div className="text-neutral-500">{e.storage_path}</div>
                <code className="text-[10px] text-neutral-500">{e.sha256_checksum.slice(0, 16)}…</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
