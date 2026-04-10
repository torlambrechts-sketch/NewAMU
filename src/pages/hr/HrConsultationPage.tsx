import { useCallback, useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Download, FileJson, Users } from 'lucide-react'
import { useHrCompliance } from '../../hooks/useHrCompliance'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { HrConsultationCommentRow, HrConsultationParticipantRow } from '../../types/hrCompliance'
import { ComplianceModuleChrome } from '../../components/compliance/ComplianceModuleChrome'
import { hrComplianceHubItems } from './hrComplianceHubNav'

export function HrConsultationPage() {
  const { pathname } = useLocation()
  const hr = useHrCompliance()
  const { fetchCaseDetail } = hr
  const { user } = useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const caseId = searchParams.get('case') ?? ''

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [ch8, setCh8] = useState(true)
  const [newParticipant, setNewParticipant] = useState('')
  const [comment, setComment] = useState('')
  const [decision, setDecision] = useState('')
  const [detail, setDetail] = useState<{
    participants: HrConsultationParticipantRow[]
    comments: HrConsultationCommentRow[]
    events: { event_type: string; body: string; created_at: string }[]
  } | null>(null)

  const selected = hr.cases.find((c) => c.id === caseId)

  const loadDetail = useCallback(async () => {
    if (!caseId) {
      setDetail(null)
      return
    }
    const d = await fetchCaseDetail(caseId)
    setDetail(d)
  }, [caseId, fetchCaseDetail])

  useEffect(() => {
    queueMicrotask(() => {
      void loadDetail()
    })
  }, [loadDetail])

  function selectCase(id: string) {
    setSearchParams({ case: id }, { replace: true })
  }

  async function exportJson() {
    if (!caseId) return
    const data = await hr.exportConsultationProtocol(caseId)
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kapittel-8-protokoll-${caseId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <ComplianceModuleChrome
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Samsvar', to: '/compliance' },
        { label: 'HR & rettssikkerhet', to: '/hr' },
        { label: 'Kap. 8' },
      ]}
      title="Informasjon og drøfting (AML kap. 8)"
      description={
        <p className="max-w-3xl">
          For virksomheter med minst 50 ansatte: dokumenter når informasjon ble gitt til tillitsvalgte, deres bemerkninger, og
          beslutningsgrunnlag. Eksport som JSON-protokoll (PDF kan genereres senere).
        </p>
      }
      hubAriaLabel="HR & rettssikkerhet — faner"
      hubItems={hrComplianceHubItems(pathname)}
    >
      {hr.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hr.error}</p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Users className="size-4" /> Saker
          </h2>
          <ul className="mt-3 space-y-1">
            {hr.cases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => selectCase(c.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    c.id === caseId ? 'bg-[#1a3d32] text-white' : 'hover:bg-neutral-100'
                  }`}
                >
                  {c.title}
                  <span className="block text-xs opacity-80">{c.status}</span>
                </button>
              </li>
            ))}
          </ul>

          {hr.canConsultation && (
            <form
              className="mt-6 border-t border-neutral-100 pt-4"
              onSubmit={(e) => {
                e.preventDefault()
                void hr.createConsultationCase(title, desc, ch8).then((r) => {
                  if (r.ok) {
                    setTitle('')
                    setDesc('')
                    setCh8(true)
                  }
                })
              }}
            >
              <h3 className="text-xs font-semibold uppercase text-neutral-500">Ny sak</h3>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tittel"
                required
                className="mt-2 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Bakgrunn og planlagt beslutning (utkast)"
                rows={3}
                className="mt-2 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-neutral-700">
                <input type="checkbox" checked={ch8} onChange={(e) => setCh8(e.target.checked)} />
                Kapittel 8 (50+ ansatte) aktuelt
              </label>
              <button type="submit" className="mt-3 w-full rounded-lg bg-[#1a3d32] py-2 text-sm font-medium text-white">
                Opprett
              </button>
            </form>
          )}
        </aside>

        <main className="min-h-[400px]">
          {!caseId && <p className="text-sm text-neutral-500">Velg en sak eller opprett ny.</p>}

          {selected && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">{selected.title}</h2>
                    <p className="mt-1 text-sm text-neutral-600">{selected.description}</p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Status: {selected.status}
                      {selected.aml_chapter_8_applies ? ' · Kap. 8 markert som relevant' : ''}
                    </p>
                    {selected.information_provided_at && (
                      <p className="mt-1 text-sm text-emerald-800">
                        Informasjon registrert: {new Date(selected.information_provided_at).toLocaleString('nb-NO')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void exportJson()}
                      className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32]"
                    >
                      <FileJson className="size-4" /> Eksporter protokoll (JSON)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void hr.exportConsultationProtocol(caseId).then((data) => {
                          if (!data) return
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(blob)
                          a.download = `kapittel-8-${caseId.slice(0, 8)}.json`
                          a.click()
                          URL.revokeObjectURL(a.href)
                        })
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white"
                    >
                      <Download className="size-4" /> Last ned
                    </button>
                  </div>
                </div>

                {hr.canConsultation && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void hr.recordInformationProvided(caseId)}
                      disabled={!!selected.information_provided_at}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 disabled:opacity-50"
                    >
                      Registrer at informasjon er gitt
                    </button>
                  </div>
                )}
              </div>

              {hr.canConsultation && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-neutral-900">Inviter deltaker</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      value={newParticipant}
                      onChange={(e) => setNewParticipant(e.target.value)}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    >
                      <option value="">— Velg bruker —</option>
                      {hr.orgUsers.map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.display_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newParticipant) return
                        void hr.addConsultationParticipant(caseId, newParticipant, 'union_rep').then(() => {
                          void loadDetail()
                          setNewParticipant('')
                        })
                      }}
                      className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
                    >
                      Legg til tillitsvalgt
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-neutral-900">Bemerkninger</h3>
                <div className="mt-3 space-y-3">
                  {detail?.comments.map((c) => (
                    <div key={c.id} className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2 text-sm">
                      <p className="text-xs text-neutral-500">
                        {new Date(c.created_at).toLocaleString('nb-NO')} · {c.author_id === user?.id ? 'Du' : c.author_id.slice(0, 8)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-neutral-800">{c.body}</p>
                    </div>
                  ))}
                  {(!detail?.comments || detail.comments.length === 0) && (
                    <p className="text-sm text-neutral-500">Ingen kommentarer ennå.</p>
                  )}
                </div>
                <div className="mt-4">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Formell bemerkning til saken…"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!comment.trim()) return
                      void hr.addConsultationComment(caseId, comment).then(() => {
                        setComment('')
                        void loadDetail()
                      })
                    }}
                    className="mt-2 rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
                  >
                    Publiser bemerkning
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-neutral-900">Beslutning / oppsummering (ledelse)</h3>
                <textarea
                  value={decision || selected.decision_summary}
                  onChange={(e) => setDecision(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="Hva ble besluttet etter drøfting (når aktuelt)"
                />
                {hr.canConsultation && (
                  <button
                    type="button"
                    onClick={() =>
                      void hr.updateConsultationCase(caseId, {
                        decision_summary: decision || selected.decision_summary,
                      })
                    }
                    className="mt-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
                  >
                    Lagre beslutningstekst
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
                <h3 className="text-sm font-semibold text-neutral-800">Tidslinje</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {detail?.events.map((ev, i) => (
                    <li key={i} className="border-l-2 border-[#1a3d32]/30 pl-3">
                      <span className="text-xs text-neutral-500">{new Date(ev.created_at).toLocaleString('nb-NO')}</span>
                      <span className="ml-2 font-medium text-neutral-800">{ev.event_type}</span>
                      <p className="text-neutral-600">{ev.body}</p>
                    </li>
                  ))}
                </ul>
                {detail?.participants && detail.participants.length > 0 && (
                  <p className="mt-4 text-xs text-neutral-600">
                    Deltakere: {detail.participants.map((p) => p.user_id.slice(0, 8)).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </ComplianceModuleChrome>
  )
}
