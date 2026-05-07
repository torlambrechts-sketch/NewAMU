// SurveyPakkerTab — list of licensed survey packs with per-pack editor.
// Mirrors modules/compliance/admin/PakkerTab; reuses the survey-side
// useSurveyPacks hook (now with updatePack + refresh).

import { useState } from 'react'
import { Layers, Settings } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { useSurveyPacks } from '../useSurveyPacks'
import { SurveyPackEditorPanel } from './SurveyPackEditorPanel'
import type { SurveyPackRow } from '../types'

type Props = {
  supabase: SupabaseClient | null
}

export function SurveyPakkerTab({ supabase }: Props) {
  const { packs, error, updatePack, refresh } = useSurveyPacks({ supabase })
  const [editing, setEditing] = useState<SurveyPackRow | null>(null)

  return (
    <div className="space-y-6">
      {error ? <WarningBox>{error}</WarningBox> : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">
            Lisensierte undersøkelsespakker
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Tilpass hvordan hver pakke vises og oppfører seg — terminologi, KPI-
          merker, lovreferanser, anonymitet-standard og om spørsmål skal låses
          ved publisering. Pakkens slug og lisensstatus styres av plattformen
          og kan ikke endres her.
        </p>

        <ul className="mt-5 space-y-3">
          {packs.length === 0 ? (
            <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-sm text-neutral-500">
              Ingen pakker lisensiert ennå.
            </li>
          ) : (
            packs.map((p) => (
              <li
                key={p.slug}
                className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {p.short_name}
                      </span>
                      <Badge variant="info">{p.plural_label}</Badge>
                      {p.requires_publish_snapshot ? (
                        <Badge variant="warning">Lås ved publisering</Badge>
                      ) : null}
                      {p.default_anonymous ? (
                        <Badge variant="neutral">Anonym (k≥{p.default_anonymity_threshold})</Badge>
                      ) : (
                        <Badge variant="neutral">Identifisert</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      <span className="font-mono">{p.slug}</span>
                      <span className="mx-1.5">·</span>
                      <span>{p.legal_references.length} bannerreferanser</span>
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
            ))
          )}
        </ul>
      </ModuleSectionCard>

      {editing ? (
        <SurveyPackEditorPanel
          pack={editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await updatePack(input)
            await refresh()
          }}
        />
      ) : null}
    </div>
  )
}
