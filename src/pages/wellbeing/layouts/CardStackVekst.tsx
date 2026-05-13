// CardStackVekst — interaktivt kort-kortstokk-mønster. Tre-fire kort
// stables vertikalt med subtle rotasjon og skygge slik at det leser
// som en håndholdt bunke postkort. Klikk topp-kortet for å sende
// det bakerst og vise neste. Pile-knappene under gir samme handling
// med tastatur.
//
// Bygd for «Stories», «Highlights» eller andre flater hvor noen få
// rike kort skal serveres bevisst én av gangen i stedet for som en
// flat grid.

import type { ReactNode } from 'react'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
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

const TONE_GRADIENT: Record<'warm' | 'forest' | 'neutral' | 'cool', string> = {
  warm: 'from-amber-50 via-white to-orange-50',
  forest: 'from-emerald-50 via-white to-green-50',
  neutral: 'from-neutral-50 via-white to-neutral-50',
  cool: 'from-rose-50 via-white to-pink-50',
}

export type CardStackVekstCard = {
  id: string
  eyebrow?: string
  title: string
  body?: ReactNode
  footer?: ReactNode
  motif?: WellbeingAxisKey
  tone?: 'warm' | 'forest' | 'neutral' | 'cool'
}

export type CardStackVekstProps = {
  eyebrow?: string
  title?: string
  description?: ReactNode
  cards: CardStackVekstCard[]
}

export function CardStackVekst({
  eyebrow,
  title,
  description,
  cards,
}: CardStackVekstProps) {
  // We keep cards in stable order and rotate via a topIdx, so React keys
  // stay aligned to original positions across shuffles.
  const [topIdx, setTopIdx] = useState(0)
  if (cards.length === 0) return null

  const advance = () => setTopIdx((i) => (i + 1) % cards.length)
  const back = () => setTopIdx((i) => (i - 1 + cards.length) % cards.length)
  const reset = () => setTopIdx(0)

  return (
    <section className="rounded-3xl border border-[#1a3d32]/10 bg-[#FAF6EE] p-6 sm:p-10">
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

      {/* Stack container — relative so absolutely-positioned cards layer. */}
      <div className="relative mx-auto" style={{ maxWidth: 540, minHeight: 340 }}>
        {cards.map((card, originalIdx) => {
          // visualIdx = position from top (0 = topmost)
          const visualIdx = (originalIdx - topIdx + cards.length) % cards.length
          const isTop = visualIdx === 0
          // For non-top cards we peek further down + rotate slightly
          // alternating directions for a hand-shuffled feel.
          const offsetY = visualIdx * 12
          const scale = 1 - visualIdx * 0.025
          const rotation = visualIdx === 0 ? 0 : visualIdx % 2 === 0 ? 1.2 : -1.2
          const opacity = visualIdx > 3 ? 0 : 1 - visualIdx * 0.08
          const zIndex = 100 - visualIdx
          const Motif = card.motif ? MOTIF_BY_AXIS[card.motif] : null
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (isTop) advance()
                else setTopIdx(originalIdx)
              }}
              className={`absolute left-0 right-0 top-0 overflow-hidden rounded-3xl border border-[#1a3d32]/15 bg-gradient-to-br ${TONE_GRADIENT[card.tone ?? 'warm']} p-7 text-left shadow-[0_18px_40px_-22px_rgba(26,61,50,0.35)] transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${
                isTop ? 'cursor-pointer hover:-translate-y-1' : 'cursor-pointer hover:opacity-95'
              }`}
              style={{
                transform: `translateY(${offsetY}px) scale(${scale}) rotate(${rotation}deg)`,
                opacity,
                zIndex,
                pointerEvents: opacity > 0 ? 'auto' : 'none',
                minHeight: 280,
              }}
              aria-label={isTop ? `Neste kort: ${card.title}` : `Bring frem: ${card.title}`}
            >
              {Motif && (
                <Motif className="pointer-events-none absolute -right-6 -top-6 h-44 w-44 opacity-[0.06]" />
              )}
              <div className="relative flex h-full flex-col gap-3">
                {card.eyebrow && (
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                    {card.eyebrow}
                  </div>
                )}
                <div className="flex items-start gap-3">
                  {Motif && <Motif className="h-12 w-12 shrink-0" />}
                  <h3
                    className="text-2xl font-bold leading-tight text-[#1a3d32]"
                    style={{ fontFamily: SERIF }}
                  >
                    {card.title}
                  </h3>
                </div>
                {card.body && (
                  <div className="text-base leading-relaxed text-[#2c3a35]">{card.body}</div>
                )}
                {card.footer && (
                  <div className="mt-auto border-t border-[#1a3d32]/10 pt-3 text-sm text-[#516760]">
                    {card.footer}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#1a3d32]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-amber-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Forrige
        </button>
        <div className="flex items-center gap-1.5">
          {cards.map((c, i) => (
            <span
              key={c.id}
              className={`h-1.5 rounded-full transition-all ${
                i === topIdx ? 'w-6 bg-amber-500' : 'w-1.5 bg-amber-200'
              }`}
              aria-hidden
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {topIdx !== 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#516760] hover:text-[#1a3d32]"
            >
              <RefreshCw className="h-3 w-3" aria-hidden /> Stokke om
            </button>
          )}
          <button
            type="button"
            onClick={advance}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-300 bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            Neste <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  )
}
