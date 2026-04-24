import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PageTemplate, SpaceCategory } from '../../types/documents'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module/moduleTableKit'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { DocumentFolderAccessSettings } from './DocumentFolderAccessSettings'
import { DocumentAccessRequestsPanel } from './DocumentAccessRequestsPanel'
import {
  buildTemplateExport,
  buildWikiPageExport,
  parseDocumentTemplateExport,
  parseWikiPageExport,
} from '../../lib/documentJsonImportExport'

const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

const categoryOptions: SelectOption[] = (Object.keys(CATEGORY_LABELS) as SpaceCategory[]).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

export function DocumentTemplatesSettings() {
  const docs = useDocuments()
  const [searchParams, setSearchParams] = useSearchParams()
  const { can, profile } = useOrgSetupContext()
  const canManage = profile?.is_org_admin === true || can('documents.manage')

  const templateImportRef = useRef<HTMLInputElement>(null)
  const pageImportRef = useRef<HTMLInputElement>(null)
  const [jsonBusy, setJsonBusy] = useState(false)
  const [jsonErr, setJsonErr] = useState<string | null>(null)
  const [importPageSpaceId, setImportPageSpaceId] = useState('')
  const [exportPageId, setExportPageId] = useState('')

  const spaceOptions: SelectOption[] = useMemo(
    () => docs.spaces.filter((s) => s.status === 'active').map((s) => ({ value: s.id, label: s.title })),
    [docs.spaces],
  )

  const pageExportOptions: SelectOption[] = useMemo(
    () => docs.pages.map((p) => ({ value: p.id, label: `${p.title} (${p.status})` })),
    [docs.pages],
  )

  const [exportTemplateId, setExportTemplateId] = useState('')

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
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportPageJson() {
    setJsonErr(null)
    const page = docs.pages.find((p) => p.id === exportPageId)
    if (!page) {
      setJsonErr('Velg et dokument å eksportere.')
      return
    }
    downloadJson(`wiki-page-${page.id.slice(0, 8)}.json`, buildWikiPageExport(page))
  }

  function handleExportTemplateJson() {
    setJsonErr(null)
    const tpl = docs.pageTemplates.find((t) => t.id === exportTemplateId)
    if (!tpl) {
      setJsonErr('Velg en mal å eksportere.')
      return
    }
    downloadJson(`document-template-${tpl.id}.json`, buildTemplateExport(tpl))
  }

  async function handleImportTemplateFile(f: File) {
    setJsonErr(null)
    setJsonBusy(true)
    try {
      const text = await f.text()
      const parsed = parseDocumentTemplateExport(JSON.parse(text) as unknown)
      if (!parsed) {
        setJsonErr('Ugyldig malfil — forventet klarert-document-template-export-v1.')
        return
      }
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
    } finally {
      setJsonBusy(false)
    }
  }

  async function handleImportPageFile(f: File) {
    setJsonErr(null)
    if (!importPageSpaceId) {
      setJsonErr('Velg målmappe for import.')
      return
    }
    setJsonBusy(true)
    try {
      const text = await f.text()
      const parsed = parseWikiPageExport(JSON.parse(text) as unknown)
      if (!parsed) {
        setJsonErr('Ugyldig dokumentfil — forventet klarert-wiki-page-export-v1.')
        return
      }
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
    } finally {
      setJsonBusy(false)
    }
  }

  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '',
    description: '',
    category: 'hms_handbook' as SpaceCategory,
  })
  const [formErr, setFormErr] = useState<string | null>(null)
  const [systemPanelId, setSystemPanelId] = useState<string | null>(null)
  const [customPanelId, setCustomPanelId] = useState<string | null>(null)

  const systemCatalog = docs.systemTemplatesCatalog

  const systemPanelTpl = useMemo(
    () => (systemPanelId ? systemCatalog.find((t) => t.id === systemPanelId) ?? null : null),
    [systemCatalog, systemPanelId],
  )

  const customOnly = docs.pageTemplates.filter((t: PageTemplate) =>
    docs.orgCustomTemplates.some((c) => c.id === t.id),
  )
  const customPanelTpl = useMemo(
    () => (customPanelId ? customOnly.find((t) => t.id === customPanelId) ?? null : null),
    [customOnly, customPanelId],
  )

  useBodyScrollLock(Boolean(systemPanelId || customPanelId))

  useEffect(() => {
    const sid = searchParams.get('system')
    if (!sid || !canManage) return
    const exists = docs.systemTemplatesCatalog.some((t) => t.id === sid)
    if (!exists) return
    setSystemPanelId(sid)
    setCustomPanelId(null)
    const next = new URLSearchParams(searchParams)
    next.delete('system')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, canManage, docs.systemTemplatesCatalog])

  useEffect(() => {
    if (!systemPanelId && !customPanelId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSystemPanelId(null)
        setCustomPanelId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [systemPanelId, customPanelId])

  async function toggleTemplate(id: string, next: boolean) {
    if (!canManage) return
    setBusyId(id)
    try {
      await docs.setSystemTemplateEnabled(id, next)
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreateCustom(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!form.label.trim()) {
      setFormErr('Tittel er påkrevd.')
      return
    }
    setBusyId('new')
    try {
      await docs.saveOrgCustomTemplate({
        label: form.label.trim(),
        description: form.description.trim(),
        category: form.category,
        legalBasis: [],
        page: {
          title: form.label.trim(),
          summary: form.description.trim(),
          status: 'draft',
          template: 'standard',
          legalRefs: [],
          requiresAcknowledgement: false,
          blocks: [{ kind: 'text', body: '<p>Rediger innholdet etter behov.</p>' }],
        },
      })
      setForm({ label: '', description: '', category: 'hms_handbook' })
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Kunne ikke lagre.')
    } finally {
      setBusyId(null)
    }
  }

  async function removeCustom(id: string) {
    if (!confirm('Slette denne malen?')) return
    setBusyId(id)
    try {
      await docs.deleteOrgCustomTemplate(id)
      setCustomPanelId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  if (!canManage) {
    return (
      <DocumentsModuleLayout>
        <WarningBox>Du har ikke tilgang til å administrere dokumentmaler.</WarningBox>
        <div className="mt-4 text-center">
          <Link to="/documents" className="text-sm font-medium text-[#1a3d32] underline">
            ← Tilbake til bibliotek
          </Link>
        </div>
      </DocumentsModuleLayout>
    )
  }

  return (
    <DocumentsModuleLayout
      subHeader={
        <p className="mt-2 border-b border-neutral-200/80 pb-4 text-sm text-neutral-600">
          Dokumentmaler for malbiblioteket: aktiver systemmaler, opprett egendefinerte maler, styr mappe-tilgang og
          bruk JSON for import/eksport. Klikk en rad for detaljer.
        </p>
      }
    >
      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}

      <DocumentFolderAccessSettings canManage={canManage} />

      <DocumentAccessRequestsPanel canManage={canManage} />

      {canManage ? (
        <ModuleSectionCard className="mb-8 p-4 md:p-5">
          <h2 className="text-sm font-semibold text-neutral-900">JSON — dokumenter og dokumentmaler</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Last ned eller last opp JSON i Klarert-format for sikkerhetskopiering og deling mellom miljøer.
          </p>
          {jsonErr ? (
            <div className="mt-3">
              <WarningBox>{jsonErr}</WarningBox>
            </div>
          ) : null}
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Dokument (wiki-side)</h3>
              <div>
                <span className="mb-1 block text-xs font-medium text-neutral-500">Velg dokument</span>
                <SearchableSelect
                  value={exportPageId}
                  options={pageExportOptions}
                  onChange={(v) => setExportPageId(v)}
                  disabled={pageExportOptions.length === 0 || jsonBusy}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                icon={<Download className="h-4 w-4" aria-hidden />}
                disabled={jsonBusy || pageExportOptions.length === 0}
                onClick={() => void handleExportPageJson()}
              >
                Last ned JSON
              </Button>
              <div className="border-t border-neutral-200/80 pt-3">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Målmappe for import</span>
                <SearchableSelect
                  value={importPageSpaceId}
                  options={spaceOptions}
                  onChange={(v) => setImportPageSpaceId(v)}
                  disabled={spaceOptions.length === 0 || jsonBusy}
                />
              </div>
              <input
                ref={pageImportRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void handleImportPageFile(f)
                }}
              />
              <Button
                type="button"
                variant="primary"
                icon={<Upload className="h-4 w-4" aria-hidden />}
                disabled={jsonBusy || spaceOptions.length === 0}
                onClick={() => pageImportRef.current?.click()}
              >
                Last opp dokument-JSON
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Dokumentmal</h3>
              <div>
                <span className="mb-1 block text-xs font-medium text-neutral-500">Velg mal</span>
                <SearchableSelect
                  value={exportTemplateId}
                  options={templateExportOptions}
                  onChange={(v) => setExportTemplateId(v)}
                  disabled={templateExportOptions.length === 0 || jsonBusy}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                icon={<Download className="h-4 w-4" aria-hidden />}
                disabled={jsonBusy || templateExportOptions.length === 0}
                onClick={() => handleExportTemplateJson()}
              >
                Last ned mal-JSON
              </Button>
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
                icon={<Upload className="h-4 w-4" aria-hidden />}
                disabled={jsonBusy}
                onClick={() => templateImportRef.current?.click()}
              >
                Last opp mal-JSON
              </Button>
            </div>
          </div>
        </ModuleSectionCard>
      ) : null}

      <ModuleSectionCard className="mb-8 p-4 md:p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Malbibliotek (brukerflate)</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Bruk maler og opprett sider fra{' '}
          <Link to="/documents/malbibliotek" className="font-medium text-[#1a3d32] underline">
            Malbibliotek
          </Link>
          {' '}
          (samme hub-layout som dokumentoversikten).
        </p>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Systemmaler</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Skru av maler dere ikke bruker — de skjules da i malbiblioteket for alle brukere.
        </p>
        <div className="mt-4">
          {docs.loading && systemCatalog.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
              <Loader2 className="size-5 animate-spin" />
              Laster maler…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className={MODULE_TABLE_TH}>Mal</th>
                    <th className={MODULE_TABLE_TH}>Kategori</th>
                    <th className={MODULE_TABLE_TH}>Aktiv</th>
                  </tr>
                </thead>
                <tbody>
                  {systemCatalog.map((t) => {
                    const row = docs.orgTemplateSettings.find((s) => s.templateId === t.id)
                    const enabled = row ? row.enabled : true
                    return (
                      <tr
                        key={t.id}
                        className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                        onClick={() => setSystemPanelId(t.id)}
                      >
                        <td className="px-5 py-4 align-middle">
                          <span className="font-medium text-[#1a3d32]">{t.label}</span>
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{t.description}</p>
                        </td>
                        <td className="px-5 py-4 align-middle text-xs text-neutral-600">{CATEGORY_LABELS[t.category]}</td>
                        <td className="px-5 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {busyId === t.id ? (
                              <Loader2 className="size-4 animate-spin text-neutral-400" />
                            ) : (
                              <ToggleSwitch
                                checked={enabled}
                                onChange={(v) => void toggleTemplate(t.id, v)}
                                label={`Aktiv for ${t.label}`}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="mt-6 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Organisasjonsspesifikke maler</h2>
        <p className="mt-1 text-xs text-neutral-500">Egne maler vises sammen med systemmalene når de er aktive.</p>

        <form onSubmit={(e) => void handleCreateCustom(e)} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-custom-title">
              Tittel
            </label>
            <StandardInput
              id="tpl-custom-title"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="F.eks. Intern revisjon — sjekkliste"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-custom-desc">
              Beskrivelse
            </label>
            <StandardInput
              id="tpl-custom-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Kort beskrivelse"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-custom-cat">
              Kategori
            </label>
            <SearchableSelect
              value={form.category}
              options={categoryOptions}
              onChange={(v) => setForm((f) => ({ ...f, category: v as SpaceCategory }))}
            />
          </div>
          {formErr ? <WarningBox>{formErr}</WarningBox> : null}
          <Button type="submit" variant="primary" icon={<Plus className="h-4 w-4" />} disabled={busyId === 'new'}>
            {busyId === 'new' ? 'Lagrer…' : 'Legg til mal'}
          </Button>
        </form>

        {customOnly.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200/80">
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-neutral-900">Dine maler</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className={MODULE_TABLE_TH}>Tittel</th>
                  <th className={MODULE_TABLE_TH}>Handling</th>
                </tr>
              </thead>
              <tbody>
                {customOnly.map((t) => (
                  <tr
                    key={t.id}
                    className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                    onClick={() => setCustomPanelId(t.id)}
                  >
                    <td className="px-5 py-4 align-middle">
                      <span className="font-medium text-[#1a3d32]">{t.label}</span>
                      <p className="mt-1 text-xs text-neutral-500">{t.description}</p>
                    </td>
                    <td className="px-5 py-4 align-middle text-xs text-neutral-500" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => void removeCustom(t.id)}
                        disabled={busyId === t.id}
                      >
                        {busyId === t.id ? <Loader2 className="size-4 animate-spin" /> : 'Slett'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>

      {(systemPanelTpl || customPanelTpl) && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <Button
            type="button"
            variant="ghost"
            aria-label="Lukk"
            className="absolute inset-0 h-auto min-h-0 rounded-none bg-black/40 p-0 hover:bg-black/50"
            onClick={() => {
              setSystemPanelId(null)
              setCustomPanelId(null)
            }}
          />
          <div
            className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {systemPanelTpl?.label ?? customPanelTpl?.label}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Lukk panel"
                onClick={() => {
                  setSystemPanelId(null)
                  setCustomPanelId(null)
                }}
                icon={<X className="h-5 w-5" />}
              />
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {systemPanelTpl && (
                <>
                  <p className="text-neutral-600">{systemPanelTpl.description}</p>
                  <p className="text-xs text-neutral-500">Kategori: {CATEGORY_LABELS[systemPanelTpl.category]}</p>
                  <div className="flex items-center gap-3 rounded-md border border-neutral-200 p-3">
                    {busyId === systemPanelTpl.id ? (
                      <Loader2 className="size-4 animate-spin text-neutral-400" />
                    ) : (
                      <ToggleSwitch
                        checked={docs.orgTemplateSettings.find((s) => s.templateId === systemPanelTpl.id)?.enabled ?? true}
                        onChange={(v) => void toggleTemplate(systemPanelTpl.id, v)}
                        label="Aktiv i malbiblioteket"
                      />
                    )}
                    <span className="text-sm text-neutral-700">Aktiv i malbiblioteket</span>
                  </div>
                </>
              )}
              {customPanelTpl && (
                <>
                  <p className="text-neutral-600">{customPanelTpl.description || 'Ingen beskrivelse.'}</p>
                  <Button
                    type="button"
                    variant="danger"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => void removeCustom(customPanelTpl.id)}
                    disabled={busyId === customPanelTpl.id}
                  >
                    {busyId === customPanelTpl.id ? 'Sletter…' : 'Slett mal'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DocumentsModuleLayout>
  )
}
