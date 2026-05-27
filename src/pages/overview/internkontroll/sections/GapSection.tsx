// Gap-analyse — matrise (framework × criticality) + list view.
//
// Drives off the resolved status field on each IkKrav. The matrix
// shows distribution per (framework, criticality) cell; the list view
// surfaces gap descriptions and the tiltak attached to each row.

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Calendar,
  ClipboardList,
  FileText,
  GraduationCap,
  Grid3x3,
  Info,
  ListChecks,
  List,
  Plus,
  Repeat,
  Scale,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import {
  CoverageBar,
  CriticalityChip,
  FrameworkIcon,
  FwChip,
  Initials,
  KontrollStatusBadge,
  SectionBanner,
  StatusPill,
  TiltakStatusPill,
  TYPE_TONE,
} from './internkontrollShared'
import type { useCompliancePlanItems } from '../useCompliancePlanItems'
import { mapPlanStatus, type IkData, type IkKontroll, type IkKrav } from '../useInternkontrollPageData'
import { cadenceLabel, type IkCategoryId } from './internkontrollTokens'
import type { FrameworkId } from '../frameworkParagraphs'
import type { CoverageEntry } from '../../../../hooks/useRegelverkCoverage'
import type { ControlFrequencyHint } from '../../../../types/complianceLayer'

/** Pre-fill payload passed from a gap row's "Opprett kontroll" button up to
 *  InternkontrollPage, which forwards it to ControlEditorPanel.initial. The
 *  panel uses `code` to auto-bind the new control to the originating
 *  paragraph (internal_control_clauses junction). */
export type CreateControlInitial = {
  code: string
  cadence?: ControlFrequencyHint
  suggestedName?: string
}

type PlanHook = ReturnType<typeof useCompliancePlanItems>

export function GapSection({
  data,
  frameworks,
  categories,
  plan,
  search,
  onCreateControl,
}: {
  data: IkData
  /** Empty = no filter on framework. Multiple = OR semantics. */
  frameworks: FrameworkId[]
  /** Empty = no filter on category. Multiple = OR semantics. */
  categories: IkCategoryId[]
  plan: PlanHook
  /** Free-text search from the page-level Søk row. */
  search: string
  /** Opens the page-level "Ny kontroll"-panel pre-filled with the krav's
   *  paragraph code + recommended cadence, so the new control gets
   *  auto-bound to the originating paragraph. Passed through from
   *  InternkontrollPage. */
  onCreateControl?: (initial: CreateControlInitial) => void
}) {
  const [view, setView] = useState<'matrix' | 'list'>('matrix')

  const gaps = useMemo(() => {
    const fwSet = frameworks.length ? new Set(frameworks) : null
    const catSet = categories.length ? new Set(categories) : null
    const q = search.trim().toLowerCase()
    return data.krav
      .filter((k) => k.status !== 'covered' && k.status !== 'na')
      .filter((k) => !fwSet || fwSet.has(k.fw))
      .filter((k) => !catSet || catSet.has(k.category))
      .filter((k) => !q || k.ref.toLowerCase().includes(q) || k.title.toLowerCase().includes(q))
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
  }, [data.krav, frameworks, categories, search])

  return (
    <div className="space-y-4">
      {!data.catalogSeeded ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Regelverk-katalogen er ikke provisjonert for denne orgen.</p>
            <p className="mt-0.5">
              Tittel, beskrivelse og anbefalt frekvens mangler fra regulation_clauses, så
              gap-radene er mindre informative og hver krav defaulter til status &quot;Gap&quot;.
              Kontakt admin for å kjøre <code className="font-mono">provision_regulation_clauses_baseline_for_org</code>.
            </p>
          </div>
        </div>
      ) : null}
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
        <GapMatrix data={data} frameworks={frameworks} />
      ) : (
        <GapList
          data={data}
          sorted={gaps}
          plan={plan}
          onCreateControl={onCreateControl}
          filtersActive={
            frameworks.length > 0 || categories.length > 0 || search.trim().length > 0
          }
        />
      )}
    </div>
  )
}

