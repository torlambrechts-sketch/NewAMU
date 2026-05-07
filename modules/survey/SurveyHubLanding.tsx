// SurveyHubLanding — neutral /survey landing rendered when no ?pack= and no
// ?template= is set in the URL. Each licensed pack is a section with its
// pinned + system templates as tiles, plus a "Vis hele pakken" link that
// drills into pack mode (?pack=).
//
// Click a tile → /survey?template={catalogId}&pack={packSlug} which puts the
// page into per-template mode (handled by SurveyPage).

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Sparkles } from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import type { ResolvedSurveyTemplate } from './useSurveyOrgTemplates'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import type { SurveyPackRow, SurveyPackSlug } from './types'

type Props = {
  packs: SurveyPackRow[]
  templates: SurveyTemplateCatalogRow[]
  pinned: ResolvedSurveyTemplate[]
  loading: boolean
  canManage: boolean
  onOpenAdmin: () => void
}

export function SurveyHubLanding({
  packs,
  templates,
  pinned,
  loading,
  canManage,
  onOpenAdmin,
}: Props) {
  const navigate = useNavigate()

  const tilesByPack = useMemo(() => {
    const byPack = new Map<SurveyPackSlug, ResolvedSurveyTemplate[]>()
    for (const t of pinned) {
      if (!t.isActive) continue
      const list = byPack.get(t.pack) ?? []
      list.push(t)
      byPack.set(t.pack, list)
    }
    for (const list of byPack.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    }
    return byPack
  }, [pinned])

  const fallbackTilesByPack = useMemo(() => {
    // When the org has no nav_pinned overrides yet, surface system templates
    // for each pack so the hub never appears empty after first license.
    const byPack = new Map<SurveyPackSlug, SurveyTemplateCatalogRow[]>()
    for (const t of templates) {
      if (!t.is_system) continue
      const list = byPack.get(t.pack) ?? []
      list.push(t)
      byPack.set(t.pack, list)
    }
    for (const list of byPack.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    }
    return byPack
  }, [templates])

  if (loading && packs.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-neutral-500">Laster pakker…</p>
    )
  }

  if (packs.length === 0) {
    return (
      <ModuleSectionCard className="p-6">
        <p className="text-sm text-neutral-700">
          Ingen undersøkelsespakker er lisensiert for organisasjonen ennå.
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
        const pinnedTiles = tilesByPack.get(pack.slug) ?? []
        const fallbackTiles = fallbackTilesByPack.get(pack.slug) ?? []
        const useFallback = pinnedTiles.length === 0 && fallbackTiles.length > 0
        const tiles = pinnedTiles.length > 0
          ? pinnedTiles.map((t) => ({
              id: t.catalogId,
              name: t.name,
              description: t.description,
              isSystem: t.isSystem,
              estimatedMinutes: null as number | null,
            }))
          : fallbackTiles.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description ?? null,
              isSystem: t.is_system,
              estimatedMinutes: t.estimated_minutes ?? null,
            }))

        return (
          <ModuleSectionCard key={pack.slug} className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">{pack.plural_label}</h2>
                  <Badge variant="info">{pack.short_name}</Badge>
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
                onClick={() => navigate(`/survey?pack=${encodeURIComponent(pack.slug)}`)}
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
                          `/survey?template=${encodeURIComponent(t.id)}&pack=${encodeURIComponent(pack.slug)}`,
                        )
                      }
                      className="group flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200/80 bg-white p-4 text-left transition-colors hover:border-[#1a3d32]/30 hover:bg-neutral-50"
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900 group-hover:text-[#1a3d32]">
                            {t.name}
                          </span>
                          {t.estimatedMinutes != null ? (
                            <span className="mt-0.5 block text-xs text-neutral-500">
                              ~{t.estimatedMinutes} min
                            </span>
                          ) : null}
                        </span>
                        {t.isSystem ? <Badge variant="neutral">System</Badge> : null}
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
