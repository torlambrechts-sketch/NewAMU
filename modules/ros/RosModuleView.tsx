import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { FormModal } from '../../src/template'
import { useRos } from './useRos'
import {
  ROS_STATUS_LABEL, ROS_STATUS_COLOR, ROS_TYPE_LABEL,
  ALL_LAW_DOMAINS, LAW_DOMAIN_BG, LAW_DOMAIN_CHIP_ACTIVE,
} from './types'
import type { RosLawDomain, RosType } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

const BTN_PRIMARY = 'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'
const BTN_SECONDARY = 'rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors'

export function RosModuleView({ supabase }: { supabase: SupabaseClient | null }) {
  const navigate = useNavigate()
  const ros = useRos({ supabase })
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    ros_type: 'general' as const,
    law_domains: ['AML'] as RosLawDomain[],
    description: '',
  })

  const stats = useMemo(() => {
    let open = 0, critical = 0, approved = 0
    for (const a of ros.analyses) {
      if (a.status === 'draft' || a.status === 'in_review') open++
      if (a.status === 'approved') approved++
    }
    return { open, critical, approved, total: ros.analyses.length }
  }, [ros.analyses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ros.analyses
    return ros.analyses.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      ROS_TYPE_LABEL[a.ros_type].toLowerCase().includes(q),
    )
  }, [ros.analyses, search])

  return (
    <div className="space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser' }]}
        title="Risikovurderinger"
        description="Kartlegg og dokumenter risikoer i henhold til IK-forskriften § 5 nr. 6 på tvers av AML, BVL, ETL, FL og PKL."
        headerActions={
          <button type="button" onClick={() => setCreateOpen(true)} className={BTN_PRIMARY}>
            + Ny analyse
          </button>
        }
      />

      <LayoutScoreStatRow items={[
        { big: String(stats.open),     title: 'Åpne analyser',    sub: 'Utkast og til gjennomgang' },
        { big: String(stats.critical), title: 'Kritisk risiko',   sub: 'Risikoscore ≥ 15 — tiltak påkrevd' },
        { big: String(stats.approved), title: 'Godkjente',        sub: 'Dobbelt-signert og arkivert' },
        { big: String(stats.total),    title: 'Totalt',           sub: 'Alle analyser' },
      ]} />

      {ros.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {ros.error}
        </div>
      )}

      <LayoutTable1PostingsShell
        wrap title="Analyser"
        description="Alle risikovurderinger sortert etter siste aktivitet."
        toolbar={
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel, type…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
        }
        footer={<span className="text-neutral-500">{filtered.length} analyser</span>}
      >
        <table className="w-full min-w-[700px] border-collapse text-left text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Lovverk</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Vurdert</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Neste revisjon</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                onClick={() => navigate(`/ros/${a.id}`)}
              >
                <td className="px-5 py-3 font-medium text-neutral-900">{a.title}</td>
                <td className="px-5 py-3 text-neutral-600">{ROS_TYPE_LABEL[a.ros_type]}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.law_domains.map((d) => (
                      <span key={d} className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${LAW_DOMAIN_BG[d]}`}>
                        {d}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROS_STATUS_COLOR[a.status]}`}>
                    {ROS_STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-neutral-600">
                  {a.assessed_at ? new Date(a.assessed_at).toLocaleDateString('nb-NO') : '—'}
                </td>
                <td className="px-5 py-3 text-neutral-600">
                  {a.next_review_date
                    ? (() => {
                        const d = new Date(a.next_review_date)
                        const overdue = d < new Date()
                        return <span className={overdue ? 'font-semibold text-red-600' : ''}>
                          {d.toLocaleDateString('nb-NO')}
                          {overdue && ' ⚠'}
                        </span>
                      })()
                    : '—'}
                </td>
                <td className="w-8 px-3 py-3 text-neutral-300">›</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-neutral-400">
                {ros.loading ? 'Laster…' : 'Ingen analyser funnet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>

      {/* Create modal */}
      <FormModal open={createOpen} onClose={() => setCreateOpen(false)}
        titleId="ros-create" title="Ny risikovurdering"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN_SECONDARY} onClick={() => setCreateOpen(false)}>Avbryt</button>
            <button type="button" className={BTN_PRIMARY}
              disabled={!form.title.trim() || form.law_domains.length === 0}
              onClick={async () => {
                const id = await ros.createAnalysis(form)
                if (id) { setCreateOpen(false); navigate(`/ros/${id}`) }
              }}
            >Opprett</button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Tittel *</span>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Beskriv hva som skal vurderes…"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]/30" />
          </label>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 mb-2">Type</p>
            <select value={form.ros_type} onChange={(e) => setForm((p) => ({ ...p, ros_type: e.target.value as RosType }))}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-[#1a3d32] focus:outline-none">
              {Object.entries(ROS_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 mb-2">Lovverk (velg alle som gjelder)</p>
            <div className="flex flex-wrap gap-2">
              {ALL_LAW_DOMAINS.map((d) => {
                const active = form.law_domains.includes(d)
                return (
                  <button key={d} type="button"
                    onClick={() => setForm((p) => ({
                      ...p,
                      law_domains: active ? p.law_domains.filter((x) => x !== d) : [...p.law_domains, d],
                    }))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? LAW_DOMAIN_CHIP_ACTIVE[d]
                        : 'border-neutral-300 bg-white text-neutral-600'
                    }`}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </FormModal>
    </div>
  )
}
