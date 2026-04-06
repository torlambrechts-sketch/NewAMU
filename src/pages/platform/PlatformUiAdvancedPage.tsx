import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Ban,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  LayoutGrid,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Star,
  Users,
  X,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import {
  layoutCardClass,
  layoutCardStyleObject,
  layoutDensityPadding,
  layoutPageMaxClass,
  layoutRadiusClass,
  layoutSurfaceClass,
  layoutTableRowClass,
  mergeLayoutPayload,
} from '../../lib/layoutLabTokens'
import {
  DEFAULT_LAYOUT_LAB,
  LAYOUT_LAB_CHANGED_EVENT,
  LAYOUT_LAB_STORAGE_KEY,
  type LayoutLabPayload,
} from '../../types/layoutLab'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'

function readPayloadFromStorage(): LayoutLabPayload {
  try {
    const raw = localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)
    if (!raw) return DEFAULT_LAYOUT_LAB
    const parsed = JSON.parse(raw) as Partial<LayoutLabPayload>
    return mergeLayoutPayload(parsed)
  } catch {
    return DEFAULT_LAYOUT_LAB
  }
}

function useLayoutLabPayload(): {
  payload: LayoutLabPayload
  reload: () => void
  presetLoading: boolean
  presetError: string | null
} {
  const [payload, setPayload] = useState<LayoutLabPayload>(() => readPayloadFromStorage())
  const [searchParams] = useSearchParams()
  const presetId = searchParams.get('preset')
  const { userId, isAdmin } = usePlatformAdmin()
  const supabase = getSupabaseBrowserClient()
  const [presetLoading, setPresetLoading] = useState(false)
  const [presetError, setPresetError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setPayload(readPayloadFromStorage())
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAYOUT_LAB_STORAGE_KEY || e.key === null) reload()
    }
    const onCustom = () => reload()
    window.addEventListener('storage', onStorage)
    window.addEventListener(LAYOUT_LAB_CHANGED_EVENT, onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(LAYOUT_LAB_CHANGED_EVENT, onCustom)
    }
  }, [reload])

  useEffect(() => {
    if (!presetId || !supabase || !userId || !isAdmin) {
      setPresetLoading(false)
      setPresetError(null)
      return
    }
    let cancelled = false
    setPresetLoading(true)
    setPresetError(null)
    void (async () => {
      try {
        const { data, error: e } = await supabase
          .from('platform_layout_presets')
          .select('payload')
          .eq('id', presetId)
          .eq('user_id', userId)
          .maybeSingle()
        if (e) throw e
        if (cancelled) return
        if (data?.payload) {
          const next = mergeLayoutPayload(data.payload as Partial<LayoutLabPayload>)
          setPayload(next)
          try {
            localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify(next))
          } catch {
            /* ignore */
          }
        } else {
          setPresetError('Fant ikke preset eller ingen tilgang.')
        }
      } catch (err) {
        if (!cancelled) setPresetError(getSupabaseErrorMessage(err))
      } finally {
        if (!cancelled) setPresetLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [presetId, supabase, userId, isAdmin])

  return { payload, reload, presetLoading, presetError }
}

function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>
      {children}
    </span>
  )
}

