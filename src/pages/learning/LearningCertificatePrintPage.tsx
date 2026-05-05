import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Award, Printer } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Button } from '../../components/ui/Button'

const SERIF_FAMILY = "'Libre Baskerville', Georgia, serif"

/**
 * Print-friendly course certificate. Opens from certifications table «Skriv ut».
 * Uses print Tailwind modifiers; nav hidden when printing via no-print wrapper class.
 */
export function LearningCertificatePrintPage() {
  const { certId } = useParams<{ certId: string }>()
  const { certificates, courses } = useLearning()
  const { organization, profile } = useOrgSetupContext()

  const cert = useMemo(() => certificates.find((c) => c.id === certId), [certificates, certId])
  const course = useMemo(
    () => (cert ? courses.find((c) => c.id === cert.courseId) : undefined),
    [cert, courses],
  )
  const orgName = organization?.name?.trim() || 'Organisasjon'

  if (!cert) {
    return (
      <div className="no-print mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-neutral-700">Fant ikke kursbeviset.</p>
        <Link
          to="/learning/certifications"
          className="mt-4 inline-block text-sm font-medium text-[#1a3d32] underline"
        >
          Tilbake til sertifikater
        </Link>
      </div>
    )
  }

  const issued = new Date(cert.issuedAt)
  const issuedStr = issued.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-neutral-900">
      <div className="no-print mx-auto max-w-[1400px] border-b border-neutral-200 bg-white px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/learning/certifications"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a3d32] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbake til sertifikater
          </Link>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Printer className="h-3.5 w-3.5" />}
            onClick={() => window.print()}
          >
            Skriv ut
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:py-0">
        <article
          id="learning-certificate-print"
          className="relative overflow-hidden rounded-2xl border-[6px] bg-white print:rounded-none print:border-2"
          style={{ borderColor: '#C9A24A', boxShadow: '0 12px 40px rgba(26,61,50,0.15)' }}
        >
          <div
            className="px-12 py-12 text-center print:px-10 print:py-10"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 0%, rgba(26,61,50,0.06) 0, transparent 50%), radial-gradient(circle at 80% 100%, rgba(201,162,74,0.10) 0, transparent 50%)',
            }}
          >
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
              <span className="h-px w-12 bg-neutral-300" />
              <span>Klarert</span>
              <span className="h-px w-12 bg-neutral-300" />
            </div>
            <h2
              className="mt-8 text-4xl font-semibold tracking-tight text-neutral-900"
              style={{ fontFamily: SERIF_FAMILY }}
            >
              Kursbevis
            </h2>
            <p className="mt-3 text-sm uppercase tracking-[0.2em] text-neutral-500">utstedes herved til</p>
            <p
              className="mt-4 text-3xl font-semibold text-[#1a3d32]"
              style={{ fontFamily: SERIF_FAMILY }}
            >
              {cert.learnerName}
            </p>
            <p className="mt-2 text-sm text-neutral-600">for fullført e-læringskurs</p>
            <p
              className="mt-3 text-2xl font-semibold text-neutral-900"
              style={{ fontFamily: SERIF_FAMILY }}
            >
              {cert.courseTitle}
            </p>
            <p className="mt-3 text-sm text-neutral-600">
              Utstedt av {orgName} via Klarert HMS-plattform
            </p>

            <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">Utstedt</p>
                <p className="mt-1 font-semibold text-neutral-900">{issuedStr}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">Versjon</p>
                <p className="mt-1 font-semibold text-neutral-900">v{cert.courseVersion ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">Kode</p>
                <p className="mt-1 font-mono text-[11px] font-semibold text-neutral-900">
                  {cert.verifyCode}
                </p>
              </div>
            </div>

            <div className="mt-10 flex items-end justify-center gap-12">
              <div className="text-center">
                <div className="border-t border-neutral-300 pt-1 text-[11px] uppercase tracking-wider text-neutral-500">
                  HMS-leder
                </div>
              </div>
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border-2"
                style={{ borderColor: '#C9A24A' }}
              >
                <Award className="h-10 w-10" style={{ color: '#C9A24A' }} />
              </div>
              <div className="text-center">
                <div className="border-t border-neutral-300 pt-1 text-[11px] uppercase tracking-wider text-neutral-500">
                  {profile?.display_name?.trim() || 'Mottaker'}
                </div>
              </div>
            </div>

            <footer className="mt-10 border-t border-neutral-200 pt-5 text-center text-[11px] text-neutral-500">
              <p>
                Dokumentasjon på gjennomført opplæring i tråd med arbeidsmiljøloven (§ 3-2) og
                internkontrollforskriften (§ 5 nr. 2).
              </p>
              <p className="mt-1">
                Verifiser ekthet ved å oppgi koden over på{' '}
                <span className="font-semibold text-neutral-700">klarert.no/verify</span>.
              </p>
              {course?.recertificationMonths ? (
                <p className="mt-1">
                  Resertifisering anbefalt hver {course.recertificationMonths}. måned.
                </p>
              ) : null}
            </footer>
          </div>
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
