// ISO Gap Analysis hub — lists all gap analysis sessions and lets admins
// start a new session for any active ISO standard.
//
// A session = one run of the clause-by-clause assessment for a single
// standard. Sessions are in_progress until the user marks them complete,
// at which point score_pct is computed and persisted.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardList,
  Globe2,
  Leaf,
  Lock,
  PlusCircle,
  Star,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { useIsoGapAnalysis } from '../../hooks/useIsoGapAnalysis'
import { useIsoSettings } from '../../hooks/useIsoSettings'
import type { IsoStandard } from '../../types/iso'
import { ISO_STANDARDS, ISO_STANDARD_LABELS, ISO_STANDARD_SHORT } from '../../types/iso'

const STANDARD_ICON: Record<IsoStandard, typeof ClipboardList> = {
  'iso-9001':  Star,
  'iso-14001': Leaf,
  'iso-45001': Globe2,
  'iso-27001': Lock,
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function IsoGapAnalysisHubPage() {
  const navigate = useNavigate()
  const { isStandardActive, loading: settingsLoading } = useIsoSettings()
  const { sessions, loading, error, createSession } = useIsoGapAnalysis(null)
  const [creating, setCreating] = useState<IsoStandard | null>(null)

  const activeStandards = ISO_STANDARDS.filter(isStandardActive)

  const handleNewSession = async (standard: IsoStandard) => {
    setCreating(standard)
    const session = await createSession(standard)
    setCreating(null)
    if (session) {
      navigate(`/iso/gap/${session.id}`)
    }
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'ISO IMS', to: '/iso/analyse' },
        { label: 'Gap-analyse' },
      ]}
      title="Gap-analyse"
      loading={loading || settingsLoading}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Start new session ── */}
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-[#3730a3]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Ny gap-analyse</h2>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Vurder samsvar klausul for klausul for én ISO-standard. Poengsummens
            beregnes automatisk når du fullfører økten.
          </p>

          {activeStandards.length === 0 ? (
            <p className="mt-5 text-sm text-neutral-500">
              Ingen aktive ISO-standarder. Gå til{' '}
              <a href="/iso/innstillinger" className="underline">
                Innstillinger
              </a>{' '}
              for å aktivere standarder.
            </p>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              {activeStandards.map((standard) => {
                const Icon = STANDARD_ICON[standard]
                return (
                  <Button
                    key={standard}
                    variant="outline"
                    size="sm"
                    icon={<Icon className="h-3.5 w-3.5" />}
                    onClick={() => handleNewSession(standard)}
                    disabled={creating === standard}
                  >
                    {creating === standard
                      ? 'Oppretter…'
                      : ISO_STANDARD_SHORT[standard]}
                  </Button>
                )
              })}
            </div>
          )}
        </ModuleSectionCard>

        {/* ── Session list ── */}
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-neutral-500" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Tidligere analyser</h2>
          </div>

          {sessions.length === 0 ? (
            <p className="mt-5 text-sm text-neutral-500">
              Ingen gap-analyser er gjennomført ennå.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {sessions.map((s) => {
                const Icon = STANDARD_ICON[s.standard] ?? ClipboardList
                return (
                  <li
                    key={s.id}
                    className="rounded-lg border border-neutral-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-neutral-900">
                              {ISO_STANDARD_LABELS[s.standard]}
                            </span>
                            {s.status === 'completed' ? (
                              <Badge variant="success">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Fullført
                              </Badge>
                            ) : (
                              <Badge variant="info">Pågår</Badge>
                            )}
                            {s.scorePct !== null && (
                              <Badge variant="neutral">{s.scorePct}%</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-400">
                            {s.status === 'completed' && s.completedAt
                              ? `Fullført ${formatDate(s.completedAt)}`
                              : `Startet ${formatDate(s.createdAt)}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/iso/gap/${s.id}`)}
                      >
                        {s.status === 'completed' ? 'Vis' : 'Fortsett'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ModuleSectionCard>
      </div>
    </ModulePageShell>
  )
}
