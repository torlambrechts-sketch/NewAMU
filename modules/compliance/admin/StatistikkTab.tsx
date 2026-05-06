// StatistikkTab — overview of execution volume and requirement coverage
// for the active pack.
//
// Three sections:
//   1. KPI strip — total executions, open count, critical findings, YTD signed.
//      Reuses the org-wide aggregates the hook fetches separately from the
//      paginated list (so numbers are accurate, not page-scoped).
//   2. Coverage strip — X of N system requirements for this pack are
//      covered by at least one active template. The remainder are gap
//      candidates (either need a template, or are non-template
//      requirements that other primitives will claim later).
//   3. Per-template execution counts — how many executions have been
//      created against each template, broken down by status.

import { useEffect, useMemo, useState } from 'react'
import { BarChart2, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { useActivePack } from '../../../src/context/packContextValue'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from '../useChecklistModule'
import { useRequirements } from '../useRequirements'

type TemplateRequirementJunctionRow = {
  template_id: string
  requirement_id: string
}

export function StatistikkTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const pack = useActivePack()
  const cl = useChecklistModule({ supabase })
  const reqs = useRequirements({ supabase })
  const { load } = cl

  // Junction rows for ALL of this org's templates in one shot — used
  // to compute coverage. Cheap query (small table, indexed by org).
  const [junctions, setJunctions] = useState<TemplateRequirementJunctionRow[]>([])

  useEffect(() => {
    void load({ pack: pack.slug })
  }, [load, pack.slug])

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    supabase
      .from('compliance_template_requirements')
      .select('template_id, requirement_id')
      .eq('organization_id', orgId)
      .then(({ data, error }) => {
        if (cancelled) return
        setJunctions(error ? [] : ((data ?? []) as TemplateRequirementJunctionRow[]))
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const packTemplates = useMemo(
    () => cl.templates.filter((t) => t.pack === pack.slug && t.is_active),
    [cl.templates, pack.slug],
  )
  const packRequirements = useMemo(
    () => reqs.forPack(pack.slug).filter((r) => r.is_active),
    [reqs, pack.slug],
  )

  const coverage = useMemo(() => {
    const activeTemplateIds = new Set(packTemplates.map((t) => t.id))
    const coveredReqIds = new Set(
      junctions
        .filter((j) => activeTemplateIds.has(j.template_id))
        .map((j) => j.requirement_id),
    )
    const covered: typeof packRequirements = []
    const uncovered: typeof packRequirements = []
    for (const r of packRequirements) {
      if (coveredReqIds.has(r.id)) covered.push(r)
      else uncovered.push(r)
    }
    return { covered, uncovered }
  }, [packTemplates, packRequirements, junctions])

  // Per-template execution counts (status × template).
  const executionCounts = useMemo(() => {
    const map = new Map<string, { draft: number; active: number; signed: number; total: number }>()
    for (const t of packTemplates) {
      map.set(t.id, { draft: 0, active: 0, signed: 0, total: 0 })
    }
    for (const e of cl.executions) {
      if (e.pack !== pack.slug) continue
      const cell = map.get(e.template_id)
      if (!cell) continue
      cell.total += 1
      if (e.status === 'draft') cell.draft += 1
      else if (e.status === 'active') cell.active += 1
      else if (e.status === 'signed') cell.signed += 1
    }
    return map
  }, [cl.executions, packTemplates, pack.slug])

  return (
    <div className="space-y-6">
      {(cl.error ?? reqs.error) ? (
        <WarningBox>{cl.error ?? reqs.error}</WarningBox>
      ) : null}

      {/* ── 1. KPI strip ─────────────────────────────────────────────── */}
      <LayoutScoreStatRow
        items={[
          { big: String(cl.aggregates.totalExecutions),
            title: 'Totalt utførelser', sub: 'Alle statuser i denne pakken' },
          { big: String(cl.aggregates.openCount),
            title: pack.kpiLabels.open, sub: 'Under behandling' },
          { big: String(cl.aggregates.criticalFindings),
            title: pack.kpiLabels.critical, sub: 'Krever oppfølging' },
          { big: String(cl.aggregates.ytdCompleted),
            title: pack.kpiLabels.ytd, sub: 'Signert i år' },
        ]}
      />

      {/* ── 2. Coverage strip ────────────────────────────────────────── */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">
            Kravdekning — {pack.shortName}
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Hvor mange av {pack.shortName}-pakkens krav som er knyttet til
          minst én aktiv mal. Krav uten malkobling håndteres typisk via
          dokumenter, møter eller andre primitiver.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-3xl font-semibold text-neutral-900">
            {coverage.covered.length}
          </span>
          <span className="text-sm text-neutral-500">
            av {packRequirements.length} krav dekkes av en mal
          </span>
        </div>

        {coverage.uncovered.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
              Krav uten malkobling ({coverage.uncovered.length})
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {coverage.uncovered.map((r) => (
                <li key={r.id}>
                  <Badge variant="neutral" title={r.title}>
                    {r.code}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-emerald-700">
            Alle aktive krav er dekket av minst én mal.
          </p>
        )}
      </ModuleSectionCard>

      {/* ── 3. Per-template execution counts ─────────────────────────── */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">
            Utførelser per mal
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Volum per aktive mal i denne pakken, fordelt på status.
        </p>

        <ul className="mt-5 space-y-3">
          {packTemplates.length === 0 ? (
            <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
              Ingen aktive maler.
            </li>
          ) : (
            packTemplates.map((t) => {
              const counts = executionCounts.get(t.id) ?? {
                draft: 0,
                active: 0,
                signed: 0,
                total: 0,
              }
              return (
                <li
                  key={t.id}
                  className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          {t.name}
                        </span>
                        {t.is_system ? (
                          <Badge variant="info">System</Badge>
                        ) : null}
                        {t.nav_pinned ? (
                          <Badge variant="success">Sidemeny</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 font-mono text-xs text-neutral-500">
                        {t.slug}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-700">
                      <span title="Kladd">
                        <span className="font-semibold">{counts.draft}</span> kladd
                      </span>
                      <span title="Aktiv">
                        <span className="font-semibold">{counts.active}</span> aktiv
                      </span>
                      <span title="Signert">
                        <span className="font-semibold">{counts.signed}</span> signert
                      </span>
                      <span className="border-l border-neutral-300 pl-3">
                        <ClipboardCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                        <span className="font-semibold">{counts.total}</span> totalt
                      </span>
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </ModuleSectionCard>
    </div>
  )
}
