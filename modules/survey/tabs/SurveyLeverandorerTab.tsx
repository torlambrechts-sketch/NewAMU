import { useNavigate } from 'react-router-dom'
import { Ghost, Building2 } from 'lucide-react'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import type { SurveyRow } from '../types'
import { surveyStatusBadgeVariant, surveyStatusLabel } from '../surveyLabels'

type Props = {
  surveys: SurveyRow[]
  loading: boolean
  canManage: boolean
  onNewExternalSurvey: () => void
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function SurveyLeverandorerTab({ surveys, loading, canManage, onNewExternalSurvey }: Props) {
  const navigate = useNavigate()
  const external = surveys.filter((s) => s.survey_type === 'external')

  const active = external.filter((s) => s.status === 'active').length
  const closed = external.filter((s) => s.status === 'closed' || s.status === 'archived').length
  const drafts = external.filter((s) => s.status === 'draft').length

  const kpiItems = [
    { big: String(active), title: 'Aktive', sub: 'Åpen innsamling' },
    { big: String(closed), title: 'Fullførte', sub: 'Lukket eller arkivert' },
    { big: String(drafts), title: 'Kladder', sub: 'Ikke publisert' },
    { big: String(external.length), title: 'Totalt', sub: 'Leverandørundersøkelser' },
  ]

  return (
    <div className="space-y-6">
      <LayoutScoreStatRow items={kpiItems} columns={4} />

      {external.length === 0 && !loading ? (
        <InfoBox>
          Ingen leverandørundersøkelser opprettet ennå. Bruk Maler-fanen for å starte fra en
          HMS-egenerklæringsmal, eller opprett en ny tilpasset undersøkelse.
        </InfoBox>
      ) : (
        <div className="flex flex-wrap gap-4">
          <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm">
            <span className="font-bold text-neutral-900">{active}</span>
            <span className="ml-1 text-neutral-500">aktive egenerklæringer</span>
          </div>
          <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm">
            <span className="font-bold text-neutral-900">{closed}</span>
            <span className="ml-1 text-neutral-500">fullførte</span>
          </div>
        </div>
      )}

      <LayoutTable1PostingsShell
        wrap
        title="Leverandørundersøkelser"
        description="HMS-egenerklæringer og etikkskjemaer sendt til leverandører og underleverandører."
        headerActions={
          canManage ? (
            <Button type="button" variant="primary" size="sm" onClick={onNewExternalSurvey}>
              Ny leverandørundersøkelse
            </Button>
          ) : null
        }
        toolbar={<span className="text-xs text-neutral-500">{external.length} registrert</span>}
      >
        {loading && external.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">Laster…</div>
        ) : external.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Ghost className="h-12 w-12 text-neutral-300" strokeWidth={1.25} aria-hidden />
            <p className="max-w-sm text-sm text-neutral-500">
              Ingen leverandørundersøkelser ennå. Start fra en mal for å sende HMS-egenerklæring.
            </p>
            {canManage && (
              <Button type="button" variant="primary" size="sm" onClick={onNewExternalSurvey}>
                Opprett leverandørundersøkelse
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Leverandør / Undersøkelse</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Org.nr.</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Periode</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Anonym</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                  <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handling</th>
                </tr>
              </thead>
              <tbody>
                {external.map((s) => (
                  <tr key={s.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                        <div>
                          <span
                            className="cursor-pointer font-medium text-[#1a3d32] hover:underline"
                            onClick={() => navigate(`/survey/${s.id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/survey/${s.id}`)}
                          >
                            {s.vendor_name ?? s.title}
                          </span>
                          {s.vendor_name && (
                            <span className="block text-xs text-neutral-500">{s.title}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-500`}>
                      {s.vendor_org_number ?? '—'}
                    </td>
                    <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-500`}>
                      {s.start_date
                        ? `${formatDate(s.start_date)} – ${formatDate(s.end_date)}`
                        : '—'}
                    </td>
                    <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                      {s.is_anonymous ? (
                        <Badge variant="info">Anonym</Badge>
                      ) : (
                        <span className="text-xs text-neutral-400">Identifisert</span>
                      )}
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
