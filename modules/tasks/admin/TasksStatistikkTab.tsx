// TasksStatistikkTab — template coverage statistics for the tasks module.
// Shows KPI strip and per-kind breakdown from task_template_catalog.

import { useCallback, useEffect, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { WarningBox } from '../../../src/components/ui/AlertBox'

type StatRow = { kind: string; total: number; system: number; org: number; withRefs: number }

export function TasksStatistikkTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rows, setRows] = useState<StatRow[]>([])
  const [totals, setTotals] = useState({ total: 0, system: 0, org: 0, withRefs: 0 })
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('task_template_catalog')
        .select('template_kind, is_system, law_refs')
        .order('template_kind')

      if (qErr) { setError(qErr.message); return }

      const map = new Map<string, StatRow>()
      for (const row of data ?? []) {
        const kind = row.template_kind as string
        if (!map.has(kind)) map.set(kind, { kind, total: 0, system: 0, org: 0, withRefs: 0 })
        const r = map.get(kind)!
        r.total++
        if (row.is_system) r.system++; else r.org++
        if (((row.law_refs as string[]) ?? []).length > 0) r.withRefs++
      }

      const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total)
      setRows(sorted)
      setTotals({
        total: sorted.reduce((n, r) => n + r.total, 0),
        system: sorted.reduce((n, r) => n + r.system, 0),
        org: sorted.reduce((n, r) => n + r.org, 0),
        withRefs: sorted.reduce((n, r) => n + r.withRefs, 0),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lasting feilet.')
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      {error && <WarningBox>{error}</WarningBox>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Totalt maler', value: totals.total },
          { label: 'Systemmaler', value: totals.system },
          { label: 'Egne maler', value: totals.org },
          { label: 'Med lovref.', value: totals.withRefs },
        ].map(({ label, value }) => (
          <ModuleSectionCard key={label} className="p-4 text-center">
            <p className="text-2xl font-bold text-[#c2410c]">{value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
          </ModuleSectionCard>
        ))}
      </div>

      {/* Per-kind table */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-5 w-5 text-[#c2410c]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Per oppgavetype</h2>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
            Ingen maler funnet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">System</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">Egne</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">Med lovref.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.kind} className="border-b border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-2.5 align-middle font-medium text-neutral-900 capitalize">{r.kind}</td>
                    <td className="px-3 py-2.5 text-right align-middle text-neutral-700">{r.system}</td>
                    <td className="px-3 py-2.5 text-right align-middle text-neutral-700">{r.org}</td>
                    <td className="px-3 py-2.5 text-right align-middle text-neutral-700">{r.withRefs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
