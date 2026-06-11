// PlanningStrategiSection — Strategi & OKR tab.
//
// Conscia brand layout per docs/CLAUDE.shadcn.md:
//   - Hero card on navy (#1a1f3a) with an aubergine (#3d2740) left rail.
//   - Small-caps labels at tracking-[0.18em].
//   - OKR tree uses <OKRDashboard editable handlers={…} /> from /table-test,
//     wired in controlled mode so every CRUD goes through the existing
//     Supabase mutations on `usePlanningOkr()`.
//   - RACI matrix kept (lightly retreated) — orthogonal to the OKR work.

import { useCallback, useMemo, useState } from 'react'
import {
  CalendarRange,
  Pencil,
  Target,
  UserCheck,
  UserCog,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type {
  OkrHealth,
  OkrKeyResult as PlanningOkrKR,
  OkrPlanFull,
} from '../../types/planning'
import type { PlanningTaskRow } from '../../hooks/usePlanningTasks'
import type { UsePlanningOkrReturn } from '../../hooks/usePlanningOkr'
import { fmtNum } from './planningConstants'
import { PlanningPlanEditPanel } from './PlanningPlanEditPanel'
import { PlanningRaciEditPanel } from './PlanningRaciEditPanel'
import { useOkrCheckins } from '../../hooks/useOkrCheckins'
import { OKRDashboard } from '../../components/okr/OKRDashboard'
import {
  OKRCheckinDialog,
  type CheckinDialogTarget,
  type CheckinFormPayload,
} from '../../components/okr/OKRCheckinDialog'
import type {
  Confidence,
  KeyResult as DashKR,
  KeyResultFormPayload,
  Objective as DashObjective,
  OKRDashboardHandlers,
  ObjectiveFormPayload,
} from '../../components/okr/OKRDashboard'

const NAVY = '#1a1f3a'
const AUBERGINE = '#3d2740'
const SMALLCAPS = 'text-[11px] font-bold uppercase tracking-[0.18em]'

type Props = {
  plan: OkrPlanFull
  ctrl: UsePlanningOkrReturn
  tasks: PlanningTaskRow[]
  onCreateTaskForKr: (objectiveId: string, keyResultId: string) => void
}

/* ── Mapping helpers (planning ↔ OKRDashboard shape) ─────────────────────── */

function progressOf(k: PlanningOkrKR): number {
  const ratio = k.invert
    ? Math.max(0, Math.min(1, k.target / Math.max(k.currentValue, 0.01)))
    : Math.min(1, Math.max(0, k.currentValue) / Math.max(k.target, 0.01))
  return Math.round(ratio * 100)
}

// Confidence lives on the DB's 0..1 scale (okr_key_results.confidence check
// constraint; PlanningObjectiveEditPanel uses 0.3–1.0). The previous 0–100
// thresholds here made every badge read off_track and wrote out-of-range
// values through the KR dialog.
function numToConfidence(n: number): Confidence {
  if (n >= 0.7) return 'on_track'
  if (n >= 0.4) return 'at_risk'
  return 'off_track'
}

function confidenceToNum(c: Confidence): number {
  if (c === 'on_track') return 0.85
  if (c === 'at_risk') return 0.55
  return 0.25
}

const CHECKIN_STALE_DAYS = 21

function fmtKrValue(value: number, unit: string): string {
  const base = fmtNum(value)
  if (!unit) return base
  return `${base} ${unit}`
}

function planningKrToDash(k: PlanningOkrKR): DashKR {
  return {
    id: k.id,
    title: k.kr,
    progress: progressOf(k),
    confidence: numToConfidence(k.confidence),
    current: fmtKrValue(k.currentValue, k.unit ?? ''),
    target: fmtKrValue(k.target, k.unit ?? ''),
  }
}

function parseLooseNumber(raw?: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, '').replace(',', '.')
  const match = cleaned.match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

/* ── Section ──────────────────────────────────────────────────────────────── */

export function PlanningStrategiSection({ plan, ctrl, tasks }: Props) {
  const { orgProfiles } = useOrgSetupContext()
  const [planEditOpen, setPlanEditOpen] = useState(false)
  const [raciEditOpen, setRaciEditOpen] = useState(false)
  const [checkinTarget, setCheckinTarget] = useState<CheckinDialogTarget | null>(null)
  const checkins = useOkrCheckins()

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

  const horizonOptions = useMemo(() => {
    const year = new Date().getFullYear()
    const opts = new Set<string>()
    for (let y = year; y <= year + 3; y += 1) {
      opts.add(`${y}`)
      opts.add(`${y} → ${y + 1}`)
      opts.add(`${y} H1`)
      opts.add(`${y} H2`)
    }
    if (plan.horizon) opts.add(plan.horizon)
    return Array.from(opts)
  }, [plan.horizon])

  // Per-KR linked/closed task counts, derived live from the tasks already
  // loaded for the page (no extra query). Drives rollup-mode progress + the
  // narrative line. Cancelled tasks are excluded from both numerator and
  // denominator (mirrors okr_kr_recompute_rollup in the DB).
  const krTaskCounts = useMemo(() => {
    const m = new Map<string, { linked: number; closed: number }>()
    for (const t of tasks) {
      if (!t.okrKeyResultId || t.status === 'cancelled') continue
      const e = m.get(t.okrKeyResultId) ?? { linked: 0, closed: 0 }
      e.linked += 1
      if (t.status === 'closed') e.closed += 1
      m.set(t.okrKeyResultId, e)
    }
    return m
  }, [tasks])

  // Mapping: planning KR → OKRDashboard.KeyResult, applying rollup progress +
  // narrative when the KR is in task_rollup mode (non-invert only), plus
  // check-in sparkline (oldest→newest) and staleness hint.
  const krToDash = useCallback(
    (k: PlanningOkrKR): DashKR => {
      const history = checkins.byKr.get(k.id) ?? []
      const checkinSpark =
        history.length >= 2 ? [...history].reverse().map((c) => c.confidence) : undefined
      let checkinHint: string | undefined
      if (history.length > 0) {
        const days = Math.floor(
          (Date.now() - new Date(history[0]!.createdAt).getTime()) / 86400000,
        )
        if (days > CHECKIN_STALE_DAYS) checkinHint = `Sist innsjekket for ${days} dager siden`
      }
      const base = { ...planningKrToDash(k), checkinSpark, checkinHint }
      if (k.progressMode === 'task_rollup' && !k.invert) {
        const c = krTaskCounts.get(k.id)
        const linked = c?.linked ?? 0
        const closed = c?.closed ?? 0
        return {
          ...base,
          progress: linked > 0 ? Math.round((closed / linked) * 100) : 0,
          current: linked > 0 ? `${closed}/${linked} oppgaver` : '0 oppgaver',
          progressMode: 'task_rollup',
          progressNote:
            linked > 0
              ? `${closed} av ${linked} koblede oppgaver fullført`
              : 'Ingen koblede oppgaver ennå — koble oppgaver for å beregne fremdrift',
          rollupDisabled: false,
        }
      }
      return { ...base, progressMode: 'manual', rollupDisabled: k.invert }
    },
    [krTaskCounts, checkins.byKr],
  )

  /* ── Check-in wiring (H2.1) ───────────────────────────────────────────── */

  const openCheckin = useCallback(
    (objectiveId: string, krId: string) => {
      const obj = plan.objectives.find((o) => o.id === objectiveId)
      const k = obj?.keyResults.find((kr) => kr.id === krId)
      if (!obj || !k) return
      setCheckinTarget({
        krId: k.id,
        krTitle: k.kr,
        objectiveTitle: obj.objective,
        currentValue: k.currentValue,
        unit: k.unit,
        confidence: numToConfidence(k.confidence),
        isRollup: k.progressMode === 'task_rollup' && !k.invert,
      })
    },
    [plan.objectives],
  )

  const submitCheckin = useCallback(
    async (payload: CheckinFormPayload) => {
      const ok = await checkins.recordCheckin({
        keyResultId: payload.krId,
        confidence: confidenceToNum(payload.confidence),
        value: payload.value ?? null,
        note: payload.note,
      })
      // The RPC also synced the live KR row — refetch the plan so badges,
      // bars and the hero rail reflect the new confidence/value.
      if (ok) ctrl.reload()
    },
    [checkins, ctrl],
  )

  // Mapping: planning OKR plan → OKRDashboard.Objective[]
  const dashboardObjectives: DashObjective[] = useMemo(
    () =>
      plan.objectives.map((o) => ({
        id: o.id,
        title: o.objective,
        description: o.why || undefined,
        owner: { name: o.ownerName || '—' },
        keyResults: o.keyResults.map(krToDash),
      })),
    [plan.objectives, krToDash],
  )

  // Quick lookup so KR-update can resolve back to the planning row for
  // unit / invert / target preservation when the dialog form omits them.
  const planningKrById = useMemo(() => {
    const map = new Map<string, PlanningOkrKR>()
    for (const o of plan.objectives) for (const k of o.keyResults) map.set(k.id, k)
    return map
  }, [plan.objectives])

  /* ── Controlled CRUD wiring (Supabase via ctrl) ─────────────────────── */

  const handlers: OKRDashboardHandlers = useMemo(() => {
    const objectiveFromPayload = (p: ObjectiveFormPayload) => ({
      objective: p.title,
      why: p.description || '',
      ownerName: p.owner.name,
    })

    const krFromPayload = (
      p: KeyResultFormPayload,
      existing?: PlanningOkrKR,
    ) => {
      const parsedCurrent = parseLooseNumber(p.current)
      const parsedTarget = parseLooseNumber(p.target)
      const hasNumericCurrent = parsedCurrent !== null
      const hasNumericTarget = parsedTarget !== null
      // Prefer explicit numeric current/target from the form. Otherwise fall
      // back to interpreting `progress` as currentValue on a 0–100 scale.
      const target = hasNumericTarget
        ? parsedTarget!
        : existing?.target ?? 100
      const currentValue = hasNumericCurrent
        ? parsedCurrent!
        : (p.progress / 100) * target
      const unit = hasNumericCurrent || hasNumericTarget
        ? existing?.unit ?? ''
        : existing?.unit ?? '%'
      const progressMode = p.progressMode ?? 'manual'
      // In rollup mode the value is owned by the DB trigger; seed it now from
      // the live counts so the bar matches immediately on mode switch (the
      // trigger then keeps it in sync as tasks close).
      let finalCurrent = currentValue
      if (progressMode === 'task_rollup' && existing) {
        const c = krTaskCounts.get(existing.id)
        finalCurrent = c && c.linked > 0 ? (target * c.closed) / c.linked : existing.currentValue
      }
      return {
        kr: p.title,
        confidence: confidenceToNum(p.confidence),
        currentValue: finalCurrent,
        target,
        unit,
        progressMode,
      }
    }

    return {
      onCreateObjective: async (p) => {
        const id = await ctrl.addObjective()
        if (id) await ctrl.updateObjective(id, objectiveFromPayload(p))
      },
      onUpdateObjective: async (id, p) => {
        await ctrl.updateObjective(id, objectiveFromPayload(p))
      },
      onDeleteObjective: async (id) => {
        await ctrl.removeObjective(id)
      },
      onCreateKR: async (objectiveId, p) => {
        const id = await ctrl.addKeyResult(objectiveId)
        if (id) await ctrl.updateKeyResult(id, krFromPayload(p))
      },
      onUpdateKR: async (_objectiveId, krId, p) => {
        const existing = planningKrById.get(krId)
        await ctrl.updateKeyResult(krId, krFromPayload(p, existing))
      },
      onDeleteKR: async (_objectiveId, krId) => {
        await ctrl.removeKeyResult(krId)
      },
    }
  }, [ctrl, planningKrById, krTaskCounts])

  /* ── Stats for the hero rail ────────────────────────────────────────── */

  const stats = useMemo(() => {
    // Average over the mapped dashboard KRs so the hero figure matches the
    // bars (rollup KRs included with their task-derived progress).
    const allDashKrs = dashboardObjectives.flatMap((o) => o.keyResults)
    const avgProgress =
      allDashKrs.length === 0
        ? 0
        : Math.round(allDashKrs.reduce((s, k) => s + k.progress, 0) / allDashKrs.length)
    return {
      totalObj: plan.objectives.length,
      totalKr: allDashKrs.length,
      taskCount: tasks.length,
      avgProgress,
    }
  }, [plan.objectives.length, dashboardObjectives, tasks.length])

  const updatedShort = useMemo(() => {
    try {
      return new Date(plan.updatedAt).toLocaleDateString('nb-NO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return '—'
    }
  }, [plan.updatedAt])

  /* ── Render ─────────────────────────────────────────────────────────── */

  const openPlanEdit = useCallback(() => setPlanEditOpen(true), [])
  const openRaciEdit = useCallback(() => setRaciEditOpen(true), [])

  return (
    <div className="space-y-6">
      {/* ── Hero card (navy + aubergine rail) ────────────────────────────── */}
      <article
        className="overflow-hidden rounded-2xl text-white shadow-lg"
        style={{ backgroundColor: NAVY }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[6px_minmax(0,1fr)_260px]">
          <div className="hidden lg:block" style={{ backgroundColor: AUBERGINE }} />
          <div className="p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`${SMALLCAPS} text-white/70`}>Ambisjon</span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white/95"
                style={{ backgroundColor: AUBERGINE }}
              >
                <Target className="size-3" aria-hidden />
                {plan.legalBasis ?? 'Arbeidsmiljøloven'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={openPlanEdit}
                icon={<Pencil className="size-3.5" />}
                className="ml-auto text-white/80 hover:bg-white/10 hover:text-white"
              >
                Rediger
              </Button>
            </div>
            <h2
              className="mt-4 text-2xl font-semibold leading-tight md:text-3xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              {plan.title}
            </h2>
            {plan.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">
                {plan.description}
              </p>
            ) : (
              <p className="mt-3 max-w-3xl text-sm italic leading-relaxed text-white/55">
                Ingen beskrivelse ennå. Klikk «Rediger» for å legge til.
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Thread icon={UserCheck} label="Sponsor" value={plan.sponsorName} />
              <Thread icon={UserCog} label="Fasilitator" value={plan.facilitatorName} />
              <Thread icon={CalendarRange} label="Horisont" value={plan.horizon} />
              <Thread icon={Pencil} label="Oppdatert" value={updatedShort} muted />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 border-t border-white/10 p-6 lg:border-l lg:border-t-0 lg:p-8">
            <Stat label="Mål" value={stats.totalObj} />
            <Stat label="Key results" value={stats.totalKr} />
            <Stat label="Snittfremdrift" value={`${stats.avgProgress}%`} />
            <Stat label="Oppgaver" value={stats.taskCount} muted />
          </div>
        </div>
      </article>

      {/* ── OKR tree (the dashboard from /table-test) ────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className={`${SMALLCAPS} text-neutral-500`}>OKR-tre</span>
            <h3
              className="mt-1 text-lg font-semibold tracking-tight text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Mål og key results
            </h3>
          </div>
        </div>
        <OKRDashboard
          objectives={dashboardObjectives}
          editable
          handlers={handlers}
          onCheckinKR={openCheckin}
          defaultView="cards"
        />
      </section>

      {/* ── RACI matrix ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className={`${SMALLCAPS} text-neutral-500`}>Ansvar</span>
            <h3
              className="mt-1 text-lg font-semibold tracking-tight text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Hvem er involvert · RACI
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Roller og ansvar i strategi-arbeidet. Følger AML § 3-1 om medvirkning og linjeansvar.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={openRaciEdit}
            icon={<Pencil className="size-3.5" />}
          >
            Rediger
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#EFE8DC]">
                <tr>
                  <th className={`border-b border-neutral-200 px-5 py-3 text-left ${SMALLCAPS} text-neutral-600`}>
                    Rolle
                  </th>
                  <th className={`border-b border-neutral-200 px-5 py-3 text-left ${SMALLCAPS} text-neutral-600`}>
                    Person / antall
                  </th>
                  <th className={`border-b border-neutral-200 px-3 py-3 text-center ${SMALLCAPS} text-neutral-600`}>
                    R
                  </th>
                  <th className={`border-b border-neutral-200 px-3 py-3 text-center ${SMALLCAPS} text-neutral-600`}>
                    A
                  </th>
                  <th className={`border-b border-neutral-200 px-3 py-3 text-center ${SMALLCAPS} text-neutral-600`}>
                    C
                  </th>
                  <th className={`border-b border-neutral-200 px-3 py-3 text-center ${SMALLCAPS} text-neutral-600`}>
                    I
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.raci.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-sm italic text-neutral-500"
                    >
                      Ingen RACI-rader ennå. Klikk «Rediger» for å legge til.
                    </td>
                  </tr>
                ) : (
                  plan.raci.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                      <td className="px-5 py-3 text-sm font-medium text-neutral-900">{r.roleLabel}</td>
                      <td className="px-5 py-3 text-sm text-neutral-700">{r.personLabel || '—'}</td>
                      <td className="px-3 py-3 text-center">
                        <RaciCell on={r.isResponsible} k="R" color={AUBERGINE} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <RaciCell on={r.isAccountable} k="A" color="#c98a2b" />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <RaciCell on={r.isConsulted} k="C" color="#6366F1" />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <RaciCell on={r.isInformed} k="I" color="#737373" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <PlanningPlanEditPanel
        open={planEditOpen}
        onClose={() => setPlanEditOpen(false)}
        plan={plan}
        ctrl={ctrl}
        personOptions={personOptions}
        horizonOptions={horizonOptions}
      />
      <PlanningRaciEditPanel
        open={raciEditOpen}
        onClose={() => setRaciEditOpen(false)}
        plan={plan}
        ctrl={ctrl}
      />
      <OKRCheckinDialog
        open={checkinTarget !== null}
        target={checkinTarget}
        onClose={() => setCheckinTarget(null)}
        onSubmit={submitCheckin}
      />
    </div>
  )
}

/* ── Tiny inline primitives ──────────────────────────────────────────────── */

function Thread({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: typeof Pencil
  label: string
  value: string | undefined | null
  muted?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
        muted ? 'bg-white/5 text-white/55' : 'text-white/90'
      }`}
      style={muted ? undefined : { backgroundColor: AUBERGINE }}
    >
      <Icon className="size-3" aria-hidden />
      <span className={`${SMALLCAPS} ${muted ? 'text-white/55' : 'text-white/65'}`}>{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </span>
  )
}

function Stat({
  label,
  value,
  muted = false,
}: {
  label: string
  value: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`${SMALLCAPS} text-white/55`}>{label}</span>
      <span
        className={`font-mono text-xl font-bold tabular-nums ${muted ? 'text-white/70' : 'text-white'}`}
      >
        {value}
      </span>
    </div>
  )
}

function RaciCell({ on, k, color }: { on: boolean; k: string; color: string }) {
  if (!on) return <span className="text-neutral-300" aria-hidden>·</span>
  return (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: color }}
      aria-label={k}
    >
      {k}
    </span>
  )
}

// Silence unused-export warning for OkrHealth (kept in case planning callers
// want to surface health pills outside this file later).
export type { OkrHealth }
