// Gap-analyse — matrise (framework × criticality) + list view.
//
// Drives off the resolved status field on each IkKrav. The matrix
// shows distribution per (framework, criticality) cell; the list view
// surfaces gap descriptions and the tiltak attached to each row.

import { useMemo, useState } from 'react'
import { Calendar, Grid3x3, List, Plus, TriangleAlert, User } from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import {
  CoverageBar,
  CriticalityChip,
  FrameworkIcon,
  FwChip,
  PRIO_TONE,
  SectionBanner,
  StatusPill,
  type IkFrameworkFilter,
} from './internkontrollShared'
import type { useCompliancePlanItems } from '../useCompliancePlanItems'
import type { IkData, IkKrav } from '../useInternkontrollPageData'
import type { IkCategoryFilter } from './internkontrollTokens'

type PlanHook = ReturnType<typeof useCompliancePlanItems>

export function GapSection({
  data,
  filterFw,
  filterCategory,
  plan,
}: {
  data: IkData
  filterFw: IkFrameworkFilter
  filterCategory: IkCategoryFilter
  plan: PlanHook
}) {
  const [view, setView] = useState<'matrix' | 'list'>('matrix')

  const gaps = useMemo(() => {
    return data.krav
      .filter((k) => k.status !== 'covered' && k.status !== 'na')
      .filter((k) => filterFw === 'all' || k.fw === filterFw)
      .filter((k) => filterCategory === 'all' || k.category === filterCategory)
      .sort((a, b) => {
        const order: Record<typeof a.status, number> = {
          gap: 0,
          partial: 1,
          covered: 2,
          na: 3,
        }
        const ord = order[a.status] - order[b.status]
        if (ord !== 0) return ord
        const crit: Record<typeof a.criticality, number> = {
          høy: 0,
          middels: 1,
          lav: 2,
        }
        return crit[a.criticality] - crit[b.criticality]
      })
  }, [data.krav, filterFw, filterCategory])

  return (
    <div className="space-y-4">
      <SectionBanner icon={<TriangleAlert className="h-4 w-4" />} title="Gap-analyse">
        Krav uten dekning eller med delvis dekning, sortert etter alvorlighet og kritikalitet.
        Lag tiltak direkte fra raden.
      </SectionBanner>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
          {(
            [
              { id: 'matrix', label: 'Matrise', Icon: Grid3x3 },
              { id: 'list', label: 'Liste', Icon: List },
            ] as const
          ).map((v) => (
            <Button
              key={v.id}
              variant="ghost"
              onClick={() => setView(v.id)}
              className={[
                'inline-flex items-center gap-1.5 rounded border-0 px-3 py-1.5 text-xs font-semibold',
                view === v.id
                  ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
              ].join(' ')}
            >
              <v.Icon className="h-3.5 w-3.5" />
              {v.label}
            </Button>
          ))}
        </div>
        <div className="text-[11px] text-neutral-500">
          <span className="font-semibold tabular-nums text-neutral-900">{gaps.length}</span> åpne ·{' '}
          <span className="tabular-nums text-red-700">
            {gaps.filter((k) => k.status === 'gap').length}
          </span>{' '}
          gap ·{' '}
          <span className="tabular-nums text-amber-700">
            {gaps.filter((k) => k.status === 'partial').length}
          </span>{' '}
          delvise
        </div>
      </div>

      {view === 'matrix' ? (
        <GapMatrix data={data} filterFw={filterFw} />
      ) : (
        <GapList data={data} sorted={gaps} plan={plan} />
      )}
    </div>
  )
}

