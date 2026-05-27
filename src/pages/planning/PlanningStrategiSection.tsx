// PlanningStrategiSection — Strategi & OKR tab.
//
// Layout follows the Internkontroll convention: light white cards with
// neutral borders, no gradients, no inline serif heroes. Editing happens
// via right-slide panels (PlanningPlanEditPanel, PlanningObjectiveEditPanel,
// PlanningRaciEditPanel) — same pattern as Sjekklister' "Ny gjennomføring"
// and Internkontroll's tiltak detail panel.

import { useMemo, useState } from 'react'
import {
  CalendarRange,
  Crosshair,
  Pencil,
  Plus,
  Target,
  UserCheck,
  UserCog,
} from 'lucide-react'
import { Initials } from '../../components/ui/elearningPrimitives'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { OkrHealth, OkrObjectiveWithKrs, OkrPlanFull } from '../../types/planning'
import type { PlanningTaskRow } from '../../hooks/usePlanningTasks'
import type { UsePlanningOkrReturn } from '../../hooks/usePlanningOkr'
import { HEALTH_META, PLANNING_ACCENT, fmtNum } from './planningConstants'
import { PlanningPlanEditPanel } from './PlanningPlanEditPanel'
import { PlanningObjectiveEditPanel } from './PlanningObjectiveEditPanel'
import { PlanningRaciEditPanel } from './PlanningRaciEditPanel'

type Props = {
  plan: OkrPlanFull
  ctrl: UsePlanningOkrReturn
  tasks: PlanningTaskRow[]
  onCreateTaskForKr: (objectiveId: string, keyResultId: string) => void
}

function buildHorizonOptions(current: string | undefined): string[] {
  const year = new Date().getFullYear()
  const opts = new Set<string>()
  for (let y = year; y <= year + 3; y += 1) {
    opts.add(`${y}`)
    opts.add(`${y} → ${y + 1}`)
    opts.add(`${y} H1`)
    opts.add(`${y} H2`)
  }
  if (current) opts.add(current)
  return Array.from(opts)
}

