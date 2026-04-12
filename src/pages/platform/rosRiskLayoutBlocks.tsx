import { ChevronDown, Eye, Filter, LayoutGrid, Plus } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { riskColour } from '../../data/rosTemplate'
import type { RosAssessment } from '../../types/internalControl'
import type { RosRiskFlattenedRow, RosRiskOverviewTableRow } from '../../lib/rosRiskOverviewRows'
import { buildRosRiskFlattenedRows, buildRosRiskOverviewRows } from '../../lib/rosRiskOverviewRows'

const FOREST = '#1a3d32'
const BOX_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

const IMPACT_LABELS = ['Svært høy', 'Høy', 'Middels', 'Lav', 'Svært lav'] as const
const LIKELIHOOD_LABELS = ['Svært usannsynlig', 'Usannsynlig', 'Mulig', 'Sannsynlig', 'Svært sannsynlig'] as const

/** Row 0 = top = highest impact */
const CELL_BG: string[][] = [
  ['#fecaca', '#fed7aa', '#fde68a', '#fef08a', '#bbf7d0'],
  ['#fed7aa', '#fde68a', '#fef08a', '#d9f99d', '#bbf7d0'],
  ['#fde68a', '#fef08a', '#d9f99d', '#bbf7d0', '#86efac'],
  ['#fef08a', '#d9f99d', '#bbf7d0', '#86efac', '#4ade80'],
  ['#d9f99d', '#bbf7d0', '#86efac', '#4ade80', '#22c55e'],
]

type MatrixMode = 'matrix' | 'grouped'

type GroupedRisk = {
  category: string
  impact: number
  likelihood: number
  count: number
  avgResidual: number
  level: 'Lav' | 'Middels' | 'Høy'
}

/** Demo: samme struktur som `buildRosRiskFlattenedRows` (én rad per risiko + matrise-celle). */
const DEMO_FLATTENED: RosRiskFlattenedRow[] = [
  {
    id: 'demo-1',
    displayIndex: 1,
    category: 'Demo',
    rosTitle: 'ROS Lager 2025',
    riskTitle: 'Kjemikalier lager',
    score: 20,
    level: 'Høy',
    impactIndex: 0,
    likelihoodIndex: 4,
  },
  {
    id: 'demo-2',
    displayIndex: 2,
    category: 'Demo',
    rosTitle: 'ROS Produksjon',
    riskTitle: 'Løfteanordning',
    score: 16,
    level: 'Høy',
    impactIndex: 1,
    likelihoodIndex: 3,
  },
  {
    id: 'demo-3',
    displayIndex: 3,
    category: 'Demo',
    rosTitle: 'ROS Kontor',
    riskTitle: 'Ergonomi kontor',
    score: 9,
    level: 'Middels',
    impactIndex: 2,
    likelihoodIndex: 2,
  },
  {
    id: 'demo-4',
    displayIndex: 4,
    category: 'Demo',
    rosTitle: 'ROS Felles',
    riskTitle: 'Brannøvelse',
    score: 6,
    level: 'Lav',
    impactIndex: 3,
    likelihoodIndex: 1,
  },
  {
    id: 'demo-5',
    displayIndex: 5,
    category: 'Demo',
    rosTitle: 'ROS IT',
    riskTitle: 'IT-backup',
    score: 3,
    level: 'Lav',
    impactIndex: 4,
    likelihoodIndex: 0,
  },
  {
    id: 'demo-6',
    displayIndex: 6,
    category: 'Demo',
    rosTitle: 'ROS Produksjon',
    riskTitle: 'Maskinvern',
    score: 15,
    level: 'Høy',
    impactIndex: 1,
    likelihoodIndex: 4,
  },
  {
    id: 'demo-7',
    displayIndex: 7,
    category: 'Demo',
    rosTitle: 'ROS Innkjøp',
    riskTitle: 'Leverandørstyring',
    score: 12,
    level: 'Middels',
    impactIndex: 0,
    likelihoodIndex: 3,
  },
]

function scoreBandToLevel(score: number): GroupedRisk['level'] {
  const b = riskColour(score)
  if (b === 'green') return 'Lav'
  if (b === 'yellow') return 'Middels'
  return 'Høy'
}

