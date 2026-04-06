import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch, Loader2, Plus, Trash2, Zap } from 'lucide-react'
import { useWorkflows } from '../hooks/useWorkflows'
import { WORKFLOW_SOURCE_MODULES } from '../types/workflow'
import type { WorkflowAction, WorkflowCondition } from '../types/workflow'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CARD = 'rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm'

const DEFAULT_CONDITION: WorkflowCondition = { match: 'always' }
const DEFAULT_ACTIONS: WorkflowAction[] = [
  {
    type: 'create_task',
    title: 'Oppfølgingsoppgave',
    description: 'Opprettet av arbeidsflyt',
    assignee: 'Ansvarlig',
    dueInDays: 7,
    module: 'hse',
    sourceType: 'manual',
  },
]

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'regel'
}

export function WorkflowModulePage() {
  const wf = useWorkflows()
  const [tab, setTab] = useState<'design' | 'runs' | 'settings'>('design')
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sourceModule, setSourceModule] = useState('hse')
  const [triggerOn, setTriggerOn] = useState<'insert' | 'update' | 'both'>('both')
  const [conditionText, setConditionText] = useState(JSON.stringify(DEFAULT_CONDITION, null, 2))
  const [actionsText, setActionsText] = useState(JSON.stringify(DEFAULT_ACTIONS, null, 2))
  const [formErr, setFormErr] = useState<string | null>(null)

  const templatesCount = useMemo(() => wf.rules.filter((r) => r.is_template).length, [wf.rules])

  const parseJson = useCallback(<T,>(raw: string, label: string): T | null => {
    try {
      return JSON.parse(raw) as T
    } catch {
      setFormErr(`Ugyldig JSON i ${label}`)
      return null
    }
  }, [])

  const handleSaveRule = useCallback(async () => {
    setFormErr(null)
    const cond = parseJson<WorkflowCondition>(conditionText, 'betingelse')
    const acts = parseJson<WorkflowAction[]>(actionsText, 'handlinger')
    if (!cond || !acts || !Array.isArray(acts)) return
    const s = slug.trim() || slugify(name)
    const res = await wf.upsertRule({
      slug: s,
      name: name.trim() || 'Uten navn',
      description: '',
      source_module: sourceModule,
      trigger_on: triggerOn,
      is_active: false,
      condition_json: cond,
      actions_json: acts,
    })
    if (res.ok) {
      setFormOpen(false)
      setName('')
      setSlug('')
      setConditionText(JSON.stringify(DEFAULT_CONDITION, null, 2))
      setActionsText(JSON.stringify(DEFAULT_ACTIONS, null, 2))
    }
  }, [wf, name, slug, sourceModule, triggerOn, conditionText, actionsText, parseJson])

  return (
    <div className={PAGE_WRAP}>
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Arbeidsflyt</span>
      </nav>

      <div className="flex flex-wrap items-start gap-6 border-b border-neutral-200/80 pb-8">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#1a3d32] text-[#c9a227]">
          <GitBranch className="size-9" />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Arbeidsflyt
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
            Koble automatiske oppgaver og oppfølging til dataregistrering (HSE, internkontroll, wiki). Regler kjøres i
            databasen når JSON-moduler lagres — så ingenting tapes ved dårlig nett. Ekstern e-post/Slack krever Edge
            Function (konfigureres i Supabase).
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-neutral-200/80 bg-white/60 p-2">
        {(
          [
            ['design', 'Design & regler'],
            ['runs', 'Kjøringer'],
            ['settings', 'Innstillinger'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === id ? 'bg-[#1a3d32] text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {wf.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{wf.error}</p>
      )}

      {tab === 'design' && (
        <div className="mt-8 space-y-6">
          <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Regler</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Aktiver med bryteren. Tom database = ingen sideeffekter — alt er av som standard til du aktiverer.
              </p>
            </div>
            {wf.canManage && (
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
              >
                <Plus className="size-4" /> Ny regel
              </button>
            )}
          </div>

          {formOpen && wf.canManage && (
            <div className={CARD}>
              <h3 className="font-semibold text-neutral-900">Ny regel</h3>
              {formErr && <p className="mt-2 text-sm text-red-700">{formErr}</p>}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-neutral-600">Navn</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="F.eks. Kritisk hendelse → HMS-oppgave"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-neutral-600">Slug (ID)</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono text-xs"
                    placeholder="auto fra navn hvis tom"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-neutral-600">Kilde (modul)</span>
                  <select
                    value={sourceModule}
                    onChange={(e) => setSourceModule(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    {WORKFLOW_SOURCE_MODULES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-neutral-600">Utløser</span>
                  <select
                    value={triggerOn}
                    onChange={(e) => setTriggerOn(e.target.value as 'insert' | 'update' | 'both')}
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <option value="both">Lagring (ny + oppdatering)</option>
                    <option value="insert">Kun første lagring</option>
                    <option value="update">Kun oppdateringer</option>
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm">
                <span className="text-neutral-600">Betingelse (JSON)</span>
                <textarea
                  value={conditionText}
                  onChange={(e) => setConditionText(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
                />
              </label>
              <label className="mt-4 block text-sm">
                <span className="text-neutral-600">Handlinger (JSON-array)</span>
                <textarea
                  value={actionsText}
                  onChange={(e) => setActionsText(e.target.value)}
                  rows={10}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveRule()}
                  className="rounded-xl bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
                >
                  Lagre regel (av som standard)
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-700"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-neutral-200/90">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Aktiv</th>
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">Kilde</th>
                  <th className="px-4 py-3">Mal</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {wf.loading && wf.rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      <Loader2 className="mx-auto size-6 animate-spin" /> Laster…
                    </td>
                  </tr>
                ) : wf.rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      Ingen regler ennå. Legg til maler under Innstillinger eller opprett egen regel.
                    </td>
                  </tr>
                ) : (
                  wf.rules.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                      <td className="px-4 py-3">
                        {wf.canManage ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={r.is_active}
                            onClick={() => void wf.setRuleActive(r.id, !r.is_active)}
                            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                              r.is_active ? 'bg-emerald-600' : 'bg-neutral-300'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition ${
                                r.is_active ? 'translate-x-5' : ''
                              }`}
                            />
                          </button>
                        ) : (
                          <span className="text-neutral-400">{r.is_active ? 'På' : 'Av'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{r.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{r.source_module}</td>
                      <td className="px-4 py-3">{r.is_template ? 'Ja' : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {wf.canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Slette «${r.name}»?`)) void wf.deleteRule(r.id)
                            }}
                            className="inline-flex rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-700"
                            aria-label="Slett"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'runs' && (
        <div className={`${CARD} mt-8`}>
          <h2 className="text-lg font-semibold text-neutral-900">Siste kjøringer</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Logg fra databasen (fullført / hoppet over / feilet). Knyttes til rapportering av responstid senere.
          </p>
          <div className="mt-4 max-h-[480px] overflow-auto rounded-xl border border-neutral-100">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left">Tid</th>
                  <th className="px-3 py-2 text-left">Modul</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Detalj</th>
                </tr>
              </thead>
              <tbody>
                {wf.runs.map((run) => (
                  <tr key={run.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 whitespace-nowrap text-neutral-600">
                      {new Date(run.created_at).toLocaleString('nb-NO')}
                    </td>
                    <td className="px-3 py-2">{run.source_module}</td>
                    <td className="px-3 py-2">{run.status}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-neutral-500">
                      {JSON.stringify(run.detail).slice(0, 120)}
                      {JSON.stringify(run.detail).length > 120 ? '…' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wf.runs.length === 0 && !wf.loading && (
              <p className="p-6 text-center text-sm text-neutral-500">Ingen kjøringer ennå.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className={`${CARD} mt-8 space-y-6`}>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Forhåndsdefinerte compliance-maler</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Ett-knapps import av AML / IK-f-relaterte maler (alle starter <strong>av</strong>). Aktiver under
              Design når dere er klare.
            </p>
            {wf.canManage ? (
              <button
                type="button"
                onClick={async () => {
                  const r = await wf.seedComplianceTemplates()
                  if (r.ok) alert('Maler lagt til (eller fantes fra før).')
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100"
              >
                <Zap className="size-4" /> Importer compliance-maler
              </button>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Kun administratorer med «workflows.manage» kan importere.</p>
            )}
            <p className="mt-2 text-xs text-neutral-500">Maler i database: {templatesCount}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-700">
            <strong className="text-neutral-900">Teknisk:</strong> Utsatt eskalering (7 dager i «todo») planlegges via
            tabellen <code className="rounded bg-white px-1">workflow_scheduled_actions</code> + cron/Edge Function.
            Ekstern varsling (SendGrid, Slack) bør kalles fra Edge Function med webhook fra databasen — ikke fra
            nettleseren.
          </div>
        </div>
      )}
    </div>
  )
}
