// Oversikt — dashboard for /internkontroll.
//
// Mirrors the design's overview: KPI row at the top, an "Etterlevelse
// per rammeverk" panel as the main visual, then a two-column lower row
// with hot gaps + upcoming year-wheel activities, and a critical /
// overdue alert banner when tiltak slip.

import { ArrowRight, AlertOctagon, Lock } from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import {
  CoverageBar,
  CriticalityChip,
  FrameworkIcon,
  FwChip,
  KpiTile,
  PRIO_TONE,
  StatusDot,
  StatusPill,
  type IkSectionId,
} from './internkontrollShared'
import type { IkData } from '../useInternkontrollPageData'

export function OversiktSection({
  data,
  setSection,
}: {
  data: IkData
  setSection: (id: IkSectionId) => void
}) {
  const stats = data.stats
  const pct = stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0
  const upcoming = data.aarshjul.filter((a) => a.status === 'planned').slice(0, 6)
  const hotGaps = [...data.krav]
    .filter((k) => k.status === 'gap' || (k.status === 'partial' && k.criticality === 'høy'))
    .sort((a) => (a.status === 'gap' ? -1 : 1))
    .slice(0, 6)
  const overdueTiltak = data.tiltak.filter(
    (t) => t.status === 'forsinket' || t.priority === 'kritisk',
  )
  const draftKontroller = data.kontroller.filter((c) => c.status !== 'aktiv').length

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          big={`${pct}%`}
          title="Etterlevelse totalt"
          sub={`${stats.covered} av ${stats.total} krav dekket`}
        />
        <KpiTile
          big={stats.gaps}
          title="Åpne gap"
          sub={`${stats.partial} med delvis dekning`}
          tone="red"
        />
        <KpiTile
          big={stats.activeKontroller}
          title="Aktive kontroller"
          sub={`${draftKontroller} utkast/utgått`}
        />
        <KpiTile
          big={data.prosjekter.length}
          title="Pågående prosjekter"
          sub={`${data.tiltak.filter((t) => t.status === 'pågår').length} tiltak i drift`}
        />
      </div>

      {/* Compliance per framework — main visual */}
      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Etterlevelse per rammeverk
            </h3>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Klikk en rad for å filtrere alt på dette rammeverket.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSection('gap')}
            icon={<ArrowRight className="h-3 w-3" />}
          >
            Gå til gap-analyse
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {data.frameworks.map((f) => {
            const c = f.reqs === 0 ? 0 : Math.round((f.covered / f.reqs) * 100)
            return (
              <div
                key={f.id}
                className="grid grid-cols-1 items-center gap-3 rounded-md border border-neutral-200/80 bg-white p-3 hover:bg-neutral-50/50 md:grid-cols-[170px_minmax(0,1fr)_220px_88px] md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ background: f.color + '14', color: f.color }}
                  >
                    <FrameworkIcon name={f.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-neutral-900">{f.short}</span>
                      {f.mandatory && <Lock className="h-2.5 w-2.5 text-neutral-400" />}
                    </div>
                    <div className="truncate text-[10px] text-neutral-500">{f.name}</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <CoverageBar
                    covered={f.covered}
                    partial={f.partial}
                    gap={f.gap}
                    total={f.reqs}
                    height={8}
                  />
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-600">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2f7757]" />
                      {f.covered} dekket
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#c98a2b]" />
                      {f.partial} delvis
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#b3382a]" />
                      {f.gap} gap
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500 md:text-right">
                  {f.reqs} krav · {f.mandatory ? 'lovpålagt' : 'frivillig'}
                </div>
                <div className="md:text-right">
                  <span
                    className={[
                      'inline-flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                      c >= 80
                        ? 'bg-green-50 text-green-800 ring-2 ring-green-200'
                        : c >= 50
                        ? 'bg-amber-50 text-amber-800 ring-2 ring-amber-200'
                        : 'bg-red-50 text-red-800 ring-2 ring-red-200',
                    ].join(' ')}
                  >
                    {c}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Two-column lower row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Hot gaps */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Kritiske gap</h3>
              <p className="text-[11px] text-neutral-500">
                Åpne gap og høyrisiko delvise dekninger.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSection('gap')}>
              Se alle
            </Button>
          </div>
          {hotGaps.length === 0 ? (
            <p className="px-5 py-6 text-center text-[12px] italic text-neutral-500">
              Ingen kritiske gap. Bra jobbet!
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {hotGaps.map((k) => (
                <li key={k.id} className="px-5 py-3 hover:bg-neutral-50/60">
                  <div className="flex items-start gap-2">
                    <StatusDot status={k.status} size={8} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <FwChip fw={k.fw} frameworks={data.frameworks} />
                        <span className="text-[10px] font-semibold tabular-nums text-neutral-600">
                          {k.ref}
                        </span>
                        <CriticalityChip value={k.criticality} />
                      </div>
                      <p className="mt-0.5 text-[13px] font-medium text-neutral-900">
                        {k.title}
                      </p>
                      {k.gap && (
                        <p className="mt-0.5 text-[11px] italic text-neutral-600">{k.gap}</p>
                      )}
                    </div>
                    <StatusPill status={k.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming activities */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Kommende i årshjulet
              </h3>
              <p className="text-[11px] text-neutral-500">
                Neste {Math.min(6, upcoming.length || 6)} planlagte kontroller.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSection('aarshjul')}>
              Åpne årshjul
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-5 py-6 text-center text-[12px] italic text-neutral-500">
              Ingen planlagte aktiviteter — opprett kontroller med en kadens.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {upcoming.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50/60"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-neutral-200 bg-[#fbf9f3] text-neutral-700">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                      {data.monthNames[a.month - 1]}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-neutral-900">
                      {a.date.split('.')[0]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{a.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {a.fw.map((fw) => (
                        <FwChip key={fw} fw={fw} frameworks={data.frameworks} />
                      ))}
                      <span className="text-[10px] text-neutral-500">· {a.owner}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Critical / overdue alerts */}
      {overdueTiltak.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900">
                {overdueTiltak.length} tiltak krever oppmerksomhet
              </h3>
              <p className="mt-0.5 text-[11px] text-red-800">
                Forsinket eller markert som kritisk prioritet.
              </p>
              <ul className="mt-2 space-y-1">
                {overdueTiltak.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-md bg-white/70 px-3 py-1.5 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${PRIO_TONE[t.priority].bg} ${PRIO_TONE[t.priority].text}`}
                      >
                        {t.priority}
                      </span>
                      <span className="font-medium text-neutral-900">{t.title}</span>
                    </div>
                    <span className="tabular-nums text-[10px] text-neutral-600">
                      Frist {t.deadline} · {t.owner}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setSection('tiltak')}>
              Åpne tiltak
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
