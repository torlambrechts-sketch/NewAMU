// Trust strip — replaces both the old stats strip and the testimonials section.
// Renders the 9 frameworks as a horizontal-scrolling pill grid on a dark band.

import { Link } from 'react-router-dom'
import { FRAMEWORKS } from '../content/compliance'

const TEAL = '#2dd4bf'

export function FrameworkBadgesSection() {
  return (
    <section className="py-12 md:py-16" style={{ background: '#142e26' }}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="mb-6 text-center text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>
          Compliance i arkitekturen
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {FRAMEWORKS.map((f) => (
            <div
              key={f.short}
              className="flex items-baseline gap-2 rounded-full border px-4 py-2 text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <span className="font-bold text-white">{f.short}</span>
              <span className="text-xs uppercase tracking-wider text-white/45">
                {f.paragraphs.length} §
              </span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-white/55">
          Hver paragraf er kartlagt til en konkret modul.{' '}
          <Link to="/compliance" className="font-semibold underline-offset-4 hover:underline" style={{ color: TEAL }}>
            Se hele dekningsmatrisen →
          </Link>
        </p>
      </div>
    </section>
  )
}
