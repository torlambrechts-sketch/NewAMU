// Studio version timeline — surfaces recent studio_revisions rows.
//
// Per-org-scoped feed of "who changed what in studio" across all
// studio-aware tables. RLS guarantees only the caller's org rows
// surface. Renders inline at the bottom of every scope page in
// Avansert-modus; in Enkel-modus it's hidden (too noisy for the
// 80% who just complete presets).
//
// Phase 1.5 — minimum useful surface. Phase 2a deepens this into the
// full VersionTimeline panel called out in spec §4 (diff view +
// revert capability + reviewer attribution + change_reason inline edit).

import { useCallback, useEffect, useState } from 'react'
import { Loader2, GitCommit } from 'lucide-react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useStudioRevision, type StudioRevisionRow } from '../../../hooks/useStudioRevision'
import { Button } from '../../ui/Button'

// Local row type extends the hook's RevisionRow with the joined
// reviewer email (the hook returns just the id; we hydrate the email
// per row inside this component since the hook intentionally stays
// narrow on what the DB column shape is).
type RevisionRow = StudioRevisionRow & {
  changed_by_email: string | null
}

const SCOPE_LABEL: Record<string, string> = {
  compliance: 'Sjekklister',
  survey: 'Undersøkelser',
  documents: 'Dokumenter',
  learning: 'Læring',
  meetings: 'Møter',
  registers: 'Register',
  dashboards: 'Dashboards',
  workflows: 'Arbeidsflyter',
}

const LIMIT = 12

export type VersionTimelineProps = {
  /** When set, narrows to this scope. Omit for the cross-scope feed. */
  scopeId?: string
}

export function VersionTimeline({ scopeId }: VersionTimelineProps) {
  const { supabase, organization } = useOrgSetupContext()
  const studioRevision = useStudioRevision()
  const [rows, setRows] = useState<RevisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const reload = useCallback(async () => {
    if (!supabase || !organization) return
    setLoading(true)
    // Drive the read through the canonical useStudioRevision hook so
    // every consumer of studio_revisions data shares one boundary +
    // benefits from any future read-side enrichment (currently the
    // hook returns rows verbatim; Phase 2a wires reviewer details).
    const baseRows = await studioRevision.fetchRevisions(scopeId)
    // Hydrate reviewer email by joining profiles separately to keep
    // the hook narrow. RLS lets each user see their own org's profiles.
    const userIds = Array.from(
      new Set(baseRows.map((r) => r.changed_by).filter((id): id is string => !!id)),
    )
    const emails = new Map<string, string>()
    if (userIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      for (const p of data ?? []) {
        const row = p as { id: string; email: string | null }
        if (row.email) emails.set(row.id, row.email)
      }
    }
    setRows(
      baseRows.map((r) => ({
        ...r,
        changed_by_email: r.changed_by ? emails.get(r.changed_by) ?? null : null,
      })),
    )
    setLoading(false)
  }, [supabase, organization, scopeId, studioRevision])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical fetch-on-mount; reload internally setStates
    void reload()
  }, [reload])

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Henter endringslogg…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        Ingen registrerte endringer enda. Endringer dukker opp her etter første lagring.
      </p>
    )
  }

  const visible = expanded ? rows : rows.slice(0, 5)

  return (
    <section aria-label="Endringslogg" className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
          {scopeId ? `Siste endringer i ${SCOPE_LABEL[scopeId] ?? scopeId}` : 'Siste endringer på tvers'}
        </h4>
        <span className="text-[10px] text-neutral-400">{rows.length} av siste {LIMIT}</span>
      </header>
      <ul className="divide-y divide-neutral-100">
        {visible.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-4 py-2.5">
            <GitCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-900">
                <span className="font-medium">{SCOPE_LABEL[r.scope_id] ?? r.scope_id}</span>
                <span className="text-neutral-400"> · {r.kind_id}</span>
                {r.change_reason ? (
                  <span className="text-neutral-700"> — {r.change_reason}</span>
                ) : null}
              </p>
              <p className="text-[10px] text-neutral-500">
                {r.changed_by_email ?? r.changed_by ?? 'ukjent bruker'} · {new Date(r.changed_at).toLocaleString('nb')}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > 5 ? (
        <footer className="border-t border-neutral-100 px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? `Vis bare 5` : `Vis alle ${rows.length}`}
          </Button>
        </footer>
      ) : null}
    </section>
  )
}
