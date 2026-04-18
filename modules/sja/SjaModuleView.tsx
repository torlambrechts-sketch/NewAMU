import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ChevronRight, Search, Settings } from 'lucide-react'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { useSja } from './useSja'
import type { SjaAnalysis, SjaJobType } from './types'

const JOB_TYPE_LABEL: Record<SjaJobType, string> = {
  hot_work: 'Varmt arbeid',
  confined_space: 'Arbeid i trange rom',
  work_at_height: 'Arbeid i høyden',
  electrical: 'Elektrisk arbeid',
  lifting: 'Løft / rigging',
  excavation: 'Graving',
  custom: 'Annet',
}

const STATUS_LABEL: Record<SjaAnalysis['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  approved: 'Godkjent',
  in_execution: 'Under utførelse',
  completed: 'Fullført',
  archived: 'Arkivert',
  stopped: 'Stoppet',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return iso
  }
}

export function SjaModuleView({ supabase }: { supabase: SupabaseClient | null }) {
  const navigate = useNavigate()
  const sja = useSja({ supabase })
  const [search, setSearch] = useState('')
  const [deviationCountBySjaId, setDeviationCountBySjaId] = useState<Record<string, number>>({})

  useEffect(() => {
    void sja.load()
  }, [sja.load])

  const analyses = useMemo(
    () => sja.analyses.filter((a) => a.deleted_at == null || String(a.deleted_at).trim() === ''),
    [sja.analyses],
  )

  useEffect(() => {
    if (!supabase || analyses.length === 0) {
      setDeviationCountBySjaId({})
      return
    }
    let cancelled = false
    void (async () => {
      const ids = analyses.map((a) => a.id)
      const { data, error } = await supabase
        .from('deviations')
        .select('source_id')
        .in('source_id', ids)
        .is('deleted_at', null)
      if (cancelled || error) {
        if (!cancelled) setDeviationCountBySjaId({})
        return
      }
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const sid = (row as { source_id?: string | null }).source_id
        if (typeof sid === 'string' && sid) counts[sid] = (counts[sid] ?? 0) + 1
      }
      setDeviationCountBySjaId(counts)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, analyses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return analyses
    return analyses.filter((a) => {
      const loc = sja.locations.find((l) => l.id === a.location_id)?.name ?? ''
      return (
        a.title.toLowerCase().includes(q) ||
        a.job_description.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q)
      )
    })
  }, [analyses, search, sja.locations])

  return (
    <div className="space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'Sikker jobbanalyse' }]}
        title="Sikker jobbanalyse"
        description="Oversikt over SJA-er i organisasjonen."
        headerActions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sja/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Innstillinger
            </Link>
          </div>
        }
      />

      <LayoutTable1PostingsShell
        wrap
        title="Analyser"
        description="Åpne en SJA for redigering og signering."
        toolbar={
          <div className="relative min-w-[200px] flex-1">
            <label className="sr-only" htmlFor="sja-search">
              Søk
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="sja-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel, beskrivelse, lokasjon …"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
        }
        footer={
          <span className="text-neutral-500">
            {search.trim() ? `${filtered.length} treff` : `Viser ${filtered.length} analyser`}
          </span>
        }
      >
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Jobbtype</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Lokasjon</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Opprettet</th>
              <th className={`w-24 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
              <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const locName = a.location_id ? sja.locations.find((l) => l.id === a.location_id)?.name ?? '—' : a.location_text ?? '—'
              const nAvvik = deviationCountBySjaId[a.id] ?? 0
              return (
                <tr
                  key={a.id}
                  className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                  onClick={() => navigate(`/sja/${a.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-neutral-900">{a.title}</td>
                  <td className="px-5 py-3 text-neutral-600">{JOB_TYPE_LABEL[a.job_type as SjaJobType] ?? a.job_type}</td>
                  <td className="px-5 py-3 text-neutral-600">{locName}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-800">
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">{formatDate(a.created_at)}</td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {nAvvik > 0 ? (
                      <Link
                        to={`/avvik?sourceId=${encodeURIComponent(a.id)}`}
                        className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {nAvvik} avvik
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="w-8 px-3 py-3 text-neutral-300">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-neutral-500">
                  {sja.loading ? 'Laster…' : 'Ingen SJA-er ennå.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>
    </div>
  )
}
