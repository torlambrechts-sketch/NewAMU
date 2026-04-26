/**
 * Klarert.com — Public landing page
 *
 * SEO: meta tags set via react-helmet or in index.html (static build)
 * Accessibility: semantic HTML5, skip link, aria-labels
 * Performance: no heavy deps, CSS-only animations, lazy sections
 */

import { Link } from 'react-router-dom'

// ─── Brand colours ────────────────────────────────────────────────────────────

const NAVY  = '#0c1929'
const TEAL  = '#2dd4bf'
const CREAM = '#f5f0e8'

// ─── Logo (inline — no external import needed for public page) ────────────────

function Logo({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  const k = dark ? '#fafafa' : NAVY
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={Math.round(size * 52 / 48)} viewBox="0 0 48 52" aria-hidden fill="none">
        <rect x="5" y="4" width="11" height="44" rx="2.2" fill={k} />
        <path d="M 14.5 31 L 42 49" stroke={k} strokeWidth="10.5" strokeLinecap="round" />
        <path d="M 13 29 L 24.5 41.5 L 44.5 9" fill="none" stroke={TEAL} strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-xl font-bold tracking-tight ${dark ? 'text-white' : 'text-[#0c1929]'}`}
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        Klarert<span className={dark ? 'text-white/70' : 'text-[#0c1929]/60'}>.com</span>
      </span>
    </span>
  )
}

// ─── Feature data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🛡️',
    title: 'HMS og internkontroll',
    desc: 'Hendelsesregistrering, vernerunder, ROS-vurderinger og SJA — alt lovpålagt etter Internkontrollforskriften §5 og AML.',
  },
  {
    icon: '🗳️',
    title: 'AMU og valg',
    desc: 'Digital valgmodul med anonym stemming, 2-årsperiodekontroll og automatisk 90-dagersvarsel. Møter med datainnsprøytet agenda.',
  },
  {
    icon: '📋',
    title: 'Sykefraværsoppfølging',
    desc: 'Lovpålagte NAV-frister genereres automatisk (4, 7, 9, 26 uker). Sikker dialogportal og taushetsbelagt sone.',
  },
  {
    icon: '📄',
    title: 'HMS-håndbok og wiki',
    desc: 'Blokkbasert dokumentsystem med 10 ferdigbygde maler — IK-f §5 og AML. Live widgets henter risikooversikt og AMU-sammensetning.',
  },
  {
    icon: '📊',
    title: 'Undersøkelser',
    desc: 'Validerte maler: UWES-9, Google re:Work, eNPS, Edmondson. Planlegg månedlig, kvartalsvis eller etter egendefinert intervall.',
  },
  {
    icon: '📅',
    title: 'Årshjul og Action Board',
    desc: 'Dynamisk årskalender over alle lovpålagte hendelser. Global Kanban samler alle åpne tiltak fra alle moduler.',
  },
]

const LAW_REFS = [
  { short: 'AML §3-1', full: 'Systematisk HMS-arbeid' },
  { short: 'AML §4-6', full: 'Sykefraværsoppfølging' },
  { short: 'AML §6-1', full: 'Verneombud' },
  { short: 'AML §7-1', full: 'AMU' },
  { short: 'IK-f §5', full: 'Internkontroll' },
  { short: 'GDPR', full: 'Personvern' },
]

const STATS = [
  { value: '6', label: 'lovpålagte moduler' },
  { value: '10+', label: 'AML-maler inkludert' },
  { value: '∞', label: 'frister auto-genereres' },
  { value: '0', label: 'papir nødvendig' },
]

const TESTIMONIALS = [
  {
    quote: 'Vi brukte 2 timer per AMU-møte på å samle data. Klarert henter det automatisk — nå bruker vi tiden på å løse problemer.',
    name: 'HR-sjef',
    org: 'Produksjonsvirksomhet, 85 ansatte',
  },
  {
    quote: 'Endelig et system som faktisk kjenner norsk arbeidslivslovgivning. Frister og terskler er innebygd, ikke noe vi må huske.',
    name: 'Verneombud',
    org: 'Kommunal helse og omsorg, 140 ansatte',
  },
  {
    quote: 'Oppfølgingsplaner, dialogmøter, NAV-meldinger — alt skjer på riktig tidspunkt automatisk. Sykefravær er ikke lenger en administrativ hodepine.',
    name: 'Daglig leder',
    org: 'Bygg og anlegg, 60 ansatte',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: CREAM, color: NAVY, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Skip link */}
      <a href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        style={{ color: NAVY }}>
        Hopp til innhold
      </a>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-black/8 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <Link to="/home" aria-label="Klarert — til forsiden">
            <Logo size={24} />
          </Link>
          <nav aria-label="Primær navigasjon" className="hidden items-center gap-6 text-sm font-medium text-neutral-700 md:flex">
            <a href="#features" className="hover:text-[#0c1929] transition-colors">Funksjoner</a>
            <a href="#compliance" className="hover:text-[#0c1929] transition-colors">Samsvar</a>
            <a href="#testimonials" className="hover:text-[#0c1929] transition-colors">Kunder</a>
            <a href="#pricing" className="hover:text-[#0c1929] transition-colors">Pris</a>
          </nav>
          <div className="flex items-center gap-3">
              <Link to="/login"
              className="hidden text-sm font-medium text-neutral-700 hover:text-[#0c1929] transition-colors md:block">
              Logg inn
            </Link>
            <Link to="/app"
              className="hidden text-sm font-medium text-neutral-700 hover:text-[#0c1929] transition-colors md:block">
              Til appen
            </Link>
            <Link to="/app"
              className="inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ background: NAVY }}>
              Logg inn
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section aria-label="Introduksjon" className="relative overflow-hidden pb-20 pt-16 md:pb-28 md:pt-24">
          {/* Subtle teal accent */}
          <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: TEAL }} />

          <div className="relative mx-auto max-w-6xl px-4 md:px-8">
            <div className="mx-auto max-w-3xl text-center">
              {/* Eyebrow */}
              <span className="mb-4 inline-flex items-center gap-2 border border-teal-300/60 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-700">
                Compliance-by-design
              </span>

              <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                HMS og arbeidsmiljø —{' '}
                <span style={{ color: TEAL }}>lovpålagte krav</span>{' '}
                uten papir
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-neutral-600 md:text-xl">
                Klarert er norsk arbeidslivslovgivning bygget inn i programvare. AMU-møter, sykefraværsoppfølging,
                vernerunder og ROS — alt med automatiske frister, riktige frister og ingen post-its.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/app"
                  className="inline-flex w-full items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:opacity-90 sm:w-auto"
                  style={{ background: NAVY }}>
                  Logg inn til appen
                  <span aria-hidden>→</span>
                </Link>
                <Link to="/login?demo=1"
                  className="inline-flex w-full items-center justify-center gap-2 border border-neutral-300 bg-white px-8 py-3.5 text-base font-semibold text-neutral-800 transition hover:bg-neutral-50 sm:w-auto">
                  Prøv demo gratis
                </Link>
              </div>

              <p className="mt-4 text-xs text-neutral-400">Ingen kredittkort. Ingen installasjon. Demoen er klar på 10 sekunder.</p>
            </div>

            {/* App preview screenshot placeholder */}
            <div className="mx-auto mt-14 max-w-5xl">
              <div className="relative overflow-hidden border border-neutral-200 bg-white shadow-2xl">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
                  <span className="size-3 rounded-full bg-red-400" />
                  <span className="size-3 rounded-full bg-amber-400" />
                  <span className="size-3 rounded-full bg-green-400" />
                  <div className="ml-3 flex-1 rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-400">
                    app.klarert.com
                  </div>
                </div>
                {/* Dashboard preview */}
                <div className="grid grid-cols-4 divide-x divide-neutral-100" style={{ background: CREAM }}>
                  {/* Sidebar */}
                  <div className="col-span-1 space-y-1 border-r border-neutral-200 bg-white p-3">
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <Logo size={16} />
                    </div>
                    {['Dashbord', 'HMS', 'AMU', 'Sykefravær', 'Internkontroll', 'E-læring'].map((label, i) => (
                      <div key={label} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${i === 0 ? 'font-semibold text-white' : 'text-neutral-500'}`}
                        style={i === 0 ? { background: NAVY } : {}}>
                        <span className="size-1.5 rounded-full" style={{ background: i === 0 ? TEAL : '#d1d5db' }} />
                        {label}
                      </div>
                    ))}
                  </div>
                  {/* Content */}
                  <div className="col-span-3 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Daglig oversikt</p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { v: '3', l: 'Åpne oppgaver', c: NAVY },
                        { v: '2', l: 'Sykefravær aktive', c: '#d97706' },
                        { v: '4/4', l: 'Møter planlagt', c: '#16a34a' },
                      ].map(({ v, l, c }) => (
                        <div key={l} className="border border-neutral-100 bg-white p-2.5">
                          <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
                          <div className="text-[9px] text-neutral-500">{l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {['Neste AMU-møte: 15. jan', 'Sykefravær-frist: 4 uker om 3 dager', 'Vernerunde Q1 klar'].map((item) => (
                        <div key={item} className="flex items-center gap-2 border border-neutral-100 bg-white px-3 py-2 text-xs text-neutral-700">
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: TEAL }} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <section aria-label="Nøkkeltall" className="border-y border-neutral-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
            <dl className="grid grid-cols-2 divide-x divide-y divide-neutral-100 md:grid-cols-4 md:divide-y-0">
              {STATS.map(({ value, label }) => (
                <div key={label} className="px-6 py-6 text-center">
                  <dt className="text-3xl font-bold" style={{ color: NAVY }}>{value}</dt>
                  <dd className="mt-1 text-sm text-neutral-500">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section id="features" aria-labelledby="features-heading" className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 id="features-heading" className="text-3xl font-bold md:text-4xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Alt du trenger for lovpålagt HMS-arbeid
              </h2>
              <p className="mt-4 text-neutral-600">
                Seks integrerte moduler. Én datakilde. Alle koblinger til norsk lov innebygd fra start.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon, title, desc }) => (
                <article key={title}
                  className="group border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md">
                  <div className="mb-4 text-3xl" role="img" aria-label={title}>{icon}</div>
                  <h3 className="mb-2 text-base font-semibold" style={{ color: NAVY }}>{title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-600">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Compliance callout ───────────────────────────────────────────── */}
        <section id="compliance" aria-labelledby="compliance-heading"
          className="border-y border-teal-200/60 py-16 md:py-20"
          style={{ background: `${NAVY}` }}>
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 id="compliance-heading" className="text-2xl font-bold text-white md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Bygget på norsk lov — ikke tilpasset etterpå
              </h2>
              <p className="mt-4 text-white/70 text-sm md:text-base">
                Hver funksjon er koblet til en konkret lovhjemmel. Compliance er ikke en sjekkliste — det er arkitekturen.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {LAW_REFS.map(({ short, full }) => (
                <div key={short}
                  className="border border-white/15 p-4 text-center backdrop-blur-sm"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="text-sm font-bold" style={{ color: TEAL }}>{short}</div>
                  <div className="mt-1 text-[11px] text-white/60">{full}</div>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-lg text-center text-xs text-white/40">
              Alle terskler, frister og dokumentasjonskrav oppdateres i systemet — ikke i en håndbok du glemmer å lese.
            </p>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section aria-labelledby="how-heading" className="py-20 md:py-28">
          <div className="mx-auto max-w-4xl px-4 md:px-8">
            <div className="mx-auto mb-14 max-w-xl text-center">
              <h2 id="how-heading" className="text-3xl font-bold md:text-4xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Kom i gang på tre steg
              </h2>
            </div>
            <ol className="grid gap-8 md:grid-cols-3" role="list">
              {[
                {
                  step: '01',
                  title: 'Sett opp organisasjonen',
                  desc: 'Legg inn ansatte, avdelinger og enheter. Systemet beregner automatisk om du er lovpålagt AMU og verneombud.',
                },
                {
                  step: '02',
                  title: 'Aktiver modulene',
                  desc: 'Slå på HMS, AMU, sykefravær eller internkontroll. Alle frister og maler er klare — ingen konfigurering.',
                },
                {
                  step: '03',
                  title: 'La systemet jobbe',
                  desc: 'Varslinger, frister, årshjul og Action Board holder oversikten. Du fokuserer på menneskene, ikke papirarbeidet.',
                },
              ].map(({ step, title, desc }) => (
                <li key={step} className="flex flex-col gap-3">
                  <div className="text-5xl font-bold tracking-tighter opacity-15" style={{ color: NAVY }}>{step}</div>
                  <h3 className="text-base font-semibold" style={{ color: NAVY }}>{title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-600">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────────── */}
        <section id="testimonials" aria-labelledby="testimonials-heading"
          className="border-t border-neutral-200 bg-white py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mx-auto mb-14 max-w-xl text-center">
              <h2 id="testimonials-heading" className="text-3xl font-bold md:text-4xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Hva sier brukerne?
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map(({ quote, name, org }) => (
                <figure key={name} className="flex flex-col gap-5 border border-neutral-200 p-6">
                  <blockquote className="flex-1">
                    <p className="text-sm leading-relaxed text-neutral-700">
                      &ldquo;{quote}&rdquo;
                    </p>
                  </blockquote>
                  <figcaption>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>{name}</p>
                    <p className="text-xs text-neutral-400">{org}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <section id="pricing" aria-labelledby="pricing-heading" className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mx-auto mb-14 max-w-xl text-center">
              <h2 id="pricing-heading" className="text-3xl font-bold md:text-4xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Enkle priser
              </h2>
              <p className="mt-4 text-sm text-neutral-500">En pris. Alle moduler. Ingen overraskelser.</p>
            </div>
            <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
              {[
                {
                  name: 'Prøv gratis',
                  price: 'Demo',
                  period: '',
                  features: ['Alle moduler', 'Forhåndsutfylt data', '10 sekunder oppstart', 'Ingen registrering'],
                  cta: 'Start demo',
                  href: '/login?demo=1',
                  highlight: false,
                },
                {
                  name: 'Liten virksomhet',
                  price: 'fra 690',
                  period: 'kr/mnd',
                  features: ['Opp til 50 ansatte', 'Alle moduler', 'Supabase datavault', 'E-post support'],
                  cta: 'Opprett konto',
                  href: '/signup',
                  highlight: true,
                },
                {
                  name: 'Større virksomhet',
                  price: 'Kontakt oss',
                  period: '',
                  features: ['Ubegrenset ansatte', 'SSO og tilgangsstyring', 'Onboarding og opplæring', 'Dedikert support'],
                  cta: 'Ta kontakt',
                  href: 'mailto:hei@klarert.com',
                  highlight: false,
                },
              ].map(({ name, price, period, features, cta, href, highlight }) => (
                <div key={name}
                  className={`flex flex-col border p-6 ${highlight ? 'border-2 shadow-lg' : 'border-neutral-200 bg-white'}`}
                  style={highlight ? { borderColor: NAVY, background: CREAM } : {}}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold" style={{ color: NAVY }}>{price}</span>
                    {period && <span className="text-sm text-neutral-500">{period}</span>}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2" role="list">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-neutral-700">
                        <span className="mt-0.5 shrink-0 text-xs" style={{ color: TEAL }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {href.startsWith('mailto') ? (
                    <a href={href}
                      className={`mt-6 block w-full py-2.5 text-center text-sm font-semibold transition ${highlight ? 'text-white hover:opacity-90' : 'border border-neutral-300 hover:bg-neutral-50'}`}
                      style={highlight ? { background: NAVY } : {}}>
                      {cta}
                    </a>
                  ) : (
                    <Link to={href}
                      className={`mt-6 block w-full py-2.5 text-center text-sm font-semibold transition ${highlight ? 'text-white hover:opacity-90' : 'border border-neutral-300 hover:bg-neutral-50'}`}
                      style={highlight ? { background: NAVY } : {}}>
                      {cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA banner ───────────────────────────────────────────────────── */}
        <section aria-label="Kom i gang" className="border-t border-neutral-200 bg-white py-16 md:py-20">
          <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
            <h2 className="text-2xl font-bold md:text-3xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Klar til å ta kontroll over HMS-arbeidet?
            </h2>
            <p className="mt-4 text-neutral-600">
              Start med demoen og se hvordan Klarert gjør lovpålagte oppgaver til en selvfølge.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/app"
                className="inline-flex w-full items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white transition hover:opacity-90 sm:w-auto"
                style={{ background: NAVY }}>
                Logg inn til appen
              </Link>
              <Link to="/login?demo=1"
                className="inline-flex w-full items-center justify-center gap-2 border border-neutral-300 bg-white px-8 py-3.5 text-base font-semibold text-neutral-800 transition hover:bg-neutral-50 sm:w-auto">
                Prøv demo gratis
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200 bg-white" role="contentinfo">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <Logo size={22} />
              <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                Norsk HMS og arbeidsmiljø i programvare. Compliance-by-design for virksomheter med 5–500 ansatte.
              </p>
            </div>
            <nav aria-label="Produkt" className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Produkt</p>
              {['Funksjoner', 'HMS-modulen', 'AMU og valg', 'Sykefravær', 'E-læring'].map((label) => (
                <a key={label} href="#features"
                  className="block text-sm text-neutral-600 hover:text-[#0c1929] transition-colors">
                  {label}
                </a>
              ))}
            </nav>
            <nav aria-label="Selskapet" className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Selskapet</p>
              {[
                { label: 'Om Klarert', href: '#' },
                { label: 'Kontakt', href: 'mailto:hei@klarert.com' },
                { label: 'Pris', href: '#pricing' },
                { label: 'Logg inn', href: '/login' },
              ].map(({ label, href }) => (
                <a key={label} href={href}
                  className="block text-sm text-neutral-600 hover:text-[#0c1929] transition-colors">
                  {label}
                </a>
              ))}
            </nav>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Lovverk</p>
              {LAW_REFS.map(({ short, full }) => (
                <p key={short} className="flex gap-2 text-sm text-neutral-500">
                  <span className="shrink-0 font-medium" style={{ color: TEAL }}>{short}</span>
                  {full}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-6 text-xs text-neutral-400">
            <p>© {new Date().getFullYear()} Klarert.com. Alle rettigheter forbeholdt.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-neutral-600 transition-colors">Personvern</a>
              <a href="#" className="hover:text-neutral-600 transition-colors">Vilkår</a>
              <a href="#" className="hover:text-neutral-600 transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