function buildGroupedRisksFromFlattened(flat: RosRiskFlattenedRow[]): GroupedRisk[] {
  const m = new Map<string, { category: string; impact: number; likelihood: number; scores: number[] }>()
  for (const r of flat) {
    const key = `${r.category}|${r.impactIndex}|${r.likelihoodIndex}`
    const cur = m.get(key)
    if (!cur) {
      m.set(key, { category: r.category, impact: r.impactIndex, likelihood: r.likelihoodIndex, scores: [r.score] })
    } else {
      cur.scores.push(r.score)
    }
  }
  return Array.from(m.values()).map((g) => {
    const sum = g.scores.reduce((a, b) => a + b, 0)
    const avgResidual = sum / g.scores.length
    return {
      category: g.category,
      impact: g.impact,
      likelihood: g.likelihood,
      count: g.scores.length,
      avgResidual,
      level: scoreBandToLevel(avgResidual),
    }
  })
}

const LEVEL_PILL: Record<GroupedRisk['level'], string> = {
  Lav: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80',
  Middels: 'bg-amber-100 text-amber-950 ring-1 ring-amber-200/80',
  Høy: 'bg-red-100 text-red-900 ring-1 ring-red-200/80',
}

function MatrixTooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show ? (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-xs text-neutral-100 shadow-lg"
        >
          {content}
        </div>
      ) : null}
    </div>
  )
}

function RosMatrixShell({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm" style={BOX_SHADOW}>
        {children}
      </div>
      {caption ? <p className="text-xs text-neutral-500">{caption}</p> : null}
    </div>
  )
}

