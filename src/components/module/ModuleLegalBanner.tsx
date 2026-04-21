import type { ReactNode } from 'react'
import { Scale } from 'lucide-react'

/**
 * Legal framework banner for module / group frontpages.
 *
 * Renders as a dark-green surface (same colour family as ComplianceBanner) with
 * a large heading, a short explanation, and a list of specific legal references
 * with the section text. Use on **group frontpages** to anchor the user in the
 * regulatory basis for the group (e.g. «Risiko & Sikkerhet» points to
 * Internkontrollforskriften § 5 nr. 6).
 *
 * Single reference sits on top of the page; multiple references stack with a
 * divider. Matches the «ComplianceBanner» + WorkplaceStandardFormPanel style.
 *
 * @example
 * ```tsx
 * <ModuleLegalBanner
 *   eyebrow="Lovgrunnlag"
 *   title="Risiko & Sikkerhet"
 *   intro="Alt arbeid med kartlegging og reduksjon av risiko på arbeidsplassen."
 *   references={[
 *     {
 *       code: 'IK-forskriften § 5 nr. 6',
 *       text: 'Virksomheten skal kartlegge farer og problemer og vurdere risiko.',
 *     },
 *     {
 *       code: 'AML § 3-1 andre ledd',
 *       text: 'Systematisk HMS-arbeid skal identifisere farer.',
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
}

export function ModuleLegalBanner({
  eyebrow = 'Lovgrunnlag',
  title,
  intro,
  references,
  className,
}: ModuleLegalBannerProps) {
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
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p>
          ) : null}
          <h2
            className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {title}
          </h2>
          {intro ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/80">{intro}</p> : null}

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
      </div>
    </section>
  )
}
