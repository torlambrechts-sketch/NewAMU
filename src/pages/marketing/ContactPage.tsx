// /kontakt and /demo — unified contact form for demo requests, questions,
// partnership and general inquiries. Posts to /api/contact (Vercel Edge +
// Resend) and falls back to mailto if the endpoint is unreachable.

import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SeoHead } from './primitives/SeoHead'
import { SectionHeader } from './primitives/SectionHeader'
import { FOREST, TEAL, CREAM } from './theme'

type InquiryType = 'demo' | 'sporsmal' | 'partnerskap' | 'annet'
type Status = 'idle' | 'submitting' | 'ok' | 'mailto' | 'err'

const INQUIRY_OPTIONS: Array<{ value: InquiryType; label: string }> = [
  { value: 'demo', label: 'Jeg vil ha en demo' },
  { value: 'sporsmal', label: 'Jeg har et spørsmål' },
  { value: 'partnerskap', label: 'Partnerskap eller integrasjon' },
  { value: 'annet', label: 'Annet' },
]

const SIZE_OPTIONS = [
  '5–25 ansatte',
  '26–50 ansatte',
  '51–100 ansatte',
  '101–250 ansatte',
  '251+ ansatte',
]

const FOCUS_OPTIONS = [
  'Lovpålagt HMS-arbeid (vernerunder, ROS, AMU)',
  'Sykefraværsoppfølging',
  'Varsling / GDPR-brudd',
  'Sjekklister og avvik',
  'Kompetanse og sertifikater',
  'Annet — jeg forklarer i meldingen',
]

const TYPE_SUBJECT: Record<InquiryType, string> = {
  demo: 'Demo-forespørsel',
  sporsmal: 'Spørsmål',
  partnerskap: 'Partnerskap',
  annet: 'Henvendelse',
}

type PageVariant = 'demo' | 'kontakt'

const VARIANT_META: Record<PageVariant, {
  title: string
  description: string
  heroEyebrow: string
  heroTitle: string
  heroBody: string
  defaultType: InquiryType
}> = {
  demo: {
    title: 'Be om demo — Klarert | 20 minutter, ingen salgspresentasjon',
    description:
      'Vi viser deg hvordan Klarert dekker akkurat ditt rammeverk. 20 minutter, ingen salgspresentasjon, ingen budsjettspørsmål.',
    heroEyebrow: 'Be om demo',
    heroTitle: '20 minutter. Ingen salgspresentasjon.',
    heroBody:
      'Si fra hva som faktisk gjør vondt i HMS-arbeidet, så viser vi om Klarert er riktig for dere. Vi spør ikke om budsjettet ditt før vi vet om vi er nyttige.',
    defaultType: 'demo',
  },
  kontakt: {
    title: 'Kontakt oss — Klarert | Spørsmål, demo og partnerskap',
    description:
      'Spør oss om hva som helst — etterlevelse, integrasjoner, demo, prising. Vi svarer innen 1 virkedag. Ingen oppfølging hvis du ikke vil ha det.',
    heroEyebrow: 'Kontakt oss',
    heroTitle: 'Spør oss om hva som helst',
    heroBody:
      'Vi svarer på alle henvendelser innen 1 virkedag — om det så er et generelt spørsmål, en demo-forespørsel eller en partner-prat. Ingen oppfølging hvis du ikke vil ha det.',
    defaultType: 'sporsmal',
  },
}

function jsonLdForVariant(variant: PageVariant) {
  const path = variant === 'demo' ? '/demo' : '/kontakt'
  const name = variant === 'demo' ? 'Be om demo' : 'Kontakt oss'
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Klarert', item: 'https://app.klarert.com/' },
          { '@type': 'ListItem', position: 2, name, item: `https://app.klarert.com${path}` },
        ],
      },
    ],
  }
}