/** Layout-ROS: 5×5-varmekart — samme flate rader som risiko-oversiktstabellen. */
export function RosWorkplaceLayoutRiskMatrixSection({
  assessments,
  onNewRisk,
  caption,
}: {
  assessments?: RosAssessment[]
  onNewRisk?: () => void
  caption?: string
}) {
  const [mode, setMode] = useState<MatrixMode>('matrix')

  const isLive = assessments != null
  const flatRows = useMemo(
    () => (isLive ? buildRosRiskFlattenedRows(assessments) : DEMO_FLATTENED),
    [assessments, isLive],
  )

  const byCellIndividual = useMemo(() => {
    const m: Record<string, RosRiskFlattenedRow[]> = {}
    for (const r of flatRows) {
      const k = `${r.impactIndex}-${r.likelihoodIndex}`
      if (!m[k]) m[k] = []
      m[k].push(r)
    }
    return m
  }, [flatRows])

  const byCellGrouped = useMemo(() => {
    const m: Record<string, GroupedRisk[]> = {}
    const grouped = buildGroupedRisksFromFlattened(flatRows)
    for (const g of grouped) {
      const k = `${g.impact}-${g.likelihood}`
      if (!m[k]) m[k] = []
      m[k].push(g)
    }
    return m
  }, [flatRows])

  const resolvedCaption =
    caption ??
    (isLive
      ? 'Varmekart fra alle risikorader (samme data som tabellen): celle = alvor × sannsynlighet (restfelt når begge er satt, ellers brutto).'
      : 'ROS-varmekart (demo): samme struktur som arbeidsflate.')

  return (
    <RosMatrixShell caption={resolvedCaption}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('matrix')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              mode === 'matrix' ? 'border-neutral-200 bg-white text-neutral-900 shadow-sm' : 'border-transparent bg-neutral-100/80 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <LayoutGrid className="size-4 shrink-0 opacity-70" aria-hidden />
            Risikomatrise
          </button>
          <button
            type="button"
            onClick={() => setMode('grouped')}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              mode === 'grouped' ? 'border-neutral-200 bg-white text-neutral-900 shadow-sm' : 'border-transparent bg-neutral-100/80 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <LayoutGrid className="size-4 shrink-0 opacity-70" aria-hidden />
            Gruppert analyse
          </button>
        </div>
        <button
          type="button"
          onClick={onNewRisk}
          className="rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: FOREST }}
          disabled={!onNewRisk}
        >
          <Plus className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
          Ny risiko
        </button>
      </div>

      <div className="p-4 md:p-6" style={{ backgroundColor: '#F9F7F2' }}>
        <div className="mx-auto max-w-[720px]">
          <p className="mb-4 text-center text-sm font-semibold text-neutral-800">
            {mode === 'matrix' ? 'Risikomatrise' : 'Gruppert risikomatrise'}
          </p>
          <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500 sm:text-xs">
              <div />
              {LIKELIHOOD_LABELS.map((lab) => (
                <div key={lab} className="px-1 pb-2 text-center leading-tight text-neutral-600">
                  {lab}
                </div>
              ))}

              {IMPACT_LABELS.map((impactLab, ri) => (
                <Fragment key={`impact-row-${ri}`}>
                  <div className="flex items-center justify-end pr-2 text-right text-[10px] font-bold uppercase leading-tight text-neutral-600 sm:text-xs">
                    <span className="max-w-[4.5rem] sm:max-w-none">{impactLab}</span>
                  </div>
                  {LIKELIHOOD_LABELS.map((_, ci) => {
                    const bg = CELL_BG[ri]?.[ci] ?? '#e5e5e5'
                    const key = `${ri}-${ci}`
                    const indiv = byCellIndividual[key] ?? []
                    const groups = byCellGrouped[key] ?? []

                    return (
                      <div
                        key={key}
                        className="relative flex min-h-[3.5rem] flex-wrap content-center items-center justify-center gap-1 rounded-md border border-white/40 p-1.5 sm:min-h-[4.25rem]"
                        style={{ backgroundColor: bg }}
                      >
                        {mode === 'matrix' ? (
                          indiv.length === 0 ? (
                            <span className="text-neutral-400/80">—</span>
                          ) : (
                            indiv.map((r) => (
                              <MatrixTooltip
                                key={r.id}
                                content={
                                  <div className="space-y-1.5">
                                    <p className="font-semibold text-white">{r.riskTitle}</p>
                                    <p className="text-neutral-300">{r.rosTitle}</p>
                                    <p>
                                      <span className="text-neutral-400">Score:</span> {r.score}{' '}
                                      <span
                                        className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                          r.level === 'Høy'
                                            ? 'bg-red-200 text-red-950'
                                            : r.level === 'Middels'
                                              ? 'bg-amber-200 text-amber-950'
                                              : 'bg-emerald-200 text-emerald-950'
                                        }`}
                                      >
                                        {r.level}
                                      </span>
                                    </p>
                                  </div>
                                }
                              >
                                <button
                                  type="button"
                                  className="flex size-7 items-center justify-center rounded-md bg-white text-xs font-bold text-neutral-900 shadow-sm ring-1 ring-neutral-200/80 hover:ring-[#1a3d32]/40"
                                >
                                  {r.displayIndex}
                                </button>
                              </MatrixTooltip>
                            ))
                          )
                        ) : groups.length === 0 ? (
                          <span className="text-neutral-400/80">—</span>
                        ) : (
                          groups.map((g) => (
                            <MatrixTooltip
                              key={`${g.category}-${g.impact}-${g.likelihood}`}
                              content={
                                <div className="space-y-1.5">
                                  <p className="font-semibold text-white">
                                    {g.count} {g.count === 1 ? 'gruppe' : 'grupper'} i denne cellen
                                  </p>
                                  <ul className="list-inside list-disc text-neutral-200">
                                    <li>
                                      {g.category}{' '}
                                      <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                        {g.level}
                                      </span>
                                    </li>
                                  </ul>
                                  <p className="text-[10px] text-neutral-400">
                                    Snitt score: {g.avgResidual.toFixed(1)} · {g.count}{' '}
                                    {g.count === 1 ? 'risiko' : 'risikoer'}
                                  </p>
                                </div>
                              }
                            >
                              <button
                                type="button"
                                className="max-w-full truncate rounded-md bg-white px-2 py-1 text-left text-[10px] font-semibold text-neutral-900 shadow-sm ring-1 ring-neutral-200/80 hover:ring-[#1a3d32]/40 sm:text-xs"
                              >
                                {g.category}
                              </button>
                            </MatrixTooltip>
                          ))
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              ))}
          </div>
          <p className="mt-3 text-center text-[10px] text-neutral-500">
            Y-aksen: konsekvens (IMPACT) · X-aksen: sannsynlighet (LIKELIHOOD)
          </p>
        </div>
      </div>
    </RosMatrixShell>
  )
}

/** 5×5 ROS-varmekart: enkelt risiko (nummer) eller gruppert (avdeling) med hover — demo-data. */
export function ComposableRosRiskMatrixBlock() {
  return (
    <RosWorkplaceLayoutRiskMatrixSection caption="ROS-varmekart (5×5, demo): første rad = modus + Ny risiko; bytt mellom matrise og gruppert visning etter avdeling." />
  )
}

const DEMO_TABLE_ROWS: RosRiskOverviewTableRow[] = [
  { id: '1', category: 'Operasjonelt', rosTitle: 'ROS Produksjon 2025', riskTitle: 'Maskinvern', score: 15, level: 'Høy' },
  { id: '2', category: 'HMS', rosTitle: 'ROS Lager', riskTitle: 'Kjemikalier', score: 20, level: 'Høy' },
  { id: '3', category: 'HMS', rosTitle: 'ROS Kontor', riskTitle: 'Ergonomi', score: 9, level: 'Middels' },
  { id: '4', category: 'Sikkerhet', rosTitle: 'ROS IT', riskTitle: 'Tilgangskontroll', score: 12, level: 'Middels' },
  { id: '5', category: 'Økonomi', rosTitle: 'ROS Felles', riskTitle: 'Kontraktsrisiko', score: 6, level: 'Lav' },
  { id: '6', category: 'Juridisk', rosTitle: 'ROS Innkjøp', riskTitle: 'Leverandør', score: 8, level: 'Middels' },
  { id: '7', category: 'Miljø', rosTitle: 'ROS Anlegg', riskTitle: 'Utslipp', score: 10, level: 'Middels' },
  { id: '8', category: 'Operasjonelt', rosTitle: 'ROS Produksjon 2025', riskTitle: 'Løfteanordning', score: 16, level: 'Høy' },
]

/** Tabell: alle risikoer på tvers av ROS-analyser. Uten `assessments` brukes demo-rader (layout-komponist). */
export function RosWorkplaceLayoutRiskTableSection({
  assessments,
  caption,
}: {
  assessments?: RosAssessment[]
  caption?: string
}) {
  const [sortDesc, setSortDesc] = useState(true)
  const [colsOpen, setColsOpen] = useState(false)
  const [showRos, setShowRos] = useState(true)

  const isLive = assessments != null
  const sourceRows = useMemo(
    () => (isLive ? buildRosRiskOverviewRows(assessments) : [...DEMO_TABLE_ROWS]),
    [assessments, isLive],
  )

  const sorted = useMemo(() => {
    const rows = [...sourceRows]
    rows.sort((a, b) => (sortDesc ? b.score - a.score : a.score - b.score))
    return rows
  }, [sourceRows, sortDesc])

  const resolvedCaption =
    caption ??
    (isLive
      ? 'Alle registrerte risikoer på tvers av ROS-vurderinger (score = restrisiko når den er satt, ellers brutto).'
      : 'ROS risiko-oversikt (demo): eksempeldata for layout-komponisten.')

  return (
    <RosMatrixShell caption={resolvedCaption}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
        <SerifHeadingSmall>Gruppert risiko-oversikt</SerifHeadingSmall>
        <div className="relative">
          <button
            type="button"
            onClick={() => setColsOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            <Eye className="size-3.5" aria-hidden />
            Kolonner
          </button>
          {colsOpen ? (
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Vis kolonner</p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={showRos} onChange={(e) => setShowRos(e.target.checked)} className="rounded border-neutral-300" />
                ROS-analyse
              </label>
            </div>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 md:px-5">{isLive ? 'Avdeling' : 'Kategori'}</th>
              {showRos ? <th className="px-4 py-3 md:px-5">ROS-analyse</th> : null}
              <th className="px-4 py-3 md:px-5">Risiko</th>
              <th className="px-4 py-3 md:px-5">
                <button
                  type="button"
                  onClick={() => setSortDesc((d) => !d)}
                  className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900"
                >
                  Score
                  <ChevronDown className={`size-3.5 transition ${sortDesc ? '' : 'rotate-180'}`} aria-hidden />
                </button>
              </th>
              <th className="px-4 py-3 md:px-5">Nivå</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={showRos ? 5 : 4} className="px-4 py-10 text-center text-sm text-neutral-500 md:px-5">
                  {isLive ? 'Ingen risikorader i ROS-vurderingene ennå.' : 'Ingen demo-rader.'}
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr key={r.id} className={`border-b border-neutral-100 ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}`}>
                  <td className="px-4 py-3 font-semibold text-neutral-900 md:px-5">{r.category}</td>
                  {showRos ? <td className="px-4 py-3 text-neutral-700 md:px-5">{r.rosTitle}</td> : null}
                  <td className="px-4 py-3 text-neutral-800 md:px-5">{r.riskTitle}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-neutral-900 md:px-5">{r.score}</td>
                  <td className="px-4 py-3 md:px-5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${LEVEL_PILL[r.level]}`}>{r.level}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500 md:px-5">
        <span>
          {sorted.length} risikoer
          {isLive ? '' : ' (demo)'}
        </span>
        <button type="button" className="inline-flex items-center gap-1 font-semibold text-[#1a3d32] hover:underline">
          <Filter className="size-3.5" aria-hidden />
          Filtrer
        </button>
      </div>
    </RosMatrixShell>
  )
}

export function ComposableRosRiskTableBlock() {
  return <RosWorkplaceLayoutRiskTableSection />
}

function SerifHeadingSmall({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-lg font-semibold tracking-tight text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
      {children}
    </h3>
  )
}
