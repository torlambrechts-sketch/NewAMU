// /registers — directory of register types.
//
// Replaces the previous category-grouped tile grid with the Klarert
// Registre design: a framework rail on the left (filters by AML /
// ISO 45001 / GDPR / …), a directory of types in box or table mode
// on the right, and per-org compliance status / due-soon banners.
//
// Each tile is a clickable doorway to /registers/:typeId where the
// detail view shows the records authored against that type.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Download,
  History,
  LayoutGrid,
  Plus,
  Rows3,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisters, type ResolvedRegisterType } from '../../hooks/useRegisters'
import { useRegulationFilter } from '../../context/RegulationFilterContext'
import { useRegisterUiPreference } from '../../hooks/useUserUiPreferences'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { useAllRegisterRecords } from './dashboards/useAllRegisterRecords'
import { RegisterFrameworkRail } from '../../components/registers/RegisterFrameworkRail'
import { RegisterComplianceStatusCard } from '../../components/registers/RegisterComplianceStatusCard'
import { RegisterModeToggle } from '../../components/registers/RegisterModeToggle'
import { RegisterHubBoxes } from '../../components/registers/RegisterHubBoxes'
import { RegisterHubTable } from '../../components/registers/RegisterHubTable'
import {
  REGISTER_FRAMEWORKS,
  typeMatchesFramework,
} from '../../lib/registers/registerFrameworks'
import {
  computeComplianceSummary,
  computeRegisterStats,
  groupRecordsByType,
  type RegisterStats,
} from '../../lib/registers/registerStats'
import { exportRecordsToCsv, downloadRegisterCsv } from '../../lib/registers/registerCsv'

