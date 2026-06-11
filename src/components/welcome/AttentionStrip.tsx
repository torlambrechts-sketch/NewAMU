// AttentionStrip — the "hva trenger oppmerksomhet i dag" row at the top of the
// logged-in home. Closes the gap where the landing page sold strategy +
// meetings + compliance but the home showed only tasks: four cards covering
// OKR health, open/overdue tasks, the next meeting and the nearest compliance
// deadline, each linking into its module.

import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, ListChecks, ShieldAlert, Target } from 'lucide-react'
import { useOkrHealthSummary } from '../../hooks/useOkrHealthSummary'
import { fmtDate } from '../../hooks/useWorkspaceDashboardData'

type Tone = 'ok' | 'warn' | 'danger'

const TONE_COLOR: Record<Tone, string> = {
  ok: '#1a3d32',
  warn: '#b45309',
  danger: '#b03020',
}

type Props = {
  openCount: number
  overdueCount: number
  nextMeeting: { startsAt: string; title: string } | null
  riskCount: number
  nextDeadline: string | null
}

export function AttentionStrip({
  openCount,
  overdueCount,
  nextMeeting,
  riskCount,
  nextDeadline,
}: Props) {
  const okr = useOkrHealthSummary()
  const okrAttention = okr.atRisk + okr.offTrack
  const okrTone: Tone = okr.offTrack > 0 ? 'danger' : okr.atRisk > 0 ? 'warn' : 'ok'

  return (
    <section aria-label="Hva trenger oppmerksomhet i dag" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        to="/planlegging?section=strategi"
        icon={Target}
        label="Strategi på spor"
        value={okr.total > 0 ? `${Math.round((okr.onTrack / okr.total) * 100)}%` : '—'}
        hint={
          okr.total === 0
            ? 'Sett opp OKR-planen'
            : okrAttention > 0
              ? `${okrAttention} nøkkelresultat trenger oppfølging`
              : 'Alle nøkkelresultater på spor'
        }
        tone={okrTone}
      />
      <Kpi
        to="/tasks/management"
        icon={ListChecks}
        label="Åpne oppgaver"
        value={openCount}
        hint={overdueCount > 0 ? `${overdueCount} forfalt` : 'Ingen forfalte'}
        tone={overdueCount > 0 ? 'danger' : 'ok'}
      />
      <Kpi
        to="/meetings"
        icon={Calendar}
        label="Neste møte"
        value={nextMeeting ? fmtDate(nextMeeting.startsAt) : '—'}
        hint={nextMeeting ? nextMeeting.title : 'Ingen planlagt'}
        tone="ok"
      />
      <Kpi
        to="/controls"
        icon={ShieldAlert}
        label="Risiko & frister"
        value={riskCount}
        hint={nextDeadline ? `Neste frist ${fmtDate(nextDeadline)}` : 'Ingen åpne'}
        tone={riskCount > 0 ? 'warn' : 'ok'}
      />
    </section>
  )
}

function Kpi({
  to,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  to: string
  icon: typeof Target
  label: string
  value: string | number
  hint: string
  tone: Tone
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400"
    >
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-neutral-400 transition-colors group-hover:text-neutral-700" aria-hidden="true" />
        <ChevronRight className="size-4 text-neutral-300 transition-colors group-hover:text-neutral-600" aria-hidden="true" />
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: TONE_COLOR[tone] }}>
        {value}
      </p>
      <p className="text-sm font-medium text-neutral-800">{label}</p>
      <p className="text-xs text-neutral-500">{hint}</p>
    </Link>
  )
}
