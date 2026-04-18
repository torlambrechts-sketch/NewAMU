import { useNavigate } from 'react-router-dom'
import type { IkPillarStatus, IkStatus } from './types'

type Props = {
  pillarStatuses: IkPillarStatus[]
  overallIkStatus: IkStatus
  loading: boolean
}

const LAW_COLOR: Record<string, string> = {
  AML: '#1a3d32',
  BVL: '#c2410c',
  ETL: '#d97706',
  FL: '#0891b2',
  PKL: '#6d28d9',
}

const STATUS_COLOR: Record<IkStatus, { bg: string; border: string; text: string; dot: string }> = {
  ok:         { bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-800',  dot: 'bg-green-500' },
  attention:  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-500' },
  critical:   { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-500' },
  unassessed: { bg: 'bg-neutral-50', border: 'border-neutral-200',text: 'text-neutral-600',dot: 'bg-neutral-400' },
}

const PILLAR_ROUTES: Record<number, string> = {
  1: '/internkontroll/lovregister',
  2: '/internkontroll/kompetanse',
  3: '/internkontroll/medvirkning',
  4: '/internkontroll/mal',
  5: '/internkontroll/tiltaksplan',
  6: '/internal-control?tab=ros',
  7: '/internal-control?tab=annual',
  8: '/internkontroll/tiltaksplan',
}

const PILLAR_LAW: Record<number, string[]> = {
  1: ['AML', 'BVL', 'ETL', 'FL', 'PKL'],
  2: ['AML', 'ETL'],
  3: ['AML'],
  4: ['AML'],
  5: ['AML', 'BVL', 'ETL', 'FL', 'PKL'],
  6: ['AML', 'BVL'],
  7: ['AML'],
  8: ['AML'],
}

export function IkHubView({ pillarStatuses, overallIkStatus, loading }: Props) {
  const navigate = useNavigate()
  const overall = STATUS_COLOR[overallIkStatus]

  return (
    <div className="space-y-6">
      {/* Overall status banner */}
      <div className={`flex items-center gap-3 rounded border px-5 py-4 ${overall.bg} ${overall.border}`}>
        <span className={`h-3 w-3 rounded-full ${overall.dot}`} />
        <div>
          <p className={`text-sm font-semibold ${overall.text}`}>
            Internkontroll — {overallIkStatus === 'ok' ? 'Alt i orden' : overallIkStatus === 'attention' ? 'Krever oppfølging' : overallIkStatus === 'critical' ? 'Kritiske avvik' : 'Ikke vurdert'}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            IK-forskriften § 5 — sist oppdatert nå
          </p>
        </div>
      </div>

      {/* Law legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(LAW_COLOR).map(([law, color]) => (
          <span key={law} className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ backgroundColor: color }} />
            {law}
          </span>
        ))}
      </div>

      {/* 8 pillar cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded border border-neutral-100 bg-neutral-50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillarStatuses.map((p) => {
            const colors = STATUS_COLOR[p.status]
            const laws = PILLAR_LAW[p.pillar] ?? []
            return (
              <button
                key={p.pillar}
                type="button"
                onClick={() => navigate(PILLAR_ROUTES[p.pillar])}
                className={`group rounded border p-4 text-left transition-shadow hover:shadow-md ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Pilar {p.pillar}
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                </div>
                <p className={`mt-2 text-sm font-semibold ${colors.text}`}>{p.label}</p>
                <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{p.details}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {laws.map((law) => (
                    <span
                      key={law}
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                      style={{ backgroundColor: LAW_COLOR[law] }}
                    >
                      {law}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
