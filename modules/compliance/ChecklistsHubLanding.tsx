// ChecklistsHubLanding — neutral /compliance/checklists landing rendered when
// neither ?pack= nor ?template= is present. Each licensed compliance pack
// becomes a section, with templates grouped by their admin-assigned
// category (Vernerunder, Fysisk og kjemisk, …). Templates without a
// category bucket into "Uten kategori".
//
// Click a tile → /compliance/checklists?template={slug}&pack={packSlug}.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, Sparkles } from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import type { CompliancePack } from '../../src/lib/compliance/packs'
import type {
  ComplianceCategoryRow,
  CompliancePackSlug,
  ComplianceTemplateRow,
} from './types'

type Props = {
  packs: CompliancePack[]
  templates: ComplianceTemplateRow[]
  categories: ComplianceCategoryRow[]
  loading: boolean
  canManage: boolean
  onOpenAdmin: () => void
}

const UNCATEGORISED_KEY = '__uncategorised__'

/** True when the template's definition jsonb declares sections[] — drives
 *  routing into ChecklistWalkthroughPage instead of the flat execution list. */
function isWalkthroughTemplate(definition: unknown): boolean {
  if (!definition || typeof definition !== 'object') return false
  const sections = (definition as { sections?: unknown }).sections
  return Array.isArray(sections) && sections.length > 0
}

export function ChecklistsHubLanding({
  packs,
  templates,
  categories,
  loading,
  canManage,
  onOpenAdmin,
}: Props) {
  const navigate = useNavigate()

  // Build per-pack groupings: each pack maps to an ordered list of category
  // buckets, and each bucket holds its templates. Uncategorised templates
  // get a synthetic "Uten kategori" bucket appended at the end.
  type Bucket = {
    key: string
    name: string
    description: string | null
    position: number
    isUncategorised: boolean
    templates: ComplianceTemplateRow[]
  }

  const groupedByPack = useMemo(() => {
    const result = new Map<CompliancePackSlug, Bucket[]>()
    const tier = (t: ComplianceTemplateRow) => (t.nav_pinned ? 0 : t.is_system ? 1 : 2)
    const sortByTierThenName = (a: ComplianceTemplateRow, b: ComplianceTemplateRow) => {
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
        templates: [],
      }))
      const uncategorised: Bucket = {
        key: UNCATEGORISED_KEY,
        name: 'Uten kategori',
        description: null,
        position: 9999,
        isUncategorised: true,
        templates: [],
      }
      const byKey = new Map<string, Bucket>([
        ...buckets.map((b) => [b.key, b] as const),
        [UNCATEGORISED_KEY, uncategorised],
      ])

      for (const t of templates) {
        if (t.pack !== pack.slug || !t.is_active) continue
        const target =
          (t.category_id && byKey.get(t.category_id)) || uncategorised
        target.templates.push(t)
      }
      for (const b of byKey.values()) b.templates.sort(sortByTierThenName)

      const ordered = [
        ...buckets.filter((b) => b.templates.length > 0),
        ...(uncategorised.templates.length > 0 ? [uncategorised] : []),
      ]
      result.set(pack.slug, ordered)
    }
    return result
  }, [packs, templates, categories])

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
        const buckets = groupedByPack.get(pack.slug) ?? []
        const totalTemplates = buckets.reduce((n, b) => n + b.templates.length, 0)

        return (
          <ModuleSectionCard key={pack.slug} className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">{pack.pluralLabel}</h2>
                  <Badge variant="info">{pack.shortName}</Badge>
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

            {totalTemplates === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">
                Ingen maler i denne pakken ennå.
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {buckets.map((bucket) => (
                  <div key={bucket.key}>
                    <div className="mb-2 flex flex-wrap items-baseline gap-2 border-b border-neutral-200/70 pb-1.5">
                      <h3 className="text-sm font-semibold text-neutral-900">{bucket.name}</h3>
                      <span className="text-xs text-neutral-500">
                        {bucket.templates.length}
                      </span>
                      {bucket.description ? (
                        <span className="ml-1 text-xs text-neutral-500">
                          · {bucket.description}
                        </span>
                      ) : null}
                    </div>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {bucket.templates.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => {
                              const href = isWalkthroughTemplate(t.definition)
                                ? `/compliance/checklists/walkthrough/${encodeURIComponent(t.slug)}`
                                : `/compliance/checklists?template=${encodeURIComponent(t.slug)}&pack=${encodeURIComponent(pack.slug)}`
                              navigate(href)
                            }}
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
                              {isWalkthroughTemplate(t.definition) ? (
                                <Badge variant="info">
                                  <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                                  Veiviser
                                </Badge>
                              ) : t.nav_pinned ? (
                                <Badge variant="success">
                                  <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                                  Festet
                                </Badge>
                              ) : t.is_system ? (
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
