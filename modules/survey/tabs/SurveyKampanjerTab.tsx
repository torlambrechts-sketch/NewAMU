import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Ghost, Search } from 'lucide-react'
import {
  ModuleRecordsTableShell,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
import type { SurveyRow } from '../types'
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

  const kpiItems = useMemo(() => {
    const active = surveys.filter((s) => s.status === 'active').length
    const drafts = surveys.filter((s) => s.status === 'draft').length
    const external = surveys.filter((s) => s.survey_type === 'external').length
    return [
      { big: String(active), title: 'Aktive', sub: 'Publisert og åpen' },
      { big: String(drafts), title: 'Kladder', sub: 'Ikke publisert' },
      { big: String(external), title: 'Leverandør', sub: 'Eksterne undersøkelser' },
      { big: String(surveys.length), title: 'Totalt', sub: 'Alle kampanjer' },
    ]
  }, [surveys])

  return (
    <div className="space-y-4">
      <ModuleRecordsTableShell
        kpiItems={kpiItems}
        kpiRowProps={{ columns: 4 }}
        title="Kampanjer"
        description="Alle organisasjonsundersøkelser — ansatte og leverandører."
        titleTypography="sans"
        headerActions={
          canManage ? (
            <Button type="button" variant="primary" size="sm" onClick={onNewSurvey}>
              Ny undersøkelse
            </Button>
          ) : null
        }
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <label className="sr-only" htmlFor="survey-campaign-search">
                Søk
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <StandardInput
                id="survey-campaign-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk i tittel…"
                className="py-2 pl-10"
              />
            </div>
            <div className="min-w-[140px]">
              <SearchableSelect value={filterType} options={TYPE_OPTIONS} onChange={setFilterType} />
            </div>
            <div className="min-w-[140px]">
              <SearchableSelect value={filterStatus} options={STATUS_OPTIONS} onChange={setFilterStatus} />
            </div>
          </div>
        }
        footer={
          <span className="text-neutral-500">
            {search.trim() || filterType || filterStatus
              ? `${filtered.length} treff`
              : `Viser ${filtered.length} kampanjer`}
          </span>
        }
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
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className={MODULE_TABLE_TH}>Kampanje</th>
                  <th className={MODULE_TABLE_TH}>Type</th>
                  <th className={MODULE_TABLE_TH}>Periode</th>
                  <th className={MODULE_TABLE_TH}>Status</th>
                  <th className={`w-8 ${MODULE_TABLE_TH}`} aria-hidden />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                    onClick={() => navigate(`/survey/${s.id}`)}
                  >
                    <td className="px-5 py-4 align-middle">
                      <span className="font-medium text-neutral-900">{s.title}</span>
                      {s.description && (
                        <span className="ml-1 block max-w-md truncate text-xs text-neutral-500">{s.description}</span>
                      )}
                      {s.vendor_name && <span className="block text-xs text-neutral-400">{s.vendor_name}</span>}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <Badge variant={surveyTypeBadgeVariant(s.survey_type)} className="text-xs">
                        {surveyTypeLabel(s.survey_type)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 align-middle text-xs text-neutral-600">
                      <DateRange s={s} />
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <Badge variant={surveyStatusBadgeVariant(s.status)} className="text-xs">
                        {surveyStatusLabel(s.status)}
                      </Badge>
                    </td>
                    <td className="w-8 px-3 py-4 align-middle text-neutral-300">
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleRecordsTableShell>
    </div>
  )
}
