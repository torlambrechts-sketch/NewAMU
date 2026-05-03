import { useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { useDocuments } from '../../../hooks/useDocuments'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { PageTemplate, SpaceCategory } from '../../../types/documents'
import { ModuleSectionCard } from '../../module/ModuleSectionCard'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../module/moduleTableKit'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { WarningBox } from '../../ui/AlertBox'
import { ToggleSwitch } from '../../ui/FormToggles'

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

export function DocumentsSettingsMaler() {
  const docs = useDocuments()
  const { profile, can } = useOrgSetupContext()
  const canManage = profile?.is_org_admin === true || can('documents.manage')

  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({ label: '', description: '', category: 'hms_handbook' as SpaceCategory })
  const [formErr, setFormErr] = useState<string | null>(null)
  const [panelId, setPanelId] = useState<string | null>(null)

  const systemCatalog = docs.systemTemplatesCatalog
  const customOnly = docs.pageTemplates.filter((t: PageTemplate) =>
    docs.orgCustomTemplates.some((c) => c.id === t.id),
  )
  const panelTpl = useMemo(
    () => (panelId ? [...systemCatalog, ...customOnly].find((t) => t.id === panelId) ?? null : null),
    [panelId, systemCatalog, customOnly],
  )
  const isCustomPanel = panelId ? customOnly.some((t) => t.id === panelId) : false

  async function toggleTemplate(id: string, next: boolean) {
    setBusyId(id)
    try { await docs.setSystemTemplateEnabled(id, next) }
    catch (e) { console.error(e) }
    finally { setBusyId(null) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!form.label.trim()) { setFormErr('Tittel er påkrevd.'); return }
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
    } finally { setBusyId(null) }
  }

  async function removeCustom(id: string) {
    if (!confirm('Slette denne malen?')) return
    setBusyId(id)
    try { await docs.deleteOrgCustomTemplate(id); setPanelId(null) }
    catch (e) { console.error(e) }
    finally { setBusyId(null) }
  }

  if (!canManage) {
    return <WarningBox>Du har ikke tilgang til å administrere dokumentmaler.</WarningBox>
  }

  return (
    <div className="space-y-6">
      {/* System templates */}
      <ModuleSectionCard className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-900">Systemmaler</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Skru av maler dere ikke bruker — de skjules da i malbiblioteket for alle brukere.
          </p>
        </div>
        {docs.loading && systemCatalog.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500">
            <Loader2 className="size-5 animate-spin" /> Laster maler…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
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
                    <tr key={t.id} className={`${MODULE_TABLE_TR_BODY} cursor-pointer`} onClick={() => setPanelId(t.id)}>
                      <td className="px-5 py-3 align-middle">
                        <span className="font-medium text-[#1a3d32]">{t.label}</span>
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{t.description}</p>
                      </td>
                      <td className="px-5 py-3 align-middle text-xs text-neutral-600">{CATEGORY_LABELS[t.category]}</td>
                      <td className="px-5 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        {busyId === t.id ? (
                          <Loader2 className="size-4 animate-spin text-neutral-400" />
                        ) : (
                          <ToggleSwitch checked={enabled} onChange={(v) => void toggleTemplate(t.id, v)} label={`Aktiv: ${t.label}`} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>

      {/* Custom templates */}
      <ModuleSectionCard className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-900">Organisasjonsspesifikke maler</h2>
          <p className="mt-0.5 text-sm text-neutral-500">Egne maler vises sammen med systemmalene i malbiblioteket.</p>
        </div>
        <div className="p-5">
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3 max-w-lg">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-title">Tittel</label>
              <StandardInput id="tpl-title" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="F.eks. Intern revisjon — sjekkliste" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-desc">Beskrivelse</label>
              <StandardInput id="tpl-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Kort beskrivelse" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="tpl-cat">Kategori</label>
              <SearchableSelect value={form.category} options={categoryOptions} onChange={(v) => setForm((f) => ({ ...f, category: v as SpaceCategory }))} />
            </div>
            {formErr ? <WarningBox>{formErr}</WarningBox> : null}
            <Button type="submit" variant="primary" icon={<Plus className="h-4 w-4" />} disabled={busyId === 'new'}>
              {busyId === 'new' ? 'Lagrer…' : 'Legg til mal'}
            </Button>
          </form>

          {customOnly.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200/80">
              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-neutral-900">Dine maler ({customOnly.length})</h3>
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
                    <tr key={t.id} className={`${MODULE_TABLE_TR_BODY} cursor-pointer`} onClick={() => setPanelId(t.id)}>
                      <td className="px-5 py-3 align-middle">
                        <span className="font-medium text-[#1a3d32]">{t.label}</span>
                        <p className="mt-0.5 text-xs text-neutral-500">{t.description}</p>
                      </td>
                      <td className="px-5 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <Button type="button" variant="danger" size="sm" onClick={() => void removeCustom(t.id)} disabled={busyId === t.id}>
                          {busyId === t.id ? <Loader2 className="size-4 animate-spin" /> : 'Slett'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ModuleSectionCard>

      {/* Detail side panel */}
      {panelTpl && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <Button type="button" variant="ghost" aria-label="Lukk" className="absolute inset-0 h-auto min-h-0 rounded-none bg-black/40 p-0 hover:bg-black/50" onClick={() => setPanelId(null)} />
          <div className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{panelTpl.label}</h2>
              <Button type="button" variant="ghost" size="icon" aria-label="Lukk panel" onClick={() => setPanelId(null)} icon={<X className="h-5 w-5" />} />
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <p className="text-neutral-600">{panelTpl.description || 'Ingen beskrivelse.'}</p>
              <p className="text-xs text-neutral-500">Kategori: {CATEGORY_LABELS[panelTpl.category]}</p>
              {!isCustomPanel && (
                <div className="flex items-center gap-3 rounded-md border border-neutral-200 p-3">
                  {busyId === panelTpl.id ? (
                    <Loader2 className="size-4 animate-spin text-neutral-400" />
                  ) : (
                    <ToggleSwitch
                      checked={docs.orgTemplateSettings.find((s) => s.templateId === panelTpl.id)?.enabled ?? true}
                      onChange={(v) => void toggleTemplate(panelTpl.id, v)}
                      label="Aktiv i malbiblioteket"
                    />
                  )}
                  <span className="text-sm text-neutral-700">Aktiv i malbiblioteket</span>
                </div>
              )}
              {isCustomPanel && (
                <Button type="button" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => void removeCustom(panelTpl.id)} disabled={busyId === panelTpl.id}>
                  {busyId === panelTpl.id ? 'Sletter…' : 'Slett mal'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