export function RegistersHubPage() {
  const orgSetup = useOrgSetupContext()
  const navigate = useNavigate()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const allRecords = useAllRegisterRecords(
    orgSetup.supabase,
    orgSetup.organization?.id ?? null,
  )
  const ui = useRegisterUiPreference()
  const easy = ui.mode === 'easy'
  const { isActive: isRegulationActive } = useRegulationFilter()

  const [framework, setFramework] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')

  // ── Compute the filtered + searched type list ────────────────────────
  const enabledTypes = useMemo(
    () => registers.types.filter((t) => t.isEnabledForOrg),
    [registers.types],
  )

  // Per-framework counts for the rail
  const countsByFramework = useMemo(() => {
    const out: Record<string, number> = {}
    for (const f of REGISTER_FRAMEWORKS) out[f.id] = 0
    for (const t of enabledTypes) {
      for (const f of REGISTER_FRAMEWORKS) {
        if (t.regulationIds.includes(f.id)) out[f.id] += 1
      }
    }
    return out
  }, [enabledTypes])

  // Per-type stats from records
  const recordsByType = useMemo(() => groupRecordsByType(allRecords.records), [allRecords.records])
  const statsByType = useMemo(() => {
    const out = new Map<string, RegisterStats>()
    for (const t of enabledTypes) {
      out.set(t.id, computeRegisterStats(t, recordsByType.get(t.id) ?? []))
    }
    return out
  }, [enabledTypes, recordsByType])

  const complianceSummary = useMemo(
    () => computeComplianceSummary(enabledTypes, recordsByType),
    [enabledTypes, recordsByType],
  )

  // Final filtered list (framework + regulation chip filter + search)
  const filteredTypes = useMemo(() => {
    const norm = search.trim().toLowerCase()
    return enabledTypes.filter((t) => {
      if (!typeMatchesFramework(t.regulationIds, framework)) return false
      // Cross-module regelverk filter (header chip) only narrows when
      // the type declares regulations and none of them are active.
      if (t.regulationIds.length > 0 && !t.regulationIds.some((rid) => isRegulationActive(rid))) {
        return false
      }
      if (norm && !t.resolvedName.toLowerCase().includes(norm)) return false
      return true
    })
  }, [enabledTypes, framework, isRegulationActive, search])

  const handleOpen = (t: ResolvedRegisterType) => {
    navigate(`/registers/${encodeURIComponent(t.id)}`)
  }

  // ── Export-all: bundles every enabled type into a single CSV per type.
  // We open a download per type one after another; browsers will all
  // accept multiple programmatic downloads back-to-back.
  const handleExportAll = () => {
    for (const t of enabledTypes) {
      const records = recordsByType.get(t.id) ?? []
      if (records.length === 0) continue
      downloadRegisterCsv(exportRecordsToCsv(t, records))
    }
  }

  const description = easy
    ? 'Lovpålagte og virksomhetsspesifikke registre — kjemikalier, behandlingsprotokoll, beredskap m.fl.'
    : `${complianceSummary.mandatoryRegisters} lovpålagte og ${
        complianceSummary.totalRegisters - complianceSummary.mandatoryRegisters
      } virksomhetsspesifikke registre. Skalerer fra AML/IK til ISO 9001/45001/27001/14001 + GDPR Art. 30.`

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Register' }]}
      title="Register"
      description={description}
      headerActions={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <RegisterModeToggle mode={ui.mode} onChange={(v) => void ui.setMode(v)} />
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportAll}
            type="button"
          >
            Eksporter alle
          </Button>
          <Link
            to="/registers/analyse"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <History className="h-4 w-4" />
            Analyse
          </Link>
          <Link
            to="/admin/settings/registers"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <Settings className="h-4 w-4" />
            Innstillinger
          </Link>
          <Link
            to="/admin/settings/registers"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#14312a]"
          >
            <Plus className="h-4 w-4" />
            Nytt register
          </Link>
        </div>
      }
    >
      {registers.loading && registers.types.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">Laster registre …</p>
      ) : enabledTypes.length === 0 ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-700">
            Ingen registre aktivert ennå. Gå til{' '}
            <Link to="/admin/settings/registers" className="font-medium text-[#1a3d32] underline">
              Innstillinger
            </Link>{' '}
            for å aktivere registre eller opprette egne.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* RAIL */}
          <aside className="space-y-3">
            <RegisterFrameworkRail
              active={framework}
              counts={countsByFramework}
              totalAll={enabledTypes.length}
              onChange={setFramework}
            />

            {!easy ? <RegisterComplianceStatusCard summary={complianceSummary} /> : null}

            {!easy && complianceSummary.overdue > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <div>
                    <div className="font-semibold">
                      {complianceSummary.overdue}{' '}
                      {complianceSummary.overdue === 1 ? 'kritisk forfall' : 'kritiske forfall'}
                    </div>
                    <div className="mt-0.5">
                      Rader med gjennomgangsfrist i fortid. Krever umiddelbar oppfølging.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>

          {/* RIGHT */}
          <section>
            <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-neutral-900">
                  {filteredTypes.length}{' '}
                  {filteredTypes.length === 1 ? 'register' : 'registre'}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-52 rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#1a3d32] focus:bg-white"
                      placeholder="Søk i registre …"
                    />
                  </div>
                  <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                    <ViewModeButton
                      icon={<LayoutGrid className="h-3.5 w-3.5" />}
                      label="Bokser"
                      active={ui.view === 'bokser'}
                      onClick={() => void ui.setView('bokser')}
                    />
                    <ViewModeButton
                      icon={<Rows3 className="h-3.5 w-3.5" />}
                      label="Tabell"
                      active={ui.view === 'tabell'}
                      onClick={() => void ui.setView('tabell')}
                    />
                  </div>
                </div>
              </div>

              {filteredTypes.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <AlertTriangle className="mx-auto h-6 w-6 text-neutral-300" aria-hidden />
                  <p className="mt-2 text-sm text-neutral-500">
                    Ingen registre matcher filterne.
                  </p>
                </div>
              ) : ui.view === 'bokser' ? (
                <RegisterHubBoxes
                  types={filteredTypes}
                  statsByType={statsByType}
                  easy={easy}
                  onOpen={handleOpen}
                />
              ) : (
                <RegisterHubTable
                  types={filteredTypes}
                  statsByType={statsByType}
                  easy={easy}
                  onOpen={handleOpen}
                />
              )}
            </div>
          </section>
        </div>
      )}
    </ModulePageShell>
  )
}

function ViewModeButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200'
          : 'text-neutral-500 hover:text-neutral-800',
      ].join(' ')}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}