function PipelineIcon({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1 text-neutral-500">{children}</span>
}

function JobListingCard({ payload }: { payload: LayoutLabPayload }) {
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  return (
    <div className={`${card} overflow-hidden`} style={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-neutral-900">Sales Manager</h3>
          <p className="mt-1 text-sm text-neutral-500">London · Sales · Tysons Corner</p>
          <Pill className="mt-2 bg-amber-100/80 text-amber-900">PIN-0039</Pill>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <Star className="size-5" />
          </button>
          <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <MoreHorizontal className="size-5" />
          </button>
          <Pill className="border border-amber-200/80 bg-transparent text-amber-900">Confidential</Pill>
          <Pill className="bg-orange-100 text-orange-800">Pending approval</Pill>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-3xl font-bold tabular-nums text-neutral-900">0</p>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Candidates</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm text-neutral-600">
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">0/2</span>
          <span className="text-neutral-300">|</span>
          <PipelineIcon>
            <Ban className="size-4 text-red-500" /> <span className="text-neutral-400">—</span>
          </PipelineIcon>
          <span className="text-neutral-300">|</span>
          <PipelineIcon>
            <ArrowRight className="size-4" /> <span>7</span>
          </PipelineIcon>
          <span className="text-neutral-300">|</span>
          <PipelineIcon>
            <Search className="size-4 text-amber-600" /> <span>1</span>
          </PipelineIcon>
          <span className="text-neutral-300">|</span>
          <PipelineIcon>
            <MessageCircle className="size-4 text-teal-600" /> <span>—</span>
          </PipelineIcon>
          <span className="text-neutral-300">|</span>
          <PipelineIcon>
            <Mail className="size-4 text-emerald-600" /> <span>—</span>
          </PipelineIcon>
          <span className="text-neutral-300">|</span>
          <PipelineIcon>
            <Check className="size-4 text-emerald-600" /> <span>—</span>
          </PipelineIcon>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900"
        >
          View candidates <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  )
}

function JobListingCardAlt({ payload }: { payload: LayoutLabPayload }) {
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  return (
    <div className={card} style={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Customer Success Manager</h3>
          <p className="mt-1 text-sm text-neutral-500">Remote · Customer · Global</p>
          <Pill className="mt-2 bg-amber-100/80 text-amber-900">PIN-0041</Pill>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill className="border border-emerald-200/80 bg-emerald-50 text-emerald-900">Open</Pill>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-3xl font-bold tabular-nums">10</p>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Candidates</p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">1/5</span>
          <span className="text-neutral-300">|</span>
          <Users className="size-4 text-neutral-500" />
        </div>
        <button type="button" className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
          View candidates <ChevronDown className="inline size-4" />
        </button>
      </div>
    </div>
  )
}

function CandidatesToolbarAndTable({ payload }: { payload: LayoutLabPayload }) {
  const [segment, setSegment] = useState<'all' | 'uninvited' | 'invited'>('all')
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  const accent = payload.accent || '#1a3d32'
  const pad = layoutDensityPadding(payload.density)
  const rMd = payload.radius === 'sm' ? 'rounded-sm' : payload.radius === 'md' ? 'rounded-md' : 'rounded-lg'
  return (
    <div className={`${card} overflow-hidden`} style={cardStyle}>
      <div className="border-b border-neutral-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="relative min-w-[200px] flex-1"
            style={{ ['--layout-accent' as string]: accent }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              placeholder="Search candidates…"
              className={`w-full border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[color:var(--layout-accent)] ${rMd}`}
            />
          </div>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50 ${rMd}`}
          >
            <Search className="size-3.5" /> Advanced
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50 ${rMd}`}
          >
            <Filter className="size-3.5" /> Filters
          </button>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          You can filter by candidates that have taken part in interviews at this stage.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className={`inline-flex border border-neutral-200 bg-neutral-50/80 p-1 ${rMd}`}>
            {(
              [
                ['all', 'All candidates'],
                ['uninvited', 'Uninvited'],
                ['invited', 'Invited'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSegment(id)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition ${rMd} ${
                  segment === id ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-white'
                }`}
                style={
                  segment === id
                    ? { backgroundColor: accent, color: '#fff' }
                    : undefined
                }
              >
                {segment === id ? (
                  <span className="flex size-4 items-center justify-center rounded-full bg-white/20">
                    <Check className="size-3" />
                  </span>
                ) : (
                  <span className="size-4 rounded-full border-2 border-neutral-300" />
                )}
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-700 hover:bg-neutral-50 ${rMd}`}
          >
            <Settings className="size-3.5" /> Configure
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th className={`w-10 ${pad}`}>
                <input type="checkbox" className="rounded border-neutral-300" aria-label="Select all" />
              </th>
              <th className={pad}>Name</th>
              <th className={pad}>Template</th>
              <th className={pad}>Attendees</th>
              <th className={pad}>Tags</th>
              <th className={pad}>Status</th>
              <th className={pad}>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr className={`${layoutTableRowClass(payload, 0)} hover:bg-neutral-50/80`}>
              <td className={pad}>
                <input type="checkbox" className="rounded border-neutral-300" />
              </td>
              <td className={`${pad} font-medium text-neutral-900`}>Tom Hacquoil</td>
              <td className={`${pad} text-neutral-600`}>Standard</td>
              <td className={`${pad} text-neutral-600`}>—</td>
              <td className={pad}>
                <span className="mr-1 inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900">
                  Custom tag 1
                </span>
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                  Referral
                </span>
              </td>
              <td className={pad}>
                <Pill className="bg-stone-100 text-stone-800">Not invited</Pill>
              </td>
              <td className={`${pad} text-neutral-500`}>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScoreBar({ value, accent }: { value: number; accent: string }) {
  const pct = Math.min(100, Math.max(0, value * 20))
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </div>
      <span className="w-10 text-right text-sm tabular-nums text-neutral-700">{value.toFixed(2)}</span>
    </div>
  )
}

function ScorecardCandidateCard({
  name,
  overall,
  payload,
}: {
  name: string
  overall: number
  payload: LayoutLabPayload
}) {
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  const accent = payload.accent || '#1a3d32'
  const pad = payload.density === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  return (
    <div className={`${card} p-0`} style={cardStyle}>
      <div className={`flex items-start justify-between border-b border-neutral-100 ${pad}`}>
        <h4 className="font-semibold text-neutral-900">{name}</h4>
        <span className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
          {overall}%
        </span>
      </div>
      <div className="border-b border-neutral-100">
        <div className="flex items-center justify-between bg-amber-50/80 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-700">Technical assessment</span>
          <span className="inline-flex items-center gap-2 text-xs text-neutral-600">
            Feedback
            <Pill className="bg-emerald-100 text-emerald-900">4.5</Pill>
          </span>
        </div>
        <div className={`space-y-3 ${pad}`}>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 text-neutral-600">Ruby on Rails</span>
            <ScoreBar value={4.5} accent={accent} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 text-neutral-600">Technical acumen</span>
            <ScoreBar value={4.2} accent={accent} />
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between bg-amber-50/80 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-700">Video screen</span>
          <span className="inline-flex items-center gap-2 text-xs text-neutral-600">
            Feedback
            <Pill className="bg-amber-100 text-amber-900">3.8</Pill>
          </span>
        </div>
        <div className={`space-y-3 ${pad}`}>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 text-neutral-600">Communication</span>
            <ScoreBar value={3.8} accent={accent} />
          </div>
        </div>
      </div>
    </div>
  )
}

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

function ModalFrame({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useBodyScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Lukk"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-ui-modal-title"
        className={`relative z-[101] max-h-[90vh] w-full overflow-y-auto border border-neutral-200 bg-white shadow-2xl ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        } rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <h2 id="advanced-ui-modal-title" className="font-serif text-xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Lukk"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-neutral-700">{children}</div>
      </div>
    </div>
  )
}

function InsightCardShell({
  payload,
  children,
  className = '',
  menu,
  style,
}: {
  payload: LayoutLabPayload
  children: ReactNode
  className?: string
  menu?: boolean
  style?: CSSProperties
}) {
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  return (
    <div className={`${card} relative ${className}`} style={{ ...cardStyle, ...style }}>
      {menu && (
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Meny"
        >
          <MoreVertical className="size-4" />
        </button>
      )}
      {children}
    </div>
  )
}

function HorizontalMetricRow({
  label,
  value,
  max,
  barColor,
}: {
  label: string
  value: number
  max: number
  barColor: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 text-neutral-600">{label}</span>
      <span className="w-7 shrink-0 tabular-nums font-medium text-neutral-900">{value}</span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
        {value > 0 ? (
          <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        ) : null}
      </div>
    </div>
  )
}

function PendingReviewCard({ payload }: { payload: LayoutLabPayload }) {
  const accent = payload.accent || '#1a3d32'
  const rows = [
    { label: 'Forfalt', value: 1, color: '#dc2626' },
    { label: 'Starter denne uken', value: 0, color: '#d6d3d1' },
    { label: 'Starter neste uke', value: 1, color: '#e7e5e4' },
    { label: 'Om to uker +', value: 1, color: '#d6d3d1' },
  ]
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <InsightCardShell payload={payload} className="flex flex-col overflow-hidden">
      <div className="border-b border-neutral-100 px-5 py-4 pr-12">
        <h3 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          Til gjennomgang
        </h3>
      </div>
      <div className="space-y-4 px-5 py-4">
        {rows.map((row) => (
          <HorizontalMetricRow key={row.label} label={row.label} value={row.value} max={max} barColor={row.color} />
        ))}
      </div>
      <div className="mt-auto border-t border-neutral-100 px-5 py-4" style={{ backgroundColor: `${accent}08` }}>
        <p className="text-3xl font-bold tabular-nums text-neutral-900">3</p>
        <p className="text-sm text-neutral-600">Kandidater venter på gjennomgang</p>
        <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900">
          Se alle <ChevronRight className="size-4" />
        </button>
      </div>
    </InsightCardShell>
  )
}

function StartersCard({ payload }: { payload: LayoutLabPayload }) {
  const accent = payload.accent || '#1a3d32'
  return (
    <InsightCardShell payload={payload} className="flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Oppstartere</p>
        <div className="flex items-center gap-1 text-sm text-neutral-600">
          <button type="button" className="rounded-md p-1 hover:bg-neutral-100" aria-label="Forrige uke">
            <ChevronLeft className="size-4" />
          </button>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Calendar className="size-4 text-neutral-400" /> Uke 18. sep. 2023
          </span>
          <button type="button" className="rounded-md p-1 hover:bg-neutral-100" aria-label="Neste uke">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="px-5 py-4">
        <div
          className="rounded-lg border-l-4 px-4 py-3"
          style={{ borderLeftColor: accent, backgroundColor: `${accent}12` }}
        >
          <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
            1
          </p>
          <p className="text-sm text-neutral-700">Kandidat som skal starte denne uken.</p>
        </div>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-neutral-100 pt-4">
          <div>
            <p className="font-serif font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Periwinkle Broccoli Mulberries
            </p>
            <p className="text-sm text-neutral-500">Office Manager</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Mandag 11. sep.</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-800">
              <Ban className="size-3" /> Ikke fullført
            </span>
          </div>
        </div>
      </div>
      <div className="mt-auto border-t border-neutral-100 px-5 py-3 text-center">
        <button type="button" className="text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900">
          Se alle oppstartere
        </button>
      </div>
    </InsightCardShell>
  )
}

function LineChartBlock({ accent }: { accent: string }) {
  const gradId = useId().replace(/:/g, '')
  const w = 320
  const h = 120
  const pad = 8
  const pts = [
    [0, 95],
    [40, 120],
    [80, 180],
    [120, 260],
    [160, 310],
    [200, 380],
    [240, 420],
    [280, 460],
  ]
  const maxY = 500
  const maxX = 280
  const mapX = (x: number) => pad + (x / maxX) * (w - pad * 2)
  const mapY = (y: number) => h - pad - (y / maxY) * (h - pad * 2)
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${mapX(x)} ${mapY(y)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L ${mapX(280)} ${h - pad} L ${mapX(0)} ${h - pad} Z`}
        fill={`url(#${gradId})`}
      />
      <path d={d} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DonutChartBlock({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { pct: number; color: string }[]
  centerLabel: string
  centerValue: string
}) {
  const size = 160
  const stroke = 18
  const r = (size - stroke) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const arcs: { dash: number; offset: number }[] = []
  let cum = 0
  for (const seg of segments) {
    const dash = (seg.pct / 100) * circumference
    arcs.push({ dash, offset: cum })
    cum += dash
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <g transform={`rotate(-90 ${c} ${c})`}>
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={segments[i].color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
          />
        ))}
      </g>
      <text x={c} y={c - 4} textAnchor="middle" className="fill-neutral-400 text-[10px] font-medium uppercase">
        {centerLabel}
      </text>
      <text x={c} y={c + 14} textAnchor="middle" className="fill-neutral-900 text-2xl font-bold">
        {centerValue}
      </text>
    </svg>
  )
}

function StageBarsCard({ payload }: { payload: LayoutLabPayload }) {
  const stages = [
    { name: 'Avvist', n: 388, color: '#dc2626' },
    { name: 'Video', n: 6, color: '#3b82f6' },
    { name: 'Søkt', n: 0, color: '#94a3b8' },
    { name: 'Tilbud', n: 0, color: '#94a3b8' },
    { name: 'Ansatt', n: 2, color: payload.accent || '#1a3d32' },
  ]
  const max = Math.max(1, ...stages.map((s) => s.n))
  return (
    <InsightCardShell payload={payload} menu className="p-0">
      <div className="border-b border-neutral-100 px-5 py-4 pr-12">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Søknader per trinn</p>
        <p className="mt-1 text-sm text-neutral-600">Oppsummering av alle søknader fordelt på arbeidsflyt.</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {stages.map((s) => (
          <HorizontalMetricRow key={s.name} label={s.name} value={s.n} max={max} barColor={s.color} />
        ))}
      </div>
    </InsightCardShell>
  )
}

function TimeInStageCard({ payload }: { payload: LayoutLabPayload }) {
  const rows = [
    { label: 'Video', days: 8.37, color: '#3b82f6' },
    { label: 'Søkt', days: 1000, color: payload.accent || '#1a3d32' },
  ]
  const max = Math.max(...rows.map((r) => r.days))
  return (
    <InsightCardShell payload={payload} menu className="p-0">
      <div className="border-b border-neutral-100 px-5 py-4 pr-12">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Snitt tid i trinn</p>
        <p className="mt-1 text-sm text-neutral-600">Gjennomsnittlig tid kandidater bruker i hvert trinn.</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-neutral-600">{row.label}</span>
            <span className="w-16 shrink-0 tabular-nums text-neutral-900">{row.days.toLocaleString('nb-NO')} d</span>
            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, (row.days / max) * 100)}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </InsightCardShell>
  )
}

function RejectionDonutCard({ payload }: { payload: LayoutLabPayload }) {
  const accent = payload.accent || '#1a3d32'
  const segments = [
    { pct: 58.4, color: accent },
    { pct: 20, color: '#f97316' },
    { pct: 12, color: '#eab308' },
    { pct: 9.6, color: '#94a3b8' },
  ]
  return (
    <InsightCardShell payload={payload} menu className="p-0">
      <div className="border-b border-neutral-100 px-5 py-4 pr-12">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Årsaker til avvisning</p>
        <p className="mt-1 text-sm text-neutral-600">Fordeling av kandidater med valgt merkelapp.</p>
      </div>
      <div className="flex flex-col items-center gap-4 px-5 py-6 md:flex-row md:items-start md:justify-between">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: accent }} />
            Underkvalifisert <span className="text-neutral-500">58,4 %</span>
          </li>
          <li className="flex items-center gap-2 text-neutral-500">
            <span className="size-2.5 rounded-full bg-orange-500" /> Annen kategori
          </li>
        </ul>
        <DonutChartBlock segments={segments} centerLabel="Totalt" centerValue="396" />
      </div>
    </InsightCardShell>
  )
}

function ApplicationsLineCard({ payload }: { payload: LayoutLabPayload }) {
  const accent = payload.accent || '#1a3d32'
  return (
    <InsightCardShell payload={payload} menu className="p-0">
      <div className="border-b border-neutral-100 px-5 py-4 pr-12">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Søknader over tid</p>
        <p className="mt-1 text-sm text-neutral-600">Kumulative søknader etter opprettelsesdato (demo).</p>
      </div>
      <div className="px-2 py-4">
        <LineChartBlock accent={accent} />
        <div className="flex justify-between px-2 text-[10px] font-medium uppercase text-neutral-400">
          <span>Jun &apos;23</span>
          <span>Jul &apos;23</span>
        </div>
      </div>
    </InsightCardShell>
  )
}

const REPORT_GROUPS = [
  {
    title: 'Stillingsrapporter',
    items: [
      { t: 'Stillingsoversikt', d: 'Status for alle stillinger i organisasjonen.' },
      { t: 'Åpne stillinger', d: 'Oversikt over alle åpne stillinger.' },
      { t: 'Besatte stillinger', d: 'Tid til besettelse og antall kandidater.' },
    ],
  },
  {
    title: 'Kandidatrapporter',
    items: [
      { t: 'Kandidatoversikt', d: 'Status for alle kandidater på aktive stillinger.' },
      { t: 'Kanaler', d: 'Hvor kandidatene kommer fra.' },
      { t: 'Vellykkede kandidater', d: 'Kanal og tid til ansettelse.' },
      { t: 'Henvisninger', d: 'Status for henvisningssøknader.' },
    ],
  },
]

function SurveyExperienceCard({ payload }: { payload: LayoutLabPayload }) {
  const accent = payload.accent || '#1a3d32'
  const detractor = 0
  const passive = 46
  const promoter = 54
  return (
    <InsightCardShell payload={payload} menu className="p-0">
      <div className="border-b border-neutral-100 px-5 py-4 pr-12">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Kandidatopplevelse</p>
        <p className="mt-1 text-sm text-neutral-600">NPS-lignende fordeling (statisk demo).</p>
      </div>
      <div className="grid gap-8 px-5 py-6 lg:grid-cols-2">
        <div className="flex justify-center">
          <DonutChartBlock
            segments={[
              { pct: promoter, color: accent },
              { pct: passive, color: '#86efac' },
            ]}
            centerLabel="Net"
            centerValue="+54"
          />
        </div>
        <div className="space-y-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full bg-red-400" style={{ width: `${detractor}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${passive}%` }} />
            <div className="h-full" style={{ width: `${promoter}%`, backgroundColor: accent }} />
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between text-neutral-700">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-red-500" /> Kritiker (0–6)
              </span>
              <span className="tabular-nums">{detractor}%</span>
            </li>
            <li className="flex items-center justify-between text-neutral-700">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" /> Passiv (7–8)
              </span>
              <span className="tabular-nums">{passive}%</span>
            </li>
            <li className="flex items-center justify-between text-neutral-700">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: accent }} /> Promotor (9–10)
              </span>
              <span className="tabular-nums">{promoter}%</span>
            </li>
          </ul>
          <p className="text-right text-[10px] text-neutral-400">Basert på NPS-metodikk (demo).</p>
        </div>
      </div>
    </InsightCardShell>
  )
}

function LatestCommentsBox({ payload }: { payload: LayoutLabPayload }) {
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  const items = [
    { score: '10 / 10', body: 'Meget god kommunikasjon og tydelige forventninger.', meta: 'Søknad ikke tilgjengelig · Over 1 år siden' },
    { score: '7 / 10', body: 'Greit intervju, kunne hatt mer struktur i oppfølging.', meta: 'Søknad ikke tilgjengelig · 8 mnd. siden' },
  ]
  return (
    <div className={`${card} flex max-h-[420px] flex-col overflow-hidden`} style={cardStyle}>
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Siste kommentarer</p>
      </div>
      <ul className="flex-1 divide-y divide-neutral-100 overflow-y-auto text-sm">
        {items.map((it) => (
          <li key={it.score} className="px-4 py-3">
            <p className="font-semibold text-neutral-900">{it.score}</p>
            <p className="mt-1 text-neutral-600">{it.body}</p>
            <p className="mt-2 text-xs text-neutral-400">{it.meta}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReportsCatalog({ payload }: { payload: LayoutLabPayload }) {
  const r = layoutRadiusClass(payload.radius)
  return (
    <div className="space-y-8">
      {REPORT_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
            <FileText className="size-4" /> {group.title}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <button
                key={item.t}
                type="button"
                className={`text-left ${r} border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md`}
              >
                <p className="font-semibold text-neutral-900">{item.t}</p>
                <p className="mt-1 text-sm text-neutral-600">{item.d}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function InsightPageCard({
  payload,
  title,
  subtitle,
  footer,
}: {
  payload: LayoutLabPayload
  title: string
  subtitle: string
  footer: string
}) {
  const card = layoutCardClass(payload)
  const cardStyle = layoutCardStyleObject(payload)
  return (
    <button type="button" className={`${card} w-full text-left transition hover:shadow-md`} style={cardStyle}>
      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 px-4 py-4">
        <div>
          <p className="font-semibold text-neutral-900">{title}</p>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>
        <MoreHorizontal className="size-5 shrink-0 text-neutral-400" />
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-neutral-500">
        <span className="flex size-8 items-center justify-center rounded-full font-semibold text-white" style={{ backgroundColor: payload.accent || '#1a3d32' }}>
          MB
        </span>
        <FileText className="size-4 text-neutral-400" />
      </div>
      <p className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">{footer}</p>
    </button>
  )
}

export function PlatformUiAdvancedPage() {
  const { payload, reload, presetLoading, presetError } = useLayoutLabPayload()
  const pageMax = useMemo(() => layoutPageMaxClass(payload.pageWidth), [payload.pageWidth])
  const surf = layoutSurfaceClass(payload.surface)
  const r = layoutRadiusClass(payload.radius)
  const accent = payload.accent || '#1a3d32'
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [newReportOpen, setNewReportOpen] = useState(false)

  return (
    <div className={`${pageMax} space-y-10`}>
      <div>
        <h1 className="text-2xl font-semibold text-white">Avansert UI — referansemønstre</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Grafer, modaler, ulike boks- og rapportmønstre, innsikt — alt styres av{' '}
          <Link to="/platform-admin/layout-lab" className="text-amber-400/90 hover:underline">
            Layout-lab
          </Link>{' '}
          (lagres i nettleseren). Legg til{' '}
          <code className="rounded bg-white/10 px-1">?preset=&lt;uuid&gt;</code> for å laste et sky-lagret preset (krever
          innlogget plattform-admin).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Link to="/platform-admin/layout-lab" className="text-amber-400/90 hover:underline">
            ← Layout-lab (endre tokens)
          </Link>
          <button
            type="button"
            onClick={() => reload()}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-neutral-200 hover:bg-white/5"
          >
            Oppdater fra lagring
          </button>
          {presetLoading && (
            <span className="inline-flex items-center gap-1 text-neutral-400">
              <Loader2 className="size-4 animate-spin" /> Laster preset…
            </span>
          )}
        </div>
        {presetError && <p className="mt-2 text-sm text-red-300">{presetError}</p>}
        <p className="mt-2 text-xs text-neutral-500">
          Aktiv aksent: <code className="rounded bg-white/10 px-1">{accent}</code> · Tetthet: {payload.density} ·
          Tabell: {payload.tableStyle} · Kort: {payload.cardStyle}
        </p>
      </div>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          Stillingsliste — horisontalt kort (to rader)
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Øvre rad: tittel, meta, PIN-pille, stjerne/meny, status-piller. Nedre rad: hovedtall, pipeline med ikoner, CTA.
        </p>
        <div className="mt-6 space-y-4">
          <JobListingCard payload={payload} />
          <JobListingCardAlt payload={payload} />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          Kandidater — søk, segmentbokser og tabell
        </h2>
        <p className="mt-1 text-sm text-neutral-600">Verktøylinje, hjelpetekst, pill-segment + tabell (tokens fra Layout-lab).</p>
        <div className="mt-6">
          <CandidatesToolbarAndTable payload={payload} />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Scorecard ratings
            </h2>
            <p className="mt-1 text-sm text-neutral-600">Sammenligning: kort med seksjonsfelt og score-rader (progress + tall).</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-800"
          >
            Export
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 rounded-lg border border-neutral-200 bg-white p-3">
          <select className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <option>Candidate current stage</option>
          </select>
          <select className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <option>Scorecard stage</option>
          </select>
          <select className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <option>Order by</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" className="rounded border-neutral-300" defaultChecked />
            Show detail
          </label>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <ScorecardCandidateCard name="Tom Hacquoil" overall={73} payload={payload} />
          <ScorecardCandidateCard name="Jane Doe" overall={81} payload={payload} />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Innsikt — oppgavekort
            </h2>
            <p className="mt-1 text-sm text-neutral-600">Horisontale søyler, oppsummering og ukevelger med uthevet boks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-800"
            >
              <Filter className="size-3.5" /> Vis filtre
            </button>
            <button
              type="button"
              onClick={() => setNewReportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase text-white"
              style={{ backgroundColor: accent }}
            >
              <Plus className="size-3.5" /> Ny rapport
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <PendingReviewCard payload={payload} />
          <StartersCard payload={payload} />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Grafer og diagrammer
            </h2>
            <p className="mt-1 text-sm text-neutral-600">Søylediagram, linjegraf og smultring — SVG, ingen ekstra avhengigheter.</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium uppercase text-neutral-500">
            <BarChart3 className="size-4" /> Insights
          </span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <StageBarsCard payload={payload} />
          <ApplicationsLineCard payload={payload} />
          <TimeInStageCard payload={payload} />
          <RejectionDonutCard payload={payload} />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          Undersøkelse og tilbakemeldinger
        </h2>
        <p className="mt-1 text-sm text-neutral-600">KPI-bokser, NPS-lignende kort og kommentarliste.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <InsightCardShell payload={payload}>
            <p className="text-4xl font-bold tabular-nums text-neutral-900">65%</p>
            <p className="mt-1 text-sm text-neutral-600">Svarprosent på kandidatundersøkelse</p>
          </InsightCardShell>
          <InsightCardShell payload={payload}>
            <p className="text-4xl font-bold tabular-nums text-neutral-900">13</p>
            <p className="mt-1 text-sm text-neutral-600">Totalt antall svar</p>
          </InsightCardShell>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SurveyExperienceCard payload={payload} />
          <LatestCommentsBox payload={payload} />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Rapporter og innsikt (katalog)
            </h2>
            <p className="mt-1 text-sm text-neutral-600">Rutenett med rapportkort — klikk åpner ingen side i denne demoen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-800"
            >
              <Filter className="size-3.5" /> Filtre
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-800"
            >
              <Download className="size-3.5" /> Eksporter
            </button>
          </div>
        </div>
        <div className="mt-6">
          <ReportsCatalog payload={payload} />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Mine innsikt-sider
            </h2>
            <p className="mt-1 text-sm text-neutral-600">Søkbar liste over lagrede dashboards (statisk).</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase text-white"
            style={{ backgroundColor: accent }}
          >
            <Plus className="size-3.5" /> Opprett side
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              placeholder="Søk…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none ring-neutral-200 focus:ring-2"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800"
          >
            <Filter className="size-4" /> Filtre
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InsightPageCard
            payload={payload}
            title="Talentinnsikt"
            subtitle="Oversikt over rekruttering"
            footer="Sist oppdatert · demo"
          />
          <InsightPageCard
            payload={payload}
            title="Rekrutteringsteam"
            subtitle="Rekrutteringsmetrikker"
            footer="Sist oppdatert · demo"
          />
          <InsightPageCard
            payload={payload}
            title="Ledelsessammendrag"
            subtitle="KPI for ledelse"
            footer="Sist oppdatert · demo"
          />
        </div>
      </section>

      <section className={`${surf} ${r} border border-white/10 p-6 md:p-8`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Widget-dashboard
            </h2>
            <p className="mt-1 text-sm text-neutral-600">Metrikk-kort med aksentkant, liste og smultring (samme tokens).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-800"
            >
              <LayoutGrid className="size-3.5" /> Rediger layout
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase text-white"
              style={{ backgroundColor: accent }}
            >
              <Plus className="size-3.5" /> Legg til widget
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <InsightCardShell payload={payload} menu className="border-t-4 p-4" style={{ borderTopColor: accent }}>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Snitt tid til ansettelse</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">28,9</p>
            <p className="text-sm text-neutral-500">dager</p>
          </InsightCardShell>
          <InsightCardShell payload={payload} menu className="border-t-4 p-4" style={{ borderTopColor: accent }}>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Snitt tid til besettelse</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">68,1</p>
            <p className="text-sm text-neutral-500">dager</p>
          </InsightCardShell>
          <InsightCardShell payload={payload} menu className="p-0">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Besatte roller</p>
              <p className="text-xs text-neutral-500">Siste 12 mnd. · etter stilling</p>
            </div>
            <ul className="max-h-40 space-y-2 overflow-y-auto px-4 py-3 text-sm">
              <li className="flex justify-between">
                <span className="text-neutral-700">Senior Sales</span>
                <span className="tabular-nums font-medium">4</span>
              </li>
              <li className="flex justify-between">
                <span className="text-neutral-700">Technical Writer</span>
                <span className="tabular-nums font-medium">2</span>
              </li>
              <li className="flex justify-between">
                <span className="text-neutral-700">Customer Success</span>
                <span className="tabular-nums font-medium">3</span>
              </li>
            </ul>
          </InsightCardShell>
        </div>
        <div className="mt-6">
          <InsightCardShell payload={payload} menu className="p-0">
            <div className="border-b border-neutral-100 px-5 py-4 pr-12">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Besatte etter avdeling</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 px-5 py-6">
              <ul className="min-w-[180px] space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-neutral-600">Drift</span>
                  <span>12 (32%)</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-600">Kundeservice</span>
                  <span>9 (24%)</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-neutral-600">Markedsføring</span>
                  <span>7 (19%)</span>
                </li>
              </ul>
              <DonutChartBlock
                segments={[
                  { pct: 32, color: accent },
                  { pct: 24, color: '#60a5fa' },
                  { pct: 19, color: '#fbbf24' },
                  { pct: 25, color: '#c4b5fd' },
                ]}
                centerLabel="Totalt"
                centerValue="37"
              />
            </div>
          </InsightCardShell>
        </div>
      </section>

      <ModalFrame open={filtersOpen} title="Filtre" onClose={() => setFiltersOpen(false)}>
        <p className="text-neutral-600">Eksempel på popup for filtre. Koble til ekte felt når rapportmotoren er klar.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-neutral-500">Periode</span>
            <select className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2">
              <option>Siste 30 dager</option>
              <option>Siste kvartal</option>
              <option>Siste år</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" className="rounded border-neutral-300" defaultChecked />
            Kun aktive stillinger
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium" onClick={() => setFiltersOpen(false)}>
            Avbryt
          </button>
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: accent }}
            onClick={() => setFiltersOpen(false)}
          >
            Bruk
          </button>
        </div>
      </ModalFrame>

      <ModalFrame open={newReportOpen} title="Ny rapport" onClose={() => setNewReportOpen(false)} wide>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Velg rapporttype</p>
            <p className="mt-2 text-sm text-neutral-600">Velg en mal eller tilpass en basisrapport til høyre.</p>
            <label className="mt-4 block text-sm">
              <span className="text-neutral-500">Type</span>
              <select className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2">
                <option value="">Velg rapporttype…</option>
                <option>Stillingsrapport</option>
                <option>Kandidatrapport</option>
              </select>
            </label>
            <button type="button" className="mt-4 w-full rounded-lg bg-neutral-200 py-2.5 text-sm font-semibold text-neutral-500" disabled>
              Neste
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-neutral-200 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Tilpass basisrapport</p>
            <div className="mt-4 space-y-6">
              {REPORT_GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-2 text-xs font-semibold text-neutral-800">{g.title}</p>
                  <div className="space-y-2">
                    {g.items.map((item) => (
                      <button
                        key={item.t}
                        type="button"
                        className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-left text-sm transition hover:border-neutral-300"
                      >
                        <span className="font-medium text-neutral-900">{item.t}</span>
                        <span className="mt-0.5 block text-xs text-neutral-500">{item.d}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-4">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700" onClick={() => setNewReportOpen(false)}>
            Lukk
          </button>
        </div>
      </ModalFrame>
    </div>
  )
}
