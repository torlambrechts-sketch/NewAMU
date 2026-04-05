import { useState } from 'react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'

export function LearningExternalTraining() {
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const {
    externalCertificates,
    submitExternalCertificate,
    approveExternalCertificate,
    learningLoading,
    learningError,
  } = useLearning()

  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const upload = () => {
    if (!title.trim() || !file) {
      setMsg('Tittel og fil er påkrevd.')
      return
    }
    void (async () => {
      const r = await submitExternalCertificate({
        title: title.trim(),
        issuer: issuer.trim() || undefined,
        validUntil: validUntil || null,
        file,
      })
      setMsg(r.ok ? 'Sendt til godkjenning.' : r.error)
      if (r.ok) {
        setTitle('')
        setIssuer('')
        setValidUntil('')
        setFile(null)
      }
    })()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Ekstern opplæring</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Last opp dokumentasjon for kurs tatt utenfor plattformen. Leder godkjenner i listen under.
        </p>
      </div>
      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Ny dokumentasjon</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-neutral-600">
              Tittel / kursnavn
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              Utsteder (valgfritt)
              <input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              Gyldig til (valgfritt)
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              Fil (PDF eller bilde)
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm"
              />
            </label>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PIN_GREEN }}
              onClick={upload}
            >
              Send inn
            </button>
            {msg ? <p className="text-xs text-neutral-700">{msg}</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-neutral-50/80 px-4 py-3 text-sm font-medium text-[#2D403A]">
            Innsendte ({externalCertificates.length})
          </div>
          <ul className="divide-y divide-neutral-100">
            {externalCertificates.map((x) => (
              <li key={x.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-[#2D403A]">{x.title}</div>
                    <div className="text-xs text-neutral-500">
                      {x.issuer ?? '—'} · {x.validUntil ? `Gyldig til ${x.validUntil}` : 'Ingen utløpsdato'}
                    </div>
                    <div className="mt-1 text-xs uppercase text-neutral-400">{x.status}</div>
                  </div>
                  {canManage && x.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900"
                        onClick={() => {
                          void (async () => {
                            const r = await approveExternalCertificate(x.id, true)
                            if (!r.ok) alert(r.error)
                          })()
                        }}
                      >
                        Godkjenn
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900"
                        onClick={() => {
                          void (async () => {
                            const r = await approveExternalCertificate(x.id, false)
                            if (!r.ok) alert(r.error)
                          })()
                        }}
                      >
                        Avslå
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {externalCertificates.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen dokumenter ennå.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
