import { useState, type ReactNode } from 'react'
import { ChevronDown, Scale } from 'lucide-react'

/**
 * Legal framework banner for module / group frontpages.
 *
 * Renders as a dark-green surface (same colour family as ComplianceBanner) with
 * a large heading, a short explanation, and a list of specific legal references
 * with the section text. Use on **group frontpages** to anchor the user in the
 * regulatory basis for the group (e.g. «Risiko & Sikkerhet» points to
 * Internkontrollforskriften § 5 nr. 6).
 *
 * Set `collapsible` to let users hide the intro + reference list. The header
 * (icon, eyebrow, title) stays visible so the legal basis is always discover-
 * able but does not push dashboard content below the fold. When collapsible,
 * the banner defaults to **collapsed** — pass `defaultCollapsed={false}` to
 * open it on first render.
 *
 * @example
 * ```tsx
 * <ModuleLegalBanner
 *   collapsible
 *   eyebrow="Lovgrunnlag"
 *   title="Risiko & Sikkerhet"
 *   intro="Alt arbeid med kartlegging og reduksjon av risiko på arbeidsplassen."
 *   references={[
 *     {
 *       code: 'IK-forskriften § 5 nr. 6',
 *       text: 'Virksomheten skal kartlegge farer og problemer og vurdere risiko.',
 *     },
 *   ]}
 * />
 * ```
 */
export interface ModuleLegalReference {
  /** Short citation, e.g. `IK-forskriften § 5 nr. 6`. Rendered as a pill. */
  code: string
  /** Full text of the legal requirement. */
  text: ReactNode
}

export interface ModuleLegalBannerProps {
  /** Small uppercase label above the title, e.g. «Lovgrunnlag». */
  eyebrow?: string
  title: ReactNode
  /** Short plain-Norwegian explanation of what the group is for. */
  intro?: ReactNode
  references: ModuleLegalReference[]
  className?: string
  /**
   * When `true`, the banner renders a toggle button and only shows the
   * eyebrow + title when collapsed. Intro and references appear when
   * expanded. Defaults to `false` (no toggle — always expanded).
   */
  collapsible?: boolean
  /**
   * Initial state when `collapsible` is `true`. Defaults to `true` so
   * frontpages start compact and let the user opt-in to the legal
   * framework details. Ignored when `collapsible` is `false`.
   */
  defaultCollapsed?: boolean
}

export function ModuleLegalBanner({
  eyebrow = 'Lovgrunnlag',
  title,
  intro,
  references,
  className,
  collapsible = false,
  defaultCollapsed = true,
}: ModuleLegalBannerProps) {
  const initialCollapsed = collapsible ? defaultCollapsed : false
  const [collapsed, setCollapsed] = useState<boolean>(initialCollapsed)
  const expanded = !collapsed
  const toggleId = 'module-legal-banner-body'

  const hasBody = Boolean(intro) || references.length > 0

  return (
    <section
      className={
        className
          ? `rounded-xl bg-[#1a3d32] p-6 text-neutral-50 shadow-sm md:p-8 ${className}`
          : 'rounded-xl bg-[#1a3d32] p-6 text-neutral-50 shadow-sm md:p-8'
      }
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 md:size-12">
          <Scale className="size-5 text-white md:size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p>
              ) : null}
              <h2
                className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {title}
              </h2>
            </div>
            {collapsible && hasBody ? (
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={expanded}
                aria-controls={toggleId}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span>{expanded ? 'Skjul' : 'Vis'} lovgrunnlag</span>
                <ChevronDown
                  className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
            ) : null}
          </div>

          {hasBody && expanded ? (
            <div id={toggleId}>
              {intro ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">{intro}</p> : null}

              {references.length > 0 ? (
                <ul className="mt-5 space-y-3 border-t border-white/15 pt-5">
                  {references.map((ref, i) => (
                    <li
                      key={typeof ref.code === 'string' ? ref.code : i}
                      className="flex flex-col gap-2 md:flex-row md:gap-4"
                    >
                      <span className="inline-flex h-6 shrink-0 items-center self-start rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-semibold tracking-wide text-white">
                        {ref.code}
                      </span>
                      <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/80">{ref.text}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
