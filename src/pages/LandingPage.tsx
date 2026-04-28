import { Link } from 'react-router-dom'
import { KlarertLogo } from '../components/brand/KlarertLogo'

const FOREST = '#1a3d32'
const TEAL = '#2dd4bf'
const CREAM = '#f5f0e8'

const NAV_LINKS = [
  { label: 'Produkt', href: '#features' },
  { label: 'Pris', href: '#pricing' },
  { label: 'Kunder', href: '#testimonials' },
  { label: 'Integrasjoner', href: '#' },
  { label: 'Ressurser', href: '#' },
]

const STATS = [
  { value: '6', label: 'lovpålagte moduler' },
  { value: '10+', label: 'AML-maler inkludert' },
  { value: '∞', label: 'frister auto-genereres' },
  { value: '0', label: 'papir nødvendig' },
]

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
    desc: 'Blokkbasert dokumentsystem med 10 ferdigbygde maler. Live widgets henter risikooversikt og AMU-sammensetning.',
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
    quote: 'Oppfølgingsplaner, dialogmøter, NAV-meldinger — alt skjer på riktig tidspunkt automatisk.',
    name: 'Daglig leder',
    org: 'Bygg og anlegg, 60 ansatte',
  },
]

const HOW_STEPS = [
  {
    step: '1',
    title: 'Sett opp organisasjonen',
    desc: 'Legg inn ansatte, avdelinger og enheter. Systemet beregner automatisk om du er lovpålagt AMU og verneombud.',
  },
  {
    step: '2',
    title: 'Aktiver modulene',
    desc: 'Slå på HMS, AMU, sykefravær eller internkontroll. Alle frister og maler er klare — ingen konfigurasjon.',
  },
  {
    step: '3',
    title: 'La systemet jobbe',
    desc: 'Varslinger, frister, årshjul og Action Board holder oversikten. Du fokuserer på menneskene.',
  },
]

// ─── App preview cards ────────────────────────────────────────────────────────

const TOP_DEVIATIONS = [
  { initials: 'BE', bg: '#c084fc', name: 'Brann og evakuering', count: 4 },
  { initials: 'MS', bg: '#f97316', name: 'Maskinsikkerhet', count: 2 },
  { initials: 'EG', bg: '#22c55e', name: 'Ergonomi', count: 7 },
  { initials: 'KE', bg: '#3b82f6', name: 'Kjemisk eksponering', count: 1 },
  { initials: 'VU', bg: '#ef4444', name: 'Verneutstyr mangler', count: 3 },
]

