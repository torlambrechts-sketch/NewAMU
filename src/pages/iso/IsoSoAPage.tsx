// ISO 27001 Statement of Applicability — manages all 93 Annex A controls.
//
// Four theme sections (organizational/people/physical/technological).
// Each control shows: applicability toggle, implementation status, target date.
// When not applicable, shows exclusion reason field. Grouped by theme.
// Progress bar at the top shows implemented / total applicable.

import { useState } from 'react'
import { CheckCircle2, Shield } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { useIsoSoA } from '../../hooks/useIsoSoA'
import type { AnnexAControl, AnnexATheme, SoAImplementationStatus } from '../../types/iso'
import {
  ANNEX_A_THEME_LABELS,
  SOA_STATUS_LABELS,
} from '../../types/iso'

const STATUS_COLOURS: Record<SoAImplementationStatus, string> = {
  not_started: 'border-neutral-200 bg-white text-neutral-600',
  planned:     'border-amber-300 bg-amber-50 text-amber-700',
  in_progress: 'border-sky-300 bg-sky-50 text-sky-700',
  implemented: 'border-green-300 bg-green-50 text-green-700',
}

const STATUSES: SoAImplementationStatus[] = ['not_started', 'planned', 'in_progress', 'implemented']
const THEMES: AnnexATheme[] = ['organizational', 'people', 'physical', 'technological']

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-[#3730a3] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="min-w-[3.5rem] text-right text-sm font-medium text-neutral-700">
        {value} / {max}
      </span>
    </div>
  )
}

export function IsoSoAPage() {
  const { loading, error, controls, entryByControlId, implementedCount, applicableCount, upsertSoA } =
    useIsoSoA()

  const [savingControlId, setSavingControlId] = useState<string | null>(null)

  const handleToggleApplicable = async (control: AnnexAControl, applicable: boolean) => {
    setSavingControlId(control.id)
    await upsertSoA({ controlId: control.id, applicable, exclusionReason: applicable ? null : undefined })
    setSavingControlId(null)
  }

  const handleStatusChange = async (control: AnnexAControl, status: SoAImplementationStatus) => {
    setSavingControlId(control.id)
    await upsertSoA({ controlId: control.id, implementationStatus: status })
    setSavingControlId(null)
  }

  const handleExclusionReason = async (control: AnnexAControl, reason: string) => {
    await upsertSoA({ controlId: control.id, exclusionReason: reason || null })
  }

  const controlsByTheme = (theme: AnnexATheme) =>
    controls.filter((c) => c.theme === theme)

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'ISO IMS', to: '/iso/analyse' },
        { label: 'SoA — ISO 27001' },
      ]}
      title="Statement of Applicability — ISO 27001:2022"
      loading={loading}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Progress strip ── */}
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#7c3aed]" aria-hidden />
              <h2 className="text-lg font-semibold text-neutral-900">
                Implementeringsgrad
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {implementedCount} implementert
              </Badge>
              <Badge variant="neutral">{applicableCount} gjeldende</Badge>
              <Badge variant="neutral">{controls.length} totalt</Badge>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={implementedCount} max={applicableCount || controls.length} />
            <p className="mt-1.5 text-xs text-neutral-400">
              Andel implementerte av gjeldende kontroller ({applicableCount} av 93 er merket som gjeldende)
            </p>
          </div>
        </ModuleSectionCard>

        {/* ── Control groups ── */}
        {THEMES.map((theme) => {
          const themeControls = controlsByTheme(theme)
          if (themeControls.length === 0) return null
          return (
            <ModuleSectionCard key={theme} className="p-5 md:p-6">
              <h2 className="text-base font-semibold text-neutral-900">
                {ANNEX_A_THEME_LABELS[theme]}
              </h2>

              <div className="mt-4 divide-y divide-neutral-100">
                {themeControls.map((control) => {
                  const entry = entryByControlId.get(control.id)
                  const isApplicable = entry?.applicable ?? true
                  const status = entry?.implementationStatus ?? 'not_started'
                  const isSaving = savingControlId === control.id

                  return (
                    <div key={control.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start gap-4">
                        {/* Applicability toggle */}
                        <label className="mt-0.5 flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                          <input
                            type="checkbox"
                            checked={isApplicable}
                            disabled={isSaving}
                            onChange={(e) => handleToggleApplicable(control, e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 text-[#7c3aed] focus:ring-[#7c3aed]"
                          />
                          Gjeldende
                        </label>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-medium text-neutral-400">
                              {control.controlId}
                            </span>
                            <span className="text-sm font-medium text-neutral-900">
                              {control.title}
                            </span>
                            {!isApplicable && (
                              <Badge variant="neutral">Ekskludert</Badge>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-neutral-500">
                            {control.description}
                          </p>

                          {!isApplicable ? (
                            <input
                              type="text"
                              className="mt-2 w-full max-w-md rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
                              placeholder="Begrunnelse for ekskludering…"
                              defaultValue={entry?.exclusionReason ?? ''}
                              onBlur={(e) => handleExclusionReason(control, e.target.value)}
                            />
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {STATUSES.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleStatusChange(control, s)}
                                  className={[
                                    'rounded border px-2.5 py-1 text-xs font-medium transition-colors',
                                    status === s
                                      ? STATUS_COLOURS[s]
                                      : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50',
                                  ].join(' ')}
                                >
                                  {SOA_STATUS_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {isSaving && (
                          <span className="mt-1 text-xs text-neutral-400">Lagrer…</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ModuleSectionCard>
          )
        })}
      </div>
    </ModulePageShell>
  )
}
