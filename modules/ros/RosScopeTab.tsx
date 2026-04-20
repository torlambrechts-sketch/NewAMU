import { useMemo, useState } from 'react'
import type { RosAnalysisRow } from './types'
import { ROS_TYPE_LABEL, ALL_LAW_DOMAINS, LAW_DOMAIN_CHIP_ACTIVE } from './types'
import type { RosLawDomain, RosType } from './types'
import type { RosState } from './useRos'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Button } from '../../src/components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'

export function RosScopeTab({ analysis, ros }: { analysis: RosAnalysisRow; ros: RosState }) {
  const readOnly = analysis.status === 'approved' || analysis.status === 'archived'

  const [title, setTitle] = useState(analysis.title)
  const [description, setDescription] = useState(analysis.description ?? '')
  const [scope, setScope] = useState(analysis.scope ?? '')
  const [assessorName, setAssessorName] = useState(analysis.assessor_name ?? '')
  const [assessedAt, setAssessedAt] = useState(analysis.assessed_at ?? '')
  const [nextReview, setNextReview] = useState(analysis.next_review_date ?? '')
  const [lawDomains, setLawDomains] = useState<RosLawDomain[]>(analysis.law_domains)
  const [rosType, setRosType] = useState<RosType>(analysis.ros_type)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const rosTypeOptions: SelectOption[] = useMemo(
    () => Object.entries(ROS_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v })),
    [],
  )

  async function handleSave() {
    setSaving(true)
    await ros.updateAnalysis(analysis.id, {
      title,
      description: description || null,
      scope: scope || null,
      assessor_name: assessorName || null,
      assessed_at: assessedAt || null,
      next_review_date: nextReview || null,
      law_domains: lawDomains,
      ros_type: rosType,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col">
      <ComplianceBanner
        title="IK-forskriften § 5 nr. 6 — kartlegging av farer og problemer"
        className="border-b border-[#1a3d32]/20"
      >
        <p>
          Virksomheten skal kartlegge farer og problemer, vurdere risiko og utarbeide tilhørende planer og tiltak for å
          redusere risikoforholdene. Gjelder på tvers av arbeidsmiljøloven (AML), brann- og eksplosjonsvernloven (BVL),
          el-tilsynsloven (ETL), forurensningsloven (FL) og produktkontrolloven (PKL).
        </p>
      </ComplianceBanner>

      <div className="space-y-6 p-5 md:p-6">
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className="md:col-span-2">
            <span className={WPSTD_FORM_FIELD_LABEL}>Tittel *</span>
            <StandardInput value={title} readOnly={readOnly} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label>
            <span className={WPSTD_FORM_FIELD_LABEL}>Analysetype</span>
            <SearchableSelect
              value={rosType}
              options={rosTypeOptions}
              disabled={readOnly}
              onChange={(v) => setRosType(v as RosType)}
            />
          </label>

          <label>
            <span className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig for analysen</span>
            <StandardInput
              value={assessorName}
              readOnly={readOnly}
              onChange={(e) => setAssessorName(e.target.value)}
              placeholder="Navn eller rolle…"
            />
          </label>

          <label>
            <span className={WPSTD_FORM_FIELD_LABEL}>Analysedato</span>
            <StandardInput type="date" value={assessedAt} readOnly={readOnly} onChange={(e) => setAssessedAt(e.target.value)} />
          </label>

          <label>
            <span className={WPSTD_FORM_FIELD_LABEL}>Neste revisjon</span>
            <StandardInput type="date" value={nextReview} readOnly={readOnly} onChange={(e) => setNextReview(e.target.value)} />
          </label>

          <label className="md:col-span-2">
            <span className={WPSTD_FORM_FIELD_LABEL}>Omfang og avgrensning</span>
            <StandardTextarea
              rows={3}
              value={scope}
              readOnly={readOnly}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Beskriv hva analysen dekker, hvilke arbeidsoperasjoner, lokasjoner og tidsperiode…"
            />
          </label>

          <label className="md:col-span-2">
            <span className={WPSTD_FORM_FIELD_LABEL}>Bakgrunn og metode</span>
            <StandardTextarea
              rows={3}
              value={description}
              readOnly={readOnly}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bakgrunn for analysen, metode brukt (HAZOP, grov risikoanalyse, …)…"
            />
          </label>

          <div className="md:col-span-2">
            <p className={`${WPSTD_FORM_FIELD_LABEL} mb-2`}>Gjeldende lovverk (velg alle som er relevante)</p>
            <div className="flex flex-wrap gap-2">
              {ALL_LAW_DOMAINS.map((d) => {
                const active = lawDomains.includes(d)
                return (
                  <Button
                    key={d}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={readOnly}
                    onClick={() =>
                      setLawDomains((prev) => (active ? prev.filter((x) => x !== d) : [...prev, d]))
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
            <p className="mt-1 text-[10px] text-neutral-500">
              AML=Arbeidsmiljø · BVL=Brann · ETL=El-tilsyn · FL=Forurensning · PKL=Produktkontroll
            </p>
          </div>
        </div>

        {!readOnly && (
          <Button variant="primary" type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre omfang'}
          </Button>
        )}
      </div>
    </div>
  )
}
