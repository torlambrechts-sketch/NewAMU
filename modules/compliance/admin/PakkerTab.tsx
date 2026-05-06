// PakkerTab — edit display fields on the org's licensed compliance packs.
//
// Read-only on slug + is_active + is_system style flags (those are
// licensing concerns managed by platform-admin via SQL per Q2 A).
// Editable: short_name, plural_label, cta_label, description, KPI labels,
// severity labels, legal-banner refs, position. Saving writes to
// public.compliance_packs and refreshes the global PackProvider state so
// page chrome (titles, KPIs, severity labels) updates immediately.

import { useState } from 'react'
import { Layers, Settings } from 'lucide-react'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { useLicensedPacks } from '../../../src/context/packContextValue'
import { PackEditorPanel } from './PackEditorPanel'
import type { CompliancePack } from '../../../src/lib/compliance/packs'

export function PakkerTab() {
  const packs = useLicensedPacks()
  const [editing, setEditing] = useState<CompliancePack | null>(null)

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">
            Lisensierte regelverk
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Tilpass hvordan hver pakke vises — terminologi, KPI-merker,
          alvorlighetsetiketter og lovreferanser i banneret. Pakkens slug og
          lisensstatus styres av plattformen og kan ikke endres her.
        </p>

        <ul className="mt-5 space-y-3">
          {packs.map((p) => (
            <li
              key={p.slug}
              className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">
                      {p.shortName}
                    </span>
                    <Badge variant="info">{p.pluralLabel}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    <span className="font-mono">{p.slug}</span>
                    <span className="mx-1.5">·</span>
                    <span>{p.legalReferences.length} bannerreferanser</span>
                    <span className="mx-1.5">·</span>
                    <span>posisjon {p.position}</span>
                  </p>
                  <p className="mt-2 text-sm text-neutral-700">{p.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Settings className="h-3.5 w-3.5" />}
                  onClick={() => setEditing(p)}
                >
                  Rediger
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </ModuleSectionCard>

      {editing ? (
        <PackEditorPanel
          pack={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
