// Møter — admin (Innstillinger).
//
// Two tabs: system templates list (toggle / category / pin / rename per
// org via meeting_org_template_settings) and categories CRUD. Mirrors
// the documents/survey admin shape but stays slim for v1.

import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FolderTree, Pin, Save, Settings } from 'lucide-react'
import { useMeetings } from '../../../modules/meetings'
import { MEETING_CADENCE_LABEL, frameworkLabel } from '../../../modules/meetings/meetingsLabels'

type Tab = 'templates' | 'categories'

const TABS: { id: Tab; label: string }[] = [
  { id: 'templates', label: 'Maler' },
  { id: 'categories', label: 'Kategorier' },
]

export function MeetingsAdminPage() {
  const meetings = useMeetings()
  const [tab, setTab] = useState<Tab>('templates')

  if (!meetings.canManage) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-neutral-700">
        Du har ikke tilgang til å administrere møtemodulen. Be administrator om
        permisjonen <code>meetings.manage</code>.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <Link
            to="/meetings"
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3 w-3" /> Møter
          </Link>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-900">
            Innstillinger
          </h1>
          <p className="mt-1 text-sm text-neutral-700">
            Slå på/av systemmaler, knytt dem til kategorier og fest favoritter i sidemenyen.
          </p>
        </div>
        <Settings className="h-7 w-7 text-neutral-400" />
      </header>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-semibold ${
                active
                  ? 'border-b-2 border-cyan-700 text-cyan-700'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {tab === 'templates' ? <TemplatesTab /> : null}
      {tab === 'categories' ? <CategoriesTab /> : null}
    </div>
  )
}

function TemplatesTab() {
  const meetings = useMeetings()
  const settingsById = useMemo(() => {
    const m = new Map<string, (typeof meetings.orgSettings)[number]>()
    for (const s of meetings.orgSettings) m.set(s.system_template_id, s)
    return m
  }, [meetings.orgSettings])

  return (
    <table className="w-full border border-neutral-200 bg-white text-sm">
      <thead className="bg-neutral-50 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
        <tr>
          <th className="px-3 py-2 text-left">Mal</th>
          <th className="px-3 py-2 text-left">Rammeverk</th>
          <th className="px-3 py-2 text-left">Kadens</th>
          <th className="px-3 py-2 text-left">Kategori</th>
          <th className="px-3 py-2 text-center">Aktiv</th>
          <th className="px-3 py-2 text-center">Festet</th>
        </tr>
      </thead>
      <tbody>
        {meetings.systemTemplates.map((t) => {
          const setting = settingsById.get(t.id)
          const enabled = setting?.enabled ?? true
          const pinned = setting?.nav_pinned ?? false
          const categoryId = setting?.category_id ?? null
          return (
            <tr key={t.id} className="border-t border-neutral-100 align-top">
              <td className="px-3 py-2">
                <div className="font-semibold text-neutral-900">
                  {setting?.override_name ?? t.label}
                </div>
                {t.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                ) : null}
              </td>
              <td className="px-3 py-2 text-xs">{frameworkLabel(t.framework)}</td>
              <td className="px-3 py-2 text-xs">
                {t.cadence_hint ? MEETING_CADENCE_LABEL[t.cadence_hint] : '—'}
              </td>
              <td className="px-3 py-2">
                <select
                  className="w-full border border-neutral-300 bg-white px-1.5 py-1 text-xs"
                  value={categoryId ?? ''}
                  onChange={(e) =>
                    void meetings.setTemplateCategory(t.id, e.target.value || null)
                  }
                >
                  <option value="">— Uten kategori —</option>
                  {meetings.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => void meetings.setTemplateEnabled(t.id, e.target.checked)}
                  aria-label={`Aktiv: ${t.label}`}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  onClick={() => void meetings.setTemplatePinned(t.id, !pinned)}
                  aria-label={`Festet: ${t.label}`}
                  className={pinned ? 'text-cyan-700' : 'text-neutral-400 hover:text-neutral-700'}
                >
                  <Pin className="h-4 w-4" />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function CategoriesTab() {
  const meetings = useMeetings()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const ok = await meetings.upsertCategory({
        slug:
          slug.trim() ||
          name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        name: name.trim(),
      })
      if (ok) {
        setName('')
        setSlug('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        {meetings.categories.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen kategorier ennå.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
            {meetings.categories.map((c) => (
              <li key={c.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                    <p className="text-[11px] text-neutral-500">{c.slug}</p>
                  </div>
                  <FolderTree className="h-4 w-4 text-neutral-400" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside>
        <form onSubmit={handleAdd} className="space-y-2 border border-neutral-200 bg-white p-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Ny kategori
          </h2>
          <label className="block text-xs text-neutral-700">
            Navn
            <input
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-xs text-neutral-700">
            Slug (valgfritt)
            <input
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="autogenerert fra navnet"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Lagre
          </button>
        </form>
      </aside>
    </div>
  )
}
