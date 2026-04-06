import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, GitBranch, RefreshCw } from 'lucide-react'
import { useHrCompliance } from '../../hooks/useHrCompliance'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

export function HrORosPage() {
  const hr = useHrCompliance()
  const { user } = useOrgSetupContext()
  const [amuText, setAmuText] = useState<Record<string, string>>({})
  const [voText, setVoText] = useState<Record<string, string>>({})

  const rows = useMemo(() => hr.rosSignoffs, [hr.rosSignoffs])

  return (
    <div className={PAGE_WRAP}>
      <Link to="/hr" className="mb-6 inline-flex items-center gap-2 text-sm text-[#1a3d32] hover:underline">
        <ArrowLeft className="size-4" /> Til HR-hub
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#1a3d32]/10 text-[#1a3d32]">
            <GitBranch className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Organisatorisk ROS (O-ROS)
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
              For analyser merket <strong>«Organisatorisk endring»</strong> i internkontroll kreves skriftlig vurdering og
              elektronisk signatur fra både AMU-representant og verneombud før ROS kan låses i internkontroll.
            </p>
            <p className="mt-3 text-sm text-neutral-600">
              Opprett og rediger selve ROS-tabellen i{' '}
              <Link className="font-medium text-[#1a3d32] underline" to="/internal-control?tab=ros">
                Internkontroll → ROS
              </Link>
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void hr.refreshRosSignoffs()}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          <RefreshCw className="size-4" /> Oppdater
        </button>
      </div>

      {hr.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hr.error}</p>
      )}

      {!hr.canORosView && !hr.canORosManage && (
        <p className="mt-6 text-sm text-neutral-500">Du har ikke tilgang til O-ROS-signaturer.</p>
      )}

      {(hr.canORosView || hr.canORosManage) && (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                <th className="px-4 py-3">ROS-ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">AMU</th>
                <th className="px-4 py-3">Verneombud</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    Ingen O-ROS-registreringer ennå. Opprett en ROS med kategori «Organisatorisk endring» i internkontroll.
                  </td>
                </tr>
              )}
              {rows.map((s) => {
                const iAmAmu = user?.id === s.amu_representative_user_id
                const iAmVo = user?.id === s.verneombud_user_id
                const amuDone = !!s.amu_signed_at
                const voDone = !!s.verneombud_signed_at
                return (
                  <tr key={s.id} className="border-b border-neutral-100 align-top">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700" title={s.ros_assessment_id}>
                      {shortId(s.ros_assessment_id)}
                    </td>
                    <td className="px-4 py-3">
                      {s.blocked ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Venter signatur</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">Klar for låsing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-700">
                      <p>{amuDone ? `Signert ${new Date(s.amu_signed_at!).toLocaleString('nb-NO')}` : 'Ikke signert'}</p>
                      {s.amu_assessment_text && (
                        <p className="mt-1 max-h-20 overflow-y-auto rounded border border-neutral-100 bg-neutral-50 p-2 text-[11px] text-neutral-600">
                          {s.amu_assessment_text}
                        </p>
                      )}
                      {hr.canORosSign && iAmAmu && !amuDone && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={amuText[s.id] ?? ''}
                            onChange={(e) => setAmuText((m) => ({ ...m, [s.id]: e.target.value }))}
                            rows={3}
                            placeholder="Skriftlig vurdering fra AMU (min. 10 tegn)…"
                            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            disabled={(amuText[s.id] ?? '').trim().length < 10}
                            onClick={() => {
                              const t = (amuText[s.id] ?? '').trim()
                              void hr.signRosOrg(s.ros_assessment_id, 'amu', t).then(() => {
                                setAmuText((m) => ({ ...m, [s.id]: '' }))
                              })
                            }}
                            className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Signer som AMU
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-700">
                      <p>{voDone ? `Signert ${new Date(s.verneombud_signed_at!).toLocaleString('nb-NO')}` : 'Ikke signert'}</p>
                      {s.verneombud_assessment_text && (
                        <p className="mt-1 max-h-20 overflow-y-auto rounded border border-neutral-100 bg-neutral-50 p-2 text-[11px] text-neutral-600">
                          {s.verneombud_assessment_text}
                        </p>
                      )}
                      {hr.canORosSign && iAmVo && !voDone && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={voText[s.id] ?? ''}
                            onChange={(e) => setVoText((m) => ({ ...m, [s.id]: e.target.value }))}
                            rows={3}
                            placeholder="Skriftlig vurdering fra verneombud (min. 10 tegn)…"
                            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            disabled={(voText[s.id] ?? '').trim().length < 10}
                            onClick={() => {
                              const t = (voText[s.id] ?? '').trim()
                              void hr.signRosOrg(s.ros_assessment_id, 'verneombud', t).then(() => {
                                setVoText((m) => ({ ...m, [s.id]: '' }))
                              })
                            }}
                            className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Signer som VO
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        Tekniske detaljer lagres i <code className="rounded bg-neutral-100 px-1">hr_ros_org_signoffs</code> med RLS slik at
        kun administrator, tildelte signatarer og brukere med HR O-ROS-tilgang ser radene.
      </p>
    </div>
  )
}
