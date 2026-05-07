// SurveyHubLanding — neutral /survey landing rendered when no ?pack= and no
// ?template= is set in the URL. Each licensed pack is a section, with
// templates grouped by their admin-assigned category. Templates without
// a category bucket into "Uten kategori".
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
import type { SurveyCategoryRow, SurveyPackRow, SurveyPackSlug } from './types'

type Props = {
  packs: SurveyPackRow[]
  templates: SurveyTemplateCatalogRow[]
  pinned: ResolvedSurveyTemplate[]
  categories: SurveyCategoryRow[]
  loading: boolean
  canManage: boolean
  onOpenAdmin: () => void
}

const UNCATEGORISED_KEY = '__uncategorised__'

export function SurveyHubLanding({
  packs,
  templates,
  pinned,
  categories,
  loading,
  canManage,
  onOpenAdmin,
}: Props) {
  const navigate = useNavigate()

  type Tile = {
    id: string
    name: string
    description: string | null
    estimatedMinutes: number | null
    isPinned: boolean
    isSystem: boolean
    pack: SurveyPackSlug
    /** Category id from the override, when one exists. */
    categoryId: string | null
  }

  const pinnedById = useMemo(() => {
    const map = new Map<string, ResolvedSurveyTemplate>()
    for (const p of pinned) {
      if (p.isActive) map.set(p.catalogId, p)
    }
    return map
  }, [pinned])

  // Build per-pack groupings: each pack maps to an ordered list of category
  // buckets, and each bucket holds its templates. Uncategorised templates
  // get a synthetic "Uten kategori" bucket appended at the end.
  type Bucket = {
    key: string
    name: string
    description: string | null
    position: number
    isUncategorised: boolean
    tiles: Tile[]
  }

  const groupedByPack = useMemo(() => {
    const result = new Map<SurveyPackSlug, Bucket[]>()
    const tier = (t: Tile) => (t.isPinned ? 0 : t.isSystem ? 1 : 2)
    const sortByTierThenName = (a: Tile, b: Tile) => {
      const d = tier(a) - tier(b)
      return d !== 0 ? d : a.name.localeCompare(b.name, 'nb')
    }

    for (const pack of packs) {
      const packCategories = categories
        .filter((c) => c.pack === pack.slug && c.is_active)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))

      const buckets: Bucket[] = packCategories.map((c) => ({
        key: c.id,
        name: c.name,
        description: c.description,
        position: c.position,
        isUncategorised: false,
        tiles: [],
      }))
      const uncategorised: Bucket = {
        key: UNCATEGORISED_KEY,
        name: 'Uten kategori',
        description: null,
        position: 9999,
        isUncategorised: true,
        tiles: [],
      }
      const byKey = new Map<string, Bucket>([
        ...buckets.map((b) => [b.key, b] as const),
        [UNCATEGORISED_KEY, uncategorised],
      ])

      for (const t of templates) {
        if (t.is_active === false || t.pack !== pack.slug) continue
        const pinnedRow = pinnedById.get(t.id)
        const tile: Tile = {
          id: t.id,
          name: pinnedRow?.name ?? t.name,
          description: pinnedRow?.description ?? t.description ?? null,
          estimatedMinutes: t.estimated_minutes ?? null,
          isPinned: !!pinnedRow,
          isSystem: t.is_system,
          pack: t.pack,
          categoryId: pinnedRow?.categoryId ?? null,
        }
        const target =
          (tile.categoryId && byKey.get(tile.categoryId)) || uncategorised
        target.tiles.push(tile)
      }
      for (const b of byKey.values()) b.tiles.sort(sortByTierThenName)

      const ordered = [
        ...buckets.filter((b) => b.tiles.length > 0),
        ...(uncategorised.tiles.length > 0 ? [uncategorised] : []),
      ]
      result.set(pack.slug, ordered)
    }
    return result
  }, [packs, templates, categories, pinnedById])

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
        const buckets = groupedByPack.get(pack.slug) ?? []
        const totalTiles = buckets.reduce((n, b) => n + b.tiles.length, 0)

        return (
          <ModuleSectionCard key={pack.slug} className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">{pack.plural_label}</h2>
                  <Badge variant="info">{pack.short_name}</Badge>
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

            {totalTiles === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">
                Ingen maler i denne pakken ennå.
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {buckets.map((bucket) => (
                  <div key={bucket.key}>
                    <div className="mb-2 flex flex-wrap items-baseline gap-2 border-b border-neutral-200/70 pb-1.5">
                      <h3 className="text-sm font-semibold text-neutral-900">{bucket.name}</h3>
                      <span className="text-xs text-neutral-500">{bucket.tiles.length}</span>
                      {bucket.description ? (
                        <span className="ml-1 text-xs text-neutral-500">
                          · {bucket.description}
                        </span>
                      ) : null}
                    </div>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {bucket.tiles.map((t) => (
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
                              {t.isPinned ? (
                                <Badge variant="success">
                                  <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                                  Festet
                                </Badge>
                              ) : t.isSystem ? (
                                <Badge variant="neutral">System</Badge>
                              ) : null}
                            </div>
                            {t.description ? (
                              <p className="line-clamp-2 text-xs text-neutral-600">{t.description}</p>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </ModuleSectionCard>
        )
      })}
    </div>
  )
}