export function PlanningStrategiSection({ plan, ctrl, tasks, onCreateTaskForKr }: Props) {
  const { orgProfiles } = useOrgSetupContext()
  const [planEditOpen, setPlanEditOpen] = useState(false)
  const [raciEditOpen, setRaciEditOpen] = useState(false)
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null)

  const personOptions = useMemo(() => {
    const list = orgProfiles
      .map((p) => ({ id: p.id, name: p.display_name || p.email || 'Bruker' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    const extras: Array<{ id: string; name: string }> = []
    if (plan.sponsorName && !list.some((p) => p.name === plan.sponsorName) && !plan.sponsorUserId) {
      extras.push({ id: `__sponsor_${plan.sponsorName}`, name: plan.sponsorName })
    }
    if (
      plan.facilitatorName
      && !list.some((p) => p.name === plan.facilitatorName)
      && !plan.facilitatorUserId
    ) {
      extras.push({ id: `__facilitator_${plan.facilitatorName}`, name: plan.facilitatorName })
    }
    return [...list, ...extras]
  }, [orgProfiles, plan.sponsorName, plan.sponsorUserId, plan.facilitatorName, plan.facilitatorUserId])

  const horizonOptions = useMemo(() => buildHorizonOptions(plan.horizon), [plan.horizon])

  const overallProgress = useMemo(() => {
    const all = plan.objectives.flatMap((o) => o.keyResults)
    if (all.length === 0) return 0
    let sum = 0
    for (const k of all) {
      const ratio = k.invert
        ? Math.max(0, Math.min(1, k.target / Math.max(k.currentValue, 0.01)))
        : Math.min(1, k.currentValue / Math.max(k.target, 0.01))
      sum += ratio
    }
    return sum / all.length
  }, [plan.objectives])

  const totalKr = useMemo(
    () => plan.objectives.reduce((sum, o) => sum + o.keyResults.length, 0),
    [plan.objectives],
  )

  const taskCountTotal = tasks.length

  const handleAddObjective = async () => {
    const newId = await ctrl.addObjective()
    if (newId) setEditingObjectiveId(newId)
  }

  return (
    <div className="space-y-5">
      {/* AMBISJON — light flat panel (Internkontroll style) */}
      <article className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">
              <Target className="h-3 w-3" />
              <span>Ambisjon · forankret i</span>
              <span className="rounded bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono">
                {plan.legalBasis ?? '—'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPlanEditOpen(true)}
                icon={<Pencil className="h-3 w-3" />}
                className="ml-auto rounded-md px-2 py-1 text-[10px] font-bold text-neutral-700 hover:bg-neutral-100"
              >
                Rediger ambisjon
              </Button>
            </div>
            <h2 className="mt-3 text-lg font-semibold leading-snug text-neutral-900 md:text-xl">
              {plan.title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
              {plan.description || (
                <span className="italic text-neutral-400">
                  Ingen beskrivelse ennå. Klikk «Rediger ambisjon» for å legge til.
                </span>
              )}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[12px] text-neutral-700 md:grid-cols-4">
              <PlanMeta Icon={UserCheck} label="Sponsor" value={plan.sponsorName} />
              <PlanMeta Icon={UserCog} label="Fasilitator" value={plan.facilitatorName} />
              <PlanMeta Icon={CalendarRange} label="Horisont" value={plan.horizon} />
              <PlanMeta
                Icon={Pencil}
                label="Sist oppdatert"
                value={new Date(plan.updatedAt).toLocaleDateString('nb-NO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center border-t border-neutral-200/80 bg-neutral-50/40 p-5 lg:border-l lg:border-t-0 lg:p-6">
            <RadialGauge value={overallProgress} />
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Samlet OKR-framdrift
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-base font-bold tabular-nums text-neutral-900">
                  {plan.objectives.length}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">Mål</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-neutral-900">{totalKr}</div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">KR</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-neutral-900">{taskCountTotal}</div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-500">Oppgaver</div>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* OKR-tre — light panel, click tile to open edit panel */}
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">OKR-tre</h3>
            <p className="text-[11px] text-neutral-500">
              {plan.objectives.length} mål forankret i Arbeidsmiljøloven. Klikk et mål for å åpne
              detaljer og redigere key results.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px]">
            {(Object.entries(HEALTH_META) as Array<[OkrHealth, (typeof HEALTH_META)[OkrHealth]]>).map(
              ([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 text-neutral-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: v.dot }} />
                  {v.label}
                </span>
              ),
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddObjective}
              icon={<Plus className="h-3 w-3" />}
            >
              Nytt mål
            </Button>
          </div>
        </div>

        {plan.objectives.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12.5px] italic text-neutral-500">
            Ingen mål ennå. Klikk «Nytt mål» for å legge til det første.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {plan.objectives.map((o) => (
              <ObjectiveTile
                key={o.id}
                o={o}
                onOpen={() => setEditingObjectiveId(o.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* RACI — light panel, "Rediger" opens panel */}
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Hvem er involvert · RACI</h3>
            <p className="text-[11px] text-neutral-500">
              Roller og ansvar i strategi-arbeidet. Følger AML § 3-1 om medvirkning og linjeansvar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <RaciLegend k="R" label="Responsible" color="#1a3d32" />
            <RaciLegend k="A" label="Accountable" color="#c98a2b" />
            <RaciLegend k="C" label="Consulted" color="#6366F1" />
            <RaciLegend k="I" label="Informed" color="#737373" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRaciEditOpen(true)}
              icon={<Pencil className="h-3 w-3" />}
              className="rounded-md border border-neutral-200 px-2 py-1 text-[10px] font-bold text-neutral-700 hover:bg-neutral-100"
            >
              Rediger
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50/60">
              <tr>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Rolle
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Person / antall
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  R
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  A
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  C
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  I
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.raci.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-[12px] italic text-neutral-500">
                    Ingen RACI-rader ennå. Klikk «Rediger» for å legge til.
                  </td>
                </tr>
              ) : (
                plan.raci.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/40">
                    <td className="px-5 py-2.5 font-medium text-neutral-900">{r.roleLabel}</td>
                    <td className="px-5 py-2.5 text-[12px] text-neutral-700">{r.personLabel || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <RaciCell on={r.isResponsible} k="R" color="#1a3d32" />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <RaciCell on={r.isAccountable} k="A" color="#c98a2b" />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <RaciCell on={r.isConsulted} k="C" color="#6366F1" />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <RaciCell on={r.isInformed} k="I" color="#737373" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over editors */}
      <PlanningPlanEditPanel
        open={planEditOpen}
        onClose={() => setPlanEditOpen(false)}
        plan={plan}
        ctrl={ctrl}
        personOptions={personOptions}
        horizonOptions={horizonOptions}
      />
      <PlanningObjectiveEditPanel
        open={editingObjectiveId !== null}
        onClose={() => setEditingObjectiveId(null)}
        plan={plan}
        objectiveId={editingObjectiveId}
        ctrl={ctrl}
        tasks={tasks}
        onCreateTaskForKr={onCreateTaskForKr}
      />
      <PlanningRaciEditPanel
        open={raciEditOpen}
        onClose={() => setRaciEditOpen(false)}
        plan={plan}
        ctrl={ctrl}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — read-only display, edit lives in the slide panels
// ─────────────────────────────────────────────────────────────────────────────

function PlanMeta({
  Icon,
  label,
  value,
}: {
  Icon: typeof UserCheck
  label: string
  value: string | undefined
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-neutral-500" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
        <div className="truncate font-semibold text-neutral-900">{value || '—'}</div>
      </div>
    </div>
  )
}

function ObjectiveTile({ o, onOpen }: { o: OkrObjectiveWithKrs; onOpen: () => void }) {
  return (
    <Button
      variant="ghost"
      onClick={onOpen}
      className="block w-full rounded-lg border border-neutral-200/80 bg-white p-4 text-left font-normal normal-case transition-all hover:border-[#1a3d32]/40 hover:bg-neutral-50"
    >
      <div className="flex items-center justify-between">
        <span className="rounded bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
          {o.ordLabel}
        </span>
        <span
          className={[
            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
            HEALTH_META[o.health].bg,
            HEALTH_META[o.health].text,
          ].join(' ')}
        >
          {HEALTH_META[o.health].label}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-[#1a3d32]">
        {o.lawRef || '—'}
      </p>
      <h4 className="mt-1 text-[13px] font-semibold leading-snug text-neutral-900">{o.objective}</h4>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-neutral-500">Framdrift</span>
          <span className="font-bold tabular-nums" style={{ color: HEALTH_META[o.health].dot }}>
            {Math.round(o.progress * 100)} %
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full"
            style={{ width: `${o.progress * 100}%`, background: HEALTH_META[o.health].dot }}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-neutral-100 pt-2 text-[10px] text-neutral-500">
        <Initials name={o.ownerName ?? '—'} size={16} />
        <span className="truncate">{o.ownerName ?? '—'}</span>
        <span className="ml-auto inline-flex items-center gap-0.5">
          <Crosshair className="h-2.5 w-2.5" />
          {o.keyResults.length} KR
        </span>
      </div>
      {/* KR preview chips — first 2 to give a quick read of what's inside */}
      {o.keyResults.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-neutral-100 pt-2">
          {o.keyResults.slice(0, 2).map((k, i) => {
            const ratio = k.invert
              ? Math.max(0, Math.min(1, k.target / Math.max(k.currentValue, 0.01)))
              : Math.min(1, k.currentValue / Math.max(k.target, 0.01))
            return (
              <li key={k.id} className="flex items-center gap-1.5 text-[10.5px] text-neutral-600">
                <span className="font-mono tabular-nums text-neutral-400">KR{i + 1}</span>
                <span className="truncate">{k.kr}</span>
                <span className="ml-auto tabular-nums text-neutral-500">
                  {Math.round(ratio * 100)} %
                </span>
              </li>
            )
          })}
          {o.keyResults.length > 2 && (
            <li className="text-[10px] italic text-neutral-400">
              + {o.keyResults.length - 2} flere KR
            </li>
          )}
        </ul>
      )}
    </Button>
  )
}

function RaciLegend({ k, label, color }: { k: string; label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ background: color }}
      >
        {k}
      </span>
      <span className="text-neutral-600">{label}</span>
    </span>
  )
}

function RaciCell({ on, k, color }: { on: boolean; k: string; color: string }) {
  if (!on) return <span className="text-neutral-300">·</span>
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: color }}
    >
      {k}
    </span>
  )
}

function RadialGauge({ value }: { value: number }) {
  const r = 48
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#e3ddcc" strokeWidth="8" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={PLANNING_ACCENT}
        strokeWidth="8"
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text
        x="60"
        y="65"
        textAnchor="middle"
        style={{ fontSize: 24, fontWeight: 700, fill: PLANNING_ACCENT }}
      >
        {Math.round(pct * 100)} %
      </text>
      <Crosshair className="hidden" />
      <Plus className="hidden" />
    </svg>
  )
}

// Re-use formatter to silence unused-import warnings during refactor.
void fmtNum
