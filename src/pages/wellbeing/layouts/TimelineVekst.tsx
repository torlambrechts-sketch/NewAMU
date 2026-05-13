// TimelineVekst — vertikal tidslinje i Vekst-stilen. Hver milepæl
// får en stor amber-prikk på en organisk linje, en eventuell motif
// i en mindre sirkel, og et serif-overskriftskort til høyre. Bygd
// for å fortelle organisasjonens HMS-år som en historie, ikke som
// en regnskaps-liste.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import {
  MotifMedvirkning,
  MotifMestring,
  MotifTrivsel,
  MotifTrygghet,
} from '../components/AxisMotifs'
import type { WellbeingAxisKey } from '../dashboards/useWorkerWellbeingDatasets'

const SERIF = "'Libre Baskerville', Georgia, serif"

const MOTIF_BY_AXIS: Record<WellbeingAxisKey, React.ComponentType<{ className?: string }>> = {
  trygghet: MotifTrygghet,
  trivsel: MotifTrivsel,
  medvirkning: MotifMedvirkning,
  mestring: MotifMestring,
}

const DOT_TONE: Record<'warm' | 'forest' | 'neutral' | 'cool', string> = {
  warm: 'bg-amber-500',
  forest: 'bg-emerald-500',
  neutral: 'bg-[#1a3d32]/40',
  cool: 'bg-rose-500',
}

const CHIP_TONE: Record<'warm' | 'forest' | 'neutral' | 'cool', string> = {
  warm: 'bg-amber-50 text-amber-900 ring-amber-200',
  forest: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  neutral: 'bg-neutral-100 text-neutral-800 ring-neutral-200',
  cool: 'bg-rose-50 text-rose-900 ring-rose-200',
}

export type TimelineVekstEntry = {
  id: string
  date: string
  title: string
  body?: ReactNode
  motif?: WellbeingAxisKey
  tone?: 'warm' | 'forest' | 'neutral' | 'cool'
  chips?: Array<{ label: string; tone?: 'warm' | 'forest' | 'neutral' | 'cool' }>
  cta?: { label: string; to: string }
}

export type TimelineVekstProps = {
  eyebrow?: string
  title?: string
  description?: ReactNode
  entries: TimelineVekstEntry[]
  footnote?: ReactNode
}

export function TimelineVekst({
  eyebrow,
  title,
  description,
  entries,
  footnote,
}: TimelineVekstProps) {
  return (
    <section className="rounded-3xl border border-[#1a3d32]/15 bg-white p-7 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]">
      {(eyebrow || title || description) && (
        <header className="mb-6 space-y-2">
          {eyebrow && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2
              className="text-2xl font-bold leading-tight text-[#1a3d32] sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-[#516760]">{description}</p>
          )}
        </header>
      )}

      <ol className="relative">
        {/* Organic vertical line — slightly offset so dots sit centred on it. */}
        <span
          aria-hidden
          className="absolute left-[19px] top-1 bottom-1 w-px bg-gradient-to-b from-amber-200 via-amber-200/60 to-transparent"
        />
        {entries.map((entry) => {
          const Motif = entry.motif ? MOTIF_BY_AXIS[entry.motif] : null
          const tone = entry.tone ?? 'warm'
          return (
            <li key={entry.id} className="relative pl-12 pb-7 last:pb-0">
              {/* Dot — large, on the spine */}
              <span
                aria-hidden
                className={`absolute left-[13px] top-2 h-[14px] w-[14px] rounded-full ring-4 ring-[#FAF6EE] ${DOT_TONE[tone]}`}
              />
              {/* Motif — sits just below the dot when there is one */}
              {Motif && (
                <span
                  aria-hidden
                  className="absolute left-0 top-9 flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-white"
                >
                  <Motif className="h-7 w-7" />
                </span>
              )}

              <div className="ml-1 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  {entry.date}
                </div>
                <h3
                  className="text-xl font-bold leading-snug text-[#1a3d32]"
                  style={{ fontFamily: SERIF }}
                >
                  {entry.title}
                </h3>
                {entry.body && (
                  <div className="max-w-2xl text-sm leading-relaxed text-[#2c3a35]">{entry.body}</div>
                )}
                {entry.chips && entry.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {entry.chips.map((chip, i) => (
                      <span
                        key={i}
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${CHIP_TONE[chip.tone ?? 'neutral']}`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}
                {entry.cta && (
                  <Link
                    to={entry.cta.to}
                    className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-amber-900 hover:underline"
                  >
                    {entry.cta.label} <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {footnote && (
        <p className="mt-4 border-t border-amber-100 pt-4 text-[11px] italic leading-relaxed text-[#516760]">
          {footnote}
        </p>
      )}
    </section>
  )
}
