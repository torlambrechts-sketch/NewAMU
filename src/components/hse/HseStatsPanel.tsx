import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

export interface HseStatsPanelProps {
  supabase: SupabaseClient | null
  /** Calendar year for time-bounded KPIs (defaults to current year). */
  year?: number
}

type DeviationStatus = 'rapportert' | 'under_behandling' | 'tiltak_iverksatt' | 'lukket'

type HseStats = {
  roundsSignedThisYear: number
  roundsDualSignoffThisYear: number
  openFindingsCount: number
  deviationCounts: Record<DeviationStatus, number>
  avgCloseDays: number | null
  highRiskFindingsThisYear: number
}

const KPI_CARD =
  'rounded-xl border border-neutral-200/90 bg-white p-5 shadow-sm'

const STATUS_ORDER: DeviationStatus[] = ['rapportert', 'under_behandling', 'tiltak_iverksatt', 'lukket']
const STATUS_LABEL_NB: Record<DeviationStatus, string> = {
  rapportert: 'Rapportert',
  under_behandling: 'Under behandling',
  tiltak_iverksatt: 'Tiltak iverksatt',
  lukket: 'Lukket',
}
const STATUS_BAR_BG: Record<DeviationStatus, string> = {
  rapportert: 'bg-amber-200',
  under_behandling: 'bg-sky-300',
  tiltak_iverksatt: 'bg-violet-300',
  lukket: 'bg-emerald-400',
}

