// /registers/admin — settings for the registers engine.
// Per-org admin can:
//   - Toggle register types on/off
//   - Override the type's name in the sidebar
//   - Assign a category
//   - Manage categories (CRUD via the shared CategoryReorderList)
//   - Author custom register types (RegisterTypeEditorPanel)

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FolderTree, Layers, Plus, Sparkles } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { StandardInput } from '../../components/ui/Input'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters } from '../../hooks/useRegisters'
import { RegisterTypeEditorPanel } from '../../components/registers/RegisterTypeEditorPanel'

export function RegistersAdminPage() {
  const orgSetup = useOrgSetupContext()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const [editorOpen, setEditorOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Uten kategori' },
      ...registers.categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [registers.categories],
  )

  const handleAddCategory = async () => {
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
    <ModulePageShell
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Register', to: '/registers' },
        { label: 'Innstillinger' },
      ]}
      title="Innstillinger — Register"
      description="Skru av/på registertyper, opprett egne, og organiser dem i kategorier."
      headerActions={
        <Link
          to="/registers"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake
        </Link>
      }
    >
      {registers.error ? <WarningBox>{registers.error}</WarningBox> : null}

      <div className="space-y-6">
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#1a3d32]" aria-hidden />
              <h2 className="text-lg font-semibold text-neutral-900">Egne registertyper</h2>
            </div>
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setEditorOpen(true)}
            >
              Opprett registertype
            </Button>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Definér egne registertyper med felter tilpasset organisasjonens behov —
            f.eks. kjøretøyregister, måleinstrumenter, eller egne kontrolltiltak.
          </p>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Kategorier</h2>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Grupper registertyper i sidebaren. Hver registertype kan tilhøre én kategori
            (eller stå under «Uten kategori»).
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="new-cat">
                Ny kategori
              </label>
              <StandardInput
                id="new-cat"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddCategory()
                  }
                }}
                placeholder="F.eks. Personvern"
                className="mt-1.5"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => void handleAddCategory()}
              disabled={!newCategoryName.trim()}
            >
              Legg til
            </Button>
          </div>
          {registers.categories.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-center text-xs text-neutral-500">
              Ingen kategorier ennå.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {registers.categories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200/80 bg-neutral-50/40 px-3 py-2"
                >
                  <span className="text-sm font-medium text-neutral-900">{c.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm(`Slette kategorien «${c.name}»? Tilknyttede registre flyttes til "Uten kategori".`)) return
                      void registers.softDeleteCategory(c.id)
                    }}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Slett
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Registertyper</h2>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Skru av en type for å skjule den fra sidebaren. Endre kategori for å
            gruppere den annerledes.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/60">
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    Navn
                  </th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    Regelverk
                  </th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    Kategori
                  </th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    Aktiv
                  </th>
                </tr>
              </thead>
              <tbody>
                {registers.types.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100">
                    <td className="px-3 py-2.5 align-top text-sm text-neutral-900">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.resolvedName}</span>
                        {t.isSystem ? <Badge variant="info">System</Badge> : <Badge variant="neutral">Egen</Badge>}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500">{t.id}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top text-xs text-neutral-700">
                      {t.regulationIds.length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {t.regulationIds.map((rid) => (
                            <Badge key={rid} variant="info">{rid.toUpperCase()}</Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <SearchableSelect
                        value={t.categoryId ?? ''}
                        options={categoryOptions}
                        onChange={(v) =>
                          void registers.setTypeCategory(t.id, v || null)
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ToggleSwitch
                        checked={t.isEnabledForOrg}
                        onChange={(v) => void registers.setTypeEnabled(t.id, v)}
                        label={`Aktiv ${t.resolvedName}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModuleSectionCard>
      </div>

      <RegisterTypeEditorPanel
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSubmit={async (payload) => {
          const id = await registers.createOrgType({
            slug: payload.slug,
            name: payload.name,
            description: payload.description,
            metadataSchema: payload.metadataSchema,
            regulationIds: payload.regulationIds,
            defaultReviewCadenceMonths: payload.defaultReviewCadenceMonths,
          })
          return id !== null
        }}
      />
    </ModulePageShell>
  )
}
