// Settings-hub wrapper for the "Maler" tab. Mirrors the inline JSX
// block in `SurveyModuleAdminPage.tsx:315-367` — template list +
// versioned JSON import/export.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, Download, Loader2, Upload } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { InfoBox, WarningBox } from '../../ui/AlertBox'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../../layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useSurvey } from '../../../../modules/survey'
import {
  buildSurveyOrgTemplateExport,
  parseSurveyOrgTemplateExport,
} from '../../../lib/surveyTemplateJsonImportExport'
import { SurveyMalerOpsCard } from '../../../../modules/survey/admin/SurveyMalerOpsCard'

export default function SurveyScopeMaler() {
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('survey.manage')
  const survey = useSurvey({ supabase })

  const templateImportRef = useRef<HTMLInputElement>(null)
  const [jsonBusy, setJsonBusy] = useState(false)
  const [jsonErr, setJsonErr] = useState<string | null>(null)
  const [exportTemplateId, setExportTemplateId] = useState('')

  const orgTemplates = useMemo(
    () => survey.templateCatalog.filter((t) => !t.is_system),
    [survey.templateCatalog],
  )

  const templateExportOptions: SelectOption[] = useMemo(
    () => orgTemplates.map((t) => ({ value: t.id, label: t.name })),
    [orgTemplates],
  )

  useEffect(() => {
    if (canManage) void survey.loadTemplateCatalog()
  }, [canManage, survey.loadTemplateCatalog])

  useEffect(() => {
    if (!exportTemplateId && templateExportOptions.length > 0) {
      setExportTemplateId(templateExportOptions[0]!.value)
    }
  }, [exportTemplateId, templateExportOptions])

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportTemplateJson() {
    setJsonErr(null)
    const tpl = orgTemplates.find((t) => t.id === exportTemplateId)
    if (!tpl) {
      setJsonErr('Velg en mal å eksportere, eller opprett en under Maler først.')
      return
    }
    downloadJson(
      `survey-org-template-${tpl.id.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40)}.json`,
      buildSurveyOrgTemplateExport(tpl),
    )
  }

  async function handleImportTemplateFile(f: File) {
    setJsonErr(null)
    setJsonBusy(true)
    try {
      const parsed = parseSurveyOrgTemplateExport(JSON.parse(await f.text()) as unknown)
      if (!parsed) {
        setJsonErr('Ugyldig fil — forventet klarert-survey-org-template-export-v1.')
        return
      }
      const t = parsed.template
      const row = await survey.saveOrgTemplate({
        name: `${t.name.trim() || 'Importert mal'} (import)`,
        shortName: t.short_name,
        description: t.description,
        category: t.category,
        audience: t.audience,
        estimatedMinutes: t.estimated_minutes,
        recommendAnonymous: t.recommend_anonymous,
        scoringNote: t.scoring_note,
        lawRef: t.law_ref,
        body: t.body,
      })
      if (row) setExportTemplateId(row.id)
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Import feilet.')
    } finally {
      setJsonBusy(false)
    }
  }

  if (!canManage) {
    return <WarningBox>Du har ikke tilgang. Krever rollen «survey.manage» eller administrator.</WarningBox>
  }

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[#7c3aed]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Undersøkelsesmaler</h2>
        </div>
        <p className="mb-5 text-sm text-neutral-600">
          Aktiver, fest i sidemenyen og angi gjennomgangsstatus for systemets og organisasjonens maler.
        </p>
        <SurveyMalerOpsCard supabase={supabase} />
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Download className="h-5 w-5 text-neutral-500" aria-hidden />
          <h2 className="text-base font-semibold text-neutral-900">Import / Eksport — JSON</h2>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Eksporter og importer egendefinerte undersøkelsesmaler. Filformatet er versjonert.
        </p>
        <div className="mt-4">
          <InfoBox>
            Format: <code className="rounded bg-neutral-100 px-1 text-xs">klarert-survey-org-template-export-v1</code>
          </InfoBox>
        </div>
        {jsonErr && (
          <div className="mt-4">
            <WarningBox>{jsonErr}</WarningBox>
          </div>
        )}
        {survey.templateCatalogLoading && orgTemplates.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Laster maler…
          </p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
              <p className="text-sm font-medium text-neutral-800">Eksporter</p>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Mal</span>
                <div className="mt-1.5">
                  <SearchableSelect
                    value={exportTemplateId}
                    options={templateExportOptions}
                    onChange={setExportTemplateId}
                    disabled={templateExportOptions.length === 0 || jsonBusy}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={templateExportOptions.length === 0 || jsonBusy}
                onClick={() => handleExportTemplateJson()}
              >
                <Download className="h-4 w-4" aria-hidden /> Last ned JSON
              </Button>
              {templateExportOptions.length === 0 && (
                <p className="text-xs text-neutral-500">Ingen egne maler ennå.</p>
              )}
            </div>
            <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
              <p className="text-sm font-medium text-neutral-800">Importer</p>
              <p className="text-xs text-neutral-600">Oppretter en ny mal med suffikset «(import)».</p>
              <input
                ref={templateImportRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void handleImportTemplateFile(f)
                }}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={jsonBusy}
                onClick={() => templateImportRef.current?.click()}
              >
                {jsonBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />Importerer…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" aria-hidden />Velg JSON-fil
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
