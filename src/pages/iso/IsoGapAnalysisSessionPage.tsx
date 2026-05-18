// ISO Gap Analysis session — clause-by-clause assessment runner.
//
// Renders all leaf clauses for the session's standard as a scrollable list.
// Each clause gets a rating (0–3) and optional notes. Responses persist on
// every change (no explicit save button). When all leaf clauses have a rating
// the "Fullfør" button becomes available.
//
// The session runner mirrors the ChecklistExecutionPage pattern: one item
// per leaf clause, responses persisted individually via upsert.

import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { useIsoGapAnalysis } from '../../hooks/useIsoGapAnalysis'
import type { GapRating } from '../../types/iso'
import { GAP_RATING_LABELS, ISO_STANDARD_SHORT } from '../../types/iso'

const RATING_COLOURS: Record<GapRating, string> = {
  0: 'border-red-300 bg-red-50 text-red-700',
  1: 'border-amber-300 bg-amber-50 text-amber-700',
  2: 'border-sky-300 bg-sky-50 text-sky-700',
  3: 'border-green-300 bg-green-50 text-green-700',
}

export function IsoGapAnalysisSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const {
    loading,
    error,
    session,
    clauses,
    responses,
    responseByClauseId,
    upsertResponse,
    completeSession,
  } = useIsoGapAnalysis(sessionId ?? null)

  const [completing, setCompleting] = useState(false)
  const [savingClauseId, setSavingClauseId] = useState<string | null>(null)

  const leafClauses = clauses.filter((c) => c.isLeaf)
  const answeredCount = leafClauses.filter((c) => responseByClauseId.has(c.id)).length
  const allAnswered = answeredCount === leafClauses.length && leafClauses.length > 0
  const isCompleted = session?.status === 'completed'

  const handleRating = async (clauseId: string, rating: GapRating) => {
    if (isCompleted) return
    setSavingClauseId(clauseId)
    const current = responseByClauseId.get(clauseId)
    await upsertResponse(clauseId, rating, current?.notes ?? undefined)
    setSavingClauseId(null)
  }

  const handleNotes = async (clauseId: string, notes: string) => {
    if (isCompleted) return
    const current = responseByClauseId.get(clauseId)
    if (current?.rating === undefined) return
    await upsertResponse(clauseId, current.rating, notes)
  }

  const handleComplete = async () => {
    setCompleting(true)
    await completeSession()
    setCompleting(false)
  }

  const notFound = !loading && !session
    ? { title: 'Analyseøkt ikke funnet', backHref: '/iso/gap', backLabel: 'Tilbake til gap-analyse' }
    : undefined

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'ISO IMS', to: '/iso/analyse' },
        { label: 'Gap-analyse', to: '/iso/gap' },
        { label: session ? ISO_STANDARD_SHORT[session.standard] : 'Laster…' },
      ]}
      title={session ? `Gap-analyse — ${ISO_STANDARD_SHORT[session.standard]}` : 'Gap-analyse'}
      loading={loading}
      notFound={notFound}
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Header strip ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/iso/gap')}
            >
              Tilbake
            </Button>
            {isCompleted && session?.scorePct !== null ? (
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Fullført — {session.scorePct}%
              </Badge>
            ) : (
              <Badge variant="info">
                {answeredCount} / {leafClauses.length} klausuler vurdert
              </Badge>
            )}
          </div>
          {!isCompleted && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleComplete}
              disabled={!allAnswered || completing}
            >
              {completing ? 'Fullfører…' : 'Fullfør analyse'}
            </Button>
          )}
        </div>

        {/* ── Clause list ── */}
        <ModuleSectionCard className="divide-y divide-neutral-100">
          {leafClauses.map((clause) => {
            const response = responseByClauseId.get(clause.id)
            const isSaving = savingClauseId === clause.id
            return (
              <div key={clause.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      <span className="mr-2 font-mono text-xs text-neutral-400">
                        {clause.clauseId}
                      </span>
                      {clause.title}
                    </p>

                    {/* Rating buttons */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {([0, 1, 2, 3] as GapRating[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          disabled={isCompleted || isSaving}
                          onClick={() => handleRating(clause.id, r)}
                          className={[
                            'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                            response?.rating === r
                              ? RATING_COLOURS[r]
                              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                            isCompleted ? 'cursor-default opacity-70' : 'cursor-pointer',
                          ].join(' ')}
                        >
                          {r} — {GAP_RATING_LABELS[r]}
                        </button>
                      ))}
                    </div>

                    {/* Notes */}
                    {response?.rating !== undefined && (
                      <textarea
                        className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#3730a3] disabled:bg-neutral-50 disabled:text-neutral-500"
                        placeholder="Notater (valgfritt)…"
                        rows={2}
                        defaultValue={response.notes ?? ''}
                        disabled={isCompleted}
                        onBlur={(e) => handleNotes(clause.id, e.target.value)}
                      />
                    )}
                  </div>

                  {isSaving && (
                    <span className="mt-1 text-xs text-neutral-400">Lagrer…</span>
                  )}
                </div>
              </div>
            )
          })}
        </ModuleSectionCard>
      </div>
    </ModulePageShell>
  )
}
