// /registers/admin — settings for the registers engine.
// Tabbed layout matching the compliance admin pattern:
//   Registertyper  — enable/disable system types + create custom types
//   Kategorier     — category CRUD (groups types in sidebar)

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Beaker,
  Building2,
  FolderTree,
  Layers,
  Lock,
  Package,
  Pin,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { StandardInput } from '../../components/ui/Input'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters } from '../../hooks/useRegisters'
import { RegisterTypeEditorPanel } from '../../components/registers/RegisterTypeEditorPanel'

type AdminTab = 'typer' | 'kategorier'

const TAB_ITEMS: TabItem[] = [
  { id: 'typer', label: 'Registertyper', icon: Layers },
  { id: 'kategorier', label: 'Kategorier', icon: FolderTree },
]

// Per-type icon map — keyed by register type ID (system slugs).
// Custom org types fall back to Package.
const TYPE_ICON_MAP: Record<string, React.ElementType> = {
  chemicals: Beaker,
  external_suppliers: Building2,
  gdpr_processing_activities: Lock,
}

function RegisterTypeIcon({ typeId, className = 'h-5 w-5' }: { typeId: string; className?: string }) {
  const Icon = TYPE_ICON_MAP[typeId] ?? Package
  return <Icon className={className} aria-hidden />
}

export function RegistersAdminPage() {
  const orgSetup = useOrgSetupContext()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const [tab, setTab] = useState<AdminTab>('typer')
  const [editorOpen, setEditorOpen] = useState(false)

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Uten kategori' },
      ...registers.categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [registers.categories],
  )

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
      tabs={
        <Tabs
          items={TAB_ITEMS}
          activeId={tab}
          onChange={(id) => setTab(id as AdminTab)}
          overflow="scroll"
        />
      }
    >
      {registers.error ? <WarningBox>{registers.error}</WarningBox> : null}

      {tab === 'typer' && (
        <RegistertyperTab
          registers={registers}
          categoryOptions={categoryOptions}
          editorOpen={editorOpen}
          setEditorOpen={setEditorOpen}
        />
      )}
      {tab === 'kategorier' && (
        <KategorierTab registers={registers} />
      )}
    </ModulePageShell>
  )
}

// ── Registertyper tab ─────────────────────────────────────────────────────────

type RegistersHook = ReturnType<typeof useRegisters>

function RegistertyperTab({
  registers,
  categoryOptions,
  editorOpen,
  setEditorOpen,
}: {
  registers: RegistersHook
  categoryOptions: { value: string; label: string }[]
  editorOpen: boolean
  setEditorOpen: (v: boolean) => void
}) {
  return (
    <div className="space-y-6">
      {/* Create custom type */}
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

      {/* System + custom types table */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Alle registertyper</h2>
        </div>
        <p className="mt-1.5 mb-4 text-sm text-neutral-600">
          Skru av en type for å skjule den fra sidebaren. Endre kategori for å
          gruppere den annerledes.
        </p>

        <ul className="space-y-3">
          {registers.types.length === 0 ? (
            <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
              Ingen registertyper tilgjengelig.
            </li>
          ) : (
            registers.types.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="mt-0.5 shrink-0 rounded-md border border-neutral-200 bg-white p-2">
                      <RegisterTypeIcon typeId={t.id} className="h-4 w-4 text-[#1a3d32]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">{t.resolvedName}</span>
                        {t.isSystem ? <Badge variant="info">System</Badge> : <Badge variant="neutral">Egen</Badge>}
                        {!t.isEnabledForOrg ? <Badge variant="neutral">Inaktiv</Badge> : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500">{t.id}</p>
                      {t.regulationIds.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {t.regulationIds.map((rid) => (
                            <Badge key={rid} variant="info">{rid.toUpperCase()}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="w-44">
                      <SearchableSelect
                        value={t.categoryId ?? ''}
                        options={categoryOptions}
                        onChange={(v) => void registers.setTypeCategory(t.id, v || null)}
                        triggerClassName="py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200/80 pt-3 text-xs text-neutral-700">
                  <label className="inline-flex items-center gap-2">
                    <ToggleSwitch
                      checked={t.isEnabledForOrg}
                      onChange={(v) => void registers.setTypeEnabled(t.id, v)}
                      label={`Aktiv: ${t.resolvedName}`}
                    />
                    <span>Aktiv</span>
                  </label>
                </div>
              </li>
            ))
          )}
        </ul>
      </ModuleSectionCard>

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
    </div>
  )
}

// ── Kategorier tab ────────────────────────────────────────────────────────────

function KategorierTab({ registers }: { registers: RegistersHook }) {
  const [newCategoryName, setNewCategoryName] = useState('')

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
    <div className="space-y-6">
      {/* Create */}
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
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="new-cat">
              Navn
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
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => void handleAddCategory()}
            disabled={!newCategoryName.trim()}
          >
            Legg til
          </Button>
        </div>
      </ModuleSectionCard>

      {/* List */}
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
                    if (!window.confirm(`Slette kategorien «${c.name}»? Tilknyttede registre flyttes til "Uten kategori".`)) return
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
