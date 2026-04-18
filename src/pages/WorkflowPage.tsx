/**
 * WorkflowPage — org-level module automation rules (module templates).
 *
 * Shown under Arbeidsflyt → «Modul-regler». End users can edit, save, and publish
 * `workflowRules` per HSE submodule without using platform-admin.
 */

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { ModuleRulesModuleSection } from '../components/workflow/ModuleRulesModuleSection'

const MODULES = [
  { key: 'hse.inspections', label: 'Inspeksjonsrunder', path: '/hse?tab=inspections', color: '#1a3d32' },
  { key: 'hse.sja', label: 'SJA', path: '/hse?tab=sja', color: '#0891b2' },
  { key: 'hse.vernerunder', label: 'Vernerunder', path: '/hse?tab=rounds', color: '#7c3aed' },
  { key: 'hse.incidents', label: 'Hendelser', path: '/workplace-reporting/incidents', color: '#dc2626' },
  { key: 'hse.training', label: 'Opplæring', path: '/hse?tab=training', color: '#d97706' },
]

export function WorkflowPage() {
  const { can, isAdmin, profile } = useOrgSetupContext()
  const canManage = profile?.is_org_admin === true || isAdmin || can('workflows.manage')

  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')

  return (
    <div
      className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 md:px-8"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#171717' }}
    >
      <div className="space-y-1">
        <h1
          className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Modul-regler
        </h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Automatiseringsregler per modul (oppgaver, e-post, varsling). Velg en modul under, rediger reglene,{' '}
          <strong>lagre</strong> og <strong>publiser</strong> når de skal brukes i appen.
        </p>
      </div>

      <div className="flex gap-3 rounded-none border border-sky-200/70 bg-sky-50/80 p-4 text-sm text-sky-800">
        <AlertCircle className="size-5 shrink-0 text-sky-500" />
        <div>
          <p className="font-semibold">Tips</p>
          <p className="mt-0.5 text-xs text-sky-700">
            Reglene gjelder modulmalen for organisasjonen. Utkast er bare synlige for deg til du publiserer. Åpne
            modulen i appen via lenkene under hvert kort når du vil teste flyten der.
          </p>
        </div>
      </div>

      {!canManage && (
        <p className="rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Du har ikke tilgang til å lagre eller publisere modulregler. Kontakt en organisasjonsadministrator eller få
          tilgangen «workflows.manage».
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-none border border-neutral-200 bg-white p-1 shadow-sm">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-none px-3 py-1.5 text-xs font-semibold transition ${
                filter === f ? 'bg-[#1a3d32] text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
              }`}
            >
              {f === 'all' ? 'Alle' : f === 'active' ? 'Aktive' : 'Inaktive'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 rounded-none border border-neutral-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setModuleFilter('all')}
            className={`rounded-none px-3 py-1.5 text-xs font-semibold transition ${
              moduleFilter === 'all' ? 'bg-[#1a3d32] text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
            }`}
          >
            Alle moduler
          </button>
          {MODULES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setModuleFilter(m.key)}
              className={`rounded-none px-3 py-1.5 text-xs font-semibold transition ${
                moduleFilter === m.key ? 'text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
              }`}
              style={moduleFilter === m.key ? { backgroundColor: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
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
  )
}
