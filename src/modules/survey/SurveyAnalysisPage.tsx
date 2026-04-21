import { useEffect, useState, type ElementType } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, LayoutList, Send, BarChart2, CheckSquare, FileText, AlertTriangle } from 'lucide-react'
import { useSurveyLegacy } from './useSurveyLegacy'
import { SurveyBuilderTab } from './SurveyBuilderTab'
import { SurveyResponsesTab } from './SurveyResponsesTab'
import { SurveyResultsTab } from './SurveyResultsTab'
import { SurveyActionTab } from './SurveyActionTab'
import { SurveyAmuTab } from './SurveyAmuTab'
import { STATUS_COLOR, STATUS_LABEL, PILLAR_LABEL, PILLAR_COLOR } from './types'

type Tab = 'builder' | 'responses' | 'results' | 'actions' | 'amu'

const TABS: { id: Tab; label: string; icon: ElementType }[] = [
  { id: 'builder', label: 'Spørsmål', icon: LayoutList },
  { id: 'responses', label: 'Besvarelser', icon: Send },
  { id: 'results', label: 'Resultater', icon: BarChart2 },
  { id: 'actions', label: 'Tiltak', icon: CheckSquare },
  { id: 'amu', label: 'AMU-protokoll', icon: FileText },
]

type Props = { supabase: SupabaseClient | null }

export function SurveyAnalysisPage({ supabase }: Props) {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const survey = useSurveyLegacy({ supabase })
  const [tab, setTab] = useState<Tab>('builder')

  useEffect(() => {
    if (surveyId) void survey.loadCampaign(surveyId)
  }, [surveyId, survey.loadCampaign])

  const c = survey.selectedCampaign

  if (survey.loading && !c) {
    return <div className="py-24 text-center text-sm text-neutral-400">Laster undersøkelse…</div>
  }
  if (!c) {
    return <div className="py-24 text-center text-sm text-red-500">Undersøkelse ikke funnet.</div>
  }

  const openActions = survey.actionPlans.filter((p) => p.status !== 'closed')

  return (
    <div className="space-y-0">
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/survey')}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold text-[#1a3d32]">{c.title}</h1>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[c.status]}`}
              >
                {STATUS_LABEL[c.status]}
              </span>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PILLAR_COLOR[c.pillar]}`}
              >
                {PILLAR_LABEL[c.pillar]}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {survey.respondentCount} respondenter · {survey.questions.length} spørsmål
              {openActions.length > 0 && (
                <span className="ml-2 font-medium text-red-600">· {openActions.length} åpne tiltak</span>
              )}
            </p>
          </div>
          {c.status === 'draft' && (
            <button
              type="button"
              onClick={() => void survey.openCampaign(c.id)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Åpne for besvarelser
            </button>
          )}
          {c.status === 'open' && (
            <button
              type="button"
              onClick={() => void survey.closeCampaign(c.id)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Avslutt innsamling
            </button>
          )}
          {c.status === 'closed' && survey.results.length === 0 && (
            <button
              type="button"
              onClick={() => void survey.computeResults(c.id)}
              disabled={survey.loading}
              className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a] disabled:opacity-40"
            >
              {survey.loading ? 'Beregner…' : 'Beregn resultater'}
            </button>
          )}
        </div>

        <div className="flex overflow-x-auto border-t border-neutral-100">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-[#1a3d32] text-[#1a3d32]'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {t.id === 'actions' && openActions.length > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {openActions.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {survey.error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{survey.error}</span>
          <button type="button" onClick={survey.clearError} className="ml-auto text-red-600 hover:text-red-800">
            ✕
          </button>
        </div>
      )}

      <div className="p-4 md:p-6">
        {tab === 'builder' && <SurveyBuilderTab survey={survey} campaign={c} />}
        {tab === 'responses' && <SurveyResponsesTab survey={survey} campaign={c} />}
        {tab === 'results' && <SurveyResultsTab survey={survey} campaign={c} />}
        {tab === 'actions' && <SurveyActionTab survey={survey} campaign={c} />}
        {tab === 'amu' && <SurveyAmuTab survey={survey} campaign={c} />}
      </div>
    </div>
  )
}
