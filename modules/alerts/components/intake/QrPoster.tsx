// QrPoster — printable poster (A4 / A3) for distribution on workplace
// notice boards. Includes QR code to the org's intake URL, what-to-expect
// timeline, and Arbeidstilsynet contact info.

import { useEffect, useState } from 'react'

type Props = {
  intakeUrl: string
  organizationName: string
  size: 'a3' | 'a4'
  lang: 'nb' | 'en'
}

const COPY = {
  nb: {
    title: 'Varsle om kritikkverdige forhold',
    description: 'Du kan varsle anonymt via denne kanalen — uten å oppgi navn.',
    scan: 'Skann QR-koden eller besøk',
    timeline: 'Hva skjer videre',
    steps: [
      'Du sender inn varselet (anonymt eller med navn).',
      'Varslingsutvalget bekrefter mottak innen 5 virkedager (AML § 2A-3).',
      'Saken behandles innen 6 uker.',
      'Du får informasjon underveis via tilgangsnøkkelen.',
    ],
    external: 'Ekstern varslingskanal',
    arbeidstilsynet: 'Arbeidstilsynet: 73 19 97 00',
    arbeidstilsynetSite: 'arbeidstilsynet.no',
    legalNote:
      'Vi er underlagt taushetsplikt etter AML § 2A-7 (5). Gjengjeldelse mot varslere er forbudt (§ 2A-4).',
  },
  en: {
    title: 'Report a workplace concern',
    description: 'You may report anonymously through this channel — no name required.',
    scan: 'Scan the QR code or visit',
    timeline: 'What happens next',
    steps: [
      'You submit the report (anonymously or with name).',
      'The committee acknowledges receipt within 5 working days (AML § 2A-3).',
      'The case is handled within 6 weeks.',
      'You get updates via the access key.',
    ],
    external: 'External reporting channel',
    arbeidstilsynet: 'Norwegian Labour Inspection: 73 19 97 00',
    arbeidstilsynetSite: 'arbeidstilsynet.no',
    legalNote:
      'We are bound by confidentiality under AML § 2A-7 (5). Retaliation against whistleblowers is prohibited (§ 2A-4).',
  },
}

export function QrPoster({ intakeUrl, organizationName, size, lang }: Props) {
  const copy = COPY[lang]
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('qrcode').then(async (mod) => {
      try {
        const QRCode = (mod as unknown as { default: typeof import('qrcode') }).default
        const dataUrl = await QRCode.toDataURL(intakeUrl, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: size === 'a3' ? 1200 : 800,
        })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch {
        if (!cancelled) setQrDataUrl(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [intakeUrl, size])

  const pageStyle: React.CSSProperties =
    size === 'a3'
      ? { width: '297mm', height: '420mm', padding: '20mm' }
      : { width: '210mm', height: '297mm', padding: '15mm' }

  return (
    <article
      className="bg-white text-neutral-900 mx-auto"
      style={{ ...pageStyle, breakAfter: 'page' }}
    >
      <header className="border-b-2 border-red-700 pb-4 mb-6">
        <div className="text-sm text-neutral-500">{organizationName}</div>
        <h1 className="text-4xl font-bold mt-1">{copy.title}</h1>
        <p className="mt-2 text-base text-neutral-700">{copy.description}</p>
      </header>

      <section className="flex gap-6 items-start">
        <div className="flex-shrink-0">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR: ${intakeUrl}`} className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 bg-neutral-100 grid place-items-center text-xs text-neutral-400">
              QR…
            </div>
          )}
        </div>
        <div className="flex-1 mt-1">
          <div className="text-sm font-semibold mb-1">{copy.scan}</div>
          <code className="block text-sm break-all text-blue-800">{intakeUrl}</code>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold border-b border-neutral-300 pb-1 mb-3">
          {copy.timeline}
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-sm">
          {copy.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold border-b border-neutral-300 pb-1 mb-3">
          {copy.external}
        </h2>
        <p className="text-sm">{copy.arbeidstilsynet}</p>
        <p className="text-sm">{copy.arbeidstilsynetSite}</p>
      </section>

      <footer className="absolute bottom-8 left-0 right-0 px-12 text-xs italic text-neutral-600">
        {copy.legalNote}
      </footer>
    </article>
  )
}
