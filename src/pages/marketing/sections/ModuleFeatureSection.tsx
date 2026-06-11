// Per-module deep section on the landing page — reused six times.
// Alternates mockup-left/mockup-right and cream/white background by `index`.

import { Link } from 'react-router-dom'
import type { ModuleFeature } from '../content/features'
import { LawRefChip } from '../primitives/LawRefChip'
import { BrowserMockup } from '../primitives/BrowserMockup'
import { ModuleMockup } from '../primitives/ModuleMockup'
import { CREAM, FOREST, TEAL } from '../theme'

type Props = {
  feature: ModuleFeature
  index: number
}

export function ModuleFeatureSection({ feature, index }: Props) {
  const isEven = index % 2 === 0
  const bg = isEven ? CREAM : '#ffffff'
  const mockupOnLeft = !isEven

  const copy = (
    <div className="flex-1">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
        style={{ borderColor: FOREST, color: FOREST, background: 'rgba(26,61,50,0.05)' }}>
        <span>{feature.eyebrow}</span>
        <span className="size-1 rounded-full" style={{ background: TEAL }} />
        <span>{feature.name}</span>
      </div>
      <h2
        className="text-3xl font-bold leading-tight tracking-tight md:text-[2.2rem] md:leading-[1.2]"
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: FOREST }}
      >
        {feature.headline}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-neutral-700 md:text-lg">{feature.lede}</p>
      <ul className="mt-6 space-y-3">
        {feature.capabilities.map((c) => (
          <li key={c.title} className="flex gap-3">
            <span
              className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: TEAL, color: FOREST }}
              aria-hidden
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: FOREST }}>{c.title}</p>
              <p className="text-sm leading-relaxed text-neutral-600">{c.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        {feature.lawRefs.map((r) => (
          <LawRefChip key={r.short} lawRef={r} size="sm" />
        ))}
      </div>
      <Link
        to={`/features/${feature.slug}`}
        className="mt-7 inline-flex items-center gap-2 text-sm font-semibold transition-colors"
        style={{ color: FOREST }}
      >
        Les mer om {feature.name.toLowerCase()}
        <span aria-hidden>→</span>
      </Link>
    </div>
  )

  const mockup = (
    <div className="flex-1">
      <figure aria-label={`Skjermbilde av ${feature.name}-modulen`}>
        <BrowserMockup url={`app.klarert.com/${feature.slug}`} tone="dark">
          <ModuleMockup slug={feature.slug} />
        </BrowserMockup>
        <figcaption className="sr-only">{feature.lede}</figcaption>
      </figure>
    </div>
  )

  return (
    <section className="py-20 md:py-24" style={{ background: bg }} id={index === 0 ? 'moduler' : undefined}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className={`flex flex-col gap-10 md:gap-14 ${mockupOnLeft ? 'md:flex-row-reverse' : 'md:flex-row'} md:items-center`}>
          {copy}
          {mockup}
        </div>
      </div>
    </section>
  )
}