export function ContactPage() {
  const location = useLocation()
  const variant: PageVariant = location.pathname === '/demo' ? 'demo' : 'kontakt'
  const meta = VARIANT_META[variant]

  const [type, setType] = useState<InquiryType>(meta.defaultType)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Keep the type selector in sync if the user navigates between /demo and /kontakt.
  useEffect(() => {
    setType(meta.defaultType)
  }, [meta.defaultType])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>

    if (data.honey) return

    setStatus('submitting')
    const endpoint =
      (import.meta.env.VITE_CONTACT_FORM_ENDPOINT as string | undefined)
      ?? (import.meta.env.VITE_DEMO_FORM_ENDPOINT as string | undefined)
      ?? '/api/contact'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ source: `klarert.com${location.pathname}`, type, ...data }),
      })
      const ct = res.headers.get('content-type') ?? ''
      const payload: { ok?: boolean; error?: string } | null = ct.includes('application/json')
        ? await res.json().catch(() => null)
        : null
      if (res.ok && payload?.ok === true) {
        setStatus('ok')
        return
      }
      throw new Error(payload?.error ?? `Status ${res.status}`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Ukjent feil')
      // Mailto fallback so the user doesn't lose what they typed.
      const subject = `${TYPE_SUBJECT[type]}: ${data.org || data.email}`
      const bodyLines = [
        `Type: ${TYPE_SUBJECT[type]}`,
        `Navn: ${data.name}`,
        data.org ? `Organisasjon: ${data.org}` : '',
        `E-post: ${data.email}`,
        data.size ? `Størrelse: ${data.size}` : '',
        data.focus ? `Hovedfokus: ${data.focus}` : '',
        data.message ? `\nMelding:\n${data.message}` : '',
      ].filter(Boolean).join('\n')
      window.location.href = `mailto:hei@klarert.com?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(bodyLines)}`
      setStatus('mailto')
    }
  }

  if (status === 'ok') return <SuccessState variant={variant} />
  if (status === 'mailto') return <MailtoFallbackState />

  const showDemoFields = type === 'demo'

  return (
    <>
      <SeoHead
        title={meta.title}
        description={meta.description}
        canonical={`https://app.klarert.com${variant === 'demo' ? '/demo' : '/kontakt'}`}
        jsonLd={jsonLdForVariant(variant)}
      />
      <section style={{ background: FOREST }} className="pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
            {meta.heroEyebrow}
          </p>
          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {meta.heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
            {meta.heroBody}
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24" style={{ background: CREAM }}>
        <div className="mx-auto max-w-2xl px-4 md:px-8">
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 md:p-8"
            noValidate
          >
            <input type="text" name="honey" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

            <div>
              <label htmlFor="type" className="mb-1.5 block text-sm font-semibold" style={{ color: FOREST }}>
                Type henvendelse <span className="text-red-600" aria-hidden>*</span>
              </label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as InquiryType)}
                required
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm transition-colors focus:border-neutral-900 focus:outline-none"
              >
                {INQUIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <Field label="Navn" name="name" type="text" autoComplete="name" required />
            <Field
              label="Organisasjon"
              name="org"
              type="text"
              autoComplete="organization"
              required={showDemoFields}
            />

            {showDemoFields && (
              <>
                <SelectField label="Størrelse" name="size" required options={SIZE_OPTIONS} />
                <SelectField label="Hovedfokus" name="focus" required options={FOCUS_OPTIONS} />
              </>
            )}

            <Field label="E-post" name="email" type="email" autoComplete="email" required />

            <div>
              <label htmlFor="message" className="mb-1.5 block text-sm font-semibold" style={{ color: FOREST }}>
                Melding {showDemoFields ? <span className="text-neutral-400">(valgfritt)</span> : <span className="text-red-600" aria-hidden>*</span>}
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required={!showDemoFields}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors focus:border-neutral-900 focus:outline-none"
                placeholder={
                  showDemoFields
                    ? 'Hva har dere prøvd? Hva fungerer ikke?'
                    : 'Hva lurer du på?'
                }
              />
            </div>

            {status === 'err' && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                Klarte ikke å sende henvendelsen ({errorMessage}). Send heller en e-post til{' '}
                <a href="mailto:hei@klarert.com" className="underline">hei@klarert.com</a>.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md px-7 py-3 text-base font-semibold transition hover:opacity-90 disabled:opacity-60"
              style={{ background: FOREST, color: 'white' }}
            >
              {status === 'submitting' ? 'Sender…' : 'Send henvendelse'}
            </button>
            <p className="text-center text-xs text-neutral-500">
              Vi svarer innen 1 virkedag. Ingen oppfølging hvis du ikke vil ha det.
            </p>
          </form>

          <div className="mt-8 grid gap-3 text-center text-sm text-neutral-600 md:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Personvern</p>
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:personvern@klarert.com">
                personvern@klarert.com
              </a>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Sikkerhet</p>
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:sikkerhet@klarert.com">
                sikkerhet@klarert.com
              </a>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Generelt</p>
              <a className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }} href="mailto:hei@klarert.com">
                hei@klarert.com
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-neutral-600">
            Vil du heller bare prøve produktet?{' '}
            <Link to="/signup" className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }}>
              Opprett gratis konto →
            </Link>
          </p>
        </div>
      </section>

      {variant === 'demo' && (
        <section className="py-16 md:py-20 bg-white">
          <div className="mx-auto max-w-4xl px-4 md:px-8">
            <SectionHeader
              eyebrow="Hva skjer etterpå"
              title="Slik foregår demoen"
              align="left"
            />
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { n: '1', title: 'Du sender skjemaet', body: 'Vi leser det og svarer innen 1 virkedag med to-tre foreslåtte tidspunkter.' },
                { n: '2', title: '20-minutters delt skjerm', body: 'Vi tar oss tid til å forstå konteksten, så viser vi de modulene som faktisk er relevante.' },
                { n: '3', title: 'Du bestemmer', body: 'Vil du prøve gratis, er det ett klikk unna. Vil du ikke, slutter vi å sende deg e-post.' },
              ].map((s) => (
                <li key={s.n} className="space-y-2">
                  <div className="flex size-9 items-center justify-center rounded-full text-sm font-bold" style={{ background: FOREST, color: 'white' }}>
                    {s.n}
                  </div>
                  <h3 className="text-base font-semibold" style={{ color: FOREST }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </>
  )
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
}: {
  label: string
  name: string
  type: 'text' | 'email'
  autoComplete?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold" style={{ color: FOREST }}>
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors focus:border-neutral-900 focus:outline-none"
      />
    </div>
  )
}

function SelectField({
  label,
  name,
  options,
  required,
}: {
  label: string
  name: string
  options: string[]
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold" style={{ color: FOREST }}>
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue=""
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm transition-colors focus:border-neutral-900 focus:outline-none"
      >
        <option value="" disabled>Velg…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function SuccessState({ variant }: { variant: PageVariant }) {
  const isDemoVariant = variant === 'demo'
  return (
    <>
      <SeoHead
        title="Takk — Klarert"
        description="Vi har mottatt henvendelsen og svarer innen 1 virkedag."
        canonical={`https://app.klarert.com${isDemoVariant ? '/demo' : '/kontakt'}`}
      />
      <section style={{ background: FOREST }} className="py-24 md:py-32">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full" style={{ background: TEAL }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="3" className="size-8" aria-hidden>
              <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight text-white md:text-4xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Takk — henvendelsen er mottatt
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75">
            Vi leser den i løpet av dagen og svarer innen 1 virkedag. Sjekk innboksen
            (og søppelposten, for sikkerhets skyld).
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md px-7 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ background: TEAL, color: FOREST }}
            >
              Tilbake til forsiden
            </Link>
            <Link
              to="/endringer"
              className="inline-flex items-center justify-center rounded-md border border-white/25 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Les endringsloggen
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function MailtoFallbackState() {
  return (
    <>
      <SeoHead
        title="Send e-posten — Klarert"
        description="Vi åpnet e-postklienten din. Send meldingen så svarer vi innen 1 virkedag."
        canonical="https://app.klarert.com/kontakt"
      />
      <section style={{ background: FOREST }} className="py-24 md:py-32">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full" style={{ background: TEAL }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="3" className="size-8" aria-hidden>
              <path d="M4 7l8 6 8-6M4 7v10h16V7M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight text-white md:text-4xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Send e-posten for å fullføre
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75">
            Vi åpnet e-postklienten din med detaljene forhåndsutfylt. Klikk «Send» der,
            så svarer vi innen 1 virkedag. Hvis ingenting åpnet seg, send heller direkte
            til{' '}
            <a className="font-semibold underline-offset-4 hover:underline" style={{ color: TEAL }} href="mailto:hei@klarert.com">
              hei@klarert.com
            </a>.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md px-7 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{ background: TEAL, color: FOREST }}
            >
              Tilbake til forsiden
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
