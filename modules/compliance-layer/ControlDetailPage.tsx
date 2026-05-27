// ControlDetailPage — /controls/:controlId (standalone route) and
// ControlDetailView (embeddable into Internkontroll · Kontroller).
//
// Tabs: Oversikt / Lovkrav / Bindinger / Bevisjournal / Innstillinger.
// Each tab pulls from a dedicated hook so heavy reads only run when that
// tab is active. Mirrors the meeting/checklist detail-page pattern.
// Uses design-system primitives per DESIGN_SYSTEM.md §3.

import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { PageShell } from '../../template'
import { Button } from '../../src/components/ui/Button'
import { ControlEditorPanel } from './ControlEditorPanel'
import { BindingEditorPanel } from './admin/BindingEditorPanel'
import { ClauseMappingPanel } from './admin/ClauseMappingPanel'
import { useControlBindings } from './useControlBindings'
import { useControlClauses } from './useControlClauses'
import { useControlEvidence } from './useControlEvidence'
import { useInternalControls } from './useInternalControls'
import type {
  ControlBindingRequirementKind,
  ControlBindingSourceKind,
  ControlCoverageLevel,
  ControlStatusLabel,
} from './types'

type TabId = 'overview' | 'clauses' | 'bindings' | 'evidence' | 'settings'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Oversikt' },
  { id: 'clauses', label: 'Lovkrav' },
  { id: 'bindings', label: 'Bindinger' },
  { id: 'evidence', label: 'Bevisjournal' },
  { id: 'settings', label: 'Innstillinger' },
]

const STATUS_LABELS: Record<ControlStatusLabel, string> = {
  on_track: 'På sporet',
  due_soon: 'Forfaller snart',
  overdue: 'Forfalt',
  never_executed: 'Aldri utført',
  retired: 'Pensjonert',
}

const COVERAGE_LABELS: Record<ControlCoverageLevel, string> = {
  primary: 'Primær',
  supporting: 'Støttende',
  partial: 'Delvis',
}

const REQUIREMENT_LABELS: Record<ControlBindingRequirementKind, string> = {
  latest_within_cadence: 'Siste innen frekvens',
  count_within_period: 'Antall innen periode',
  exists: 'Eksisterer',
  signed: 'Signert',
}

const SOURCE_KIND_LABELS: Record<ControlBindingSourceKind, string> = {
  compliance_execution: 'Sjekklist-utførelse',
  survey_response: 'Undersøkelses-svar',
  document_acknowledgement: 'Dokument-bekreftelse',
  learning_completion: 'Kursfullføring',
  task_completion: 'Lukket oppgave',
  meeting_protocol: 'Møteprotokoll',
  register_record: 'Registerpost',
  manual_evidence: 'Manuelt bevis',
}

// Standalone route. Reads `controlId` from the URL, then defers to
// ControlDetailView. Kept thin so the embeddable view can be reused
// from inside Internkontroll · Kontroller without a second hook tree.
export function ControlDetailPage() {
  const { controlId } = useParams<{ controlId: string }>()
  if (!controlId) {
    return (
      <PageShell title="Mangler kontroll-id" description="">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Ugyldig URL — kontroll-id mangler.
        </div>
      </PageShell>
    )
  }
  return (
    <PageShell title="" description="">
      <ControlDetailView controlId={controlId} />
    </PageShell>
  )
}

/**
 * Embeddable detail view. Renders title + tabs + tab content + the
 * three edit panels. Use from inside any page chrome (Internkontroll,
 * /controls/:id PageShell, modal, …). `backHref` controls the
 * "Tilbake" button target; `onBack` overrides it with a callback for
 * embed scenarios (e.g. clearing a `?control=` query param).
 */
