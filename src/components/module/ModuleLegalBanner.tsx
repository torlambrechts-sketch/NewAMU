import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useModuleLegalFramework } from './ModuleLegalFrameworkContext'

/** Pastel header stripes for inner cards (Rooms-style). */
const CARD_HEADER_COLORS = ['#e9d5ff', '#fed7aa', '#fef3c7', '#bae6fd'] as const

/**
 * Legal / compliance intro for module pages — light mint surface with inner white
 * cards (one per reference), dismiss (X), and a session-persisted helper switch in
 * {@link ModulePageShell} to show the bar again after close.
 */
export interface ModuleLegalReference {
  /** Short citation, e.g. `IK-forskriften § 5 nr. 6`. */
  code: string
  /** Full text of the legal requirement. */
  text: ReactNode
}

export interface ModuleLegalBannerProps {
  /** Small uppercase label above the title (default «Regelverk»). */
  eyebrow?: string
  title: ReactNode
  /** Short plain-Norwegian explanation under the welcome line. */
  intro?: ReactNode
  references: ModuleLegalReference[]
  className?: string
  /**
   * @deprecated Kept for API compatibility; the banner is always shown in full when visible
   * (use the X to close and the header switch to reopen).
   */
  collapsible?: boolean
  /** @deprecated Ignored. */
  defaultCollapsed?: boolean
}

export function ModuleLegalBanner({
  eyebrow = 'Regelverk',
  title,
  intro,
  references,
  className,
}: ModuleLegalBannerProps) {
  const { registerBanner, unregisterBanner, dismissed, setDismissed } = useModuleLegalFramework()

  useEffect(() => {
    registerBanner()
    return () => unregisterBanner()
  }, [registerBanner, unregisterBanner])

  if (dismissed) return null

  const shell = [
    'relative rounded-xl border border-emerald-200/80 bg-[#e8f4ec] p-5 shadow-sm md:p-6',
    className?.trim() ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={shell} aria-labelledby="module-legal-framework-title">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full border border-neutral-300/80 bg-white/90 text-neutral-600 shadow-sm transition hover:bg-white hover:text-neutral-900"
        aria-label="Lukk regelverkspanel"
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="pr-10">
        {eyebrow ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-900/70">{eyebrow}</p>
        ) : null}
        <h2
          id="module-legal-framework-title"
          className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 md:text-xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {title}
        </h2>
        {intro ? (
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-neutral-700">{intro}</p>
        ) : (
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-neutral-700">
            Dette arbeidet er forankret i gjeldende lover og forskrifter. Kort oversikt under — bruk som sjekkliste i
            arbeidet.
          </p>
        )}
      </div>

      {references.length > 0 ? (
        <ul className="mt-5 grid list-none grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {references.map((ref, i) => (
            <li
              key={typeof ref.code === 'string' ? ref.code : i}
              className="flex flex-col overflow-hidden rounded-lg border border-neutral-200/90 bg-white shadow-sm"
            >
              <div
                className="h-2 w-full shrink-0"
                style={{ backgroundColor: CARD_HEADER_COLORS[i % CARD_HEADER_COLORS.length] }}
                aria-hidden
              />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-800">{ref.code}</span>
                <div className="text-xs leading-relaxed text-neutral-600">{ref.text}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
