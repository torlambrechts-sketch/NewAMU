import { useNavigate } from 'react-router-dom'
import { BarChart3, ChevronRight } from 'lucide-react'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import {
  ModuleDonutCard,
  ModuleFilledListCard,
  type InsightSeg,
} from '../../../src/components/insights/ModuleInsightCharts'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import type { SurveyRow } from '../types'
import { surveyStatusBadgeVariant, surveyStatusLabel, surveyTypeLabel } from '../surveyLabels'

// ── colour palette consistent with platform-admin ──────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active:   '#2f7757',
  draft:    '#94a3b8',
  closed:   '#1a3d32',
  archived: '#cbd5e1',
}
const TYPE_COLORS: Record<string, string> = {
  internal:   '#1a3d32',
  pulse:      '#2563eb',
  exit:       '#94a3b8',
  onboarding: '#ca8a04',
  external:   '#c2410c',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Props = { surveys: SurveyRow[]; loading: boolean }

export function SurveyAnalyseOverviewTab({ surveys, loading }: Props) {
  const navigate = useNavigate()

  const now = new Date()
  const thisYear = now.getFullYear()

  const active   = surveys.filter((s) => s.status === 'active').length
  const draft    = surveys.filter((s) => s.status === 'draft').length
  const closedYr = surveys.filter((s) => s.status === 'closed' && s.closed_at && new Date(s.closed_at).getFullYear() === thisYear).length
  const amuPend  = surveys.filter((s) => s.status === 'closed' && s.amu_review_required).length

  const kpiItems = [
    { big: String(surveys.length), title: 'Totalt',           sub: 'Alle undersøkelser' },
    { big: String(active),         title: 'Aktive',           sub: 'Pågår nå' },
    { big: String(closedYr),       title: `Lukket ${thisYear}`, sub: 'Fullført dette år' },
    { big: String(amuPend),        title: 'Venter AMU',       sub: 'Krever behandling' },
    { big: String(draft),          title: 'Kladder',          sub: 'Under utarbeidelse' },
  ]

  // ── donuts ─────────────────────────────────────────────────────────────────
  const byStatus = (['active', 'draft', 'closed', 'archived'] as const)
    .map((st): InsightSeg => ({
      label: surveyStatusLabel(st),
      value: surveys.filter((s) => s.status === st).length,
      color: STATUS_COLORS[st] ?? '#cbd5e1',
    }))
    .filter((s) => s.value > 0)

  const byType = (['internal', 'pulse', 'exit', 'onboarding', 'external'] as const)
    .map((t): InsightSeg => ({
      label: surveyTypeLabel(t),
      value: surveys.filter((s) => s.survey_type === t).length,
      color: TYPE_COLORS[t] ?? '#94a3b8',
    }))
    .filter((s) => s.value > 0)

  // ── recent — sorted by updated_at desc ─────────────────────────────────────
  const recent = [...surveys]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8)
    .map((s): InsightSeg => ({
      label: s.title,
      value: new Date(s.updated_at).getTime(), // raw for InsightSeg value field (not displayed as-is)
      color: STATUS_COLORS[s.status] ?? '#94a3b8',
    }))

  if (loading && surveys.length === 0) {
    return <p className="py-12 text-center text-sm text-neutral-500">Laster analysedata…</p>
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <LayoutScoreStatRow items={kpiItems} columns={5} variant="compact" />

      {/* Donuts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ModuleDonutCard
          title="Undersøkelser etter status"
          subtitle="Fordeling av alle undersøkelser i organisasjonen"
          segments={byStatus}
          total={surveys.length}
          emptyHint="Ingen undersøkelser registrert ennå."
        />
        <ModuleDonutCard
          title="Undersøkelser etter type"
          subtitle="Intern · Puls · Leverandør · Sluttsamtale · Onboarding"
          segments={byType}
          total={surveys.length}
          emptyHint="Ingen undersøkelser registrert ennå."
        />
      </div>

      {/* Recent list + drill-down table */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ModuleFilledListCard
          title="Nylig oppdaterte"
          subtitle="Sist endret — klikk for å åpne analyse"
          rows={recent}
          emptyHint="Ingen undersøkelser ennå."
        />

        <ModuleSectionCard className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#1a3d32]" aria-hidden />
            <h3 className="text-sm font-semibold text-neutral-800">Alle undersøkelser — bor ned til analyse</h3>
          </div>
          {surveys.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Ingen undersøkelser opprettet ennå.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {[...surveys]
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, 12)
                .map((s) => (
                  <div
                    key={s.id}
                    className="group flex cursor-pointer items-center gap-3 py-2.5 hover:bg-neutral-50/70"
                    onClick={() => navigate(`/survey/${s.id}?tab=analyse`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/survey/${s.id}?tab=analyse`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-neutral-900">{s.title}</span>
                        <Badge variant={surveyStatusBadgeVariant(s.status)}>{surveyStatusLabel(s.status)}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-400">{surveyTypeLabel(s.survey_type)} · {fmt(s.updated_at)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 transition-colors group-hover:text-[#1a3d32]" aria-hidden />
                  </div>
                ))}
            </div>
          )}
          {surveys.length > 12 && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => navigate('/survey?tab=kampanjer')}>
              Vis alle {surveys.length} undersøkelser
            </Button>
          )}
        </ModuleSectionCard>
      </div>
    </div>
  )
}
