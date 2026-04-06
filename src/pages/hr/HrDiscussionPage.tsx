import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Lock, Shield } from 'lucide-react'
import { useHrCompliance } from '../../hooks/useHrCompliance'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { HrLegalAck } from '../../types/hrCompliance'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

function mergeAck(base: Record<string, unknown> | HrLegalAck | undefined, patch: Partial<HrLegalAck>): HrLegalAck {
  return { ...(base as HrLegalAck), ...patch }
}

export function HrDiscussionPage() {
  const hr = useHrCompliance()
  const { user, profile } = useOrgSetupContext()
  const [empId, setEmpId] = useState('')
  const [unionId, setUnionId] = useState('')
  const [signNames, setSignNames] = useState<Record<string, { manager?: string; employee?: string; union?: string }>>({})

  const myName = profile?.display_name?.trim() || profile?.email || user?.email || ''

  const sortedMeetings = useMemo(
    () => [...hr.meetings].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [hr.meetings],
  )

  function ackFor(m: (typeof hr.meetings)[0]): HrLegalAck {
    const raw = m.legal_acknowledgements
    return typeof raw === 'object' && raw !== null ? (raw as HrLegalAck) : {}
  }

  async function setAck(id: string, patch: Partial<HrLegalAck>) {
    const m = hr.meetings.find((x) => x.id === id)
    if (!m) return
    await hr.updateDiscussion(id, { legal_acknowledgements: mergeAck(m.legal_acknowledgements as Record<string, unknown>, patch) })
  }

  function printPreview(id: string) {
    const m = hr.meetings.find((x) => x.id === id)
    if (!m) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Referat § 15-1</title>
      <style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;line-height:1.5} h1{font-size:1.25rem} .muted{color:#666;font-size:0.85rem}</style></head><body>
      <h1>Referat — drøftelsessamtale (AML § 15-1)</h1>
      <p class="muted">Ikke konklusjon om oppsigelse. Generert ${new Date().toLocaleString('nb-NO')}</p>
      <p><strong>Møtedato:</strong> ${m.meeting_at ? new Date(m.meeting_at).toLocaleString('nb-NO') : '—'}</p>
      <p><strong>Emner drøftet:</strong></p>
      <pre style="white-space:pre-wrap;font:inherit">${(m.topics_discussed || '').replace(/</g, '&lt;')}</pre>
      <p><strong>Referat:</strong></p>
      <pre style="white-space:pre-wrap;font:inherit">${(m.summary_text || '').replace(/</g, '&lt;')}</pre>
      <p><strong>Hash (ved låsing):</strong> ${m.content_sha256 || '—'}</p>
      </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className={PAGE_WRAP}>
      <Link to="/hr" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1a3d32] hover:underline">
        <ArrowLeft className="size-4" /> Til HR-hub
      </Link>

      <div className="flex flex-wrap items-start gap-4 border-b border-neutral-200/80 pb-8">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#1a3d32]/10 text-[#1a3d32]">
          <Shield className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Drøftelsessamtale (AML § 15-1)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">
            Obligatorisk sjekkliste, referat uten oppsigelseskonklusjon, elektronisk signatur med navn, og tidslås med SHA-256
            etter alle påkrevde signaturer. Tillitsvalgt ser kun saker der vedkommende er innkalt.
          </p>
        </div>
      </div>

      {hr.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hr.error}</p>
      )}

      {hr.canDiscussion && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Ny sak</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Arbeidstaker
              <select
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">— Velg bruker —</option>
                {hr.orgUsers
                  .filter((u) => u.user_id !== user?.id)
                  .map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.display_name} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              Tillitsvalgt (valgfritt)
              <select
                value={unionId}
                onChange={(e) => setUnionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">— Ikke innkalt —</option>
                {hr.orgUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              void hr.createDiscussionDraft({
                employeeUserId: empId,
                unionRepUserId: unionId || null,
                unionRepInvited: !!unionId,
              })
            }
            disabled={!empId}
            className="mt-4 rounded-xl bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Opprett utkast
          </button>
          {hr.orgUsers.length === 0 && (
            <p className="mt-2 text-xs text-amber-800">Ingen brukere i organisasjonen funnet — sjekk at migrasjon og RLS er kjørt.</p>
          )}
        </div>
      )}

      <div className="mt-10 space-y-8">
        {sortedMeetings.map((m) => {
          const ack = ackFor(m)
          const locked = m.status === 'locked'
          const sn = signNames[m.id] ?? {}
          return (
            <article
              key={m.id}
              className={`overflow-hidden rounded-2xl border shadow-sm ${locked ? 'border-emerald-200 bg-emerald-50/30' : 'border-neutral-200/90 bg-white'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-[#1a3d32]" />
                  <span className="font-semibold text-neutral-900">Sak {m.id.slice(0, 8)}…</span>
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">{m.status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => printPreview(m.id)}
                  className="text-sm font-medium text-[#1a3d32] hover:underline"
                >
                  Forhåndsvis utskrift
                </button>
              </div>

              <div className="grid gap-6 p-5 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sjekkliste (lovkrav)</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={m.informed_union_accompaniment_right}
                        disabled={locked}
                        onChange={(e) => void hr.updateDiscussion(m.id, { informed_union_accompaniment_right: e.target.checked })}
                      />
                      <span>Arbeidstaker informert om retten til å ha med tillitsvalgt (hvor aktuelt)</span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={m.union_rep_present}
                        disabled={locked}
                        onChange={(e) => void hr.updateDiscussion(m.id, { union_rep_present: e.target.checked })}
                      />
                      <span>Tillitsvalgt var til stede (eller ikke aktuelt / ikke ønsket)</span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={ack.no_termination_conclusion ?? false}
                        disabled={locked}
                        onChange={(e) => void setAck(m.id, { no_termination_conclusion: e.target.checked })}
                      />
                      <span>Referatet inneholder ikke konklusjon om oppsigelse på dette stadiet</span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={m.checklist_completed}
                        disabled={locked}
                        onChange={(e) => void hr.updateDiscussion(m.id, { checklist_completed: e.target.checked })}
                      />
                      <span>Sjekkliste fullført — klar til signatur</span>
                    </label>
                  </ul>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-500">Møtedato og tid</label>
                  <input
                    type="datetime-local"
                    value={m.meeting_at ? m.meeting_at.slice(0, 16) : ''}
                    disabled={locked}
                    onChange={(e) =>
                      void hr.updateDiscussion(m.id, {
                        meeting_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="border-t border-neutral-100 px-5 py-4">
                <label className="text-xs font-semibold text-neutral-500">Emner som ble drøftet</label>
                <textarea
                  value={m.topics_discussed ?? ''}
                  disabled={locked}
                  onChange={(e) => void hr.updateDiscussion(m.id, { topics_discussed: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  placeholder="F.eks. årsaker til drøftelse, mulige tiltak, tidsplan for videre prosess (uten beslutning om oppsigelse)"
                />
              </div>

              <div className="border-t border-neutral-100 px-5 py-4">
                <label className="text-xs font-semibold text-neutral-500">Referat (ingen konklusjon om oppsigelse)</label>
                <textarea
                  value={m.summary_text}
                  disabled={locked}
                  onChange={(e) => void hr.updateDiscussion(m.id, { summary_text: e.target.value })}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>

              {!locked && (
                <div className="border-t border-neutral-100 bg-neutral-50/50 px-5 py-4">
                  <h3 className="text-sm font-semibold text-neutral-800">Elektronisk signatur (fullt navn)</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    {(user?.id === m.manager_user_id || hr.canDiscussion) && (
                      <div>
                        <p className="text-xs text-neutral-600">Leder</p>
                        <input
                          value={sn.manager ?? ''}
                          onChange={(e) =>
                            setSignNames((s) => ({ ...s, [m.id]: { ...s[m.id], manager: e.target.value } }))
                          }
                          placeholder={myName}
                          className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void hr.signDiscussion(m.id, 'manager', sn.manager || myName)}
                          className="mt-2 rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Signer som leder
                        </button>
                      </div>
                    )}
                    {user?.id === m.employee_user_id && (
                      <div>
                        <p className="text-xs text-neutral-600">Arbeidstaker</p>
                        <input
                          value={sn.employee ?? ''}
                          onChange={(e) =>
                            setSignNames((s) => ({ ...s, [m.id]: { ...s[m.id], employee: e.target.value } }))
                          }
                          placeholder={myName}
                          className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void hr.signDiscussion(m.id, 'employee', sn.employee || myName)}
                          className="mt-2 rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Signer som arbeidstaker
                        </button>
                      </div>
                    )}
                    {m.union_rep_invited && user?.id === m.union_rep_user_id && (
                      <div>
                        <p className="text-xs text-neutral-600">Tillitsvalgt</p>
                        <input
                          value={sn.union ?? ''}
                          onChange={(e) =>
                            setSignNames((s) => ({ ...s, [m.id]: { ...s[m.id], union: e.target.value } }))
                          }
                          placeholder={myName}
                          className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void hr.signDiscussion(m.id, 'union', sn.union || myName)}
                          className="mt-2 rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Signer som tillitsvalgt
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-500">
                    Signatur lagres med tidspunkt. Lås først når leder + arbeidstaker har signert
                    {m.union_rep_invited ? ', og tillitsvalgt hvis innkalt' : ''}.
                  </p>
                </div>
              )}

              {locked && (
                <div className="flex flex-wrap items-center gap-3 border-t border-emerald-100 bg-emerald-50/50 px-5 py-4 text-sm text-emerald-900">
                  <Lock className="size-5 shrink-0" />
                  <span>
                    Låst {m.locked_at ? new Date(m.locked_at).toLocaleString('nb-NO') : ''}. SHA-256:{' '}
                    <code className="break-all text-xs">{m.content_sha256}</code>
                  </span>
                </div>
              )}

              {!locked && (
                <div className="border-t border-neutral-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void hr.lockDiscussion(m.id)}
                    disabled={!m.manager_signed_at || !m.employee_signed_at || (m.union_rep_invited && !m.union_rep_signed_at)}
                    className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    <CheckCircle2 className="size-4" /> Lås referat (hash + tidsstempel)
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {sortedMeetings.length === 0 && !hr.loading && (
        <p className="mt-10 text-center text-sm text-neutral-500">Ingen saker — eller du har ikke tilgang.</p>
      )}
    </div>
  )
}
