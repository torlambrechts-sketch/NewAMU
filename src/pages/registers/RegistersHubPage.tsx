// /registers — hub. Lists every enabled register type as a tile,
// grouped by category. Mirrors the SurveyHubLanding pattern.
//
// Click a tile → /registers/<typeId>.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Database, FolderTree, Plus } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegulationFilter } from '../../context/RegulationFilterContext'
import { useRegisters } from '../../hooks/useRegisters'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'

const UNCAT_KEY = '__uncat__'

export function RegistersHubPage() {
  const orgSetup = useOrgSetupContext()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const { isActive: isRegulationActive } = useRegulationFilter()

  // Build per-category buckets of enabled types. Hide types whose
  // regulations don't overlap the active filter (when the user has
  // narrowed the top-bar regelverk chip).
  const grouped = useMemo(() => {
    type Bucket = { key: string; name: string; types: typeof registers.types }
    const buckets = new Map<string, Bucket>()
    const enabledTypes = registers.types.filter((t) => {
      if (!t.isEnabledForOrg) return false
      // When filter is active and the type declares regulations, require
      // at least one to be active. Untagged types pass through (they're
      // generic register kinds).
      if (t.regulationIds.length === 0) return true
      return t.regulationIds.some((rid) => isRegulationActive(rid))
    })
    for (const t of enabledTypes) {
      const key = t.categoryId ?? UNCAT_KEY
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.types.push(t)
      } else {
        const cat = registers.categories.find((c) => c.id === key)
        buckets.set(key, {
          key,
          name: cat?.name ?? 'Uten kategori',
          types: [t],
        })
      }
    }
    return [...buckets.values()].sort((a, b) => {
      // Real categories first (sorted by their position), uncat at the end
      const aPos = registers.categories.find((c) => c.id === a.key)?.position ?? 9999
      const bPos = registers.categories.find((c) => c.id === b.key)?.position ?? 9999
      return aPos - bPos || a.name.localeCompare(b.name, 'nb')
    })
  }, [registers.types, registers.categories, isRegulationActive])

  const totalEnabled = registers.types.filter((t) => t.isEnabledForOrg).length

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Register' }]}
      title="Register"
      description="Strukturerte registre på tvers av regelverk — kjemikalier, leverandører, behandlingsprotokoll, og egne registre du oppretter selv."
      headerActions={
        <Link
          to="/registers/admin"
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" />
          Innstillinger
        </Link>
      }
    >
      {registers.loading && registers.types.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">Laster registre …</p>
      ) : totalEnabled === 0 ? (
        <ModuleSectionCard className="p-6">
          <p className="text-sm text-neutral-700">
            Ingen registre aktivert ennå. Gå til{' '}
            <Link to="/registers/admin" className="font-medium text-[#1a3d32] underline">
              Innstillinger
            </Link>{' '}
            for å aktivere registre eller opprette egne.
          </p>
        </ModuleSectionCard>
      ) : (
        <div className="space-y-6">
          {grouped.map((bucket) => (
            <ModuleSectionCard key={bucket.key} className="p-5 md:p-6">
              <div className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-[#1a3d32]" aria-hidden />
                <h2 className="text-lg font-semibold text-neutral-900">{bucket.name}</h2>
                <span className="text-xs text-neutral-500">
                  · {bucket.types.length} {bucket.types.length === 1 ? 'register' : 'registre'}
                </span>
              </div>
              <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {bucket.types.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/registers/${encodeURIComponent(t.id)}`}
                      className="group flex h-full flex-col gap-2 rounded-lg border border-neutral-200/80 bg-white p-4 transition-colors hover:border-[#1a3d32] hover:bg-[#1a3d32]/[0.02]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-[#1a3d32]" aria-hidden />
                          <p className="text-sm font-semibold text-neutral-900">
                            {t.resolvedName}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400 transition-colors group-hover:text-[#1a3d32]" />
                      </div>
                      {t.description ? (
                        <p className="line-clamp-3 text-xs text-neutral-600">{t.description}</p>
                      ) : null}
                      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                        {t.regulationIds.slice(0, 3).map((rid) => (
                          <Badge key={rid} variant="info">
                            {rid.toUpperCase()}
                          </Badge>
                        ))}
                        {!t.isSystem ? <Badge variant="neutral">Egen</Badge> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ModuleSectionCard>
          ))}
        </div>
      )}
    </ModulePageShell>
  )
}
