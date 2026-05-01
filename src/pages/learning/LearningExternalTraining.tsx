import { useState } from 'react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WarningBox } from '../../components/ui/AlertBox'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Venter godkjenning',
  approved: 'Godkjent',
  rejected: 'Avslått',
}

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
  const [uploading, setUploading] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  const upload = () => {
    if (!title.trim() || !file) {
      setMsg('Tittel og fil er påkrevd.')
      return
    }
    void (async () => {
      setUploading(true)
      const r = await submitExternalCertificate({
        title: title.trim(),
        issuer: issuer.trim() || undefined,
        validUntil: validUntil || null,
        file,
      })
      setUploading(false)
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
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
          <h2 className="font-semibold text-[#2D403A]">Ny dokumentasjon</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-neutral-600">
              Tittel / kursnavn
              <StandardInput value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              Utsteder (valgfritt)
              <StandardInput value={issuer} onChange={(e) => setIssuer(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              Gyldig til (valgfritt)
              <StandardInput
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1"
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
            <Button type="button" variant="primary" style={{ backgroundColor: PIN_GREEN }} onClick={upload} disabled={uploading}>
              {uploading ? 'Laster opp…' : 'Send inn'}
            </Button>
            {msg ? <p className="text-xs text-neutral-700">{msg}</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3]">
          <div className="border-b border-[#e3ddcc] bg-[#f7f5ee] px-4 py-3 text-sm font-medium text-[#1a3d32]">
            Innsendte ({externalCertificates.length})
          </div>
          <ul className="divide-y divide-[#e3ddcc]">
            {externalCertificates.map((x) => {
              const statusColour = x.status === 'approved' ? 'text-[#2f7757]'
                : x.status === 'rejected' ? 'text-[#b3382a]'
                : 'text-[#c98a2b]'
              return (
                <li key={x.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-[#2D403A]">{x.title}</div>
                      <div className="text-xs text-neutral-500">
                        {x.issuer ?? '—'} · {x.validUntil ? `Gyldig til ${x.validUntil}` : 'Ingen utløpsdato'}
                      </div>
                      <div className={`mt-1 text-xs font-medium ${statusColour}`}>
                        {STATUS_LABELS[x.status] ?? x.status}
                      </div>
                    </div>
                    {canManage && x.status === 'pending' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              void (async () => {
                                const r = await approveExternalCertificate(x.id, true)
                                if (!r.ok) setApproveError(r.error)
                              })()
                            }}
                          >
                            Godkjenn
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              void (async () => {
                                const r = await approveExternalCertificate(x.id, false)
                                if (!r.ok) setApproveError(r.error)
                              })()
                            }}
                          >
                            Avslå
                          </Button>
                        </div>
                        {approveError ? (
                          <div className="mt-2">
                            <WarningBox>{approveError}</WarningBox>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          {externalCertificates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm text-[#6b6f68]">Ingen innsendte dokumenter ennå.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
