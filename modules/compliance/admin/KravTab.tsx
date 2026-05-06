// KravTab — compliance requirement taxonomy for the active pack.
//
// Two ownership lanes (per Q4 B):
//   System (organization_id IS NULL)  — read-only, can view, used for tagging
//   Custom (organization_id = my org) — full CRUD by org admin
//
// Templates link to requirements via the compliance_template_requirements
// junction (set in the Maler tab). This tab is the place to author the
// requirements themselves.

import { useMemo, useState } from 'react'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useActivePack } from '../../../src/context/packContextValue'
import { useRequirements } from '../useRequirements'
import { RequirementEditorPanel } from './RequirementEditorPanel'
import type { ComplianceRequirementRow } from '../types'

export function KravTab() {
  const { supabase } = useOrgSetupContext()
  const pack = useActivePack()
  const reqs = useRequirements({ supabase })

  const [editorTarget, setEditorTarget] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; requirement: ComplianceRequirementRow }
    | null
  >(null)

  const packReqs = useMemo(() => reqs.forPack(pack.slug), [reqs, pack.slug])
  const systemReqs = useMemo(
    () => packReqs.filter((r) => r.organization_id === null),
    [packReqs],
  )
  const customReqs = useMemo(
    () => packReqs.filter((r) => r.organization_id !== null),
    [packReqs],
  )

  const handleDelete = async (r: ComplianceRequirementRow) => {
    if (r.is_system) return
    const ok = window.confirm(`Slette kravet «${r.code}»? Dette kan ikke angres.`)
    if (!ok) return
    await reqs.softDeleteRequirement(r.id)
  }

  return (
    <div className="space-y-6">
      {reqs.error ? <WarningBox>{reqs.error}</WarningBox> : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">
              Krav — {pack.shortName}
            </h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setEditorTarget({ mode: 'create' })}
          >
            Nytt krav
          </Button>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Krav er klausuler eller seksjoner i regelverket — for eksempel
          AML §3-1 eller ISO 45001 §9.2. Maler kobles til relevante krav
          for å vise dekningsgrad. Egne krav (f.eks. interne HMS-policyer)
          kan legges til her; systemkrav vedlikeholdes av plattformen.
        </p>

        {/* ── System requirements ─────────────────────────────────────── */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-neutral-900">Systemkrav</h3>
          <ul className="mt-3 space-y-2">
            {systemReqs.length === 0 ? (
              <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-sm text-neutral-500">
                Ingen systemkrav for denne pakken.
              </li>
            ) : (
              systemReqs.map((r) => (
                <RequirementRow
                  key={r.id}
                  requirement={r}
                  readOnly
                  onEdit={() => setEditorTarget({ mode: 'edit', requirement: r })}
                  onToggleActive={() => {}}
                  onDelete={() => handleDelete(r)}
                />
              ))
            )}
          </ul>
        </div>

        {/* ── Custom requirements ─────────────────────────────────────── */}
        <div className="mt-6 border-t border-neutral-100 pt-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Egne krav
          </h3>
          <ul className="mt-3 space-y-2">
            {customReqs.length === 0 ? (
              <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-sm text-neutral-500">
                Ingen egne krav definert ennå.
              </li>
            ) : (
              customReqs.map((r) => (
                <RequirementRow
                  key={r.id}
                  requirement={r}
                  readOnly={false}
                  onEdit={() => setEditorTarget({ mode: 'edit', requirement: r })}
                  onToggleActive={(v) =>
                    reqs.updateRequirement({ id: r.id, is_active: v })
                  }
                  onDelete={() => handleDelete(r)}
                />
              ))
            )}
          </ul>
        </div>
      </ModuleSectionCard>

      {editorTarget ? (
        <RequirementEditorPanel
          mode={editorTarget.mode}
          requirement={
            editorTarget.mode === 'edit' ? editorTarget.requirement : null
          }
          onClose={() => setEditorTarget(null)}
          onSaved={() => setEditorTarget(null)}
        />
      ) : null}
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

type RowProps = {
  requirement: ComplianceRequirementRow
  readOnly: boolean
  onEdit: () => void
  onToggleActive: (value: boolean) => void | Promise<void>
  onDelete: () => void | Promise<void>
}

function RequirementRow({
  requirement,
  readOnly,
  onEdit,
  onToggleActive,
  onDelete,
}: RowProps) {
  return (
    <li className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-neutral-900">
              {requirement.code}
            </span>
            {requirement.is_system ? (
              <Badge variant="info">System</Badge>
            ) : null}
            {!requirement.is_active ? (
              <Badge variant="neutral">Inaktiv</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-neutral-700">{requirement.title}</p>
          {requirement.description ? (
            <p className="mt-1 text-xs text-neutral-500">
              {requirement.description}
            </p>
          ) : null}
        </button>

        {!readOnly ? (
          <div className="flex shrink-0 items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
              <ToggleSwitch
                checked={requirement.is_active}
                onChange={(v) => onToggleActive(v)}
                label="Aktiv"
              />
              <span>Aktiv</span>
            </label>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
              aria-label="Slett krav"
            >
              <span className="sr-only">Slett</span>
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  )
}
