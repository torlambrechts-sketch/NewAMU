// /demo — structured form replacing scattered mailto: CTAs.
// Posts to VITE_DEMO_FORM_ENDPOINT if configured; otherwise falls back to
// opening a prefilled mailto so it works in any environment.

import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeoHead } from './primitives/SeoHead'
import { SectionHeader } from './primitives/SectionHeader'
import { FOREST, TEAL, CREAM } from './theme'

type Status = 'idle' | 'submitting' | 'ok' | 'err'

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
  'Annet — jeg forklarer',
]

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Klarert', item: 'https://app.klarert.com/' },
        { '@type': 'ListItem', position: 2, name: 'Be om demo', item: 'https://app.klarert.com/demo' },
      ],
    },
  ],
}

export function DemoPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>

    if (data.honey) return // honeypot tripped — silently drop

    setStatus('submitting')
    const endpoint = import.meta.env.VITE_DEMO_FORM_ENDPOINT as string | undefined

    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'klarert.com/demo', ...data }),
        })
        if (!res.ok) throw new Error(`Status ${res.status}`)
        setStatus('ok')
        return
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Ukjent feil')
        setStatus('err')
        return
      }
    }

    // Fallback: build a prefilled mailto:. Works without backend.
    const body = [
      `Navn: ${data.name}`,
      `Organisasjon: ${data.org}`,
      `Størrelse: ${data.size}`,
      `Hovedfokus: ${data.focus}`,
      data.message ? `\nMer info:\n${data.message}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    const subject = `Demo-forespørsel: ${data.org}`
    window.location.href = `mailto:hei@klarert.com?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`
    setStatus('ok')
  }

  if (status === 'ok') return <SuccessState />

  return (
    <>
      <SeoHead
        title="Be om demo — Klarert | 20 minutter, ingen salgsdeck"
        description="Vi viser deg hvordan Klarert dekker akkurat ditt rammeverk. 20 minutter, ingen salgsdeck, ingen budsjettspørsmål."
        canonical="https://app.klarert.com/demo"
        jsonLd={JSON_LD}
      />
      <section style={{ background: FOREST }} className="pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
            Be om demo
          </p>
          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            20 minutter. Ingen salgsdeck.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
            Si fra hva som faktisk gjør vondt i HMS-arbeidet, så viser vi om Klarert er
            riktig for dere. Vi spør ikke om budsjettet ditt før vi vet om vi er nyttige.
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

            <Field label="Navn" name="name" type="text" autoComplete="name" required />
            <Field label="Organisasjon" name="org" type="text" autoComplete="organization" required />

            <SelectField label="Størrelse" name="size" required options={SIZE_OPTIONS} />
            <SelectField label="Hovedfokus" name="focus" required options={FOCUS_OPTIONS} />

            <div>
              <label className="mb-1.5 block text-sm font-semibold" style={{ color: FOREST }}>
                Mer kontekst <span className="text-neutral-400">(valgfritt)</span>
              </label>
              <textarea
                name="message"
                rows={4}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors focus:border-neutral-900 focus:outline-none"
                placeholder="Hva har dere prøvd? Hva fungerer ikke?"
              />
            </div>

            <Field label="E-post" name="email" type="email" autoComplete="email" required />

            {status === 'err' && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                Klarte ikke sende forespørsel ({errorMessage}). Send heller en e-post til{' '}
                <a href="mailto:hei@klarert.com" className="underline">hei@klarert.com</a>.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md px-7 py-3 text-base font-semibold transition hover:opacity-90 disabled:opacity-60"
              style={{ background: FOREST, color: 'white' }}
            >
              {status === 'submitting' ? 'Sender…' : 'Send forespørsel'}
            </button>
            <p className="text-center text-xs text-neutral-500">
              Vi svarer innen 1 virkedag. Ingen oppfølging hvis du ikke vil ha det.
            </p>
          </form>
          <p className="mt-6 text-center text-sm text-neutral-600">
            Vil du heller bare prøve produktet?{' '}
            <Link to="/signup" className="font-semibold underline-offset-4 hover:underline" style={{ color: FOREST }}>
              Opprett gratis konto →
            </Link>
          </p>
        </div>
      </section>

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
              { n: '3', title: 'Du bestemmer', body: 'Vil du prøve gratis er det én klikk unna. Vil du ikke, slutter vi å maile deg.' },
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

function SuccessState() {
  return (
    <>
      <SeoHead
        title="Takk — Klarert"
        description="Vi har mottatt forespørselen og svarer innen 1 virkedag."
        canonical="https://app.klarert.com/demo"
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
            Takk — forespørselen er mottatt
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/75">
            Vi leser den i løpet av dagen og svarer innen 1 virkedag med to-tre foreslåtte
            tidspunkter. Sjekk inboksen (og søppelposten, for sikkerhets skyld).
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
