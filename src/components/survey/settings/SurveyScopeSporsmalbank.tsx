// Settings-hub wrapper for the "Spørsmålsbank" tab. Mirrors the inline
// JSX block in `SurveyModuleAdminPage.tsx:267-312` (plus the slide-over
// "add question" form at 391-415). Owns its own state — `useSurvey`
// hook handles the data.

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { LayoutTable1PostingsShell } from '../../layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../layout/layoutTable1PostingsKit'
import { SlidePanel } from '../../layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../layout/WorkplaceStandardFormPanel'
import { WarningBox } from '../../ui/AlertBox'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useSurvey } from '../../../../modules/survey'
import { QUESTION_TYPE_OPTIONS, questionTypeLabel } from '../../../../modules/survey/surveyLabels'
import type { SurveyQuestionBankRow, SurveyQuestionType } from '../../../../modules/survey/types'

export default function SurveyScopeSporsmalbank() {
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('survey.manage')
  const survey = useSurvey({ supabase })
  const { loadQuestionBank } = survey

  const [showAdd, setShowAdd] = useState(false)
  const [qbCategory, setQbCategory] = useState('')
  const [qbText, setQbText] = useState('')
  const [qbType, setQbType] = useState<SurveyQuestionType>('rating_1_to_5')
  const [qbSaving, setQbSaving] = useState(false)

  const typeOptions: SelectOption[] = QUESTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  useEffect(() => {
    if (canManage) void loadQuestionBank()
  }, [canManage, loadQuestionBank])

  const handleSaveBank = useCallback(async () => {
    if (!qbCategory.trim() || !qbText.trim()) return
    setQbSaving(true)
    const row = await survey.upsertQuestionBank({
      category: qbCategory.trim(),
      questionText: qbText.trim(),
      questionType: qbType,
    })
    setQbSaving(false)
    if (row) {
      setShowAdd(false)
      setQbCategory('')
      setQbText('')
      setQbType('rating_1_to_5')
    }
  }, [qbCategory, qbText, qbType, survey])

  if (!canManage) {
    return <WarningBox>Du har ikke tilgang. Krever rollen «survey.manage» eller administrator.</WarningBox>
  }

  return (
    <>
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">Spørsmålsbank</h2>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setQbCategory('')
              setQbText('')
              setQbType('rating_1_to_5')
              setShowAdd(true)
            }}
          >
            <Plus className="h-4 w-4" /> Legg til
          </Button>
        </div>
        <LayoutTable1PostingsShell
          wrap={false}
          title="Gjenbrukbare spørsmål"
          description="Hent fra bank i byggeren."
          toolbar={<span className="text-xs text-neutral-500">{survey.questionBank.length} spørsmål</span>}
        >
          {survey.loading && survey.questionBank.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">Laster…</p>
          ) : survey.questionBank.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">Ingen spørsmål i banken ennå.</p>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Spørsmål</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                    <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
                  </tr>
                </thead>
                <tbody>
                  {survey.questionBank.map((r: SurveyQuestionBankRow) => (
                    <tr key={r.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                      <td className={LAYOUT_TABLE1_POSTINGS_TD}>{r.category}</td>
                      <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                        <span className="whitespace-normal">{r.question_text}</span>
                      </td>
                      <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                        <Badge variant="neutral">{questionTypeLabel(r.question_type)}</Badge>
                      </td>
                      <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right`}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-600"
                          onClick={() => {
                            if (typeof window !== 'undefined' && !window.confirm('Slette spørsmålet?')) return
                            void survey.deleteQuestionBank(r.id)
                          }}
                          aria-label={`Slett: ${r.question_text.slice(0, 40)}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>

      <SlidePanel
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Nytt spørsmål i bank"
        titleId="qbank-panel-title-scope"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={qbSaving || !qbText.trim() || !qbCategory.trim()}
              onClick={() => void handleSaveBank()}
            >
              {qbSaving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-cat-scope">
              Kategori (obligatorisk)
            </label>
            <StandardInput
              id="qb-cat-scope"
              value={qbCategory}
              onChange={(e) => setQbCategory(e.target.value)}
              placeholder="F.eks. Jobbkrav"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-text-scope">
              Spørsmålstekst (obligatorisk)
            </label>
            <StandardTextarea
              id="qb-text-scope"
              value={qbText}
              onChange={(e) => setQbText(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="qb-type-scope">
              Type
            </label>
            <SearchableSelect
              value={qbType}
              options={typeOptions}
              onChange={(v) => setQbType(v as SurveyQuestionType)}
            />
          </div>
        </div>
      </SlidePanel>
    </>
  )
}
