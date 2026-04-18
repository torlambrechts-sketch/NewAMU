import { useState } from 'react'
import type { RosAnalysisRow } from './types'
import {
  ROS_TYPE_LABEL, ALL_LAW_DOMAINS, LAW_DOMAIN_CHIP_ACTIVE,
} from './types'
import type { RosLawDomain, RosType } from './types'
import type { RosState } from './useRos'

const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'
const INPUT = 'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]/30'
const BTN_PRIMARY = 'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'

export function RosScopeTab({ analysis, ros }: { analysis: RosAnalysisRow; ros: RosState }) {
  const readOnly = analysis.status === 'approved' || analysis.status === 'archived'

  const [title,         setTitle]         = useState(analysis.title)
  const [description,   setDescription]   = useState(analysis.description ?? '')
  const [scope,         setScope]         = useState(analysis.scope ?? '')
  const [assessorName,  setAssessorName]  = useState(analysis.assessor_name ?? '')
  const [assessedAt,    setAssessedAt]    = useState(analysis.assessed_at ?? '')
  const [nextReview,    setNextReview]    = useState(analysis.next_review_date ?? '')
  const [lawDomains,    setLawDomains]    = useState<RosLawDomain[]>(analysis.law_domains)
  const [rosType,       setRosType]       = useState<RosType>(analysis.ros_type)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)

  async function handleSave() {
    setSaving(true)
    await ros.updateAnalysis(analysis.id, {
      title, description: description || null, scope: scope || null,
      assessor_name: assessorName || null, assessed_at: assessedAt || null,
      next_review_date: nextReview || null,
      law_domains: lawDomains,
      ros_type: rosType,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 px-5 py-5 md:px-8">
      {/* Legal info box */}
      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] p-4">
        <p className="text-xs font-semibold text-[#1a3d32]">IK-forskriften § 5 nr. 6 — kartlegging av farer og problemer</p>
        <p className="mt-1 text-xs text-neutral-500">
          Virksomheten skal kartlegge farer og problemer, vurdere risiko og utarbeide tilhørende planer og tiltak
          for å redusere risikoforholdene. Gjelder på tvers av AML, BVL, ETL, FL og PKL.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={FIELD_LABEL}>Tittel *</span>
          <input value={title} readOnly={readOnly} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>Analysetype</span>
          <select value={rosType} disabled={readOnly} onChange={(e) => setRosType(e.target.value as RosType)}
            className={INPUT}>
            {Object.entries(ROS_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>Ansvarlig for analysen</span>
          <input value={assessorName} readOnly={readOnly} onChange={(e) => setAssessorName(e.target.value)}
            placeholder="Navn eller rolle…" className={INPUT} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>Analysedato</span>
          <input type="date" value={assessedAt} readOnly={readOnly} onChange={(e) => setAssessedAt(e.target.value)}
            className={INPUT} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>Neste revisjon</span>
          <input type="date" value={nextReview} readOnly={readOnly} onChange={(e) => setNextReview(e.target.value)}
            className={INPUT} />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={FIELD_LABEL}>Omfang og avgrensning</span>
          <textarea rows={3} value={scope} readOnly={readOnly} onChange={(e) => setScope(e.target.value)}
            placeholder="Beskriv hva analysen dekker, hvilke arbeidsoperasjoner, lokasjoner og tidsperiode…"
            className={`${INPUT} resize-none`} />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className={FIELD_LABEL}>Bakgrunn og metode</span>
          <textarea rows={3} value={description} readOnly={readOnly} onChange={(e) => setDescription(e.target.value)}
            placeholder="Bakgrunn for analysen, metode brukt (HAZOP, grov risikoanalyse, …)…"
            className={`${INPUT} resize-none`} />
        </label>

        {/* Law domain selector */}
        <div className="md:col-span-2">
          <p className={FIELD_LABEL + ' mb-2'}>Gjeldende lovverk (velg alle som er relevante)</p>
          <div className="flex flex-wrap gap-2">
            {ALL_LAW_DOMAINS.map((d) => {
              const active = lawDomains.includes(d)
              return (
                <button key={d} type="button" disabled={readOnly}
                  onClick={() => setLawDomains((prev) =>
                    active ? prev.filter((x) => x !== d) : [...prev, d]
                  )}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                    active
                      ? LAW_DOMAIN_CHIP_ACTIVE[d]
                      : 'border-neutral-300 bg-white text-neutral-600'
                  }`}>
                  {d}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">
            AML=Arbeidsmiljø · BVL=Brann · ETL=El-tilsyn · FL=Forurensning · PKL=Produktkontroll
          </p>
        </div>
      </div>

      {!readOnly && (
        <button type="button" onClick={() => void handleSave()} disabled={saving} className={BTN_PRIMARY}>
          {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre omfang'}
        </button>
      )}
    </div>
  )
}
