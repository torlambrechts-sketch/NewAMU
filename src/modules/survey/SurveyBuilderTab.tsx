import { useState } from 'react'
import { Plus, Trash2, Download, Shield, GripVertical } from 'lucide-react'
import type { SurveyModuleState } from './useSurveyLegacy'
import type { SurveyCampaignRow, SurveyPillar, SurveyQuestionType } from '../../data/survey'
import { PILLAR_LABEL } from '../../data/survey'

const BTN_PRIMARY =
  'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'
const INPUT =
  'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30'
const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

type Props = { survey: SurveyModuleState; campaign: SurveyCampaignRow }

const QTYPE_LABEL: Record<SurveyQuestionType, string> = {
  likert5: 'Likert 1–5',
  likert7: 'Likert 1–7',
  yesno: 'Ja / Nei',
  text: 'Fritekst',
  nps: 'NPS 0–10',
}

const PILLAR_BORDER: Record<SurveyPillar, string> = {
  psychosocial: 'border-l-violet-400',
  physical: 'border-l-blue-400',
  organization: 'border-l-amber-400',
  safety_culture: 'border-l-emerald-400',
  custom: 'border-l-neutral-300',
}

export function SurveyBuilderTab({ survey, campaign }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [form, setForm] = useState({
    pillar: campaign.pillar,
    category: '',
    questionText: '',
    questionType: 'likert5' as SurveyQuestionType,
    isMandatory: false,
  })

  const isLocked = campaign.status !== 'draft'

  const handleAdd = async () => {
    if (!form.questionText.trim() || !form.category.trim()) return
    await survey.upsertQuestion({
      campaignId: campaign.id,
      pillar: form.pillar as SurveyPillar,
      category: form.category,
      questionText: form.questionText,
      questionType: form.questionType,
      isMandatory: form.isMandatory,
      sortOrder: survey.questions.length,
    })
    setForm((p) => ({ ...p, questionText: '', category: '' }))
    setShowAdd(false)
  }

  const handleSeedQps = async () => {
    setSeeding(true)
    await survey.seedQpsNordic(campaign.id, campaign.pillar)
    setSeeding(false)
  }

  const grouped = survey.questions.reduce<Record<string, typeof survey.questions>>((acc, q) => {
    ;(acc[q.category] ??= []).push(q)
    return acc
  }, {})

  const mandatoryCount = survey.questions.filter((q) => q.is_mandatory).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!isLocked && (
          <>
            <button type="button" onClick={() => setShowAdd((v) => !v)} className={BTN_PRIMARY}>
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Legg til spørsmål
              </span>
            </button>
            <button
              type="button"
              onClick={handleSeedQps}
              disabled={seeding}
              className="flex items-center gap-2 rounded-lg border border-[#1a3d32] px-4 py-2 text-sm font-semibold text-[#1a3d32] hover:bg-[#1a3d32]/5 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {seeding ? 'Laster inn…' : 'Importer QPSNordic-spørsmål'}
            </button>
          </>
        )}
        {mandatoryCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-700">
            <Shield className="h-3.5 w-3.5" />
            {mandatoryCount} obligatoriske spørsmål (AML § 4-3)
          </span>
        )}
      </div>

      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] px-4 py-3 text-sm text-[#1a3d32]">
        <strong>QPSNordic / ARK:</strong> Validerte norske spørsmålssett. Fem spørsmål er obligatoriske etter AML § 4-3
        (integritet, medvirkning, sikkerhet, helse, trakassering). Disse kan ikke slettes.
      </div>

      {showAdd && (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1a3d32]">Nytt spørsmål</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={FIELD_LABEL}>Pilar</label>
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
              <label className={FIELD_LABEL}>Kategori *</label>
              <input
                className={INPUT}
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="f.eks. Jobbkrav"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={FIELD_LABEL}>Spørsmålstekst *</label>
              <textarea
                className={INPUT}
                rows={2}
                value={form.questionText}
                onChange={(e) => setForm((p) => ({ ...p, questionText: e.target.value }))}
                placeholder="Skriv spørsmålet her…"
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Svartype</label>
              <select
                className={INPUT}
                value={form.questionType}
                onChange={(e) => setForm((p) => ({ ...p, questionType: e.target.value as SurveyQuestionType }))}
              >
                {(Object.entries(QTYPE_LABEL) as [SurveyQuestionType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="mandatory"
                checked={form.isMandatory}
                onChange={(e) => setForm((p) => ({ ...p, isMandatory: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="mandatory" className="text-sm text-neutral-700">
                Obligatorisk (AML)
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleAdd} className={BTN_PRIMARY}>
              Legg til
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {survey.questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-400">
          Ingen spørsmål ennå. Importer QPSNordic eller legg til manuelt.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, qs]) => (
            <div key={cat} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-[#1a3d32]">
                  {cat}
                  <span className="ml-2 text-xs font-normal text-neutral-400">{qs.length} spørsmål</span>
                </h3>
              </div>
              <div className="divide-y divide-neutral-100">
                {qs.map((q) => (
                  <div key={q.id} className={`flex items-start gap-3 border-l-4 px-4 py-3 ${PILLAR_BORDER[q.pillar]}`}>
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-800">{q.question_text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium">
                          {QTYPE_LABEL[q.question_type as SurveyQuestionType]}
                        </span>
                        {q.is_mandatory && (
                          <span className="flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">
                            <Shield className="h-2.5 w-2.5" /> Obligatorisk
                          </span>
                        )}
                        {q.source_key && <span className="text-neutral-300">{q.source_key}</span>}
                      </div>
                    </div>
                    {!isLocked && !q.is_mandatory && (
                      <button
                        type="button"
                        onClick={() => void survey.deleteQuestion(q.id)}
                        className="shrink-0 rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
