import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ghost } from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
import type { SurveyRow, SurveyStatus, SurveyType } from '../types'
import {
  surveyStatusBadgeVariant,
  surveyStatusLabel,
  surveyTypeBadgeVariant,
  surveyTypeLabel,
} from '../surveyLabels'

type Props = {
  surveys: SurveyRow[]
  loading: boolean
  canManage: boolean
  onNewSurvey: () => void
}

const STATUS_OPTIONS = [
  { value: '', label: 'Alle statuser' },
  { value: 'active', label: 'Aktiv' },
  { value: 'draft', label: 'Kladd' },
  { value: 'closed', label: 'Lukket' },
  { value: 'archived', label: 'Arkivert' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'Alle typer' },
  { value: 'internal', label: 'Ansatte' },
  { value: 'external', label: 'Leverandør' },
  { value: 'pulse', label: 'Puls' },
  { value: 'exit', label: 'Sluttsamtale' },
  { value: 'onboarding', label: 'Onboarding' },
]

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DateRange({ s }: { s: SurveyRow }) {
  if (s.start_date || s.end_date) {
    return <span>{formatDate(s.start_date)} – {formatDate(s.end_date)}</span>
  }
  if (s.status === 'active') {
    return <span className="text-neutral-400">Pågår</span>
  }
  return <span className="text-neutral-400">—</span>
}

export function SurveyKampanjerTab({ surveys, loading, canManage, onNewSurvey }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = surveys.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && s.survey_type !== filterType) return false
    if (filterStatus && s.status !== filterStatus) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1" style={{ minWidth: '180px' }}>
          <StandardInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i kampanjer…"
          />
        </div>
        <div style={{ minWidth: '140px' }}>
          <SearchableSelect
            value={filterType}
            options={TYPE_OPTIONS}
            onChange={setFilterType}
          />
        </div>
        <div style={{ minWidth: '140px' }}>
          <SearchableSelect
            value={filterStatus}
            options={STATUS_OPTIONS}
            onChange={setFilterStatus}
          />
        </div>
      </div>

      <LayoutTable1PostingsShell
        wrap
        title="Kampanjer"
        description="Alle organisasjonsundersøkelser — ansatte og leverandører."
        headerActions={
          canManage ? (
            <Button type="button" variant="primary" size="sm" onClick={onNewSurvey}>
              Ny undersøkelse
            </Button>
          ) : null
        }
        toolbar={<span className="text-xs text-neutral-500">{filtered.length} kampanjer</span>}
      >
        {loading && filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">Laster…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Ghost className="h-12 w-12 text-neutral-300" strokeWidth={1.25} aria-hidden />
            <p className="max-w-sm text-sm text-neutral-500">
              {search || filterType || filterStatus
                ? 'Ingen kampanjer matcher filteret.'
                : 'Ingen undersøkelser opprettet ennå.'}
            </p>
            {canManage && !search && !filterType && !filterStatus && (
              <Button type="button" variant="primary" size="sm" onClick={onNewSurvey}>
                Opprett første undersøkelse
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kampanje</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Periode</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                  <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handling</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                      <span
                        className="cursor-pointer font-medium text-[#1a3d32] hover:underline"
                        onClick={() => navigate(`/survey/${s.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/survey/${s.id}`)}
                      >
                        {s.title}
                      </span>
                      {s.description && (
                        <span className="ml-1 block max-w-md truncate text-xs text-neutral-500">
                          {s.description}
                        </span>
                      )}
                      {s.vendor_name && (
                        <span className="block text-xs text-neutral-400">{s.vendor_name}</span>
                      )}
                    </td>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                      <Badge variant={surveyTypeBadgeVariant(s.survey_type)}>
                        {surveyTypeLabel(s.survey_type)}
                      </Badge>
                    </td>
                    <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-500`}>
                      <DateRange s={s} />
                    </td>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                      <Badge variant={surveyStatusBadgeVariant(s.status)}>
                        {surveyStatusLabel(s.status)}
                      </Badge>
                    </td>
                    <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/survey/${s.id}`)}
                      >
                        Åpne
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LayoutTable1PostingsShell>
    </div>
  )
}
