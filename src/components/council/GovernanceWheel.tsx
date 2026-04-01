import { MEETINGS_PER_YEAR } from '../../data/meetingGovernance'
import type { CouncilMeeting, QuarterSlot } from '../../types/council'

type Props = {
  year: number
  meetings: CouncilMeeting[]
  onQuarterClick?: (quarter: QuarterSlot) => void
}

function countMeetingsForQuarter(
  meetings: CouncilMeeting[],
  year: number,
  q: QuarterSlot,
): number {
  return meetings.filter((m) => {
    if (m.governanceYear !== year || m.quarterSlot !== q) return false
    return m.status !== 'cancelled'
  }).length
}

export function GovernanceWheel({ year, meetings, onQuarterClick }: Props) {
  const quarters: QuarterSlot[] = [1, 2, 3, 4]
  const total = quarters.reduce((acc, q) => acc + countMeetingsForQuarter(meetings, year, q), 0)
  const ok = total >= MEETINGS_PER_YEAR

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Årshjul (styring)</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Mål: <strong>{MEETINGS_PER_YEAR} ordinære møter</strong> per kalenderår med standard agenda. Kvartalene
            viser om minst ett møte er registrert (ikke avlyst).
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            ok ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'
          }`}
        >
          {total} / {MEETINGS_PER_YEAR} i {year}
          {ok ? ' ✓' : ''}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-center md:gap-10">
        <svg viewBox="0 0 120 120" className="size-44 shrink-0 md:size-52" aria-hidden>
          <circle cx="60" cy="60" r="54" fill="#f5f0e8" stroke="#1a3d32" strokeWidth="2" />
          {[0, 1, 2, 3].map((i) => {
            const start = (i * 90 - 90) * (Math.PI / 180)
            const end = ((i + 1) * 90 - 90) * (Math.PI / 180)
            const q = (i + 1) as QuarterSlot
            const filled = countMeetingsForQuarter(meetings, year, q) > 0
            const x1 = 60 + 50 * Math.cos(start)
            const y1 = 60 + 50 * Math.sin(start)
            const x2 = 60 + 50 * Math.cos(end)
            const y2 = 60 + 50 * Math.sin(end)
            const large = 0
            return (
              <path
                key={q}
                d={`M 60 60 L ${x1} ${y1} A 50 50 0 ${large} 1 ${x2} ${y2} Z`}
                fill={filled ? '#1a3d32' : '#e8e4dc'}
                stroke="#1a3d32"
                strokeWidth="0.5"
                className={onQuarterClick ? 'cursor-pointer transition-opacity hover:opacity-90' : ''}
                onClick={() => onQuarterClick?.(q)}
              />
            )
          })}
          <circle cx="60" cy="60" r="18" fill="#faf8f4" stroke="#c9a227" strokeWidth="1.5" />
          <text x="60" y="64" textAnchor="middle" className="fill-[#1a3d32] text-[11px] font-bold">
            {year}
          </text>
        </svg>

        <ul className="w-full max-w-sm space-y-2 text-sm">
          {quarters.map((q) => {
            const n = countMeetingsForQuarter(meetings, year, q)
            const filled = n > 0
            return (
              <li
                key={q}
                className={`flex items-center justify-between rounded-xl px-3 py-2 ring-1 ${
                  filled ? 'bg-[#1a3d32]/5 ring-[#1a3d32]/20' : 'bg-neutral-50 ring-neutral-200'
                }`}
              >
                <span className="font-medium text-neutral-800">Q{q}</span>
                <span className="text-neutral-600">
                  {n === 0 ? 'Ingen møte registrert' : `${n} møte${n > 1 ? 'r' : ''}`}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
