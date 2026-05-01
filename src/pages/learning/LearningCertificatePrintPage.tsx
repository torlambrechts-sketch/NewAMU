import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Button } from '../../components/ui/Button'

/**
 * Print-friendly course certificate (D4). Opens from certifications table «Skriv ut».
 * Uses print Tailwind modifiers; nav hidden when printing via no-print wrapper class.
 */
export function LearningCertificatePrintPage() {
  const { certId } = useParams<{ certId: string }>()
  const { certificates } = useLearning()
  const { organization } = useOrgSetupContext()

  const cert = useMemo(() => certificates.find((c) => c.id === certId), [certificates, certId])
  const orgName = organization?.name?.trim() || 'Organisasjon'

  if (!cert) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center no-print">
        <p className="text-neutral-700">Fant ikke kursbeviset.</p>
        <Link to="/learning/certifications" className="mt-4 inline-block text-sm font-medium text-emerald-800 underline">
          Tilbake til sertifikater
        </Link>
      </div>
    )
  }

  const issued = new Date(cert.issuedAt)
  const issuedStr = issued.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-neutral-900 no-print:pb-12">
      <div className="no-print mx-auto max-w-[1400px] border-b border-neutral-200 bg-white px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/learning/certifications" className="text-sm text-emerald-800 hover:underline">
            ← Tilbake til sertifikater
          </Link>
          <Button type="button" variant="primary" onClick={() => window.print()}>
            Skriv ut
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:py-6">
        <article
          className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-8 shadow-sm print:border-neutral-300 print:shadow-none"
          id="learning-certificate-print"
        >
          <header className="border-b border-[#e3ddcc] pb-6 text-center print:border-neutral-300">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6f68]">Kursbevis</p>
            <h1
              className="mt-2 text-2xl font-semibold text-[#1a3d32] md:text-3xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              {cert.courseTitle}
            </h1>
            <p className="mt-2 text-sm text-neutral-600">{orgName}</p>
          </header>

          <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6b6f68]">Deltaker</dt>
              <dd className="mt-1 font-medium text-neutral-900">{cert.learnerName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6b6f68]">Utstedt</dt>
              <dd className="mt-1 font-medium text-neutral-900">{issuedStr}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6b6f68]">Kursversjon</dt>
              <dd className="mt-1 font-medium text-neutral-900">{cert.courseVersion ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#6b6f68]">Verifiseringskode</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tracking-wide text-[#1a3d32]">{cert.verifyCode}</dd>
            </div>
          </dl>

          <footer className="mt-10 border-t border-[#e3ddcc] pt-6 text-center text-xs text-neutral-600 print:border-neutral-300">
            <p>Dokumentasjon på gjennomført opplæring i henhold til arbeidsmiljøloven og internkontrollforskriften.</p>
            <p className="mt-2">Oppbevares sammen med øvrig HMS-dokumentasjon.</p>
          </footer>
        </article>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}
