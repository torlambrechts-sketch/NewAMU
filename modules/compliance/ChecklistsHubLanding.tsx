// ChecklistsHubLanding — neutral /compliance/checklists landing rendered when
// neither ?pack= nor ?template= is present. Each licensed compliance pack
// becomes a section with its pinned (or system-baseline) templates as tiles,
// plus a "Vis hele pakken" link to drill into pack mode.
//
// Click a tile → /compliance/checklists?template={slug}&pack={packSlug}.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, Sparkles } from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import type { CompliancePack } from '../../src/lib/compliance/packs'
import type { ComplianceTemplateRow, CompliancePackSlug } from './types'

type Props = {
  packs: CompliancePack[]
  templates: ComplianceTemplateRow[]
  loading: boolean
  canManage: boolean
  onOpenAdmin: () => void
}

export function ChecklistsHubLanding({
  packs,
  templates,
  loading,
  canManage,
  onOpenAdmin,
}: Props) {
  const navigate = useNavigate()

  const tilesByPack = useMemo(() => {
    const pinned = new Map<CompliancePackSlug, ComplianceTemplateRow[]>()
    const system = new Map<CompliancePackSlug, ComplianceTemplateRow[]>()
    for (const t of templates) {
      if (!t.is_active) continue
      if (t.nav_pinned) {
        const list = pinned.get(t.pack) ?? []
        list.push(t)
        pinned.set(t.pack, list)
      } else if (t.is_system) {
        const list = system.get(t.pack) ?? []
        list.push(t)
        system.set(t.pack, list)
      }
    }
    const sortByName = (a: ComplianceTemplateRow, b: ComplianceTemplateRow) =>
      a.name.localeCompare(b.name, 'nb')
    pinned.forEach((list) => list.sort(sortByName))
    system.forEach((list) => list.sort(sortByName))
    return { pinned, system }
  }, [templates])

  if (loading && packs.length === 0) {
    return <p className="py-16 text-center text-sm text-neutral-500">Laster pakker…</p>
  }

  if (packs.length === 0) {
    return (
      <ModuleSectionCard className="p-6">
        <p className="text-sm text-neutral-700">
          Ingen compliance-pakker er lisensiert for organisasjonen ennå.
        </p>
        {canManage ? (
          <p className="mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={onOpenAdmin}>
              Gå til innstillinger
            </Button>
          </p>
        ) : null}
      </ModuleSectionCard>
    )
  }

  return (
    <div className="space-y-6">
      {packs.map((pack) => {
        const pinnedTiles = tilesByPack.pinned.get(pack.slug) ?? []
        const systemTiles = tilesByPack.system.get(pack.slug) ?? []
        const useFallback = pinnedTiles.length === 0 && systemTiles.length > 0
        const tiles = pinnedTiles.length > 0 ? pinnedTiles : systemTiles

        return (
          <ModuleSectionCard key={pack.slug} className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">{pack.pluralLabel}</h2>
                  <Badge variant="info">{pack.shortName}</Badge>
                  {useFallback ? (
                    <Badge variant="neutral">
                      <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                      System
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm text-neutral-600">{pack.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<ArrowRight className="h-4 w-4" />}
                onClick={() =>
                  navigate(`/compliance/checklists?pack=${encodeURIComponent(pack.slug)}`)
                }
              >
                Vis hele pakken
              </Button>
            </div>

            {tiles.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">
                Ingen maler i denne pakken ennå.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tiles.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/compliance/checklists?template=${encodeURIComponent(t.slug)}&pack=${encodeURIComponent(pack.slug)}`,
                        )
                      }
                      className="group flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200/80 bg-white p-4 text-left transition-colors hover:border-[#1a3d32]/30 hover:bg-neutral-50"
                    >
                      <div className="flex items-start gap-2">
                        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900 group-hover:text-[#1a3d32]">
                            {t.name}
                          </span>
                          {t.cadence_hint ? (
                            <span className="mt-0.5 block text-xs text-neutral-500">
                              {t.cadence_hint}
                            </span>
                          ) : null}
                        </span>
                        {t.is_system ? <Badge variant="neutral">System</Badge> : null}
                      </div>
                      {t.description ? (
                        <p className="line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ModuleSectionCard>
        )
      })}
    </div>
  )
}
