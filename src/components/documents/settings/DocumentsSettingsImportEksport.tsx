import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { useDocuments } from '../../../hooks/useDocuments'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { ModuleSectionCard } from '../../module/ModuleSectionCard'
import { Button } from '../../ui/Button'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { InfoBox, WarningBox } from '../../ui/AlertBox'
import {
  buildTemplateExport,
  buildWikiPageExport,
  parseDocumentTemplateExport,
  parseWikiPageExport,
} from '../../../lib/documentJsonImportExport'

export function DocumentsSettingsImportEksport() {
  const docs = useDocuments()
  const { profile, can } = useOrgSetupContext()
  const canManage = profile?.is_org_admin === true || can('documents.manage')

  const templateImportRef = useRef<HTMLInputElement>(null)
  const pageImportRef = useRef<HTMLInputElement>(null)
  const [jsonBusy, setJsonBusy] = useState(false)
  const [jsonErr, setJsonErr] = useState<string | null>(null)
  const [importPageSpaceId, setImportPageSpaceId] = useState('')
  const [exportPageId, setExportPageId] = useState('')
  const [exportTemplateId, setExportTemplateId] = useState('')

  const spaceOptions: SelectOption[] = useMemo(
    () => docs.spaces.filter((s) => s.status === 'active').map((s) => ({ value: s.id, label: s.title })),
    [docs.spaces],
  )
  const pageExportOptions: SelectOption[] = useMemo(
    () => docs.pages.map((p) => ({ value: p.id, label: `${p.title} (${p.status})` })),
    [docs.pages],
  )
  const templateExportOptions: SelectOption[] = useMemo(
    () => docs.pageTemplates.map((t) => ({ value: t.id, label: t.label })),
    [docs.pageTemplates],
  )

  useEffect(() => {
    if (!importPageSpaceId && spaceOptions.length > 0) setImportPageSpaceId(spaceOptions[0]!.value)
  }, [importPageSpaceId, spaceOptions])

  useEffect(() => {
    if (!exportPageId && pageExportOptions.length > 0) setExportPageId(pageExportOptions[0]!.value)
  }, [exportPageId, pageExportOptions])

  useEffect(() => {
    if (!exportTemplateId && templateExportOptions.length > 0) setExportTemplateId(templateExportOptions[0]!.value)
  }, [exportTemplateId, templateExportOptions])

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.rel = 'noopener'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportPage() {
    setJsonErr(null)
    const page = docs.pages.find((p) => p.id === exportPageId)
    if (!page) { setJsonErr('Velg et dokument å eksportere.'); return }
    downloadJson(`wiki-page-${page.id.slice(0, 8)}.json`, buildWikiPageExport(page))
  }

  function handleExportTemplate() {
    setJsonErr(null)
    const tpl = docs.pageTemplates.find((t) => t.id === exportTemplateId)
    if (!tpl) { setJsonErr('Velg en mal å eksportere.'); return }
    downloadJson(`document-template-${tpl.id}.json`, buildTemplateExport(tpl))
  }

  async function handleImportTemplate(f: File) {
    setJsonErr(null); setJsonBusy(true)
    try {
      const parsed = parseDocumentTemplateExport(JSON.parse(await f.text()) as unknown)
      if (!parsed) { setJsonErr('Ugyldig malfil — forventet klarert-document-template-export-v1.'); return }
      const t = parsed.template
      await docs.saveOrgCustomTemplate({
        label: `${t.label} (import)`,
        description: t.description,
        category: t.category,
        legalBasis: t.legalBasis,
        page: t.page,
      })
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Import av mal feilet.')
    } finally { setJsonBusy(false) }
  }

  async function handleImportPage(f: File) {
    setJsonErr(null)
    if (!importPageSpaceId) { setJsonErr('Velg målmappe for import.'); return }
    setJsonBusy(true)
    try {
      const parsed = parseWikiPageExport(JSON.parse(await f.text()) as unknown)
      if (!parsed) { setJsonErr('Ugyldig dokumentfil — forventet klarert-wiki-page-export-v1.'); return }
      const p = parsed.page
      const page = await docs.createPage(
        importPageSpaceId,
        p.title.trim() || 'Importert dokument',
        p.template,
        Array.isArray(p.blocks) ? p.blocks : [],
        {
          legalRefs: p.legalRefs,
          requiresAcknowledgement: p.requiresAcknowledgement,
          summary: p.summary,
          acknowledgementAudience: p.acknowledgementAudience,
          acknowledgementDepartmentId: p.acknowledgementDepartmentId,
          revisionIntervalMonths: p.revisionIntervalMonths,
          nextRevisionDueAt: p.nextRevisionDueAt,
        },
      )
      await docs.updatePage(page.id, {
        lang: p.lang,
        containsPii: p.containsPii,
        piiCategories: p.piiCategories,
        piiLegalBasis: p.piiLegalBasis,
        piiRetentionNote: p.piiRetentionNote,
        retentionCategory: p.retentionCategory,
        retainMinimumYears: p.retainMinimumYears,
        retainMaximumYears: p.retainMaximumYears,
        status: 'draft',
      })
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'Import av dokument feilet.')
    } finally { setJsonBusy(false) }
  }

  if (!canManage) {
    return <WarningBox>Du har ikke tilgang til import/eksport av dokumenter og maler.</WarningBox>
  }

  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">JSON — dokumenter og maler</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Last ned eller last opp JSON i Klarert-format for sikkerhetskopiering og deling mellom miljøer.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <InfoBox>
          Format: <code className="rounded bg-neutral-100 px-1 text-xs">klarert-wiki-page-export-v1</code> og{' '}
          <code className="rounded bg-neutral-100 px-1 text-xs">klarert-document-template-export-v1</code>
        </InfoBox>

        {jsonErr ? <WarningBox>{jsonErr}</WarningBox> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Documents */}
          <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Dokument (wiki-side)</h3>
            <div>
              <span className="mb-1 block text-xs font-medium text-neutral-500">Velg dokument for eksport</span>
              <SearchableSelect value={exportPageId} options={pageExportOptions} onChange={setExportPageId} disabled={pageExportOptions.length === 0 || jsonBusy} />
            </div>
            <Button type="button" variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} disabled={jsonBusy || pageExportOptions.length === 0} onClick={() => void handleExportPage()}>
              Last ned JSON
            </Button>
            <div className="border-t border-neutral-200/80 pt-3">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Målmappe for import</span>
              <SearchableSelect value={importPageSpaceId} options={spaceOptions} onChange={setImportPageSpaceId} disabled={spaceOptions.length === 0 || jsonBusy} />
            </div>
            <input ref={pageImportRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleImportPage(f) }} />
            <Button type="button" variant="primary" icon={<Upload className="h-4 w-4" aria-hidden />} disabled={jsonBusy || spaceOptions.length === 0} onClick={() => pageImportRef.current?.click()}>
              Last opp dokument-JSON
            </Button>
          </div>

          {/* Templates */}
          <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Dokumentmal</h3>
            <div>
              <span className="mb-1 block text-xs font-medium text-neutral-500">Velg mal for eksport</span>
              <SearchableSelect value={exportTemplateId} options={templateExportOptions} onChange={setExportTemplateId} disabled={templateExportOptions.length === 0 || jsonBusy} />
            </div>
            <Button type="button" variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} disabled={jsonBusy || templateExportOptions.length === 0} onClick={() => handleExportTemplate()}>
              Last ned mal-JSON
            </Button>
            <input ref={templateImportRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleImportTemplate(f) }} />
            <Button type="button" variant="primary" icon={<Upload className="h-4 w-4" aria-hidden />} disabled={jsonBusy} onClick={() => templateImportRef.current?.click()}>
              {jsonBusy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Importerer…</> : <>Last opp mal-JSON</>}
            </Button>
          </div>
        </div>
      </div>
    </ModuleSectionCard>
  )
}
