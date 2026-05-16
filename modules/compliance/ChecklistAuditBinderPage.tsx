// ChecklistAuditBinderPage — revisor-ready printable summary of a signed
// compliance checklist execution. Reachable from any signed execution via
// the "Generer revisorperm" button or directly at
// /compliance/checklists/:executionId/binder.
//
// Why client-side print rather than server-side PDF:
//   * Avoids a puppeteer / chromium server dependency.
//   * Renders deterministically — every section / item / response /
//     spawned task / sign checksum laid out in document order with a
//     print stylesheet that the browser converts to PDF on demand.
//   * The signed execution's definition_snapshot is the source of truth —
//     the binder reads from there, not the live template, so the binder
//     can be regenerated years later and still matches the audit record.
//
// What goes in the binder:
//   1. Cover sheet — org / template / signed-at / signed-by / checksum
//   2. Roller og organisering (Section 0 metadata)
//   3. Per section: title, chapter, intro, every item with answer +
//      severity + comment, plus resolution-pointer evidence (links).
//   4. Oppfølgingsoppgaver — task_items spawned from this execution
//      (source_id = executionId, source_category = compliance_checklist_item).
//   5. Footer — sign integrity tag (sign_checksum) so the printed PDF can
//      be compared against the row signature.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { parseChecklistDefinition } from './schema'
import { ResolutionPointerChip } from './components/ResolutionPointerChip'
import type {
  ChecklistItem,
  ChecklistSection,
  ComplianceResponseRow,
} from './types'

type BoundTask = {
  id: string
  title: string
  status: string
  priority: string
  assignee_name: string | null
  due_date: string | null
  source_item_key: string | null
}

function readAnswerLabel(response: ComplianceResponseRow | undefined): string {
  if (!response) return '— (ikke besvart)'
  const v = response.value as { ok?: boolean | null } | null
  if (!v || typeof v !== 'object') return '— (ukjent)'
  if (v.ok === true) return 'I orden'
  if (v.ok === false) return 'Mangler'
  if (v.ok === null) return 'Ikke aktuelt'
  return '— (ukjent)'
}