function GapMatrix({ data, frameworks }: { data: IkData; frameworks: FrameworkId[] }) {
  const fwSet = frameworks.length ? new Set(frameworks) : null
  const fws = fwSet ? data.frameworks.filter((f) => fwSet.has(f.id)) : data.frameworks
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
  onCreateControl,
  filtersActive,
}: {
  data: IkData
  sorted: IkKrav[]
  plan: PlanHook
  onCreateControl?: (initial: CreateControlInitial) => void
  /** True when at least one filter chip (framework / category / search) is
   *  active. Drives an honest empty state that distinguishes "filter hid
   *  everything" from "the org is fully covered". */
  filtersActive: boolean
}) {
  const [, setSearchParams] = useSearchParams()
  // Use the functional updater form so concurrent URL changes from other
  // effects aren't clobbered by a stale render-time snapshot. (code-review F9)
  const openControl = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev)
          sp.set('section', 'kontroller')
          sp.set('control', id)
          return sp
        },
        { replace: false },
      )
    },
    [setSearchParams],
  )
  const kontrollerById = useMemo(() => {
    const m = new Map<string, IkKontroll>()
    for (const c of data.kontroller) m.set(c.id, c)
    return m
  }, [data.kontroller])

  if (sorted.length === 0) {
    // sorted=0 means "no gap rows match the current view". Distinguish two
    // honest states: filters hid everything vs. all gaps are closed. The
    // unseeded-catalog case can't reach this branch (catalog unseeded =>
    // every krav defaults to 'gap' status => sorted=172), so it's surfaced
    // as a banner above the list/matrix instead (see catalogSeededBanner).
    if (filtersActive) {
      return (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-6 text-center text-[12px] text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="font-medium text-neutral-700">Ingen gap matcher gjeldende filter.</p>
          <p className="mt-1 italic">
            Fjern filter for å se hele oversikten — det kan finnes gap utenfor det valgte rammeverket
            eller kategorien.
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-green-200 bg-green-50/40 p-6 text-center text-[12px] text-green-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="font-semibold">Ingen åpne gap.</p>
        <p className="mt-1 italic text-green-800/80">
          Alle krav i katalogen er dekket eller markert som ikke-aktuelt.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <ul className="divide-y divide-neutral-100">
        {sorted.map((k) => {
          const tiltakForKrav = plan.itemsByLawRef.get(k.ref) ?? []
          const linkedControls = k.controls
            .map((id) => kontrollerById.get(id))
            .filter((c): c is IkKontroll => Boolean(c))
          return (
            <li key={k.id} className="px-5 py-4 hover:bg-neutral-50/40">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
                <div className="space-y-3">
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
                    {k.description ? (
                      <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                        {k.description}
                      </p>
                    ) : k.title === k.ref ? (
                      // Neither DB description nor a static paragraph title — the
                      // h4 above just repeats the code. Surface this as a seed
                      // gap rather than letting the row look broken.
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] italic text-neutral-500">
                        <Info className="h-3 w-3" />
                        Beskrivelse mangler i regelverk-katalogen.
                      </p>
                    ) : null}
                    {k.gap && (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-900">
                        <span className="font-semibold">Gap: </span>
                        {k.gap}
                      </div>
                    )}
                  </div>

                  {linkedControls.length > 0 ? (
                    <KontrollReferenceBlock
                      controls={linkedControls}
                      onOpen={openControl}
                    />
                  ) : (
                    <RecommendedApproachBlock
                      krav={k}
                      onCreateControl={onCreateControl}
                    />
                  )}
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
                      {tiltakForKrav.map((t) => {
                        // Use the canonical raw→display status mapper so the
                        // colour + label match TiltakSection. The previous
                        // code keyed PRIO_TONE (criticality palette) by raw
                        // English enum which produced confusing chips
                        // ("done" with lav-grey, "blocked" with red).
                        const mapped = mapPlanStatus(t.status, t.due_at)
                        return (
                          <li
                            key={t.id}
                            className="rounded border border-neutral-200 bg-white p-2 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-neutral-900">{t.title}</span>
                              <TiltakStatusPill status={mapped.status} />
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
                              <span className="tabular-nums">
                                Frist {t.due_at ?? '—'}
                              </span>
                            </div>
                          </li>
                        )
                      })}
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

// ── KontrollReferenceBlock — shown when at least one control exists ─────────
//
// Tells the user exactly which control(s) cover this paragraph: name, type,
// owner, cadence, last/next run, status. Click opens the control detail in
// the Kontroller-tab (in-page navigation via ?control=). Addresses the user
// feedback: "we need to know what the control is and who normally is
// responsible and the required / recommended cadence".
function KontrollReferenceBlock({
  controls,
  onOpen,
}: {
  controls: IkKontroll[]
  onOpen: (id: string) => void
}) {
  return (
    <div className="rounded-md border border-neutral-200/80 bg-[#fbf9f3]/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        <ShieldCheck className="h-3 w-3" />
        {controls.length === 1
          ? '1 kontroll registrert for dette kravet'
          : `${controls.length} kontroller registrert for dette kravet`}
      </div>
      <ul className="mt-2 space-y-2">
        {controls.map((c) => (
          <li
            key={c.id}
            className="rounded-md border border-neutral-200 bg-white p-3 text-[12px]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-neutral-900">{c.title}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{
                      background: TYPE_TONE[c.type].bg,
                      color: TYPE_TONE[c.type].text,
                    }}
                  >
                    {TYPE_TONE[c.type].label}
                  </span>
                  <KontrollStatusBadge status={c.status} />
                </div>
                {c.purpose && (
                  <p className="mt-1 text-[11px] leading-snug text-neutral-600">{c.purpose}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpen(c.id)}
                className="shrink-0 text-[11px]"
                icon={<ArrowUpRight className="h-3 w-3" />}
              >
                Åpne kontroll
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Eier</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Initials name={c.owner} size={16} />
                  <span className="truncate text-neutral-800">{c.owner}</span>
                </div>
                {c.ownerRole && (
                  <div className="mt-0.5 text-[10px] text-neutral-500">{c.ownerRole}</div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                  Frekvens
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-neutral-800">
                  <Repeat className="h-3 w-3 text-neutral-500" />
                  {c.frequencyLabel}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                  Sist kjørt
                </div>
                <div className="mt-0.5 tabular-nums text-neutral-800">{c.lastRun}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                  Neste
                </div>
                <div className="mt-0.5 tabular-nums text-neutral-800">{c.nextRun}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── RecommendedApproachBlock — Klarert "slik løser vi det" ──────────────────
//
// Shown when no control covers the paragraph. Surfaces:
//   • recommended cadence sourced from regulation_clauses.recommended_cadence
//     (with legal basis when cadence_rationale is non-null, Klarert-heuristikk
//     when null — UI distinguishes the two so auditors don't cite heuristics
//     as law),
//   • Klarert library templates already available (checklist / meeting /
//     document / course / survey) that close the gap if activated,
//   • a one-click button to open the Ny-kontroll-panel.
const EVIDENCE_KIND_META: Record<
  CoverageEntry['kind'],
  { label: string; icon: typeof ShieldCheck }
> = {
  checklist_template: { label: 'Sjekkliste-mal', icon: ListChecks },
  checklist_item: { label: 'Sjekkliste-punkt', icon: ListChecks },
  meeting_template: { label: 'Møte-mal', icon: Users },
  document_template: { label: 'Dokument-mal', icon: FileText },
  document: { label: 'Dokument', icon: FileText },
  course_system: { label: 'Kurs', icon: GraduationCap },
  course_org: { label: 'Kurs', icon: GraduationCap },
  survey: { label: 'Undersøkelse', icon: ClipboardList },
  ros: { label: 'ROS-analyse', icon: TriangleAlert },
  task: { label: 'Oppgave', icon: ClipboardList },
}

// Defensive fallback for any future CoverageEntry.kind that might be added
// without updating EVIDENCE_KIND_META — TS exhaustiveness catches it at build
// time, but a stale build deploy or a back-end schema drift could still send
// an unknown kind at runtime. Without this, the destructure crashes the row.
// (code-review F7)
const FALLBACK_EVIDENCE_META = { label: 'Mal', icon: ClipboardList } as const

function RecommendedApproachBlock({
  krav,
  onCreateControl,
}: {
  krav: IkKrav
  onCreateControl?: (initial: CreateControlInitial) => void
}) {
  const isLegalBasis = Boolean(krav.cadenceRationale)
  const cadenceLabelText = cadenceLabel(krav.recommendedCadence)
  // Dedupe by (kind, id) so a template that mentions the same § twice in
  // its body doesn't list itself twice. Cap at 4 entries to keep the row
  // scannable — auditors don't want a wall of templates.
  const templates = useMemo(() => {
    const seen = new Set<string>()
    const out: CoverageEntry[] = []
    for (const e of krav.evidence) {
      if (e.source !== 'template') continue
      const key = `${e.kind}:${e.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(e)
      if (out.length >= 4) break
    }
    return out
  }, [krav.evidence])

  return (
    <div className="rounded-md border border-[#dbe6e0] bg-[#f3f7f4] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">
        <Sparkles className="h-3 w-3" />
        Anbefalt løsning fra Klarert
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-800">
        <span className="inline-flex items-center gap-1 font-semibold">
          <Repeat className="h-3 w-3 text-[#1a3d32]" />
          Anbefalt frekvens:
        </span>
        <span className="font-semibold text-[#1a3d32]">{cadenceLabelText}</span>
        {isLegalBasis ? (
          <span
            className="inline-flex items-center gap-1 rounded border border-[#1a3d32]/30 bg-[#1a3d32]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]"
            aria-label="Lovgrunnlag: frekvens forankret i lov eller forskrift."
            title="Frekvens forankret i lov eller forskrift."
          >
            <Scale className="h-2.5 w-2.5" />
            Lovgrunnlag
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-semibold italic text-neutral-600"
            aria-label="Klarert-anbefaling — ikke et eksplisitt lovkrav."
            title="Frekvens er en Klarert-anbefaling, ikke et eksplisitt lovkrav."
          >
            <Info className="h-2.5 w-2.5" />
            Klarert-anbefaling (ikke lovkrav)
          </span>
        )}
      </div>
      {krav.cadenceRationale && (
        <p className="mt-1 text-[11px] leading-snug text-neutral-600">
          <span className="font-semibold text-neutral-700">Begrunnelse:</span>{' '}
          {krav.cadenceRationale}
        </p>
      )}

      {templates.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Klarert-maler som dekker kravet
          </div>
          <ul className="mt-1.5 space-y-1">
            {templates.map((t) => {
              const meta = EVIDENCE_KIND_META[t.kind] ?? FALLBACK_EVIDENCE_META
              const Icon = meta.icon
              return (
                <li
                  key={`${t.kind}:${t.id}`}
                  className="flex items-center gap-2 rounded border border-neutral-200 bg-white px-2 py-1.5 text-[11px]"
                >
                  <Icon className="h-3 w-3 shrink-0 text-[#1a3d32]" />
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                    {meta.label}
                  </span>
                  <span className="min-w-0 truncate text-neutral-800">{t.title}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-[11px] italic text-neutral-600">
          Ingen Klarert-mal dekker dette kravet ennå — opprett en kontroll manuelt.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onCreateControl && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-2.5 w-2.5" />}
            onClick={() =>
              onCreateControl({
                code: krav.ref,
                cadence: krav.recommendedCadence,
                // Suggest a control name based on the krav's plain-language
                // title when available — falls back to "Kontroll for <ref>".
                suggestedName:
                  krav.title && krav.title !== krav.ref
                    ? `${krav.title} — kontroll`
                    : `Kontroll for ${krav.ref}`,
              })
            }
          >
            Opprett kontroll
          </Button>
        )}
        <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
          <Calendar className="h-3 w-3" />
          Bruk forslagene over som utgangspunkt for kontroll og årshjul.
        </span>
      </div>
    </div>
  )
}

