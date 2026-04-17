import { useMemo, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useInternalControl } from '../../hooks/useInternalControl'
import {
  computeInspectionReadiness,
  findVarslingRoutinePage,
  readinessColor,
  varslingAcknowledgementRate,
} from '../../lib/inspectionReadiness'

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
}

export function InspectionReadinessScore() {
  const docs = useDocuments()
  const { members } = useOrgSetupContext()
  const ic = useInternalControl()
  const nowMs = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)
  const year = new Date().getFullYear()

  const { score, color } = useMemo(() => {
    const varslingPage = findVarslingRoutinePage(docs.pages)
    const varslingAckRate = varslingAcknowledgementRate(varslingPage, docs.receipts, members.length)
    const annualLockedThisYear = ic.annualReviews.some(
      (a) => a.year === year && (a.status === 'locked' || a.locked),
    )
    const { score: s } = computeInspectionReadiness({
      legalCoverage: docs.legalCoverage,
      pages: docs.pages,
      pageTemplates: docs.pageTemplates,
      spaces: docs.spaces,
      auditLedger: docs.auditLedger.map((e) => ({ action: e.action, pageId: e.pageId, at: e.at })),
      employeeCount: members.length,
      nowMs,
      annualReviewLockedThisYear: annualLockedThisYear,
      varslingAckRate,
    })
    const c = readinessColor(s)
    return { score: s, color: c }
  }, [docs, members.length, ic.annualReviews, nowMs, year])

  const stroke = color === 'green' ? '#15803d' : color === 'amber' ? '#b45309' : '#b91c1c'
  const bg = color === 'green' ? 'bg-emerald-50' : color === 'amber' ? 'bg-amber-50' : 'bg-red-50'
  const r = 52
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c

  return (
    <div
      className={`flex flex-wrap items-center gap-6 rounded-none border border-neutral-200/90 p-5 shadow-sm ${bg}`}
      role="region"
      aria-label={`Tilsynsklarhet ${score} av 100`}
    >
      <div className="relative size-28 shrink-0">
        <svg className="size-28 -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="butt"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-neutral-900">{score}</span>
          <span className="text-[10px] font-medium text-neutral-500">/ 100</span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-neutral-900">Tilsynsklarhet</h2>
        <p className="mt-1 text-xs text-neutral-600">
          Vektet score basert på IK-f §5-dekning, aktuelle dokumenter, årsgjennomgang, varslingsrutine og AMU (store
          virksomheter).
        </p>
        <Link
          to="/documents/compliance/inspection-export"
          className="mt-3 inline-flex text-xs font-medium text-[#1a3d32] underline"
        >
          Arbeidstilsynet-rapport →
        </Link>
      </div>
    </div>
  )
}