export function ChecklistAuditBinderPage() {
  const { executionId } = useParams<{ executionId: string }>()
  const orgSetup = useOrgSetupContext()
  const { supabase, organization } = orgSetup
  const cl = useChecklistModule({ supabase })
  const { load, loading, loadDetail, executions, responsesByExecutionId, templates, assignableUsers } = cl

  const [tasks, setTasks] = useState<BoundTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  useEffect(() => {
    void load().then(() => setInitialLoadDone(true))
  }, [load])

  useEffect(() => {
    if (executionId) void loadDetail(executionId)
  }, [executionId, loadDetail])

  const execution = useMemo(
    () => executions.find((e) => e.id === executionId) ?? null,
    [executions, executionId],
  )

  const template = useMemo(
    () => templates.find((t) => t.id === execution?.template_id) ?? null,
    [templates, execution?.template_id],
  )

  // The binder always reads from the FROZEN snapshot — never the live
  // template — so the printed record matches the signed state.
  const definition = useMemo(() => {
    const src = execution?.definition_snapshot ?? template?.definition
    return parseChecklistDefinition(src)
  }, [execution?.definition_snapshot, template?.definition])

  const responses = (executionId && responsesByExecutionId[executionId]) || []
  const responsesByKey = useMemo(() => {
    const m = new Map<string, ComplianceResponseRow>()
    for (const r of responses) m.set(r.item_key, r)
    return m
  }, [responses])

  // Load tasks spawned from this execution. Cancellation guard so a
  // mid-fetch unmount or re-keyed effect doesn't setState on a stale
  // render (React 18 would warn).
  useEffect(() => {
    if (!supabase || !executionId || !organization?.id) return
    let cancelled = false
    setTasksLoading(true)
    void supabase
      .from('task_items')
      .select('id,title,status,priority,assignee_name,due_date,source_item_key')
      .eq('organization_id', organization.id)
      .eq('source_category', 'compliance_checklist_item')
      .eq('source_id', executionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setTasks((data ?? []) as BoundTask[])
        setTasksLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, executionId, organization?.id])

  // Not-found state: load completed but no execution matches the URL.
  if (initialLoadDone && !loading && (!execution || !template)) {
    return (
      <div className="mx-auto max-w-[900px] p-8 text-neutral-700">
        <h1 className="text-xl font-semibold text-neutral-900">Fant ikke sjekklisten</h1>
        <p className="mt-2 text-sm">
          Sesjon-ID <code className="font-mono">{executionId}</code> finnes ikke for denne
          organisasjonen, eller er slettet. Sjekk URL-en eller naviger tilbake via menyen.
        </p>
      </div>
    )
  }

  if (!execution || !template) {
    return (
      <div className="mx-auto max-w-[900px] p-8 text-neutral-700">
        <p>Laster revisorperm…</p>
      </div>
    )
  }

  const signedAt = execution.signed_at
    ? new Date(execution.signed_at).toLocaleString('nb-NO')
    : null
  const signer = execution.signed_by
    ? assignableUsers.find((u) => u.id === execution.signed_by)?.displayName ?? execution.signed_by
    : null
  const metadata = (execution.metadata ?? {}) as Record<string, unknown>
  const sections: ChecklistSection[] = definition.sections ?? []

  return (
    <div className="binder-root min-h-screen bg-white text-neutral-900">
      {/* Screen-only header with print button — hidden in print output. */}
      <div className="binder-actions sticky top-0 z-10 border-b border-neutral-200 bg-[#F9F7F2] px-6 py-3 print:hidden">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3">
          <div className="text-sm text-neutral-600">
            Revisorperm — klar for print til PDF. Bruk nettleserens utskriftsfunksjon
            (<kbd className="rounded border border-neutral-300 px-1">Ctrl/Cmd + P</kbd>) og velg «Lagre som PDF».
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Printer className="h-4 w-4" />
            Skriv ut / lagre som PDF
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-[900px] px-6 py-8 print:px-0 print:py-4">
        {/* Cover sheet */}
        <header className="mb-8 border-b-2 border-neutral-900 pb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Revisorperm — compliance-sjekkliste
          </p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">{template.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">{template.description}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="font-semibold text-neutral-700">Organisasjon</dt>
            <dd className="text-neutral-900">{organization?.name ?? '—'}</dd>
            <dt className="font-semibold text-neutral-700">Sesjonstittel</dt>
            <dd className="text-neutral-900">{execution.title}</dd>
            <dt className="font-semibold text-neutral-700">Status</dt>
            <dd className="text-neutral-900">{execution.status === 'signed' ? 'Signert' : execution.status}</dd>
            <dt className="font-semibold text-neutral-700">Signert</dt>
            <dd className="text-neutral-900">{signedAt ?? '— (ikke signert)'}</dd>
            <dt className="font-semibold text-neutral-700">Signert av</dt>
            <dd className="text-neutral-900">{signer ?? '—'}</dd>
            <dt className="font-semibold text-neutral-700">Sign-checksum</dt>
            <dd className="break-all font-mono text-xs text-neutral-700">{execution.sign_checksum ?? '—'}</dd>
            <dt className="font-semibold text-neutral-700">Pakke</dt>
            <dd className="text-neutral-900">{execution.pack}</dd>
          </dl>
        </header>

        {/* Section 0 — metadata */}
        {Object.keys(metadata).length > 0 && (
          <section className="mb-8 break-inside-avoid">
            <h2 className="mb-3 border-b border-neutral-300 pb-1 text-xl font-semibold">
              0. Roller og organisering
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {Object.entries(metadata).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium text-neutral-700">{k}</dt>
                  <dd className="text-neutral-900">
                    {Array.isArray(v) ? v.join(', ') : String(v ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Sections */}
        {sections.map((section, idx) => (
          <section key={section.key} className="mb-8 break-inside-avoid-page">
            <h2 className="mb-1 border-b border-neutral-300 pb-1 text-xl font-semibold">
              {idx + 1}. {section.title}
            </h2>
            {section.chapter && (
              <p className="text-xs text-neutral-500">{section.chapter}</p>
            )}
            {section.intro && (
              <p className="mt-2 text-sm italic text-neutral-700">{section.intro}</p>
            )}
            <ul className="mt-3 space-y-3">
              {section.items.map((item: ChecklistItem) => {
                const resp = responsesByKey.get(item.key)
                const answerLabel = readAnswerLabel(resp)
                return (
                  <li
                    key={item.key}
                    className="break-inside-avoid rounded border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {item.law_ref && (
                          <span className="mr-2 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium">
                            {item.law_ref}
                          </span>
                        )}
                        <span className="font-medium text-neutral-900">{item.prompt}</span>
                      </div>
                      <span className="shrink-0 font-semibold">{answerLabel}</span>
                    </div>
                    {resp?.severity && (
                      <p className="mt-1 text-xs">
                        <span className="font-medium text-neutral-700">Alvorlighetsgrad:</span>{' '}
                        <span className="uppercase tracking-wide text-amber-800">{resp.severity}</span>
                      </p>
                    )}
                    {resp?.comment && (
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-xs text-neutral-800">
                        {resp.comment}
                      </pre>
                    )}
                    {item.resolutions && item.resolutions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5 print:hidden">
                        {item.resolutions.map((r, i) => (
                          <ResolutionPointerChip key={`${item.key}-r-${i}`} resolution={r} />
                        ))}
                      </div>
                    )}
                    {item.resolutions && item.resolutions.length > 0 && (
                      <p className="mt-1 hidden text-xs text-neutral-600 print:block">
                        Evidens: {item.resolutions
                          .map((r) => `${r.kind}:${r.ref ?? '(uten ref)'}${r.label ? ` (${r.label})` : ''}`)
                          .join(' · ')}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {/* Spawned tasks */}
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-3 border-b border-neutral-300 pb-1 text-xl font-semibold">
            Oppfølgingsoppgaver fra denne gjennomgangen
          </h2>
          {tasksLoading ? (
            <p className="text-sm text-neutral-600">Henter oppgaver…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen oppgaver ble opprettet fra denne gjennomgangen.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left">
                  <th className="py-1 pr-2 text-xs font-semibold uppercase tracking-wide">§ / post</th>
                  <th className="py-1 pr-2 text-xs font-semibold uppercase tracking-wide">Tittel</th>
                  <th className="py-1 pr-2 text-xs font-semibold uppercase tracking-wide">Ansvarlig</th>
                  <th className="py-1 pr-2 text-xs font-semibold uppercase tracking-wide">Frist</th>
                  <th className="py-1 text-xs font-semibold uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-200 align-top">
                    <td className="py-1.5 pr-2 font-mono text-xs">{t.source_item_key ?? '—'}</td>
                    <td className="py-1.5 pr-2">{t.title}</td>
                    <td className="py-1.5 pr-2">{t.assignee_name ?? '—'}</td>
                    <td className="py-1.5 pr-2">{t.due_date ?? '—'}</td>
                    <td className="py-1.5">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-12 border-t border-neutral-300 pt-3 text-xs text-neutral-500">
          <p>
            Generert {new Date().toLocaleString('nb-NO')}. Sign-checksum bekreftes mot
            <code className="ml-1 font-mono">compliance_checklist_executions.sign_checksum</code>.
          </p>
        </footer>
      </article>

      {/* Print stylesheet — keeps each section together, drops nav chrome. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; }
          .binder-actions { display: none !important; }
          .binder-root { background: white !important; }
        }
      `}</style>
    </div>
  )
}
