// MeetingsStatistikkTab — template coverage statistics for the meetings module.
// Shows template counts per framework, active/inactive breakdown, and
// law-ref coverage so admins can spot gaps at a glance.

import { BarChart2 } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { useMeetings } from '../index'
import { MEETING_FRAMEWORK_LABEL } from '../meetingsLabels'
import { MeetingFrameworkIcon } from '../../../src/pages/meetings/MeetingsAdminPage'

export function MeetingsStatistikkTab() {
  const meetings = useMeetings()

  const systemTotal = meetings.systemTemplates.length
  const orgTotal = meetings.orgTemplates.length
  const total = systemTotal + orgTotal

  // Per-framework breakdown
  type FwRow = {
    framework: string
    system: number
    org: number
    withRefs: number
  }
  const fwMap = new Map<string, FwRow>()

  for (const t of meetings.systemTemplates) {
    const fw = t.framework ?? 'INTERNAL'
    if (!fwMap.has(fw)) fwMap.set(fw, { framework: fw, system: 0, org: 0, withRefs: 0 })
    const r = fwMap.get(fw)!
    r.system++
    if ((t.law_refs ?? []).length > 0) r.withRefs++
  }
  for (const t of meetings.orgTemplates) {
    const fw = t.framework ?? 'INTERNAL'
    if (!fwMap.has(fw)) fwMap.set(fw, { framework: fw, system: 0, org: 0, withRefs: 0 })
    fwMap.get(fw)!.org++
  }

  const rows = Array.from(fwMap.values()).sort((a, b) =>
    a.framework.localeCompare(b.framework),
  )

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: 'Totalt maler', value: total },
          { label: 'Systemmaler', value: systemTotal },
          { label: 'Egne maler', value: orgTotal },
        ].map(({ label, value }) => (
          <ModuleSectionCard key={label} className="p-4 text-center">
            <p className="text-2xl font-bold text-[#1a3d32]">{value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
          </ModuleSectionCard>
        ))}
      </div>

      {/* Per-framework table */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Per rammeverk</h2>
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
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Rammeverk</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">System</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">Egne</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500">Med lovref.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.framework} className="border-b border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="shrink-0 rounded border border-neutral-200 bg-white p-1">
                          <MeetingFrameworkIcon framework={r.framework} className="h-3.5 w-3.5 text-[#1a3d32]" />
                        </div>
                        <span className="font-medium text-neutral-900">
                          {MEETING_FRAMEWORK_LABEL[r.framework as keyof typeof MEETING_FRAMEWORK_LABEL] ?? r.framework}
                        </span>
                      </div>
                    </td>
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
