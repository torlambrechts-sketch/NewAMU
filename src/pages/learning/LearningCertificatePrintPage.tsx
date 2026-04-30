import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

function formatDateNb(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function lawRefFromTags(tags: string[]): string {
  const t = tags.find((x) => x.toLowerCase().startsWith('lovref:'))
  return t ? t.slice('lovref:'.length).trim() || '—' : '—'
}

export function LearningCertificatePrintPage() {
  const { certId } = useParams<{ certId: string }>()
  const { certificates, courses, certificationRenewals } = useLearning()
  const { organization } = useOrgSetupContext()

  const cert = useMemo(
    () => certificates.find((c) => c.id === certId),
    [certificates, certId],
  )
  const course = useMemo(() => courses.find((c) => c.id === cert?.courseId), [courses, cert?.courseId])

  const renewal = useMemo(() => {
    if (!cert) return null
    return (
      certificationRenewals.find((r) => r.certificateId === cert.id && r.courseId === cert.courseId) ??
      certificationRenewals.find((r) => r.courseId === cert.courseId && !r.certificateId)
    )
  }, [certificationRenewals, cert])

  const verifyUrl =
    typeof window !== 'undefined' && cert
      ? `${window.location.origin}/learning/certificates/${cert.id}/print`
      : ''

  if (!certId) {
    return <p className="p-6 text-sm text-neutral-600">Mangler sertifikat-ID.</p>
  }

  if (!cert) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-neutral-600">Fant ikke sertifikatet.</p>
        <Link to="/learning/certifications" className="text-sm font-medium text-emerald-800 underline print:hidden">
          Tilbake til sertifikater
        </Link>
      </div>
    )
  }

  const lawRef = lawRefFromTags(course?.tags ?? [])
  const validUntil =
    renewal && renewal.status !== 'renewed'
      ? formatDateNb(renewal.expiresAt)
      : course?.recertificationMonths
        ? 'Se kurs (gyldighetsperiode)'
        : 'Ingen utløpsdato registrert'

  return (
    <>
      <div className="print:hidden mx-auto max-w-2xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/learning/certifications" className="text-sm font-medium text-emerald-800 underline">
            Tilbake
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-neutral-50"
          >
            <Printer className="size-4" />
            Skriv ut
          </button>
        </div>
      </div>

      <article
        className="mx-auto max-w-[720px] bg-white px-8 py-10 text-neutral-900 shadow-sm print:shadow-none print:max-w-none"
        data-print-only
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Klarert</p>
            <p className="mt-1 text-sm text-neutral-700">{organization?.name?.trim() || 'Organisasjon'}</p>
          </div>
          <div className="text-right text-xs text-neutral-500">
            <span className="font-semibold text-[#1a3d32]">Klarert</span>
          </div>
        </header>

        <h1
          className="mt-8 text-center font-semibold tracking-tight text-[#1a3d32]"
          style={{ fontFamily: "'Source Serif 4', 'Libre Baskerville', Georgia, serif", fontSize: '28px' }}
        >
          KURSBEVIS / OPPLÆRINGSBEVIS
        </h1>

        <dl className="mt-10 space-y-4 text-sm">
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Kurs</dt>
            <dd className="font-medium text-[#2D403A]">{cert.courseTitle}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Deltaker</dt>
            <dd>{cert.learnerName}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Organisasjon</dt>
            <dd>{organization?.name?.trim() || '—'}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Gjennomført</dt>
            <dd>{formatDateNb(cert.issuedAt)}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Versjon</dt>
            <dd>{cert.courseVersion ?? '—'}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Lovhjemmel</dt>
            <dd>{lawRef}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Gyldig til</dt>
            <dd>{validUntil}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
            <dt className="font-medium text-neutral-500">Verifiser</dt>
            <dd className="font-mono text-base font-semibold">{cert.verifyCode}</dd>
          </div>
        </dl>

        <footer className="mt-12 rounded-lg bg-[#1a3d32] px-5 py-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-200/90">Verifisering</p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-wide">{cert.verifyCode}</p>
          {verifyUrl ? (
            <p className="mt-2 break-all text-xs text-emerald-100/90">{verifyUrl}</p>
          ) : null}
        </footer>
      </article>
    </>
  )
}