export function ControlDetailView({
  controlId,
  backHref = '/internkontroll?section=kontroller',
  onBack,
}: {
  controlId: string
  backHref?: string
  onBack?: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [editing, setEditing] = useState(false)
  const [bindingPanelOpen, setBindingPanelOpen] = useState(false)
  const [clausePanelOpen, setClausePanelOpen] = useState(false)

  const { byId, statusByControlId, loading: cLoading, refresh: refreshControls } =
    useInternalControls({ supabase })
  const {
    junctionsByControlId,
    clausesById,
    refresh: refreshClauses,
  } = useControlClauses({ supabase })
  const { byControlId, refresh: refreshBindings } = useControlBindings({
    supabase,
  })
  const { executions, refresh: refreshEvidence, recordManualEvidence } =
    useControlEvidence({ supabase, controlId: controlId ?? null })

  const control = controlId ? byId[controlId] : undefined
  const statusView = controlId ? statusByControlId[controlId] : undefined
  const clauseJunctions = useMemo(
    () => (controlId ? junctionsByControlId[controlId] ?? [] : []),
    [controlId, junctionsByControlId],
  )
  const bindings = controlId ? byControlId[controlId] ?? [] : []

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshControls(),
      refreshClauses(),
      refreshBindings(),
      refreshEvidence(),
    ])
  }, [refreshControls, refreshClauses, refreshBindings, refreshEvidence])

  const groupedClauses = useMemo(() => {
    const map: Record<string, typeof clauseJunctions> = {}
    for (const j of clauseJunctions) {
      const c = clausesById[j.clause_id]
      const reg = c?.regulation_id ?? 'ukjent'
      if (!map[reg]) map[reg] = []
      map[reg].push(j)
    }
    return map
  }, [clauseJunctions, clausesById])

  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
    >
      ← Tilbake
    </button>
  ) : (
    <Link
      to={backHref}
      className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
    >
      ← Tilbake
    </Link>
  )

  if (cLoading && !control) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        Laster kontroll…
      </div>
    )
  }

  if (!control) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Fant ingen kontroll med id {controlId}. {backButton}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header — replaces the previous PageShell-supplied chrome so the
          view can be embedded inside Internkontroll's section column. */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3">
        <div className="min-w-0 space-y-1">
          <h2
            className="text-xl font-semibold text-neutral-900 md:text-2xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {control.name}
          </h2>
          {control.purpose ? (
            <p className="text-sm text-neutral-600">{control.purpose}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {backButton}
          {!control.is_system ? (
            <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
              Rediger
            </Button>
          ) : (
            <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
              Systemkontroll — skrivebeskyttet
            </span>
          )}
        </div>
      </header>
      <nav className="flex gap-1 border-b border-neutral-200 text-sm">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab(t.id)}
            className={`-mb-px rounded-none border-b-2 px-3 py-2 font-medium ${
              activeTab === t.id
                ? 'border-amber-700 text-amber-800'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Status
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-neutral-500">Tilstand</dt>
              <dd className="text-neutral-900">
                {statusView ? STATUS_LABELS[statusView.status_label] : '—'}
              </dd>
              <dt className="text-neutral-500">Sist utført</dt>
              <dd className="text-neutral-900">
                {statusView?.last_occurred_at
                  ? new Date(statusView.last_occurred_at).toLocaleDateString(
                      'nb-NO',
                    )
                  : 'Ingen'}
              </dd>
              <dt className="text-neutral-500">Neste frist</dt>
              <dd className="text-neutral-900">
                {statusView?.next_due_at
                  ? new Date(statusView.next_due_at).toLocaleDateString('nb-NO')
                  : '—'}
              </dd>
              <dt className="text-neutral-500">Utførelser siste 12 mnd</dt>
              <dd className="text-neutral-900">
                {statusView?.last12m_executions ?? 0}
              </dd>
              <dt className="text-neutral-500">Totalt</dt>
              <dd className="text-neutral-900">
                {statusView?.total_executions ?? 0}
              </dd>
            </dl>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Konfigurasjon
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-neutral-500">Familie</dt>
                <dd className="text-neutral-900">{control.control_family}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Frekvens</dt>
                <dd className="text-neutral-900">
                  {control.frequency_hint ?? 'Ved hendelse'}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Eier-rolle</dt>
                <dd className="text-neutral-900">{control.owner_role ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Slug</dt>
                <dd className="font-mono text-xs text-neutral-700">
                  {control.slug}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {activeTab === 'clauses' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Lovkrav som denne kontrollen oppfyller
            </h2>
            {!control.is_system ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setClausePanelOpen(true)}
              >
                Legg til lovkrav
              </Button>
            ) : null}
          </div>
          {Object.keys(groupedClauses).length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              Ingen lovkrav koblet ennå.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedClauses).map(([reg, items]) => (
                <div
                  key={reg}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
                    {reg.toUpperCase()}
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {items.map((j) => {
                      const c = clausesById[j.clause_id]
                      return (
                        <li
                          key={j.clause_id}
                          className="flex items-center justify-between gap-3 rounded border border-neutral-100 px-3 py-2"
                        >
                          <span>
                            <span className="font-mono text-xs text-neutral-700">
                              {c?.code ?? j.clause_id}
                            </span>{' '}
                            <span className="text-neutral-900">
                              {c?.title ?? ''}
                            </span>
                          </span>
                          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                            {COVERAGE_LABELS[j.coverage_level]}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'bindings' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Bindinger — hva teller som bevis
            </h2>
            {!control.is_system ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setBindingPanelOpen(true)}
              >
                Ny binding
              </Button>
            ) : null}
          </div>
          {bindings.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              Ingen bindinger ennå. Når du legger til en, vil signerte
              artefakter i modulen automatisk telle som bevis.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {bindings.map((b) => (
                <li
                  key={b.id}
                  className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {SOURCE_KIND_LABELS[b.source_kind]} —{' '}
                        <span className="font-mono text-xs text-neutral-700">
                          {b.source_template_slug ?? b.source_template_id}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        {REQUIREMENT_LABELS[b.requirement_kind]} ·{' '}
                        {b.cadence_hint ?? 'arvet frekvens'} ·{' '}
                        {b.is_required ? 'påkrevd' : 'støttende'}
                      </p>
                      {b.notes ? (
                        <p className="mt-1 text-xs text-neutral-700">{b.notes}</p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        b.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {b.is_active ? 'aktiv' : 'inaktiv'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {activeTab === 'evidence' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Bevisjournal (siste 200)
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const summary = window.prompt(
                  'Beskrivelse av det manuelle beviset:',
                )
                if (!summary) return
                const url = window.prompt(
                  'Valgfri lenke til bevis-dokument (kan stå tomt):',
                )
                await recordManualEvidence({
                  control_id: controlId,
                  occurred_at: new Date().toISOString(),
                  summary,
                  evidence_url: url || null,
                })
                await refreshEvidence()
              }}
            >
              Last opp manuelt bevis
            </Button>
          </div>
          {executions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              Ingen bevisrader ennå. Signer en artefakt i en bundet modul,
              eller last opp manuelt bevis over.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
              {executions.map((e) => (
                <li key={e.id} className="flex items-start gap-3 p-3 text-sm">
                  <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    {SOURCE_KIND_LABELS[e.source_kind]}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900">
                      {e.summary ?? 'Uten beskrivelse'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-600">
                      {new Date(e.occurred_at).toLocaleString('nb-NO')} ·{' '}
                      <span className="font-mono">{e.source_table}</span>
                    </p>
                  </div>
                  {e.evidence_url ? (
                    <a
                      href={e.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-700 hover:underline"
                    >
                      Åpne
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
            Innstillinger
          </h2>
          {control.is_system ? (
            <p className="text-sm text-neutral-700">
              Dette er en systemkontroll. Klone den for å tilpasse (kommer i
              Phase 2).
            </p>
          ) : (
            <p className="text-sm text-neutral-700">
              Bruk "Rediger" øverst på siden for å endre navn, formål eller
              eierrolle.
            </p>
          )}
        </div>
      ) : null}

      <ControlEditorPanel
        open={editing}
        mode="edit"
        control={editing ? control : null}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false)
          await refreshAll()
        }}
      />
      <BindingEditorPanel
        open={bindingPanelOpen}
        controlId={controlId}
        onClose={() => setBindingPanelOpen(false)}
        onSaved={async () => {
          setBindingPanelOpen(false)
          await refreshBindings()
        }}
      />
      <ClauseMappingPanel
        open={clausePanelOpen}
        controlId={controlId}
        onClose={() => setClausePanelOpen(false)}
        onSaved={async () => {
          setClausePanelOpen(false)
          await refreshClauses()
        }}
      />
    </div>
  )
}
