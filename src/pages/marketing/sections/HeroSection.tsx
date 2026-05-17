// Hero — refreshed headline, sub-headline, dual CTA, and the dashboard mockup.

import { Link } from 'react-router-dom'
import { KlarertLogo } from '../../../components/brand/KlarertLogo'
import { BrowserMockup } from '../primitives/BrowserMockup'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'

const HERO_STATS = [
  { value: '6', label: 'integrerte moduler' },
  { value: '9', label: 'rammeverk dekket' },
  { value: '80+', label: 'AML-paragrafer' },
  { value: 'EU-region', label: 'data og hosting' },
]

export function HeroSection() {
  return (
    <section style={{ background: FOREST }}>
      <div className="pb-0 pt-16 text-center md:pt-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
            <span className="size-2 rounded-full" style={{ background: TEAL, boxShadow: `0 0 8px ${TEAL}` }} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Bygget for norsk arbeidsmiljølov
            </span>
          </div>

          <h1
            className="text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[4rem]"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Norsk compliance,{' '}
            <br className="hidden sm:block" />
            <span style={{ borderBottom: `4px solid ${TEAL}`, paddingBottom: '4px' }}>ferdig kodet</span>
            .
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Seks moduler. Ni rammeverk. Frister, signaturer og dokumentasjon dekket fra dag én —
            bygget på arbeidsmiljøloven, internkontrollforskriften og GDPR. Ikke tilpasset etterpå.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md px-8 py-3.5 text-base font-semibold transition hover:opacity-90 sm:w-auto"
              style={{ background: TEAL, color: FOREST }}
            >
              Prøv gratis 30 dager
            </Link>
            <Link
              to="/demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/25 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Be om demo
            </Link>
          </div>
          <p className="mt-3 text-xs text-white/60">
            Ingen kredittkort. Ingen installasjon. Data i EU.
          </p>

          <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 text-left sm:grid-cols-4">
            {HERO_STATS.map(({ value, label }) => (
              <div key={label} className="border-l-2 pl-3" style={{ borderColor: TEAL }}>
                <dt className="text-2xl font-bold text-white">{value}</dt>
                <dd className="mt-0.5 text-[11px] uppercase tracking-widest text-white/50">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mx-auto mt-14 max-w-5xl px-4 md:px-8">
          <figure aria-label="Skjermbilde av Klarert-dashboardet">
            <BrowserMockup>
              <div className="grid grid-cols-5">
              <div className="col-span-1 space-y-1 border-r p-3" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0d2a1c' }}>
                <div className="mb-3 px-1"><KlarertLogo size={14} variant="onDark" /></div>
                {['Dashbord', 'Oppgaver', 'Sjekklister', 'Varslinger', 'Dokumenter', 'E-læring', 'Undersøkelser'].map((l, i) => (
                  <div
                    key={l}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${i === 0 ? 'font-semibold' : ''}`}
                    style={i === 0 ? { background: 'rgba(45,212,191,0.15)', color: TEAL } : { color: 'rgba(255,255,255,0.4)' }}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: i === 0 ? TEAL : 'rgba(255,255,255,0.2)' }} />
                    {l}
                  </div>
                ))}
              </div>
              <div className="col-span-4 p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: TEAL }}>God morgen, leder</p>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {[
                    { v: '24', l: 'Åpne tiltak', c: '#fbbf24' },
                    { v: '3', l: 'Saker krever oppmerksomhet', c: '#ef4444' },
                    { v: '87 %', l: 'AMU-svarrate', c: TEAL },
                  ].map(({ v, l, c }) => (
                    <div key={l} className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
                      <div className="mt-0.5 text-[10px] text-white/40">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {[
                    'Vernerunde Q1 klar for signering — 4 funn, 1 kritisk',
                    'Sertifikat "Førstehjelp" utløper for 3 ansatte om 87 dager',
                    'Anonym varsling #VAR-2025-018 — bekreftelsesfrist i dag',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded border px-3 py-2 text-xs text-white/60" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: TEAL }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </BrowserMockup>
            <figcaption className="sr-only">
              Klarert-dashboardet viser åpne tiltak, varsler og AMU-svarrate på tvers av modulene.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
