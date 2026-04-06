import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  Filter,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Search,
  Settings,
  Star,
  Users,
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

export function PlatformUiAdvancedPage() {
  const { payload, reload, presetLoading, presetError } = useLayoutLabPayload()
  const pageMax = useMemo(() => layoutPageMaxClass(payload.pageWidth), [payload.pageWidth])
  const surf = layoutSurfaceClass(payload.surface)
  const r = layoutRadiusClass(payload.radius)
  const accent = payload.accent || '#1a3d32'

  return (
    <div className={`${pageMax} space-y-10`}>
      <div>
        <h1 className="text-2xl font-semibold text-white">Avansert UI — referansemønstre</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          ATS-lignende kort, tabell med segmentkontroll og scorecard-kort. Stil hentes fra{' '}
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
    </div>
  )
}
