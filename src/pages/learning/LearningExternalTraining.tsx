import { useMemo, useState } from 'react'
import { CheckCircle2, FileUp, ShieldCheck, XCircle } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WarningBox } from '../../components/ui/AlertBox'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY, ModuleSectionCard } from '../../components/module'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Venter godkjenning', variant: 'warning' },
  approved: { label: 'Godkjent', variant: 'success' },
  rejected: { label: 'Avslått', variant: 'danger' },
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
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

  const kpis = useMemo<LayoutScoreStatItem[]>(() => {
    const pending = externalCertificates.filter((x) => x.status === 'pending').length
    const approved = externalCertificates.filter((x) => x.status === 'approved').length
    const rejected = externalCertificates.filter((x) => x.status === 'rejected').length
    return [
      { big: String(externalCertificates.length), title: 'Innsendinger', sub: 'Totalt' },
      { big: String(pending), title: 'Venter', sub: 'Til godkjenning' },
      { big: String(approved), title: 'Godkjent', sub: 'Aktive' },
      { big: String(rejected), title: 'Avslått', sub: 'Krever ny innsending' },
    ]
  }, [externalCertificates])

  return (
    <div className="space-y-6">
      {learningError ? <WarningBox>{learningError}</WarningBox> : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}

      <LayoutScoreStatRow items={kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-[#1a3d32]" />
            <h2 className="text-lg font-semibold text-neutral-900">Ny dokumentasjon</h2>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Fyll inn detaljer og last opp PDF eller bilde av kursbevis.
          </p>
          <div className="mt-5 space-y-5">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-title">
                Tittel / kursnavn
              </label>
              <StandardInput
                id="ext-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5"
                placeholder="F.eks. Kran- og løfteopplæring G4"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-issuer">
                Utsteder (valgfritt)
              </label>
              <StandardInput
                id="ext-issuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className="mt-1.5"
                placeholder="F.eks. Norsk Sertifisering"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-valid-until">
                Gyldig til (valgfritt)
              </label>
              <StandardInput
                id="ext-valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-file">
                Fil (PDF eller bilde)
              </label>
              <p className="mt-1 text-xs text-neutral-500">
                Maks 10&nbsp;MB. Aksepterte formater: PDF, JPG, PNG.
              </p>
              <input
                id="ext-file"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                aria-label="Last opp PDF eller bilde av kursbevis"
                className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 file:mr-3 file:rounded-l-md file:border-0 file:border-r file:border-neutral-300 file:bg-neutral-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-100"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              type="button"
              variant="primary"
              onClick={upload}
              disabled={uploading}
              icon={<FileUp className="h-4 w-4" />}
            >
              {uploading ? 'Laster opp…' : 'Send inn'}
            </Button>
          </div>
          {msg ? (
            <p className="mt-3 text-xs text-neutral-700" role="status">
              {msg}
            </p>
          ) : null}
        </ModuleSectionCard>

        <ModuleSectionCard className="!p-0">
          <LayoutTable1PostingsShell
            wrap={false}
            titleTypography="sans"
            title="Innsendt dokumentasjon"
            description={canManage ? 'Godkjenn eller avslå innsendinger.' : 'Dine innsendinger og status.'}
            toolbar={
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Godkjent dokumentasjon teller som lovpålagt opplæring
              </div>
            }
            footer={<span>{externalCertificates.length} innsendinger</span>}
          >
            {externalCertificates.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-neutral-500">
                Ingen innsendte dokumenter ennå.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50/60">
                  <tr>
                    <th className={MODULE_TABLE_TH}>Tittel</th>
                    <th className={MODULE_TABLE_TH}>Utsteder</th>
                    <th className={MODULE_TABLE_TH}>Gyldig til</th>
                    <th className={MODULE_TABLE_TH}>Status</th>
                    {canManage ? <th className={MODULE_TABLE_TH} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {externalCertificates.map((x) => {
                    const meta = STATUS_BADGE[x.status] ?? { label: x.status, variant: 'warning' as const }
                    return (
                      <tr key={x.id} className={MODULE_TABLE_TR_BODY}>
                        <td className="px-5 py-3 font-medium text-neutral-900">{x.title}</td>
                        <td className="px-5 py-3 text-neutral-700">{x.issuer ?? '—'}</td>
                        <td className="px-5 py-3 text-neutral-700">{fmtDate(x.validUntil)}</td>
                        <td className="px-5 py-3">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        {canManage ? (
                          <td className="px-5 py-3 text-right">
                            {x.status === 'pending' ? (
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
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
                                  size="sm"
                                  variant="danger"
                                  icon={<XCircle className="h-3.5 w-3.5" />}
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
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </LayoutTable1PostingsShell>
        </ModuleSectionCard>
      </div>

      {approveError ? <WarningBox>{approveError}</WarningBox> : null}
    </div>
  )
}
