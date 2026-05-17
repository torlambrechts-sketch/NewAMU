// HealthPanel — operational visibility for the workflow engine.
//
// Answers a single question: "is the engine working right now?". Four
// KPIs at the top + three widgets (silent rules, queue depth/age,
// deadlines at risk) in a 2-column grid below. Data comes from
// useWorkflowHealth (one hook, four parallel queries, 30 s refresh
// gated on document visibility). Click-throughs deep-link into the
// existing tabs (dry-run / rules / approvals) via setSearchParams
// so the same URL shapes the rest of the page already understands.

import { useCallback } from 'react'
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Layers,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  ShieldOff,
  Zap,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useT } from '../../../hooks/useT'
import { useWorkflows } from '../../../hooks/useWorkflows'
import {
  useWorkflowHealth,
  type DeadlineRisk,
  type QueueHealthBucket,
  type SilentRule,
} from '../../../hooks/useWorkflowHealth'
import { Button } from '../../ui/Button'

const SILENT_WINDOW_DAYS = 30

function formatRelativeMinutes(t: ReturnType<typeof useT>['t'], minutes: number | null): string {
  if (minutes === null) return t('workflow.health.queue.noPending')
  if (minutes < 1) return t('workflow.health.queue.ageJustNow')
  if (minutes < 60) return t('workflow.health.queue.ageMinutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('workflow.health.queue.ageHours', { count: hours })
  const days = Math.floor(hours / 24)
  return t('workflow.health.queue.ageDays', { count: days })
}

function formatDeadlineCountdown(t: ReturnType<typeof useT>['t'], iso: string | null): string {
  if (!iso) return t('workflow.health.deadlines.noDeadline')
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return t('workflow.health.deadlines.noDeadline')
  const diffMs = ms - Date.now()
  if (diffMs < 0) {
    const overdueMinutes = Math.round(Math.abs(diffMs) / 60_000)
    if (overdueMinutes < 60) {
      return t('workflow.health.deadlines.overdueMinutes', { count: overdueMinutes })
    }
    const overdueHours = Math.floor(overdueMinutes / 60)
    return t('workflow.health.deadlines.overdueHours', { count: overdueHours })
  }
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return t('workflow.health.deadlines.inMinutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  return t('workflow.health.deadlines.inHours', { count: hours })
}

function queueAgeTint(minutes: number | null): { bg: string; fg: string } {
  if (minutes === null) return { bg: '#f5f5f4', fg: '#525252' }
  if (minutes > 60) return { bg: '#fef2f2', fg: '#b91c1c' }
  if (minutes > 15) return { bg: '#fffbeb', fg: '#b45309' }
  return { bg: '#ecfdf5', fg: '#047857' }
}

type KpiTileProps = {
  big: string
  title: string
  sub: string
  tone: 'neutral' | 'warn' | 'danger' | 'ok'
  icon: React.ComponentType<{ className?: string }>
}

const TONE_COLORS: Record<KpiTileProps['tone'], { ring: string; fg: string; bg: string }> = {
  neutral: { ring: 'ring-neutral-200', fg: '#1f2937', bg: '#ffffff' },
  warn: { ring: 'ring-amber-200', fg: '#92400e', bg: '#fffbeb' },
  danger: { ring: 'ring-red-200', fg: '#991b1b', bg: '#fef2f2' },
  ok: { ring: 'ring-emerald-200', fg: '#065f46', bg: '#ecfdf5' },
}

function KpiTile({ big, title, sub, tone, icon: Icon }: KpiTileProps) {
  const c = TONE_COLORS[tone]
  return (
    <div
      className={`rounded-xl ring-1 ${c.ring} px-4 py-3 flex items-start gap-3`}
      style={{ background: c.bg, color: c.fg }}
    >
      <Icon className="h-5 w-5 mt-0.5 opacity-80" />
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-tight" style={{ color: c.fg }}>
          {big}
        </div>
        <div className="text-xs font-medium" style={{ color: c.fg }}>
          {title}
        </div>
        <div className="text-[11px] opacity-70">{sub}</div>
      </div>
    </div>
  )
}

export function HealthPanel() {
  const { t } = useT()
  const [, setSearchParams] = useSearchParams()
  const { kpis, silentRules, queueHealth, deadlineRisks, loading, error, refresh, forceQueueTick } =
    useWorkflowHealth()
  const { setRuleActive, canActivate, canActivateExternal } = useWorkflows()
  const isAdminLike = canActivate || canActivateExternal

  const goToTab = useCallback(
    (tab: string, extras: Record<string, string> = {}) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (tab === 'library') params.delete('tab')
          else params.set('tab', tab)
          for (const [k, v] of Object.entries(extras)) {
            params.set(k, v)
          }
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const handleTestSilent = useCallback(
    (rule: SilentRule) => {
      goToTab('dry-run', { rule: rule.ruleId })
    },
    [goToTab],
  )

  const handleDeactivateSilent = useCallback(
    async (rule: SilentRule) => {
      if (!isAdminLike) return
      await setRuleActive(rule.ruleId, false)
      refresh()
    },
    [isAdminLike, refresh, setRuleActive],
  )

  const handleOpenApproval = useCallback(
    (risk: DeadlineRisk) => {
      goToTab('approvals', { approval: risk.approvalId })
    },
    [goToTab],
  )

  const handleForceTick = useCallback(async () => {
    // Errors are surfaced via the panel-level error banner — the hook
    // already setError's on failure, so we just fire-and-forget here.
    await forceQueueTick()
  }, [forceQueueTick])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <Activity className="h-4 w-4 text-emerald-700" />
        <h2 className="text-sm font-semibold text-neutral-900">
          {t('workflow.health.title')}
        </h2>
        <span className="text-xs text-neutral-500">{t('workflow.health.subtitle')}</span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<RefreshCcw className="h-3.5 w-3.5" />}
          onClick={() => refresh()}
          disabled={loading}
        >
          {t('workflow.health.refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('workflow.health.error', { detail: error })}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          big={String(kpis.activeRules)}
          title={t('workflow.health.kpi.activeRules')}
          sub={t('workflow.health.kpi.activeRulesSub')}
          tone="neutral"
          icon={Zap}
        />
        <KpiTile
          big={String(kpis.silentRules)}
          title={t('workflow.health.kpi.silentRules')}
          sub={t('workflow.health.kpi.silentRulesSub', { days: SILENT_WINDOW_DAYS })}
          tone={kpis.silentRules > 0 ? 'warn' : 'ok'}
          icon={PauseCircle}
        />
        <KpiTile
          big={String(kpis.failedRuns7d)}
          title={t('workflow.health.kpi.failedRuns')}
          sub={t('workflow.health.kpi.failedRunsSub')}
          tone={kpis.failedRuns7d > 0 ? 'danger' : 'ok'}
          icon={AlertOctagon}
        />
        <KpiTile
          big={String(kpis.pendingApprovals)}
          title={t('workflow.health.kpi.pendingApprovals')}
          sub={t('workflow.health.kpi.pendingApprovalsSub')}
          tone={kpis.pendingApprovals > 0 ? 'warn' : 'ok'}
          icon={Hourglass}
        />
      </div>

      {/* Widgets — 2-column grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Widget 1: silent rules — spans both columns on lg for readability */}
        <SilentRulesWidget
          rules={silentRules}
          loading={loading}
          isAdminLike={isAdminLike}
          onTest={handleTestSilent}
          onDeactivate={handleDeactivateSilent}
        />

        {/* Widget 2: queue health */}
        <QueueHealthWidget
          buckets={queueHealth.buckets}
          oldestPendingAgeMinutes={queueHealth.oldestPendingAgeMinutes}
          isAdminLike={isAdminLike}
          onForceTick={handleForceTick}
        />

        {/* Widget 3: deadlines at risk — full row */}
        <div className="lg:col-span-2">
          <DeadlineRiskWidget risks={deadlineRisks} onOpen={handleOpenApproval} />
        </div>
      </div>
    </div>
  )
}

// ─── Widget 1 ─────────────────────────────────────────────────────────────

function SilentRulesWidget({
  rules,
  loading,
  isAdminLike,
  onTest,
  onDeactivate,
}: {
  rules: SilentRule[]
  loading: boolean
  isAdminLike: boolean
  onTest: (rule: SilentRule) => void
  onDeactivate: (rule: SilentRule) => void | Promise<void>
}) {
  const { t } = useT()

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <PauseCircle className="h-4 w-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-neutral-900">
          {t('workflow.health.silent.title')}
        </h3>
        <span className="text-xs text-neutral-500">
          {t('workflow.health.silent.subtitle', { days: SILENT_WINDOW_DAYS })}
        </span>
      </header>
      <div className="divide-y divide-neutral-100">
        {rules.length === 0 && (
          <div className="px-4 py-6 text-sm text-neutral-600">
            {loading ? t('workflow.health.loading') : t('workflow.health.silent.empty')}
          </div>
        )}
        {rules.map((rule) => (
          <div key={rule.ruleId} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-neutral-900">{rule.name}</div>
              <div className="text-xs text-neutral-500">
                {rule.triggerEventName
                  ? t('workflow.health.silent.triggerLine', { event: rule.triggerEventName })
                  : t('workflow.health.silent.triggerLineGeneric', { mode: rule.triggerOn })}
              </div>
              <div className="text-xs text-neutral-500">
                {t('workflow.health.silent.lastFiredNever', { days: SILENT_WINDOW_DAYS })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<PlayCircle className="h-3.5 w-3.5" />}
                onClick={() => onTest(rule)}
              >
                {t('workflow.health.silent.testButton')}
              </Button>
              {isAdminLike && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<ShieldOff className="h-3.5 w-3.5" />}
                  onClick={() => void onDeactivate(rule)}
                  title={t('workflow.health.silent.deactivateTitle')}
                >
                  {t('workflow.health.silent.deactivateButton')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Widget 2 ─────────────────────────────────────────────────────────────

const QUEUE_STATUS_TINTS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#eff6ff', fg: '#1d4ed8' },
  processing: { bg: '#fefce8', fg: '#854d0e' },
  awaiting_approval: { bg: '#fdf4ff', fg: '#7e22ce' },
  awaiting_schedule: { bg: '#f0f9ff', fg: '#0369a1' },
  done: { bg: '#ecfdf5', fg: '#047857' },
  failed: { bg: '#fef2f2', fg: '#b91c1c' },
  cancelled: { bg: '#f5f5f4', fg: '#525252' },
}

function QueueHealthWidget({
  buckets,
  oldestPendingAgeMinutes,
  isAdminLike,
  onForceTick,
}: {
  buckets: QueueHealthBucket[]
  oldestPendingAgeMinutes: number | null
  isAdminLike: boolean
  onForceTick: () => void
}) {
  const { t } = useT()
  const total = buckets.reduce((acc, b) => acc + b.count, 0)
  const max = buckets.reduce((acc, b) => Math.max(acc, b.count), 1)
  const ageTint = queueAgeTint(oldestPendingAgeMinutes)

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <Layers className="h-4 w-4 text-blue-700" />
        <h3 className="text-sm font-semibold text-neutral-900">
          {t('workflow.health.queue.title')}
        </h3>
        <span className="text-xs text-neutral-500">
          {t('workflow.health.queue.subtitle', { count: total })}
        </span>
        <span className="flex-1" />
        {isAdminLike && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Zap className="h-3.5 w-3.5" />}
            onClick={onForceTick}
          >
            {t('workflow.health.queue.forceTick')}
          </Button>
        )}
      </header>
      <div className="px-4 py-3">
        <div
          className="mb-3 inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium"
          style={{ background: ageTint.bg, color: ageTint.fg }}
        >
          <Clock className="h-3.5 w-3.5" />
          {t('workflow.health.queue.oldestLabel')}
          <span>{formatRelativeMinutes(t, oldestPendingAgeMinutes)}</span>
        </div>
        {buckets.length === 0 && (
          <div className="text-sm text-neutral-600">{t('workflow.health.queue.empty')}</div>
        )}
        <ul className="space-y-2">
          {buckets.map((b) => {
            const tint = QUEUE_STATUS_TINTS[b.status] ?? { bg: '#f5f5f4', fg: '#525252' }
            const pct = Math.max(4, Math.round((b.count / max) * 100))
            return (
              <li key={b.status} className="flex items-center gap-3">
                <div className="w-32 text-xs font-medium text-neutral-700">
                  {t(`workflow.health.queue.status.${b.status}`, b.status)}
                </div>
                <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-neutral-100">
                  <div
                    className="h-full rounded-md"
                    style={{ width: `${pct}%`, background: tint.fg }}
                  />
                </div>
                <div
                  className="w-10 text-right text-xs font-semibold"
                  style={{ color: tint.fg }}
                >
                  {b.count}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

// ─── Widget 3 ─────────────────────────────────────────────────────────────

function DeadlineRiskWidget({
  risks,
  onOpen,
}: {
  risks: DeadlineRisk[]
  onOpen: (risk: DeadlineRisk) => void
}) {
  const { t } = useT()
  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-red-700" />
        <h3 className="text-sm font-semibold text-neutral-900">
          {t('workflow.health.deadlines.title')}
        </h3>
        <span className="text-xs text-neutral-500">
          {t('workflow.health.deadlines.subtitle')}
        </span>
      </header>
      <div className="divide-y divide-neutral-100">
        {risks.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-neutral-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {t('workflow.health.deadlines.empty')}
          </div>
        )}
        {risks.map((risk) => (
          <button
            key={risk.approvalId}
            type="button"
            className="flex w-full flex-wrap items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50"
            onClick={() => onOpen(risk)}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-neutral-900">{risk.ruleName}</div>
              <div className="text-xs text-neutral-500">
                {risk.regulator
                  ? t('workflow.health.deadlines.regulatorLine', { regulator: risk.regulator })
                  : t('workflow.health.deadlines.regulatorUnknown')}
              </div>
              {risk.approverRole && (
                <div className="text-xs text-neutral-500">
                  {t('workflow.health.deadlines.assigneeLine', { role: risk.approverRole })}
                </div>
              )}
            </div>
            <div className="text-right text-xs font-semibold text-red-700">
              {formatDeadlineCountdown(t, risk.deadlineAt)}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
