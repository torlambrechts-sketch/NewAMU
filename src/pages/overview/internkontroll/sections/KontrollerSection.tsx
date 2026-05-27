// Kontroller — list of named internal controls (Tier 2 of the
// compliance-layer architecture). Two views: cards (default) and table.
// Each row sets ?control=<id> so the detail view renders inside the
// Internkontroll chrome (ControlDetailView) instead of bouncing to a
// standalone /controls/<id> page.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, FileText, LayoutGrid, Plus, ShieldCheck, Table as TableIcon } from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import {
  FilterPills,
  FwChip,
  Initials,
  KontrollStatusBadge,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
  SectionBanner,
  Stars,
  TYPE_TONE,
} from './internkontrollShared'
import type { IkCategoryId } from './internkontrollTokens'
import type { FrameworkId } from '../frameworkParagraphs'
import type { IkData } from '../useInternkontrollPageData'

type ControlType = 'forebyggende' | 'oppdagende' | 'korrigerende'
type Freq = 'daglig' | 'manedlig' | 'kvartalsvis' | 'arlig' | 'all'

export function KontrollerSection({
  data,
  frameworks,
  categories,
  search,
  onCreateControl,
}: {
  data: IkData
  /** Empty = no filter on framework. Multiple = OR semantics. */
  frameworks: FrameworkId[]
  /** Empty = no filter on category. Multiple = OR semantics. */
  categories: IkCategoryId[]
  /** Free-text search from the page-level Søk row. */
  search: string
  /** Open the page-level ControlEditorPanel (the same slide-over the
   *  header "Ny kontroll" button and the gap-section "Opprett kontroll"
   *  use). Single panel mount, single onSaved hook for refresh. */
  onCreateControl: () => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const openControl = (id: string) => {
    const sp = new URLSearchParams(searchParams)
    sp.set('control', id)
    setSearchParams(sp, { replace: false })
  }
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [typeFilter, setTypeFilter] = useState<ControlType | 'all'>('all')
  const [freqFilter, setFreqFilter] = useState<Freq>('all')

  const enriched = useMemo(() => {
    return data.kontroller.map((c) => {
      const fws = new Set<FrameworkId>()
      for (const code of c.covers) {
        if (code.startsWith('AML ')) fws.add('aml')
        else if (code.startsWith('IK-f ')) fws.add('ik-f')
        else if (code.startsWith('GDPR ')) fws.add('gdpr')
        else if (code.startsWith('Åpenhetsloven ')) fws.add('apenhetsloven')
        else if (code.startsWith('ISO 45001')) fws.add('iso-45001')
      }
      return { ...c, fws: [...fws] }
    })
  }, [data.kontroller])

  const filtered = useMemo(() => {
    const fwSet = frameworks.length ? new Set(frameworks) : null
    const catSet = categories.length ? new Set(categories) : null
    const q = search.trim().toLowerCase()
    return enriched.filter((c) => {
      if (fwSet && !c.fws.some((id) => fwSet.has(id))) return false
      // A kontroll matches the category filter if ANY of the paragraphs
      // it covers fall into any chosen category — kontrol-on-§ is M:M.
      if (catSet && !c.categories.some((id) => catSet.has(id))) return false
      if (typeFilter !== 'all' && c.type !== typeFilter) return false
      if (freqFilter !== 'all' && c.frequency !== freqFilter) return false
      if (q && !c.title.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) return false
      return true
    })
  }, [enriched, frameworks, categories, typeFilter, freqFilter, search])

  const avgEff =
    filtered.length === 0
      ? '–'
      : (
          filtered.reduce((a, c) => a + (c.effectiveness || 0), 0) / filtered.length
        ).toFixed(1)

  return (
    <div className="space-y-4">
      <SectionBanner icon={<ShieldCheck className="h-4 w-4" />} title="Kontroller">
        Konkrete handlinger og rutiner som etterlever ett eller flere krav. Hver kontroll har
        eier, frekvens og dokumentert evidens.
      </SectionBanner>

      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {filtered.length} kontroller
            </h3>
            <p className="text-[11px] text-neutral-500">
              {filtered.filter((c) => c.status === 'aktiv').length} aktive · gj.snitt effektivitet{' '}
              {avgEff}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
              {(
                [
                  { id: 'cards', Icon: LayoutGrid },
                  { id: 'table', Icon: TableIcon },
                ] as const
              ).map((v) => (
                <Button
                  key={v.id}
                  variant="ghost"
                  onClick={() => setView(v.id)}
                  className={[
                    'rounded border-0 px-2 py-1',
                    view === v.id
                      ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900',
                  ].join(' ')}
                >
                  <v.Icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={onCreateControl}
            >
              Ny kontroll
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-2.5">
          <FilterPills
            value={typeFilter}
            onChange={setTypeFilter}
            items={[
              { id: 'all', label: 'Alle typer' },
              { id: 'forebyggende', label: 'Forebyggende' },
              { id: 'oppdagende', label: 'Oppdagende' },
              { id: 'korrigerende', label: 'Korrigerende' },
            ]}
          />
          <FilterPills
            value={freqFilter}
            onChange={setFreqFilter}
            items={[
              { id: 'all', label: 'Alle frekvenser' },
              { id: 'daglig', label: 'Daglig' },
              { id: 'manedlig', label: 'Månedlig' },
              { id: 'kvartalsvis', label: 'Kvartalsvis' },
              { id: 'arlig', label: 'Årlig' },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] italic text-neutral-500">
            Ingen kontroller matcher filteret.
          </p>
        ) : view === 'cards' ? (
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <article
                key={c.id}
                onClick={() => openControl(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openControl(c.id)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Åpne detalj for ${c.title}`}
                className="cursor-pointer overflow-hidden rounded-xl border border-neutral-200/80 bg-white transition-all hover:border-[#1a3d32]/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3d32]/40"
              >
                <div className="h-1" style={{ background: TYPE_TONE[c.type].bg }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: TYPE_TONE[c.type].bg, color: TYPE_TONE[c.type].text }}
                    >
                      {TYPE_TONE[c.type].label}
                    </span>
                    <KontrollStatusBadge status={c.status} />
                  </div>
                  <h4 className="mt-2 text-sm font-semibold leading-tight text-neutral-900">
                    {c.title}
                  </h4>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-600">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {c.frequencyLabel}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-2.5 w-2.5" />
                      {c.evidence}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.fws.slice(0, 4).map((fw) => (
                      <FwChip key={fw} fw={fw} frameworks={data.frameworks} />
                    ))}
                  </div>
                  <div className="mt-3 border-t border-neutral-100 pt-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <Initials name={c.owner} size={20} />
                        <span className="truncate text-neutral-700">{c.owner}</span>
                      </div>
                      <span className="tabular-nums text-neutral-500">
                        {c.covers.length} krav
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-neutral-500">Effektivitet</span>
                      <Stars value={c.effectiveness} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-[#fbf9f3]/60 p-2 text-[10px]">
                    <div>
                      <div className="text-neutral-500">Sist kjørt</div>
                      <div className="font-semibold tabular-nums text-neutral-900">
                        {c.lastRun}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Neste</div>
                      <div className="font-semibold tabular-nums text-neutral-900">
                        {c.nextRun}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr>
                  <th className={MODULE_TABLE_TH}>Kontroll</th>
                  <th className={MODULE_TABLE_TH}>Type</th>
                  <th className={MODULE_TABLE_TH}>Frekvens</th>
                  <th className={MODULE_TABLE_TH}>Eier</th>
                  <th className={MODULE_TABLE_TH}>Rammeverk</th>
                  <th className={MODULE_TABLE_TH}>Effektivitet</th>
                  <th className={MODULE_TABLE_TH}>Sist · Neste</th>
                  <th className={MODULE_TABLE_TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openControl(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        openControl(c.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Åpne detalj for ${c.title}`}
                    className={MODULE_TABLE_TR_BODY + ' cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1a3d32]/40'}
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-neutral-900">{c.title}</div>
                      <div className="text-[10px] text-neutral-500">
                        {c.covers.length} krav · evidens: {c.evidence}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                        style={{
                          background: TYPE_TONE[c.type].bg,
                          color: TYPE_TONE[c.type].text,
                        }}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[11px] text-neutral-700">
                      {c.frequencyLabel}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Initials name={c.owner} size={20} />
                        <span className="text-[11px] text-neutral-700">{c.owner}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.fws.slice(0, 3).map((fw) => (
                          <FwChip key={fw} fw={fw} frameworks={data.frameworks} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Stars value={c.effectiveness} />
                    </td>
                    <td className="px-5 py-3 text-[11px] tabular-nums text-neutral-600">
                      <div>{c.lastRun}</div>
                      <div className="text-neutral-400">→ {c.nextRun}</div>
                    </td>
                    <td className="px-5 py-3">
                      <KontrollStatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
