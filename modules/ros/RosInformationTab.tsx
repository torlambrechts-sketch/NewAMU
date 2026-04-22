import { useMemo, useState } from 'react'
import type { RosAnalysisRow } from './types'
import { ROS_TYPE_LABEL, ALL_LAW_DOMAINS, LAW_DOMAIN_CHIP_ACTIVE } from './types'
import type { RosLawDomain, RosType } from './types'
import type { RosState } from './useRos'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Button } from '../../src/components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { ModuleInformationCard } from '../../src/components/module/ModuleInformationCard'

export function RosInformationTab({ analysis, ros }: { analysis: RosAnalysisRow; ros: RosState }) {
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

  const lawDomainChips = (
    <div>
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
  )

  return (
    <ModuleInformationCard
      withCard={false}
      title="IK-forskriften § 5 nr. 6 — kartlegging av farer og problemer"
      description={
        <p>
          Virksomheten skal kartlegge farer og problemer, vurdere risiko og utarbeide tilhørende planer og
          tiltak for å redusere risikoforholdene. Gjelder på tvers av arbeidsmiljøloven (AML), brann- og
          eksplosjonsvernloven (BVL), el-tilsynsloven (ETL), forurensningsloven (FL) og produktkontrolloven
          (PKL).
        </p>
      }
      rows={[
        {
          id: 'title',
          label: 'Tittel',
          required: true,
          value: (
            <StandardInput value={title} readOnly={readOnly} onChange={(e) => setTitle(e.target.value)} />
          ),
        },
        {
          id: 'ros_type',
          label: 'Analysetype',
          value: (
            <SearchableSelect
              value={rosType}
              options={rosTypeOptions}
              disabled={readOnly}
              onChange={(v) => setRosType(v as RosType)}
            />
          ),
        },
        {
          id: 'assessor_name',
          label: 'Ansvarlig for analysen',
          value: (
            <StandardInput
              value={assessorName}
              readOnly={readOnly}
              onChange={(e) => setAssessorName(e.target.value)}
              placeholder="Navn eller rolle…"
            />
          ),
        },
        {
          id: 'assessed_at',
          label: 'Analysedato',
          value: (
            <StandardInput
              type="date"
              value={assessedAt}
              readOnly={readOnly}
              onChange={(e) => setAssessedAt(e.target.value)}
            />
          ),
        },
        {
          id: 'next_review_date',
          label: 'Neste revisjon',
          value: (
            <StandardInput
              type="date"
              value={nextReview}
              readOnly={readOnly}
              onChange={(e) => setNextReview(e.target.value)}
            />
          ),
        },
        {
          id: 'scope',
          label: 'Omfang og avgrensning',
          value: (
            <StandardTextarea
              rows={3}
              value={scope}
              readOnly={readOnly}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Beskriv hva analysen dekker, hvilke arbeidsoperasjoner, lokasjoner og tidsperiode…"
            />
          ),
        },
        {
          id: 'description',
          label: 'Bakgrunn og metode',
          value: (
            <StandardTextarea
              rows={3}
              value={description}
              readOnly={readOnly}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bakgrunn for analysen, metode brukt (HAZOP, grov risikoanalyse, …)…"
            />
          ),
        },
        {
          id: 'law_domains',
          label: 'Gjeldende lovverk',
          value: lawDomainChips,
        },
      ]}
      footer={
        !readOnly ? (
          <div className="flex justify-end">
            <Button
              variant="primary"
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre omfang'}
            </Button>
          </div>
        ) : null
      }
    />
  )
}
