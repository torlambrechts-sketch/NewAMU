// Krav — full catalog of requirements (paragraphs) the org is bound by.
//
// Drives off the merged per-framework paragraph list; for each row we
// surface the resolved status, the controls that satisfy it, and an
// inline drill-down with metadata + actions.

import { Fragment, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Link as LinkIcon,
  ListPlus,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { StandardInput } from '../../../../components/ui/Input'
import {
  CriticalityChip,
  FilterPills,
  FwChip,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
  SectionBanner,
  StatusPill,
  TYPE_TONE,
  type IkFrameworkFilter,
} from './internkontrollShared'
import type { IkData, IkKravStatus, IkCriticality } from '../useInternkontrollPageData'

export function KravSection({
  data,
  filterFw,
}: {
  data: IkData
  filterFw: IkFrameworkFilter
  setFilterFw: (id: IkFrameworkFilter) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IkKravStatus | 'all'>('all')
  const [critFilter, setCritFilter] = useState<IkCriticality | 'all'>('all')
  const [openRow, setOpenRow] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return data.krav.filter((k) => {
      if (filterFw !== 'all' && k.fw !== filterFw) return false
      if (statusFilter !== 'all' && k.status !== statusFilter) return false
      if (critFilter !== 'all' && k.criticality !== critFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!`${k.ref} ${k.title}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [data.krav, filterFw, statusFilter, critFilter, search])

  return (
    <div className="space-y-4">
      <SectionBanner icon={<Scale className="h-4 w-4" />} title="Krav-katalog">
        Alle krav virksomheten er underlagt — fra lovverk, forskrifter og valgte rammeverk.
        Hvert krav skal ha minst én kontroll som etterlever det.
      </SectionBanner>

      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {filtered.length} av {data.krav.length} krav
            </h3>
            <p className="text-[11px] text-neutral-500">Sortert etter rammeverk og paragraf.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-3 w-3" />}
              onClick={() => exportCsv(filtered)}
            >
              Eksporter CSV
            </Button>
            <Button variant="primary" size="sm" icon={<Plus className="h-3 w-3" />}>
              Nytt krav
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel, paragraf…"
              className="bg-neutral-50 py-1.5 pl-8 pr-3 text-xs focus:bg-white"
            />
          </div>
          <FilterPills
            value={statusFilter}
            onChange={setStatusFilter}
            items={[
              { id: 'all', label: 'Alle status' },
              { id: 'covered', label: 'Dekket' },
              { id: 'partial', label: 'Delvis' },
              { id: 'gap', label: 'Gap' },
            ]}
          />
          <FilterPills
            value={critFilter}
            onChange={setCritFilter}
            items={[
              { id: 'all', label: 'Alle' },
              { id: 'høy', label: 'Høy kritikalitet' },
              { id: 'middels', label: 'Middels' },
              { id: 'lav', label: 'Lav' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr>
                <th className={MODULE_TABLE_TH}>Rammeverk</th>
                <th className={MODULE_TABLE_TH}>Krav</th>
                <th className={MODULE_TABLE_TH}>Kritikalitet</th>
                <th className={MODULE_TABLE_TH}>Kontroller</th>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH}>Eier</th>
                <th className={MODULE_TABLE_TH}>Neste revisjon</th>
                <th className={MODULE_TABLE_TH + ' text-right'} aria-label="" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[12px] italic text-neutral-500">
                    Ingen krav matcher filteret.
                  </td>
                </tr>
              ) : null}
              {filtered.map((k) => {
                const isOpen = openRow === k.id
                const ctlIds = k.controls
                const ctls = ctlIds
                  .map((cid) => data.kontroller.find((c) => c.id === cid))
                  .filter((x): x is NonNullable<typeof x> => Boolean(x))
                return (
                  <Fragment key={k.id}>
                    <tr
                      className={MODULE_TABLE_TR_BODY + ' cursor-pointer'}
                      onClick={() => setOpenRow(isOpen ? null : k.id)}
                    >
                      <td className="px-5 py-3">
                        <FwChip fw={k.fw} frameworks={data.frameworks} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[10px] font-bold tabular-nums text-neutral-500">
                            {k.ref}
                          </span>
                          <span className="font-medium text-neutral-900">{k.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <CriticalityChip value={k.criticality} />
                      </td>
                      <td className="px-5 py-3">
                        {ctls.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                            <ShieldOff className="h-3 w-3" /> Ingen
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700">
                            <ShieldCheck className="h-3 w-3 text-[#1a3d32]" />
                            {ctls.length} kontroll{ctls.length === 1 ? '' : 'er'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill status={k.status} />
                      </td>
                      <td className="px-5 py-3 text-[11px] text-neutral-700">{k.owner}</td>
                      <td className="px-5 py-3 text-[11px] tabular-nums text-neutral-600">
                        {k.nextReview}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isOpen ? (
                          <ChevronDown className="ml-auto h-3.5 w-3.5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="ml-auto h-3.5 w-3.5 text-neutral-400" />
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-[#fbf9f3]/50">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
                            <div>
                              {k.gap && (
                                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900">
                                  <div className="font-semibold">Gap-beskrivelse</div>
                                  <p className="mt-0.5">{k.gap}</p>
                                </div>
                              )}
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                Kontroller som dekker dette kravet
                              </h4>
                              {ctls.length === 0 ? (
                                <p className="mt-2 text-[12px] italic text-neutral-500">
                                  Ingen kontroller tilknyttet — opprett en for å dekke kravet.
                                </p>
                              ) : (
                                <ul className="mt-2 space-y-1.5">
                                  {ctls.map((c) => (
                                    <li
                                      key={c.id}
                                      className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-2"
                                    >
                                      <span
                                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                                        style={{
                                          background: TYPE_TONE[c.type].bg,
                                          color: TYPE_TONE[c.type].text,
                                        }}
                                      >
                                        {c.type}
                                      </span>
                                      <span className="flex-1 text-[12px] font-medium text-neutral-900">
                                        {c.title}
                                      </span>
                                      <span className="text-[10px] text-neutral-500">
                                        {c.frequencyLabel} · {c.owner}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {k.evidence.length > 0 && (
                                <>
                                  <h4 className="mt-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                    Maler og publiserte ressurser
                                  </h4>
                                  <ul className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                                    {k.evidence.slice(0, 8).map((e) => (
                                      <li
                                        key={`${e.kind}-${e.id}`}
                                        className="rounded-md border border-neutral-200 bg-white p-2 text-[11px]"
                                      >
                                        <div className="font-medium text-neutral-900">{e.title}</div>
                                        <div className="mt-0.5 text-[10px] text-neutral-500">
                                          {e.kind} · {e.source === 'instance' ? 'publisert' : 'mal'}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={<LinkIcon className="h-3 w-3" />}
                                >
                                  Koble kontroll
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={<Plus className="h-3 w-3" />}
                                >
                                  Opprett kontroll
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<ListPlus className="h-3 w-3" />}
                                >
                                  Opprett tiltak
                                </Button>
                              </div>
                            </div>
                            <aside className="rounded-md border border-neutral-200 bg-white p-3 text-[11px]">
                              <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                Metadata
                              </h5>
                              <dl className="mt-2 space-y-1.5">
                                <div className="flex justify-between">
                                  <dt className="text-neutral-500">Sist gjennomgått</dt>
                                  <dd className="tabular-nums text-neutral-900">{k.reviewed}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-neutral-500">Neste revisjon</dt>
                                  <dd className="tabular-nums text-neutral-900">{k.nextReview}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-neutral-500">Kritikalitet</dt>
                                  <dd>
                                    <CriticalityChip value={k.criticality} />
                                  </dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-neutral-500">Eier</dt>
                                  <dd className="text-neutral-900">{k.owner}</dd>
                                </div>
                                {k.chapter && (
                                  <div className="flex justify-between">
                                    <dt className="text-neutral-500">Kapittel</dt>
                                    <dd className="text-right text-neutral-900">{k.chapter}</dd>
                                  </div>
                                )}
                              </dl>
                            </aside>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function exportCsv(rows: IkData['krav']) {
  const lines = [['Rammeverk', 'Paragraf', 'Tittel', 'Status', 'Kritikalitet', 'Eier'].join(';')]
  for (const k of rows) {
    lines.push(
      [
        escape(k.fw),
        escape(k.ref),
        escape(k.title),
        escape(k.status),
        escape(k.criticality),
        escape(k.owner),
      ].join(';'),
    )
  }
  // BOM prefix so Excel decodes UTF-8 correctly.
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `internkontroll-krav-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Escape + neutralise formula-injection vectors (=, +, -, @, tab, CR)
// when a CSV value would otherwise start a formula in Excel.
function escape(s: string): string {
  const trigger = /^[=+\-@\t\r]/.test(s) ? "'" : ''
  const body = trigger + s
  if (body.includes(';') || body.includes('"') || body.includes('\n') || trigger) {
    return '"' + body.replaceAll('"', '""') + '"'
  }
  return body
}
