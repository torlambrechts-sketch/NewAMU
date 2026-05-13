// Settings-hub wrapper for the "Registertyper" tab. Mirrors the
// `RegistertyperTab` internal component in `RegistersAdminPage.tsx:116`
// so the unified settings shell can render it standalone via React.lazy.
// Owns its own `editorOpen` state (lifted out of the legacy parent page).

import { useMemo, useState } from 'react'
import { Beaker, Building2, Layers, Lock, Package, Plus, Sparkles } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters } from '../../hooks/useRegisters'
import { RegisterTypeEditorPanel } from '../../components/registers/RegisterTypeEditorPanel'

const TYPE_ICON_MAP: Record<string, React.ElementType> = {
  chemicals: Beaker,
  external_suppliers: Building2,
  gdpr_processing_activities: Lock,
}

function TypeIcon({ typeId, className = 'h-5 w-5' }: { typeId: string; className?: string }) {
  const Icon = TYPE_ICON_MAP[typeId] ?? Package
  return <Icon className={className} aria-hidden />
}

export default function RegistersScopeTyper() {
  const { supabase } = useOrgSetupContext()
  const registers = useRegisters({ supabase })
  const [editorOpen, setEditorOpen] = useState(false)

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Uten kategori' },
      ...registers.categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [registers.categories],
  )

  return (
    <div className="space-y-6">
      {registers.error ? <WarningBox>{registers.error}</WarningBox> : null}

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
              <li key={t.id} className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="mt-0.5 shrink-0 rounded-md border border-neutral-200 bg-white p-2">
                      <TypeIcon typeId={t.id} className="h-4 w-4 text-[#1a3d32]" />
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