function yearRangeIso(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year}-12-31T23:59:59.999Z`,
  }
}

function formatAvgDays(days: number | null): string {
  if (days == null || Number.isNaN(days)) return '—'
  if (days < 1) return '< 1 dag'
  return `${days.toFixed(1)} dager`
}

export function HseStatsPanel({ supabase, year: yearProp }: HseStatsPanelProps) {
  const navigate = useNavigate()
  const { organization } = useOrgSetupContext()
  const year = yearProp ?? new Date().getFullYear()
  const { start: yearStart, end: yearEnd } = useMemo(() => yearRangeIso(year), [year])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<HseStats | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) {
      setStats(null)
      setError('Ingen databasekobling.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setExportNote(null)

    try {
      const [
        signedRes,
        dualRes,
        findingsRes,
        devRapRes,
        devUnderRes,
        devTiltakRes,
        devLukketRes,
        closedRowsRes,
        highRiskRes,
      ] = await Promise.all([
        supabase
          .from('inspection_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'signed')
          .is('deleted_at', null)
          .gte('completed_at', yearStart)
          .lte('completed_at', yearEnd),
        supabase
          .from('inspection_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'signed')
          .is('deleted_at', null)
          .not('manager_signed_at', 'is', null)
          .not('deputy_signed_at', 'is', null)
          .gte('completed_at', yearStart)
          .lte('completed_at', yearEnd),
        supabase.from('inspection_findings').select('id, deviation_id, deleted_at'),
        supabase
          .from('deviations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'rapportert'),
        supabase
          .from('deviations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'under_behandling'),
        supabase
          .from('deviations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'tiltak_iverksatt'),
        supabase
          .from('deviations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'lukket'),
        supabase
          .from('deviations')
          .select('id, created_at, closed_at')
          .eq('status', 'lukket')
          .not('closed_at', 'is', null),
        supabase
          .from('inspection_findings')
          .select('id', { count: 'exact', head: true })
          .gte('risk_score', 10)
          .gte('created_at', yearStart)
          .lte('created_at', yearEnd),
      ])

      const errs = [
        signedRes.error,
        dualRes.error,
        findingsRes.error,
        devRapRes.error,
        devUnderRes.error,
        devTiltakRes.error,
        devLukketRes.error,
        closedRowsRes.error,
        highRiskRes.error,
      ].filter(Boolean)
      if (errs.length > 0) {
        throw new Error(errs.map((e) => e!.message).join(' · '))
      }

      const findingRows = ((findingsRes.data ?? []) as { id: string; deviation_id: string | null; deleted_at?: string | null }[]).filter(
        (f) => f.deleted_at == null || String(f.deleted_at).trim() === '',
      )
      const devIds = [...new Set(findingRows.map((f) => f.deviation_id).filter(Boolean))] as string[]
      let openFindingsCount = findingRows.filter((f) => f.deviation_id == null).length
      if (devIds.length > 0) {
        const { data: devStatusRows, error: devErr } = await supabase
          .from('deviations')
          .select('id, status')
          .in('id', devIds)
        if (devErr) throw devErr
        const notClosed = new Set(
          (devStatusRows ?? [])
            .filter((r: { status: string }) => r.status !== 'lukket')
            .map((r: { id: string }) => r.id),
        )
        openFindingsCount += findingRows.filter((f) => f.deviation_id && notClosed.has(f.deviation_id)).length
      }

      const closedRows = (closedRowsRes.data ?? []) as { id: string; created_at: string; closed_at: string }[]
      let avgCloseDays: number | null = null
      if (closedRows.length > 0) {
        const ms = closedRows.map((r) => {
          const a = new Date(r.closed_at).getTime()
          const b = new Date(r.created_at).getTime()
          return a - b
        })
        const avgMs = ms.reduce((s, v) => s + v, 0) / ms.length
        avgCloseDays = avgMs / (1000 * 60 * 60 * 24)
      }

      setStats({
        roundsSignedThisYear: signedRes.count ?? 0,
        roundsDualSignoffThisYear: dualRes.count ?? 0,
        openFindingsCount,
        deviationCounts: {
          rapportert: devRapRes.count ?? 0,
          under_behandling: devUnderRes.count ?? 0,
          tiltak_iverksatt: devTiltakRes.count ?? 0,
          lukket: devLukketRes.count ?? 0,
        },
        avgCloseDays,
        highRiskFindingsThisYear: highRiskRes.count ?? 0,
      })
    } catch (e) {
      setStats(null)
      setError(e instanceof Error ? e.message : 'Kunne ikke laste statistikk.')
    } finally {
      setLoading(false)
    }
  }, [supabase, yearStart, yearEnd])

  useEffect(() => {
    void load()
  }, [load])

  const deviationTotal = useMemo(() => {
    if (!stats) return 0
    return STATUS_ORDER.reduce((s, k) => s + stats.deviationCounts[k], 0)
  }, [stats])

  async function handleExportAnnualReview() {
    setExportNote(null)
    if (!supabase || !organization?.id) {
      setExportNote('Opprett årsgjennomgang i Dokumenter → Maler')
      return
    }
    setExporting(true)
    try {
      const { data, error: qErr } = await supabase
        .from('wiki_annual_reviews')
        .select('id, year')
        .eq('organization_id', organization.id)
        .eq('year', year)
        .maybeSingle()
      if (qErr) throw qErr
      if (data?.id) {
        navigate(`/documents/aarsgjennomgang?year=${year}`)
      } else {
        setExportNote('Opprett årsgjennomgang i Dokumenter → Maler')
      }
    } catch {
      setExportNote('Opprett årsgjennomgang i Dokumenter → Maler')
    } finally {
      setExporting(false)
    }
  }

  const kpis: {
    value: string
    label: string
    sub: string
  }[] = stats
    ? [
        {
          value: String(stats.roundsSignedThisYear),
          label: 'Signerte runder i år',
          sub: `IK-f § 5 nr. 5 · fullført ${year}`,
        },
        {
          value: String(stats.roundsDualSignoffThisYear),
          label: 'Runder med dobbeltsignatur',
          sub: 'AML § 3-1 (2h) · leder + verneombud',
        },
        {
          value: String(stats.openFindingsCount),
          label: 'Åpne funn',
          sub: 'Uten lukket avvik · IK-f § 5',
        },
        {
          value: String(stats.deviationCounts.lukket),
          label: 'Avvik lukket (totalt)',
          sub: 'Status «lukket» i avviksmodulen',
        },
        {
          value: formatAvgDays(stats.avgCloseDays),
          label: 'Snitt tid til lukking',
          sub: 'Avvik med status lukket (closed_at − opprettet)',
        },
        {
          value: String(stats.highRiskFindingsThisYear),
          label: 'Høy/kritisk risiko-funn i år',
          sub: 'Risikoskår ≥ 10 · IK-f § 5',
        },
      ]
    : []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">HMS-statistikk for revisjon</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Tall Arbeidstilsynet ofte etterspør og som inngår i årlig gjennomgang ({year}).
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || !supabase}
          onClick={() => void handleExportAnnualReview()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#1a3d32] bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Eksporter til årsgjennomgang
        </button>
      </div>
      {exportNote && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {exportNote}
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
          Laster statistikk…
        </div>
      )}

      {!loading && stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {kpis.map((k) => (
              <div key={k.label} className={KPI_CARD}>
                <p className="text-3xl font-bold tabular-nums tracking-tight text-neutral-900">{k.value}</p>
                <p className="mt-2 text-sm font-medium text-neutral-800">{k.label}</p>
                <p className="mt-1 text-xs text-neutral-500">{k.sub}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-neutral-900">Avviksstatus</h4>
            <div className="flex h-10 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 text-[10px] font-semibold text-neutral-900 sm:text-xs">
              {deviationTotal === 0 ? (
                <div className="flex w-full items-center justify-center text-neutral-500">Ingen avvik registrert</div>
              ) : (
                STATUS_ORDER.filter((key) => stats.deviationCounts[key] > 0).map((key) => {
                  const n = stats.deviationCounts[key]
                  const pct = (n / deviationTotal) * 100
                  return (
                    <div
                      key={key}
                      title={`${STATUS_LABEL_NB[key]}: ${n}`}
                      className={`flex min-w-0 items-center justify-center px-1 text-center leading-tight ${STATUS_BAR_BG[key]}`}
                      style={{ width: `${pct}%` }}
                    >
                      <span className="truncate">{STATUS_LABEL_NB[key]}</span>
                    </div>
                  )
                })
              )}
            </div>
            {deviationTotal > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                {STATUS_ORDER.map((key) => (
                  <li key={key}>
                    <span className={`mr-1 inline-block size-2 rounded-sm ${STATUS_BAR_BG[key]}`} />
                    {STATUS_LABEL_NB[key]}: {stats.deviationCounts[key]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
