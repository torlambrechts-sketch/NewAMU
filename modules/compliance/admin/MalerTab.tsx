// MalerTab — template CRUD for the active pack.
//
// Lists all (non-deleted) templates for the pack the user is focused on.
// Each row shows: name, item count, badges for system / pinned / inactive,
// and inline toggles for is_active and nav_pinned. Clicking a template
// opens TemplateEditorPanel for full editing (name, description, items,
// requirement tagging). System templates can be edited and toggled but
// not deleted; the trash icon is hidden for them.

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, GitBranch, Pin, Plus, Settings, Trash2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useActivePack } from '../../../src/context/packContextValue'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { useChecklistModule } from '../useChecklistModule'
import { parseChecklistDefinition } from '../schema'
import { TemplateEditorPanel } from './TemplateEditorPanel'
import { TemplateVersionsPanel } from './TemplateVersionsPanel'
import type { ComplianceTemplateRow } from '../types'

export function MalerTab() {
  const { supabase } = useOrgSetupContext()
  const pack = useActivePack()
  const cl = useChecklistModule({ supabase })
  const { load } = cl

  const [editorTarget, setEditorTarget] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; template: ComplianceTemplateRow }
    | null
  >(null)
  const [versionsTarget, setVersionsTarget] = useState<ComplianceTemplateRow | null>(null)

  useEffect(() => {
    void load({ pack: pack.slug })
  }, [load, pack.slug])

  const visibleTemplates = useMemo(
    () => cl.templates.filter((t) => t.pack === pack.slug),
    [cl.templates, pack.slug],
  )

  return (
    <div className="space-y-6">
      {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">
              Maler — {pack.shortName}
            </h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setEditorTarget({ mode: 'create' })}
          >
            Ny mal
          </Button>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Maler definerer hva en sjekklisteutførelse spør om. Trykk på en
          rad for å redigere punkter og kravkobling. Systemmaler kan ikke
          slettes — bruk «Aktiv» av/på for å skjule dem.
        </p>

        <ul className="mt-5 space-y-3">
          {visibleTemplates.length === 0 ? (
            <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
              Ingen maler for {pack.shortName} ennå.
            </li>
          ) : (
            visibleTemplates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                onEdit={() => setEditorTarget({ mode: 'edit', template: t })}
                onVersions={() => setVersionsTarget(t)}
                onTogglePinned={(value) =>
                  cl.updateTemplate({ templateId: t.id, nav_pinned: value })
                }
                onToggleActive={(value) =>
                  cl.updateTemplate({ templateId: t.id, is_active: value })
                }
                onDelete={() => cl.softDeleteTemplate(t.id)}
              />
            ))
          )}
        </ul>
      </ModuleSectionCard>

      {editorTarget ? (
        <TemplateEditorPanel
          mode={editorTarget.mode}
          template={editorTarget.mode === 'edit' ? editorTarget.template : null}
          onClose={() => setEditorTarget(null)}
          onSaved={() => setEditorTarget(null)}
        />
      ) : null}

      {versionsTarget ? (
        <TemplateVersionsPanel
          slug={versionsTarget.slug}
          pack={versionsTarget.pack}
          templateName={versionsTarget.name}
          currentVersionMajor={versionsTarget.current_version_major ?? 1}
          currentVersionMinor={versionsTarget.current_version_minor ?? 0}
          onClose={() => setVersionsTarget(null)}
          onPublished={() => load({ pack: pack.slug })}
        />
      ) : null}
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

type RowProps = {
  template: ComplianceTemplateRow
  onEdit: () => void
  onVersions: () => void
  onTogglePinned: (value: boolean) => void | Promise<void>
  onToggleActive: (value: boolean) => void | Promise<void>
  onDelete: () => void | Promise<void>
}

function TemplateRow({
  template,
  onEdit,
  onVersions,
  onTogglePinned,
  onToggleActive,
  onDelete,
}: RowProps) {
  const def = useMemo(
    () => parseChecklistDefinition(template.definition),
    [template.definition],
  )
  const itemCount = def.items.length

  const handleDelete = async () => {
    if (template.is_system) return
    const ok = window.confirm(
      `Slette malen «${template.name}»? Dette kan ikke angres.`,
    )
    if (!ok) return
    await onDelete()
  }

  return (
    <li className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">
              {template.name}
            </span>
            {template.is_system ? (
              <Badge variant="info">System</Badge>
            ) : null}
            {template.nav_pinned ? <Badge variant="success">Sidemeny</Badge> : null}
            {!template.is_active ? <Badge variant="neutral">Inaktiv</Badge> : null}
            {template.review_status === 'draft' ? (
              <Badge variant="warning">Utkast</Badge>
            ) : null}
            {template.review_status === 'approved' ? (
              <Badge variant="success">Godkjent</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            <span className="font-mono">{template.slug}</span>
            <span className="mx-1.5">·</span>
            <span>
              {itemCount} {itemCount === 1 ? 'punkt' : 'punkter'}
            </span>
            {template.cadence_hint ? (
              <>
                <span className="mx-1.5">·</span>
                <span>{template.cadence_hint}</span>
              </>
            ) : null}
            {template.description ? (
              <>
                <span className="mx-1.5">·</span>
                <span>{template.description}</span>
              </>
            ) : null}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Settings className="h-3.5 w-3.5" />}
            onClick={onEdit}
          >
            Rediger
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<GitBranch className="h-3.5 w-3.5" />}
            onClick={onVersions}
            title={`v${template.current_version_major ?? 1}.${template.current_version_minor ?? 0}`}
          >
            v{template.current_version_major ?? 1}.{template.current_version_minor ?? 0}
          </Button>
          {!template.is_system ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDelete}
              aria-label="Slett mal"
            >
              Slett
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200/80 pt-3 text-xs text-neutral-700">
        <label className="inline-flex items-center gap-2">
          <ToggleSwitch
            checked={template.is_active}
            onChange={(v) => onToggleActive(v)}
            label="Aktiv"
          />
          <span>Aktiv</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <ToggleSwitch
            checked={template.nav_pinned}
            onChange={(v) => onTogglePinned(v)}
            label="Vis i sidemenyen"
          />
          <span className="inline-flex items-center gap-1">
            <Pin className="h-3 w-3" aria-hidden />
            Vis i sidemenyen
          </span>
        </label>
      </div>
    </li>
  )
}
