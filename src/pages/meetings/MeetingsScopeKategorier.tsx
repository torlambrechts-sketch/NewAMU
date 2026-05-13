// Settings-hub wrapper for the Møter "Kategorier" tab. Mirrors the
// `CategoriesTab` internal function in `MeetingsAdminPage.tsx:405`.

import { useState, type FormEvent } from 'react'
import { FolderTree, Plus, Save } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { useMeetings } from '../../../modules/meetings'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function MeetingsScopeKategorier() {
  const meetings = useMeetings()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      const ok = await meetings.upsertCategory({
        slug: slug.trim() || slugify(name),
        name: name.trim(),
        description: description.trim() || null,
      })
      if (ok) {
        setName('')
        setSlug('')
        setDescription('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Kategorier</h2>
          </div>
          <span className="text-xs text-neutral-500">{meetings.categories.length}</span>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Kategorier bestemmer hvordan maler grupperes i hovedsiden og sidemenyen.
        </p>
        {meetings.categories.length === 0 ? (
          <p className="mt-5 text-sm text-neutral-600">Ingen kategorier ennå.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {meetings.categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{c.slug}</p>
                  {c.description ? (
                    <p className="mt-2 text-xs text-neutral-600">{c.description}</p>
                  ) : null}
                </div>
                <FolderTree className="h-4 w-4 shrink-0 text-neutral-400" />
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <h3 className="text-sm font-semibold text-neutral-900">Ny kategori</h3>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-cat-name-scope">
              Navn
            </label>
            <StandardInput
              id="meetings-cat-name-scope"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-cat-slug-scope">
              Slug
            </label>
            <StandardInput
              id="meetings-cat-slug-scope"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="autogenerert fra navnet"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-cat-desc-scope">
              Beskrivelse
            </label>
            <StandardTextarea
              id="meetings-cat-desc-scope"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              variant="primary"
              type="submit"
              icon={<Plus className="h-4 w-4" />}
              disabled={busy || !name.trim()}
            >
              <Save className="h-4 w-4" /> Lagre
            </Button>
          </div>
        </form>
      </ModuleSectionCard>
    </div>
  )
}
