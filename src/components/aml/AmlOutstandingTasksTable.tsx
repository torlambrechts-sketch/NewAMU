// AmlOutstandingTasksTable — table of utestående oppgaver, sorted with
// overdue first then by severity. Design source:
// ui_kits/aml-compliance/AmlPieces2.jsx OutstandingTasks.

import { Download, ListFilter } from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Badge } from '../ui/Badge'
import type { AmlTask, AmlTaskSeverity } from '../../data/amlComplianceSeed'

const SERIF = "'Libre Baskerville', Georgia, serif"

const SEV_LABEL: Record<AmlTaskSeverity, string> = {
  critical: 'Kritisk',
  high: 'Høy',
  medium: 'Middels',
  low: 'Lav',
}
const SEV_VARIANT: Record<AmlTaskSeverity, 'critical' | 'warning' | 'info' | 'neutral'> = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
}
const SEV_ORDER: Record<AmlTaskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function AmlOutstandingTasksTable({ tasks }: { tasks: AmlTask[] }) {
  const sorted = tasks.slice().sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    return SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
  })

  return (
    <ModuleSectionCard className="!p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2
            className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Utestående oppgaver
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Forfall innen 30 dager, sortert etter alvorlighet og frist. Klikk for tiltak og signering.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <ListFilter className="h-3.5 w-3.5" /> Mine oppgaver
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <Download className="h-3.5 w-3.5" /> Eksporter
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              <th className="px-5 py-2.5">Oppgave</th>
              <th className="px-3 py-2.5">Modul</th>
              <th className="px-3 py-2.5">Lovverk</th>
              <th className="px-3 py-2.5">Alvorlighet</th>
              <th className="px-3 py-2.5">Ansvarlig</th>
              <th className="px-5 py-2.5 text-right">Frist</th>
              <th className="px-3 py-2.5 text-right" aria-label="Åpne" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className="border-t border-neutral-100 hover:bg-neutral-50/60"
              >
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tabular-nums text-neutral-400">
                      {r.id}
                    </span>
                    <span className="font-medium text-neutral-900">{r.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-neutral-700">{r.module}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-neutral-600">{r.law}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={SEV_VARIANT[r.severity]}>{SEV_LABEL[r.severity]}</Badge>
                </td>
                <td className="px-3 py-2.5 text-neutral-700">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-semibold text-neutral-700">
                      {r.owner
                        .split(' ')
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    {r.owner}
                  </span>
                </td>
                <td
                  className={`px-5 py-2.5 text-right tabular-nums ${
                    r.overdue ? 'font-semibold text-red-700' : 'text-neutral-700'
                  }`}
                >
                  {r.overdue ? <span className="mr-1">⚠</span> : null}
                  {r.due}
                  {r.overdue ? (
                    <span className="ml-1 text-[10px] font-semibold text-red-600">
                      {' '}
                      · {r.daysLate}d
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-neutral-300">›</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
        <span>
          Viser {sorted.length} av {sorted.length} aktive
        </span>
        <a
          className="font-semibold text-[#1a3d32] hover:underline"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          Se alle oppgaver →
        </a>
      </div>
    </ModuleSectionCard>
  )
}
