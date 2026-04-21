/**
 * WorkflowPage — org-level module automation rules (module templates).
 *
 * Shown under Arbeidsflyt → «Modul-regler». Visual shell matches platform-admin
 * «Modul-maler» + layout-hub cream preview (rounded-xl, amber CTAs, section labels).
 */

import { useState } from 'react'
import { AlertCircle, GitBranch, LayoutTemplate } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { ModuleRulesModuleSection } from '../components/workflow/ModuleRulesModuleSection'
import { WorkplaceSerifSectionTitle } from '../components/layout/WorkplacePageHeading1'
import {
  WMR_CALLOUT,
  WMR_CALLOUT_WARN,
  WMR_PAGE_CARD,
  WMR_PAGE_CARD_SHADOW,
  WMR_PILL,
  WMR_PILL_ACTIVE,
  WMR_PILL_GROUP,
  WMR_PILL_MODULE_ACTIVE,
  WMR_SECTION_LABEL,
  WMR_SHELL,
} from '../components/workflow/workflowModuleRulesLayoutKit'

const MODULES = [
  { key: 'hse.inspections', label: 'Inspeksjonsrunder', path: '/hse?tab=inspections', color: '#1a3d32' },
  { key: 'hse.sja', label: 'SJA', path: '/hse?tab=sja', color: '#0891b2' },
  { key: 'hse.vernerunder', label: 'Vernerunder', path: '/vernerunder', color: '#7c3aed' },
  { key: 'hse.incidents', label: 'Hendelser', path: '/workplace-reporting/incidents', color: '#dc2626' },
  { key: 'hse.training', label: 'Opplæring', path: '/hse?tab=training', color: '#d97706' },
]

export function WorkflowPage() {
  const { can, isAdmin, profile } = useOrgSetupContext()
  const canManage = profile?.is_org_admin === true || isAdmin || can('workflows.manage')

  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')

  return (
    <div className={`${WMR_SHELL} w-full space-y-6`} style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#171717' }}>
      <div className={`${WMR_PAGE_CARD}`} style={WMR_PAGE_CARD_SHADOW}>
        <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <LayoutTemplate className="size-4 text-amber-600" aria-hidden />
              <span className="font-semibold uppercase tracking-wide text-amber-800/90">Modul-regler</span>
              <span className="text-neutral-300">·</span>
              <span className="inline-flex items-center gap-1">
                <GitBranch className="size-3.5 text-neutral-400" aria-hidden />
                Samme redigeringsmønster som under{' '}
                <Link
                  to="/platform-admin/layout"
                  className="font-medium text-[#1a3d32] underline decoration-neutral-300 underline-offset-2 hover:text-amber-900"
                >
                  Layout (arbeidsflate)
                </Link>
              </span>
            </div>
            <WorkplaceSerifSectionTitle as="h2" className="text-2xl md:text-3xl">
              Automatiseringsregler per modul
            </WorkplaceSerifSectionTitle>
            <p className="max-w-2xl text-sm text-neutral-600">
              Velg modul til venstre i filteret under, rediger reglene, <strong className="text-neutral-800">lagre</strong> og{' '}
              <strong className="text-neutral-800">publiser</strong> når de skal brukes i appen. Kortene under viser gjeldende regler
              (samme data som i plattformadmin → Modul-maler → Arbeidsflyt).
            </p>
          </div>
        </div>

        <div className={WMR_CALLOUT}>
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold text-sky-950">Tips</p>
            <p className="mt-1 text-xs text-sky-900/90">
              Reglene gjelder modulmalen for organisasjonen. Utkast er bare synlige for deg til du publiserer. Åpne modulen i appen via
              lenkene under hvert kort når du vil teste flyten der.
            </p>
          </div>
        </div>

        {!canManage && (
          <div className={WMR_CALLOUT_WARN}>
            Du har ikke tilgang til å lagre eller publisere modulregler. Kontakt en organisasjonsadministrator eller få tilgangen{' '}
            <code className="rounded bg-white/80 px-1 text-xs">workflows.manage</code>.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr]">
          <div className="space-y-3">
            <p className={WMR_SECTION_LABEL}>Filter</p>
            <div className="space-y-2">
              <p className={`${WMR_SECTION_LABEL} !font-semibold !normal-case !tracking-normal text-neutral-600`}>Status</p>
              <div className={WMR_PILL_GROUP}>
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={filter === f ? WMR_PILL_ACTIVE : WMR_PILL}
                  >
                    {f === 'all' ? 'Alle' : f === 'active' ? 'Aktive' : 'Inaktive'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <p className={`${WMR_SECTION_LABEL} !font-semibold !normal-case !tracking-normal text-neutral-600`}>Moduler</p>
              <div className={`${WMR_PILL_GROUP} flex-col`}>
                <button type="button" onClick={() => setModuleFilter('all')} className={moduleFilter === 'all' ? WMR_PILL_MODULE_ACTIVE : WMR_PILL}>
                  Alle moduler
                </button>
                {MODULES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModuleFilter(m.key)}
                    className={`w-full text-left ${moduleFilter === m.key ? WMR_PILL_MODULE_ACTIVE : WMR_PILL}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/90 p-3 text-xs text-neutral-600">
              <p className="font-semibold text-neutral-800">Referanse</p>
              <p className="mt-1 leading-relaxed">
                Tabell- og verktøylinje-mønster:{' '}
                <code className="rounded bg-white px-1 py-0.5 text-[10px] text-neutral-700">WorkplaceStandardListLayout</code> (se{' '}
                <Link to="/platform-admin/layout" className="font-medium text-[#1a3d32] underline">
                  Layout (arbeidsflate)
                </Link>
                ).
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <p className={WMR_SECTION_LABEL}>Regler etter modul</p>
            <div className="space-y-5">
              {MODULES.filter((m) => moduleFilter === 'all' || m.key === moduleFilter).map((m) => (
                <ModuleRulesModuleSection
                  key={m.key}
                  moduleKey={m.key}
                  label={m.label}
                  color={m.color}
                  path={m.path}
                  canManage={canManage}
                  activityFilter={filter}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
