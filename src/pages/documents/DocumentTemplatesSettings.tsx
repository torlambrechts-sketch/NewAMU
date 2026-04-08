import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PageTemplate, SpaceCategory } from '../../types/documents'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'

const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

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

const INPUT = 'mt-1 w-full rounded-none border border-neutral-200 px-3 py-2 text-sm'
const BTN_PRIMARY =
  'inline-flex items-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-50'

export function DocumentTemplatesSettings() {
  const docs = useDocuments()
  const { can } = useOrgSetupContext()
  const canManage = can('documents.manage')

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
        <p className="mt-8 text-center text-neutral-600">Du har ikke tilgang til å administrere dokumentmaler.</p>
        <div className="mt-4 text-center">
          <Link to="/documents" className="text-[#1a3d32] underline">
            ← Tilbake til bibliotek
          </Link>
        </div>
      </DocumentsModuleLayout>
    )
  }

  return (
    <DocumentsModuleLayout
      subHeader={
        <p className="mt-6 border-b border-neutral-200/80 pb-6 text-sm text-neutral-600">
          Aktiver eller skjul systemmaler for organisasjonen, og opprett egne maler som vises i malbiblioteket. Klikk en
          rad for detaljer.
        </p>
      }
    >
      {docs.error && (
        <div className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {docs.error}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Systemmaler</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Skru av maler dere ikke bruker — de skjules da i malbiblioteket for alle brukere.
        </p>
        <div className="mt-4 overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
          {docs.loading && systemCatalog.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-neutral-500">
              <Loader2 className="size-5 animate-spin" />
              Laster maler…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Mal</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Aktiv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {systemCatalog.map((t) => {
                    const row = docs.orgTemplateSettings.find((s) => s.templateId === t.id)
                    const enabled = row ? row.enabled : true
                    return (
                      <tr
                        key={t.id}
                        className="cursor-pointer transition-colors hover:bg-neutral-50"
                        onClick={() => setSystemPanelId(t.id)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#1a3d32]">{t.label}</span>
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{t.description}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-600">{CATEGORY_LABELS[t.category]}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                            <input
                              type="checkbox"
                              className="size-4 rounded-none border-neutral-300"
                              checked={enabled}
                              disabled={busyId === t.id}
                              onChange={(e) => void toggleTemplate(t.id, e.target.checked)}
                            />
                            {busyId === t.id ? <Loader2 className="size-4 animate-spin" /> : null}
                          </label>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Organisasjonsspesifikke maler</h2>
        <p className="mt-1 text-xs text-neutral-500">Egne maler vises sammen med systemmalene når de er aktive.</p>

        <form onSubmit={(e) => void handleCreateCustom(e)} className="mt-4 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">Tittel</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className={INPUT}
                placeholder="F.eks. Intern revisjon — sjekkliste"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">Beskrivelse</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={INPUT}
                placeholder="Kort beskrivelse"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SpaceCategory }))}
                className={`${INPUT} bg-white`}
              >
                {(Object.keys(CATEGORY_LABELS) as SpaceCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
          <button type="submit" disabled={busyId === 'new'} className={`${BTN_PRIMARY} mt-4`}>
            {busyId === 'new' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Legg til mal
          </button>
        </form>

        {customOnly.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-neutral-900">Dine maler</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">Tittel</th>
                    <th className="px-4 py-3">Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {customOnly.map((t) => (
                    <tr
                      key={t.id}
                      className="cursor-pointer transition-colors hover:bg-neutral-50"
                      onClick={() => setCustomPanelId(t.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#1a3d32]">{t.label}</span>
                        <p className="mt-1 text-xs text-neutral-500">{t.description}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => void removeCustom(t.id)}
                          disabled={busyId === t.id}
                          className="rounded-none border border-red-200 bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {busyId === t.id ? <Loader2 className="size-4 animate-spin" /> : 'Slett'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {(systemPanelTpl || customPanelTpl) && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Lukk"
            className="absolute inset-0 bg-black/40"
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
              <button
                type="button"
                onClick={() => {
                  setSystemPanelId(null)
                  setCustomPanelId(null)
                }}
                className="rounded-none p-2 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {systemPanelTpl && (
                <>
                  <p className="text-neutral-600">{systemPanelTpl.description}</p>
                  <p className="text-xs text-neutral-500">Kategori: {CATEGORY_LABELS[systemPanelTpl.category]}</p>
                  <label className="flex cursor-pointer items-center gap-2 border border-neutral-200 p-3">
                    <input
                      type="checkbox"
                      className="size-4 rounded-none border-neutral-300"
                      checked={
                        docs.orgTemplateSettings.find((s) => s.templateId === systemPanelTpl.id)?.enabled ?? true
                      }
                      disabled={busyId === systemPanelTpl.id}
                      onChange={(e) => void toggleTemplate(systemPanelTpl.id, e.target.checked)}
                    />
                    <span>Aktiv i malbiblioteket</span>
                    {busyId === systemPanelTpl.id ? <Loader2 className="size-4 animate-spin" /> : null}
                  </label>
                </>
              )}
              {customPanelTpl && (
                <>
                  <p className="text-neutral-600">{customPanelTpl.description || 'Ingen beskrivelse.'}</p>
                  <button
                    type="button"
                    onClick={() => void removeCustom(customPanelTpl.id)}
                    disabled={busyId === customPanelTpl.id}
                    className="inline-flex items-center gap-2 rounded-none border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    {busyId === customPanelTpl.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Slett mal
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DocumentsModuleLayout>
  )
}