function GapMatrix({ data, filterFw }: { data: IkData; filterFw: IkFrameworkFilter }) {
  const fws =
    filterFw === 'all' ? data.frameworks : data.frameworks.filter((f) => f.id === filterFw)
  const cols: Array<'høy' | 'middels' | 'lav'> = ['høy', 'middels', 'lav']

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Modenhetsmatrise — rammeverk × kritikalitet
          </h3>
          <p className="text-[11px] text-neutral-500">
            Hver celle viser krav per status. Klikk en celle for å åpne kravene.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#2f7757]" />
            Dekket
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#c98a2b]" />
            Delvis
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#b3382a]" />
            Gap
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr>
              <th className="w-[180px] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Rammeverk
              </th>
              {cols.map((c) => (
                <th
                  key={c}
                  className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500"
                >
                  Kritikalitet:{' '}
                  <span
                    style={{
                      color: c === 'høy' ? '#9A3412' : c === 'middels' ? '#854D0E' : '#525252',
                    }}
                  >
                    {c}
                  </span>
                </th>
              ))}
              <th className="w-[160px] px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Totalt
              </th>
            </tr>
          </thead>
          <tbody>
            {fws.map((fw) => {
              const fwKrav = data.krav.filter((k) => k.fw === fw.id)
              return (
                <tr key={fw.id} className="border-t border-neutral-100">
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                        style={{ background: fw.color + '14', color: fw.color }}
                      >
                        <FrameworkIcon name={fw.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-900">{fw.short}</div>
                        <div className="truncate text-[10px] text-neutral-500">{fw.name}</div>
                      </div>
                    </div>
                  </td>
                  {cols.map((crit) => {
                    const cell = fwKrav.filter((k) => k.criticality === crit)
                    const c = cell.filter((k) => k.status === 'covered').length
                    const p = cell.filter((k) => k.status === 'partial').length
                    const g = cell.filter((k) => k.status === 'gap').length
                    const tone: 'red' | 'amber' | 'green' | 'neutral' =
                      g > 0 ? 'red' : p > 0 ? 'amber' : c > 0 ? 'green' : 'neutral'
                    const bg = {
                      red: 'bg-red-50 border-red-200',
                      amber: 'bg-amber-50 border-amber-200',
                      green: 'bg-green-50 border-green-200',
                      neutral: 'bg-neutral-50 border-neutral-200',
                    }[tone]
                    return (
                      <td key={crit} className="px-1.5 py-2">
                        <div className={`rounded-md border p-2 ${bg}`}>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold tabular-nums text-neutral-900">
                              {cell.length}
                            </span>
                            <span className="text-[10px] text-neutral-500">krav</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {c > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-green-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#2f7757]" />
                                {c}
                              </span>
                            )}
                            {p > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#c98a2b]" />
                                {p}
                              </span>
                            )}
                            {g > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-red-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#b3382a]" />
                                {g}
                              </span>
                            )}
                            {cell.length === 0 && (
                              <span className="text-neutral-400">—</span>
                            )}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-2 py-3 text-right">
                    <div className="inline-block">
                      <CoverageBar
                        covered={fw.covered}
                        partial={fw.partial}
                        gap={fw.gap}
                        total={fw.reqs}
                        height={6}
                      />
                      <div className="mt-1 text-[10px] tabular-nums text-neutral-500">
                        {fw.reqs === 0 ? 0 : Math.round((fw.covered / fw.reqs) * 100)}% dekket
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GapList({
  data,
  sorted,
  plan,
}: {
  data: IkData
  sorted: IkKrav[]
  plan: PlanHook
}) {
  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200/80 bg-white p-6 text-center text-[12px] italic text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        Ingen åpne gap — alt er dekket eller markert som ikke-aktuelt.
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <ul className="divide-y divide-neutral-100">
        {sorted.map((k) => {
          const tiltakForKrav = plan.itemsByLawRef.get(k.ref) ?? []
          return (
            <li key={k.id} className="px-5 py-4 hover:bg-neutral-50/40">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <StatusPill status={k.status} />
                    <FwChip fw={k.fw} frameworks={data.frameworks} />
                    <span className="font-mono text-[10px] font-bold tabular-nums text-neutral-500">
                      {k.ref}
                    </span>
                    <CriticalityChip value={k.criticality} />
                  </div>
                  <h4 className="mt-1 text-sm font-semibold text-neutral-900">{k.title}</h4>
                  {k.gap && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900">
                      <span className="font-semibold">Gap: </span>
                      {k.gap}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {k.owner}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Frist {k.nextReview}
                    </span>
                  </div>
                </div>
                <aside className="rounded-md border border-neutral-200/80 bg-[#fbf9f3]/60 p-3">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Tilknyttede tiltak
                  </h5>
                  {tiltakForKrav.length === 0 ? (
                    <div className="mt-2">
                      <p className="text-[11px] italic text-neutral-500">
                        Ingen tiltak opprettet for å lukke dette gapet.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-2"
                        icon={<Plus className="h-2.5 w-2.5" />}
                        onClick={() => {
                          void plan.createItem({
                            law_ref: k.ref,
                            framework_id: (k.fw as unknown) as Parameters<
                              PlanHook['createItem']
                            >[0]['framework_id'],
                            title: `Lukke gap for ${k.ref}`,
                            description: k.gap ?? '',
                            status: 'planned',
                          })
                        }}
                      >
                        Opprett tiltak
                      </Button>
                    </div>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {tiltakForKrav.map((t) => (
                        <li
                          key={t.id}
                          className="rounded border border-neutral-200 bg-white p-2 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-neutral-900">{t.title}</span>
                            <span
                              className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                                t.status === 'in_progress'
                                  ? PRIO_TONE['høy'].bg + ' ' + PRIO_TONE['høy'].text
                                  : t.status === 'blocked'
                                  ? PRIO_TONE['kritisk'].bg + ' ' + PRIO_TONE['kritisk'].text
                                  : t.status === 'done'
                                  ? PRIO_TONE['lav'].bg + ' ' + PRIO_TONE['lav'].text
                                  : PRIO_TONE['middels'].bg + ' ' + PRIO_TONE['middels'].text
                              }`}
                            >
                              {t.status}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                            <span className="tabular-nums">
                              Frist {t.due_at ?? '—'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

