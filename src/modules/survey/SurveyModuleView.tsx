import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ClipboardList, Plus, Calendar, ChevronRight, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSurvey } from './useSurvey'
import type { SurveyCampaignRow, SurveyPillar } from './types'
import { PILLAR_LABEL, PILLAR_COLOR, STATUS_LABEL, STATUS_COLOR } from './types'

const BTN_PRIMARY =
  'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'
const INPUT =
  'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30'
const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

type Props = { supabase: SupabaseClient | null }

export function SurveyModuleView({ supabase }: Props) {
  const survey = useSurvey({ supabase })
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', pillar: 'psychosocial' as SurveyPillar, closesAt: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void survey.loadList()
  }, [survey.loadList])

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setCreating(true)
    const campaign = await survey.createCampaign({
      title: form.title,
      pillar: form.pillar,
      closesAt: form.closesAt || undefined,
    })
    setCreating(false)
    if (campaign) {
      setShowNew(false)
      navigate(`/survey/${campaign.id}`)
    }
  }

  const open = survey.campaigns.filter((c) => c.status === 'open')
  const draft = survey.campaigns.filter((c) => c.status === 'draft')
  const closed = survey.campaigns.filter((c) => c.status === 'closed')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3d32]">Organisasjonsundersøkelser</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Systematisk kartlegging av arbeidsmiljøet — AML § 3-1, § 4-1, § 4-3, § 4-4
          </p>
        </div>
        <button type="button" onClick={() => setShowNew(true)} className={BTN_PRIMARY}>
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Ny undersøkelse
          </span>
        </button>
      </div>

      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] px-4 py-3 text-sm text-[#1a3d32]">
        <strong>Lovkrav:</strong> AML § 3-1 pålegger systematisk HMS-arbeid. Organisasjonsundersøkelse skal
        gjennomføres regelmessig (anbefalt hvert 12–24 mnd), presenteres for AMU og vernombud (AML § 7-2), og
        resultere i konkrete tiltak ved avvik (IK-forskriften § 5). GDPR: resultater vises aldri for grupper med
        færre enn fem respondenter.
      </div>

      {survey.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{survey.error}</span>
          <button type="button" onClick={survey.clearError} className="ml-auto text-red-600 hover:text-red-800">
            ✕
          </button>
        </div>
      )}

      {showNew && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[#1a3d32]">Ny undersøkelse</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={FIELD_LABEL}>Tittel *</label>
              <input
                className={INPUT}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="f.eks. Arbeidsmiljøundersøkelse 2026"
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Kartleggingspilar</label>
              <select
                className={INPUT}
                value={form.pillar}
                onChange={(e) => setForm((p) => ({ ...p, pillar: e.target.value as SurveyPillar }))}
              >
                {(Object.entries(PILLAR_LABEL) as [SurveyPillar, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Stenger (valgfritt)</label>
              <input
                type="date"
                className={INPUT}
                value={form.closesAt}
                onChange={(e) => setForm((p) => ({ ...p, closesAt: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleCreate} disabled={creating || !form.title.trim()} className={BTN_PRIMARY}>
              {creating ? 'Oppretter…' : 'Opprett undersøkelse'}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {survey.campaigns.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Totalt', value: survey.campaigns.length, color: 'text-[#1a3d32]' },
            { label: 'Åpne', value: open.length, color: 'text-emerald-700' },
            { label: 'Kladd', value: draft.length, color: 'text-neutral-600' },
            { label: 'Avsluttet', value: closed.length, color: 'text-blue-700' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="mt-1 text-xs text-neutral-500">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {survey.loading && survey.campaigns.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-400">Laster undersøkelser…</div>
      ) : survey.campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <p className="text-sm font-medium text-neutral-500">Ingen undersøkelser ennå</p>
          <p className="mt-1 text-xs text-neutral-400">Klikk «Ny undersøkelse» for å komme i gang</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="py-3 pl-4 pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Undersøkelse
                </th>
                <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Pilar</th>
                <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Status</th>
                <th className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Stenger</th>
                <th className="px-2 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500">Resultat</th>
                <th className="w-8 py-3 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {survey.campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} onClick={() => navigate(`/survey/${c.id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CampaignRow({ campaign: c, onClick }: { campaign: SurveyCampaignRow; onClick: () => void }) {
  const closes = c.closes_at ? new Date(c.closes_at).toLocaleDateString('nb-NO') : '–'
  return (
    <tr onClick={onClick} className="cursor-pointer transition-colors hover:bg-neutral-50">
      <td className="py-3 pl-4 pr-2 font-medium text-[#1a3d32]">{c.title}</td>
      <td className="px-2 py-3">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PILLAR_COLOR[c.pillar]}`}
        >
          {PILLAR_LABEL[c.pillar]}
        </span>
      </td>
      <td className="px-2 py-3">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[c.status]}`}
        >
          {STATUS_LABEL[c.status]}
        </span>
      </td>
      <td className="px-2 py-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {closes}
        </span>
      </td>
      <td className="px-2 py-3 text-right text-xs font-medium text-neutral-400">–</td>
      <td className="pr-4 text-right">
        <ChevronRight className="ml-auto h-4 w-4 text-neutral-400" />
      </td>
    </tr>
  )
}
