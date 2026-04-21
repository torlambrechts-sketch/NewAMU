import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ClipboardList, Ghost, Loader2, Plus, Settings } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { useSurvey } from './useSurvey'
import { surveyStatusBadgeVariant, surveyStatusLabel } from './surveyLabels'
import type { SurveyRow } from './types'

type Props = { supabase: SupabaseClient | null }

function SurveyListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Ghost className="h-12 w-12 text-neutral-300" strokeWidth={1.25} aria-hidden />
      <p className="max-w-sm text-sm text-neutral-500">Ingen undersøkelser opprettet ennå. Opprett den første for å komme i gang.</p>
    </div>
  )
}

export function SurveyPage({ supabase }: Props) {
  const navigate = useNavigate()
  const survey = useSurvey({ supabase })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void survey.loadSurveys()
  }, [survey.loadSurveys])

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return
    setCreating(true)
    const row = await survey.createSurvey({ title: title.trim(), description: description.trim() || null })
    setCreating(false)
    if (row) {
      setTitle('')
      setDescription('')
      navigate(`/survey/${row.id}`)
    }
  }, [title, description, survey, navigate])

  const rows = survey.surveys

  return (
    <div className="flex flex-col space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Arbeidsplass', to: '/workspace' }, { label: 'Undersøkelser' }]}
        title="Organisasjonsundersøkelser"
        description="Kartlegging av psykososialt arbeidsmiljø — opprett, publiser og analyser svar innenfor virksomheten."
        headerActions={
          survey.canManage ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/survey/admin')}>
              <Settings className="h-4 w-4" aria-hidden />
              Modulinnstillinger
            </Button>
          ) : null
        }
      />

      <div className={WORKPLACE_MODULE_CARD} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <div className="p-5 md:p-6">
          {survey.canManage ? (
            <div className="mb-8 space-y-4 border-b border-neutral-200 pb-8">
              <h2 className="text-lg font-semibold text-neutral-900">Ny undersøkelse</h2>
              <div className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <p className="text-sm font-medium text-neutral-800">Grunnleggende</p>
                  <p className="mt-1 text-sm text-neutral-600">Opprett en kladd. Du legger til spørsmål og publiserer når den er klar.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-new-title">
                      Tittel
                    </label>
                    <StandardInput
                      id="survey-new-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="F.eks. Psykososialt klima 2026"
                    />
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-new-desc">
                      Beskrivelse
                    </label>
                    <StandardTextarea
                      id="survey-new-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Valgfri introduksjon til deltakerne"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={creating || !title.trim() || survey.loading}
                    onClick={() => void handleCreate()}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Oppretter…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" aria-hidden />
                        Opprett kladd
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="mb-6 text-sm text-neutral-600">
              Du har innsyn i listen. Redigering krever tilgangen «Undersøkelse — administrasjon».
            </p>
          )}

          <LayoutTable1PostingsShell
            wrap={false}
            title="Registrerte undersøkelser"
            description="Åpne en undersøkelse for detaljer, spørsmål, svar og analyse."
            toolbar={<span className="text-xs text-neutral-500">{rows.length} registrert</span>}
          >
            {survey.loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Laster…
              </div>
            ) : rows.length === 0 ? (
              <SurveyListEmpty />
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Oppdatert</th>
                    <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: SurveyRow) => (
                    <tr key={r.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                      <td className="px-5 py-3 align-middle text-sm text-neutral-900">
                        <Link to={`/survey/${r.id}`} className="font-medium text-[#1a3d32] hover:underline">
                          {r.title}
                        </Link>
                        {r.description ? (
                          <div className="mt-0.5 max-w-md truncate text-xs font-normal text-neutral-500">{r.description}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <Badge variant={surveyStatusBadgeVariant(r.status)}>{surveyStatusLabel(r.status)}</Badge>
                      </td>
                      <td className="px-5 py-3 align-middle text-xs text-neutral-600">
                        {new Date(r.updated_at).toLocaleString('nb-NO')}
                      </td>
                      <td className="px-5 py-3 text-right align-middle">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/survey/${r.id}`)}
                        >
                          <ClipboardList className="h-4 w-4" aria-hidden />
                          Åpne
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </LayoutTable1PostingsShell>
        </div>
      </div>
    </div>
  )
}
