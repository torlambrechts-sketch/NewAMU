import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react'
import { useHrCompliance } from '../../hooks/useHrCompliance'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

export function HrDiscussionPage() {
  const hr = useHrCompliance()
  const [empId, setEmpId] = useState('')
  const [unionId, setUnionId] = useState('')

  return (
    <div className={PAGE_WRAP}>
      <Link to="/hr" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1a3d32] hover:underline">
        <ArrowLeft className="size-4" /> Til HR-hub
      </Link>

      <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
        Drøftelsessamtale (AML § 15-1)
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">
        Juridisk obligatoriske avkryssinger og referat uten konklusjon om oppsigelse. Etter signatur fra begge parter kan
        saken låses med kryptografisk hash (bevis for rekkefølge før eventuelt oppsigelsesbrev).
      </p>

      {hr.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hr.error}</p>
      )}

      {hr.canDiscussion && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-neutral-900">Ny sak (utkast)</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Velg ansatt som bruker-ID (koble til innlogging senere). UUID fra organization_members kan mappes til bruker.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="block text-sm">
              Arbeidstaker (bruker-ID)
              <input
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="uuid"
                className="mt-1 block w-full min-w-[280px] rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block text-sm">
              Tillitsvalgt (valgfri)
              <input
                value={unionId}
                onChange={(e) => setUnionId(e.target.value)}
                placeholder="uuid"
                className="mt-1 block w-full min-w-[280px] rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void hr.createDiscussionDraft({ employeeUserId: empId.trim(), unionRepUserId: unionId.trim() || null, unionRepInvited: !!unionId.trim() })}
            disabled={!empId.trim()}
            className="mt-4 rounded-xl bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Opprett utkast
          </button>
          <p className="mt-3 text-xs text-neutral-500">Bruk innlogget brukers UUID for arbeidstaker når konto finnes.</p>
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200/90">
        <table className="min-w-[800px] w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50/80 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sjekkliste</th>
              <th className="px-4 py-3">Referat</th>
              <th className="px-4 py-3">Låst</th>
            </tr>
          </thead>
          <tbody>
            {hr.meetings.map((m) => (
              <tr key={m.id} className="border-b border-neutral-100">
                <td className="px-4 py-3">{m.status}</td>
                <td className="px-4 py-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={m.informed_union_accompaniment_right}
                      onChange={(e) => void hr.updateDiscussion(m.id, { informed_union_accompaniment_right: e.target.checked })}
                    />
                    <span className="text-xs">Informert om ledsagerrett</span>
                  </label>
                  <label className="mt-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={m.union_rep_present}
                      onChange={(e) => void hr.updateDiscussion(m.id, { union_rep_present: e.target.checked })}
                    />
                    <span className="text-xs">Tillitsvalgt til stede</span>
                  </label>
                  <label className="mt-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={m.checklist_completed}
                      onChange={(e) => void hr.updateDiscussion(m.id, { checklist_completed: e.target.checked })}
                    />
                    <span className="text-xs">Sjekkliste fullført</span>
                  </label>
                </td>
                <td className="px-4 py-3 align-top">
                  <textarea
                    value={m.summary_text}
                    onChange={(e) => void hr.updateDiscussion(m.id, { summary_text: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                    placeholder="Referat (ingen konklusjon om oppsigelse)"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void hr.signDiscussion(m.id, 'manager')}
                      className="rounded border border-neutral-200 px-2 py-1 text-xs"
                    >
                      Signer leder
                    </button>
                    <button
                      type="button"
                      onClick={() => void hr.signDiscussion(m.id, 'employee')}
                      className="rounded border border-neutral-200 px-2 py-1 text-xs"
                    >
                      Signer AT
                    </button>
                    {m.union_rep_invited && (
                      <button
                        type="button"
                        onClick={() => void hr.signDiscussion(m.id, 'union')}
                        className="rounded border border-neutral-200 px-2 py-1 text-xs"
                      >
                        Signer tillitsvalgt
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  {m.status === 'locked' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Lock className="size-4" /> {m.content_sha256?.slice(0, 16)}…
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void hr.lockDiscussion(m.id)}
                      disabled={!m.manager_signed_at || !m.employee_signed_at}
                      className="inline-flex items-center gap-1 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                    >
                      <CheckCircle2 className="size-3.5" /> Lås (hash)
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hr.meetings.length === 0 && !hr.loading && (
          <p className="p-8 text-center text-sm text-neutral-500">Ingen saker — eller du har ikke tilgang til å se dem.</p>
        )}
      </div>
    </div>
  )
}
