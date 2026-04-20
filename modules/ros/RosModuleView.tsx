import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Settings } from 'lucide-react'
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
import { ROS_STATUS_LABEL, ROS_TYPE_LABEL, ALL_LAW_DOMAINS, LAW_DOMAIN_BG, LAW_DOMAIN_CHIP_ACTIVE } from './types'
import type { RosLawDomain, RosType, RosStatus } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { Badge } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'

type CreateAnalysisForm = {
  title: string
  ros_type: RosType
  law_domains: RosLawDomain[]
  description: string
  template_id: string
}

const emptyCreateForm = (): CreateAnalysisForm => ({
  title: '',
  ros_type: 'general',
  law_domains: ['AML'],
  description: '',
  template_id: '',
})

function rosStatusBadgeVariant(status: RosStatus) {
  switch (status) {
    case 'draft':
      return 'draft' as const
    case 'in_review':
      return 'info' as const
    case 'approved':
      return 'success' as const
    case 'archived':
      return 'neutral' as const
    default:
      return 'neutral' as const
  }
}

export function RosModuleView({ supabase }: { supabase: SupabaseClient | null }) {
  const navigate = useNavigate()
  const ros = useRos({ supabase })
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateAnalysisForm>(emptyCreateForm)

  const stats = useMemo(() => {
    let open = 0
    let approved = 0
    for (const a of ros.analyses) {
      if (a.status === 'draft' || a.status === 'in_review') open++
      if (a.status === 'approved') approved++
    }
    return { open, critical: ros.criticalHazardCount, approved, total: ros.analyses.length }
  }, [ros.analyses, ros.criticalHazardCount])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ros.analyses
    return ros.analyses.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || ROS_TYPE_LABEL[a.ros_type].toLowerCase().includes(q),
    )
  }, [ros.analyses, search])

  const rosTypeOptions: SelectOption[] = useMemo(
    () => Object.entries(ROS_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v })),
    [],
  )

  const templateOptions: SelectOption[] = useMemo(() => {
    const rows = ros.templates.filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name }))
    return [{ value: '', label: '(ingen mal)' }, ...rows]
  }, [ros.templates])

  return (
    <div className="space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'ROS-analyser' }]}
        title="Risikovurderinger"
        description="Kartlegg og dokumenter risikoer i henhold til IK-forskriften § 5 nr. 6 på tvers av AML, BVL, ETL, FL og PKL."
        headerActions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/ros/admin')}>
              <Settings className="h-4 w-4" />
              Innstillinger
            </Button>
            <Button variant="primary" type="button" onClick={() => setCreateOpen(true)}>
              + Ny analyse
            </Button>
          </div>
        }
      />

      <LayoutScoreStatRow
        items={[
          { big: String(stats.open), title: 'Åpne analyser', sub: 'Utkast, gjennomgang og signert' },
          { big: String(stats.critical), title: 'Kritiske farekilder', sub: 'Risikoskår ≥ 15 i organisasjonen' },
          { big: String(stats.approved), title: 'Godkjente', sub: 'Begge signaturer registrert' },
          { big: String(stats.total), title: 'Totalt', sub: 'Alle analyser' },
        ]}
      />

      {ros.error && <WarningBox>{ros.error}</WarningBox>}

      <LayoutTable1PostingsShell
        wrap
        title="Analyser"
        description="Alle risikovurderinger sortert etter siste aktivitet."
        toolbar={
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel, type…"
              className="py-2 pl-10"
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
                  <Badge variant={rosStatusBadgeVariant(a.status)}>{ROS_STATUS_LABEL[a.status]}</Badge>
                </td>
                <td className="px-5 py-3 text-neutral-600">
                  {a.assessed_at ? new Date(a.assessed_at).toLocaleDateString('nb-NO') : '—'}
                </td>
                <td className="px-5 py-3 text-neutral-600">
                  {a.next_review_date ? (
                    (() => {
                      const d = new Date(a.next_review_date)
                      const overdue = d < new Date()
                      return (
                        <span className={overdue ? 'font-semibold text-red-600' : ''}>
                          {d.toLocaleDateString('nb-NO')}
                          {overdue && ' ⚠'}
                        </span>
                      )
                    })()
                  ) : (
                    '—'
                  )}
                </td>
                <td className="w-8 px-3 py-3 text-neutral-300">›</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-neutral-400">
                  {ros.loading ? 'Laster…' : 'Ingen analyser funnet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleId="ros-create"
        title="Ny risikovurdering"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!form.title.trim() || form.law_domains.length === 0}
              onClick={async () => {
                const id = await ros.createAnalysis({
                  title: form.title,
                  ros_type: form.ros_type,
                  law_domains: form.law_domains,
                  description: form.description || undefined,
                })
                if (id && form.template_id) {
                  await ros.applyTemplateToAnalysis(id, form.template_id)
                }
                if (id) {
                  setCreateOpen(false)
                  navigate(`/ros/${id}`)
                }
              }}
            >
              Opprett
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Tittel *</span>
            <StandardInput
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Beskriv hva som skal vurderes…"
            />
          </label>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">Type</p>
            <SearchableSelect value={form.ros_type} options={rosTypeOptions} onChange={(v) => setForm((p) => ({ ...p, ros_type: v as RosType }))} />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">Standardmal (valgfritt)</p>
            <SearchableSelect
              value={form.template_id}
              options={templateOptions}
              placeholder="Velg mal…"
              onChange={(v) => setForm((p) => ({ ...p, template_id: v }))}
            />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">Lovverk (velg alle som gjelder)</p>
            <div className="flex flex-wrap gap-2">
              {ALL_LAW_DOMAINS.map((d) => {
                const active = form.law_domains.includes(d)
                return (
                  <Button
                    key={d}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        law_domains: active ? p.law_domains.filter((x) => x !== d) : [...p.law_domains, d],
                      }))
                    }
                    className={
                      active
                        ? `${LAW_DOMAIN_CHIP_ACTIVE[d]} border-transparent`
                        : 'border-neutral-300 bg-white text-neutral-600'
                    }
                  >
                    {d}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </FormModal>
    </div>
  )
}