const TOP_CASES = [
  { initials: 'LH', bg: '#a78bfa', name: 'Line Hansen', role: 'Verneombud', count: 67 },
  { initials: 'NK', bg: '#34d399', name: 'Nils Knutsen', role: 'HMS-leder', count: 52 },
  { initials: 'AR', bg: '#fbbf24', name: 'Anne Rønning', role: 'Daglig leder', count: 47 },
  { initials: 'VB', bg: '#f87171', name: 'Vegard Berg', role: 'Avdelingsleder', count: 33 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Hero (dark green) ──────────────────────────────────────────── */}
      <div style={{ background: FOREST }}>

        {/* Navbar */}
        <header className="sticky top-0 z-50 border-b border-white/10" style={{ background: FOREST }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
            <Link to="/home" aria-label="Klarert — til forsiden">
              <KlarertLogo size={24} variant="onDark" />
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-medium text-white/70 md:flex">
              {NAV_LINKS.map(({ label, href }) => (
                <a key={label} href={href} className="transition-colors hover:text-white">{label}</a>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login"
                className="hidden rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 md:inline-flex">
                Logg inn
              </Link>
              <Link to="/signup"
                className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition hover:opacity-90"
                style={{ background: TEAL, color: FOREST }}>
                Prøv gratis
              </Link>
            </div>
          </div>
        </header>

        {/* Hero content */}
        <section className="pb-0 pt-20 text-center">
          <div className="mx-auto max-w-4xl px-4 md:px-8">
            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-3">
              <div className="flex -space-x-2">
                {['LH','NK','AR'].map((i, idx) => (
                  <div key={idx} className="flex size-8 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white"
                    style={{ borderColor: FOREST, background: ['#a78bfa','#34d399','#fbbf24'][idx] }}>
                    {i}
                  </div>
                ))}
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
                Norsk arbeidsmiljølov
              </span>
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              En compliance-kultur{' '}
              <br className="hidden sm:block" />
              starter med{' '}
              <span style={{ borderBottom: `4px solid ${TEAL}`, paddingBottom: '2px' }}>Klarert</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              HMS, AMU, sykefravær og internkontroll — alt lovpålagt, alt automatisert, i én norsk plattform.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-8 py-3.5 text-base font-semibold transition hover:opacity-90 sm:w-auto"
                style={{ background: TEAL, color: FOREST }}>
                Prøv gratis 30 dager
              </Link>
              <Link to="/login?demo=1"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/25 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                Be om demo
              </Link>
            </div>
            <p className="mt-3 text-xs text-white/40">Ingen kredittkort. Ingen installasjon.</p>
          </div>

          {/* App screenshot mockup */}
          <div className="mx-auto mt-14 max-w-5xl px-4 md:px-8">
            <div className="relative overflow-hidden rounded-t-2xl border border-white/10 shadow-2xl shadow-black/40"
              style={{ background: '#0a2218' }}>
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
                <span className="size-3 rounded-full bg-red-500/70" />
                <span className="size-3 rounded-full bg-amber-500/70" />
                <span className="size-3 rounded-full bg-green-500/70" />
                <div className="ml-3 flex-1 rounded border border-white/10 bg-white/5 px-3 py-1 text-center text-xs text-white/40">
                  app.klarert.com
                </div>
              </div>
              {/* Dashboard layout */}
              <div className="grid grid-cols-5">
                {/* Sidebar */}
                <div className="col-span-1 border-r border-white/8 p-3 space-y-1" style={{ background: '#0d2a1c' }}>
                  <div className="mb-3 px-1"><KlarertLogo size={14} variant="onDark" /></div>
                  {['Dashbord','HMS','AMU','Sykefravær','Internkontroll','E-læring'].map((l, i) => (
                    <div key={l} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${i === 0 ? 'font-semibold text-white' : 'text-white/40'}`}
                      style={i === 0 ? { background: 'rgba(45,212,191,0.15)', color: TEAL } : {}}>
                      <span className="size-1.5 rounded-full shrink-0" style={{ background: i === 0 ? TEAL : 'rgba(255,255,255,0.2)' }} />
                      {l}
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div className="col-span-4 p-5">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: TEAL }}>God morgen, Leder</p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { v: '3', l: 'Åpne avvik', c: '#ef4444' },
                      { v: '2', l: 'Aktive sykefravær', c: '#f97316' },
                      { v: '4/4', l: 'AMU-møter planlagt', c: TEAL },
                    ].map(({ v, l, c }) => (
                      <div key={l} className="rounded-lg border border-white/8 p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {['Neste AMU-møte: 15. jan','Sykefravær-frist: 4 uker om 3 dager','Vernerunde Q1 klar for gjennomføring'].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded border border-white/8 px-3 py-2 text-xs text-white/60">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: TEAL }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <dl className="grid grid-cols-2 divide-x divide-y divide-neutral-100 md:grid-cols-4 md:divide-y-0">
            {STATS.map(({ value, label }) => (
              <div key={label} className="px-6 py-6 text-center">
                <dt className="text-3xl font-bold" style={{ color: FOREST }}>{value}</dt>
                <dd className="mt-1 text-sm text-neutral-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Floating app cards ───────────────────────────────────────────── */}
      <section className="py-20 md:py-28" style={{ background: CREAM }}>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}>
              Én app for alle compliance-kravene dine
            </h2>
            <p className="mt-4 text-neutral-600">
              Compliance er kraftfullt. Hyppig, strukturert HMS-arbeid hjelper alle å føle seg trygge og ivaretatt.
            </p>
          </div>
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            {/* Left: Top deviations */}
            <div className="flex-1 rounded-2xl border border-neutral-200 bg-white p-5 shadow-md">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Åpne avvik</span>
              </div>
              {TOP_DEVIATIONS.map(({ initials, bg, name, count }) => (
                <div key={name} className="flex items-center justify-between border-b border-neutral-50 py-2.5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                      style={{ background: bg }}>{initials}</div>
                    <span className="text-sm text-neutral-700">{name}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: FOREST }}>{count}</span>
                </div>
              ))}
            </div>
            {/* Center: Dashboard stats + case list */}
            <div className="flex-[1.4] space-y-3">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Avvik-status</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${TEAL}22`, color: FOREST }}>Live</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-neutral-100">
                  {[{ v: '12', l: 'Nye' }, { v: '7', l: 'Pågående' }, { v: '103', l: 'Lukket' }].map(({ v, l }) => (
                    <div key={l} className="px-3 text-center first:pl-0 last:pr-0">
                      <div className="text-lg font-bold" style={{ color: FOREST }}>{v}</div>
                      <div className="text-[10px] text-neutral-400">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-md">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm">👤</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Saksbehandlere</span>
                </div>
                {TOP_CASES.map(({ initials, bg, name, role, count }) => (
                  <div key={name} className="flex items-center justify-between border-b border-neutral-50 py-2 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                        style={{ background: bg }}>{initials}</div>
                      <div>
                        <div className="text-sm font-medium text-neutral-800">{name}</div>
                        <div className="text-[10px] text-neutral-400">{role}</div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: FOREST }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: CTA card */}
            <div className="flex-1 rounded-2xl border-2 p-6 shadow-md" style={{ borderColor: FOREST, background: FOREST }}>
              <div className="mb-4 flex size-10 items-center justify-center rounded-full" style={{ background: TEAL }}>
                <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
                  <path d="M12 2L3.5 6v5c0 5.5 3.7 10.7 8.5 12 4.8-1.3 8.5-6.5 8.5-12V6L12 2z" fill={FOREST}/>
                  <path d="M9 12l2 2 4-4" stroke={FOREST} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-bold text-white" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                Vil du ta compliance på alvor?
              </h3>
              <p className="mb-5 text-sm text-white/60">
                Utforsk spesialfunksjonene som løfter HMS-arbeidet til neste nivå.
              </p>
              <Link to="/signup"
                className="inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                style={{ background: TEAL, color: FOREST }}>
                Les mer
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="mx-auto mb-4 max-w-xl text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Slik fungerer det</p>
            <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}>
              Kom i gang på tre steg
            </h2>
          </div>
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {HOW_STEPS.map(({ step, title, desc }) => (
              <li key={step} className="flex flex-col gap-4">
                <div className="flex size-12 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ background: FOREST }}>
                  {step}
                </div>
                <h3 className="text-base font-semibold" style={{ color: FOREST }}>{title}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28" style={{ background: CREAM }}>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}>
              Alt du trenger for lovpålagt HMS-arbeid
            </h2>
            <p className="mt-4 text-neutral-600">
              Seks integrerte moduler. Én datakilde. Alle koblinger til norsk lov innebygd fra start.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon, title, desc }) => (
              <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl text-2xl"
                  style={{ background: `${TEAL}20` }}>
                  {icon}
                </div>
                <h3 className="mb-2 text-base font-semibold" style={{ color: FOREST }}>{title}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compliance callout ───────────────────────────────────────────── */}
      <section className="py-16 md:py-20" style={{ background: FOREST }}>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Bygget på norsk lov — ikke tilpasset etterpå
            </h2>
            <p className="mt-4 text-sm text-white/60 md:text-base">
              Hver funksjon er koblet til en konkret lovhjemmel. Compliance er ikke en sjekkliste — det er arkitekturen.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {LAW_REFS.map(({ short, full }) => (
              <div key={short} className="rounded-xl border border-white/10 p-4 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="text-sm font-bold" style={{ color: TEAL }}>{short}</div>
                <div className="mt-1 text-[11px] text-white/50">{full}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section id="testimonials" className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}>
              Hva sier brukerne?
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, org }) => (
              <figure key={name} className="flex flex-col gap-5 rounded-2xl border border-neutral-200 p-6">
                <blockquote className="flex-1">
                  <p className="text-sm leading-relaxed text-neutral-700">&ldquo;{quote}&rdquo;</p>
                </blockquote>
                <figcaption>
                  <p className="text-sm font-semibold" style={{ color: FOREST }}>{name}</p>
                  <p className="text-xs text-neutral-400">{org}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 md:py-28" style={{ background: CREAM }}>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}>
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
                features: ['Alle moduler','Forhåndsutfylt data','10 sekunder oppstart','Ingen registrering'],
                cta: 'Start demo',
                href: '/login?demo=1',
                highlight: false,
              },
              {
                name: 'Liten virksomhet',
                price: 'fra 690',
                period: 'kr/mnd',
                features: ['Opp til 50 ansatte','Alle moduler','Supabase datavault','E-post support'],
                cta: 'Opprett konto',
                href: '/signup',
                highlight: true,
              },
              {
                name: 'Større virksomhet',
                price: 'Kontakt oss',
                period: '',
                features: ['Ubegrenset ansatte','SSO og tilgangsstyring','Onboarding og opplæring','Dedikert support'],
                cta: 'Ta kontakt',
                href: 'mailto:hei@klarert.com',
                highlight: false,
              },
            ].map(({ name, price, period, features, cta, href, highlight }) => (
              <div key={name}
                className={`flex flex-col rounded-2xl p-6 ${highlight ? 'shadow-lg' : 'border border-neutral-200 bg-white'}`}
                style={highlight ? { background: FOREST } : {}}>
                <h3 className={`text-sm font-semibold uppercase tracking-wide ${highlight ? 'text-white/60' : 'text-neutral-500'}`}>{name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${highlight ? 'text-white' : ''}`} style={!highlight ? { color: FOREST } : {}}>{price}</span>
                  {period && <span className={`text-sm ${highlight ? 'text-white/60' : 'text-neutral-500'}`}>{period}</span>}
                </div>
                <ul className="mt-5 flex-1 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 shrink-0" style={{ color: TEAL }}>✓</span>
                      <span className={highlight ? 'text-white/80' : 'text-neutral-700'}>{f}</span>
                    </li>
                  ))}
                </ul>
                {href.startsWith('mailto') ? (
                  <a href={href}
                    className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition ${highlight ? 'hover:opacity-90' : 'border border-neutral-300 hover:bg-neutral-50'}`}
                    style={highlight ? { background: TEAL, color: FOREST } : {}}>
                    {cta}
                  </a>
                ) : (
                  <Link to={href}
                    className={`mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition ${highlight ? 'hover:opacity-90' : 'border border-neutral-300 hover:bg-neutral-50'}`}
                    style={highlight ? { background: TEAL, color: FOREST } : {}}>
                    {cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24" style={{ background: FOREST }}>
        <div className="mx-auto max-w-2xl px-4 text-center md:px-8">
          <h2 className="text-2xl font-bold text-white md:text-3xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Prøv Klarert gratis
          </h2>
          <p className="mt-4 text-white/60">
            Elevér HMS-arbeidet ditt. Start din gratis 30-dagerstest nå.
          </p>
          <Link to="/signup"
            className="mt-7 inline-flex items-center justify-center rounded-md px-8 py-3.5 text-base font-semibold transition hover:opacity-90"
            style={{ background: TEAL, color: FOREST }}>
            Kom i gang
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <KlarertLogo size={22} variant="onLight" />
              <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                Norsk HMS og arbeidsmiljø i programvare. Compliance-by-design for virksomheter med 5–500 ansatte.
              </p>
            </div>
            <nav aria-label="Produkt" className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Produkt</p>
              {['Funksjoner','HMS-modulen','AMU og valg','Sykefravær','E-læring'].map((label) => (
                <a key={label} href="#features" className="block text-sm text-neutral-600 transition-colors hover:text-neutral-900">{label}</a>
              ))}
            </nav>
            <nav aria-label="Selskapet" className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Selskapet</p>
              {[{ label: 'Om Klarert', href: '#' },{ label: 'Kontakt', href: 'mailto:hei@klarert.com' },{ label: 'Pris', href: '#pricing' },{ label: 'Logg inn', href: '/login' }].map(({ label, href }) => (
                <a key={label} href={href} className="block text-sm text-neutral-600 transition-colors hover:text-neutral-900">{label}</a>
              ))}
            </nav>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Lovverk</p>
              {LAW_REFS.map(({ short, full }) => (
                <p key={short} className="flex gap-2 text-sm text-neutral-500">
                  <span className="shrink-0 font-medium" style={{ color: TEAL }}>{short}</span>{full}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-6 text-xs text-neutral-400">
            <p>© {new Date().getFullYear()} Klarert.com. Alle rettigheter forbeholdt.</p>
            <div className="flex gap-6">
              <a href="#" className="transition-colors hover:text-neutral-600">Personvern</a>
              <a href="#" className="transition-colors hover:text-neutral-600">Vilkår</a>
              <a href="#" className="transition-colors hover:text-neutral-600">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
