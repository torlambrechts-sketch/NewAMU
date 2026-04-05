import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { PageTemplate, SpaceCategory } from '../../types/documents'

const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

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

  const systemCatalog = docs.systemTemplatesCatalog

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
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  const customOnly = docs.pageTemplates.filter((t: PageTemplate) =>
    docs.orgCustomTemplates.some((c) => c.id === t.id),
  )

  if (!canManage) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-600">
        Du har ikke tilgang til å administrere dokumentmaler.
        <div className="mt-4">
          <Link to="/documents" className="text-[#1a3d32] underline">← Tilbake</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link to="/documents" className="inline-flex items-center gap-1 hover:text-[#1a3d32]">
          <ArrowLeft className="size-4" />
          Documents
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-neutral-800">Malinnstillinger</span>
      </nav>

      <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
        Dokumentmaler
      </h1>
      <p className="mt-1 text-sm text-neutral-600">
        Aktiver eller skjul systemmaler for organisasjonen, og opprett egne maler som vises i malbiblioteket.
      </p>

      {docs.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{docs.error}</div>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-neutral-800">Systemmaler</h2>
        <p className="mt-1 text-xs text-neutral-500">Skru av maler dere ikke bruker — de skjules da i malbiblioteket for alle brukere.</p>
        <div className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
          {docs.loading && systemCatalog.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-neutral-500">
              <Loader2 className="size-5 animate-spin" />
              Laster maler…
            </div>
          ) : (
            systemCatalog.map((t) => {
              const row = docs.orgTemplateSettings.find((s) => s.templateId === t.id)
              const enabled = row ? row.enabled : true
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900">{t.label}</div>
                    <div className="text-xs text-neutral-500 line-clamp-2">{t.description}</div>
                    <div className="mt-1 text-[10px] text-neutral-400">{CATEGORY_LABELS[t.category]}</div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      className="rounded border-neutral-300"
                      checked={enabled}
                      disabled={busyId === t.id}
                      onChange={(e) => void toggleTemplate(t.id, e.target.checked)}
                    />
                    {busyId === t.id ? <Loader2 className="size-4 animate-spin" /> : 'Aktiv'}
                  </label>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-800">Organisasjonsspesifikke maler</h2>
        <p className="mt-1 text-xs text-neutral-500">Egne maler vises sammen med systemmalene når de er aktive.</p>

        <form onSubmit={(e) => void handleCreateCustom(e)} className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">Tittel</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="F.eks. Intern revisjon — sjekkliste"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">Beskrivelse</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                placeholder="Kort beskrivelse"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SpaceCategory }))}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {(Object.keys(CATEGORY_LABELS) as SpaceCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>
          {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
          <button
            type="submit"
            disabled={busyId === 'new'}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-50"
          >
            {busyId === 'new' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Legg til mal
          </button>
        </form>

        {customOnly.length > 0 && (
          <ul className="mt-4 space-y-2">
            {customOnly.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-neutral-900">{t.label}</div>
                  <div className="text-xs text-neutral-500">{t.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeCustom(t.id)}
                  disabled={busyId === t.id}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Slett"
                >
                  {busyId === t.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
