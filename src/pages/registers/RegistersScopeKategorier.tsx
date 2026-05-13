// Settings-hub wrapper for the "Kategorier" tab. Mirrors the
// `KategorierTab` internal component in `RegistersAdminPage.tsx:244` so
// the unified settings shell can render it standalone via React.lazy.

import { useState } from 'react'
import { FolderTree, Pin, Plus, Trash2 } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters } from '../../hooks/useRegisters'

export default function RegistersScopeKategorier() {
  const { supabase } = useOrgSetupContext()
  const registers = useRegisters({ supabase })
  const [newCategoryName, setNewCategoryName] = useState('')

  const handleAdd = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    await registers.createCategory({
      slug: slug || `kategori-${Date.now()}`,
      name,
      position: (registers.categories.length + 1) * 10,
    })
    setNewCategoryName('')
  }

  return (
    <div className="space-y-6">
      {registers.error ? <WarningBox>{registers.error}</WarningBox> : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderTree className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Ny kategori</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-600">
          Grupper registertyper i sidebaren. Hver registertype kan tilhøre én kategori
          (eller stå under «Uten kategori»).
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="new-cat-scope">
              Navn
            </label>
            <StandardInput
              id="new-cat-scope"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
              placeholder="F.eks. Personvern"
              className="mt-1.5"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => void handleAdd()}
            disabled={!newCategoryName.trim()}
          >
            Legg til
          </Button>
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Kategorier</h2>
          </div>
          <span className="text-xs text-neutral-500">{registers.categories.length}</span>
        </div>

        {registers.categories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
            Ingen kategorier ennå. Opprett den første over.
          </p>
        ) : (
          <ul className="space-y-3">
            {registers.categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/40 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Pin className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <span className="text-sm font-medium text-neutral-900">{c.name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Slette kategorien «${c.name}»? Tilknyttede registre flyttes til "Uten kategori".`,
                      )
                    )
                      return
                    void registers.softDeleteCategory(c.id)
                  }}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Slett ${c.name}`}
                >
                  Slett
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>
    </div>
  )
}
