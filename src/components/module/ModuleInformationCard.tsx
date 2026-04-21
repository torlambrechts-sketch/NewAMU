import type { ReactNode } from 'react'
import { ComplianceBanner } from '../ui/ComplianceBanner'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../layout/WorkplaceStandardFormPanel'
import { ModuleSectionCard } from './ModuleSectionCard'

/**
 * A single row of entity metadata: label on the left, value (read-only text,
 * badge, or editable form control) on the right. Matches `WPSTD_FORM_ROW_GRID`.
 */
export interface ModuleInformationRow {
  /** Stable key (used for React map). */
  id: string
  /** Left-column label, e.g. «Tittel», «Status», «Lokasjon». */
  label: ReactNode
  /**
   * Right-column content. Pass any React node — a `StandardInput`,
   * `SearchableSelect`, `Badge`, or just a string. Use `null`/`undefined`
   * to render an em-dash placeholder.
   */
  value: ReactNode
  /** Optional `htmlFor` target when the row owns a single labelled control. */
  htmlFor?: string
  /** `true` — marks the label with a red asterisk. */
  required?: boolean
}

export interface ModuleInformationCardProps {
  /** Heading shown in the green compliance banner. Ignored when `hideHeader`. */
  title?: ReactNode
  /** Optional sub-text under the heading inside the banner. */
  description?: ReactNode
  /** One row per piece of entity information. */
  rows: ModuleInformationRow[]
  /**
   * Optional footer-bar children (e.g. «Lagre»-button). When omitted, no
   * footer is rendered.
   */
  footer?: ReactNode
  /** `false` — drop the outer ModuleSectionCard (e.g. already inside one). */
  withCard?: boolean
  /**
   * `true` — skip the dark-green `ComplianceBanner` header. Useful when an
   * outer component (e.g. the detail-page tab surface) already renders a
   * top-level banner and nesting would mean two stacked dark-green rows.
   */
  hideHeader?: boolean
  className?: string
}

/**
 * Generic «Informasjon»-kort for en modul-entitet.
 *
 * Erstatter per-modul «Round basics», «ROS basics», «SJA basics» osv.
 * Layouten følger {@link ComplianceBanner} + {@link WPSTD_FORM_ROW_GRID}
 * slik at en vernerunde, en ROS-analyse og en SJA-oppføring får nøyaktig
 * samme typografi, padding og linjekanter.
 *
 * Bruk:
 * ```tsx
 * <ModuleInformationCard
 *   title="Informasjon"
 *   description="Generell informasjon om denne vernerunden."
 *   rows={[
 *     { id: 'title', label: 'Tittel', value: <StandardInput … />, required: true },
 *     { id: 'status', label: 'Status', value: <SearchableSelect … /> },
 *     { id: 'location', label: 'Lokasjon', value: <SearchableSelect … /> },
 *   ]}
 * />
 * ```
 */
export function ModuleInformationCard({
  title,
  description,
  rows,
  footer,
  withCard = true,
  hideHeader = false,
  className,
}: ModuleInformationCardProps) {
  const body = (
    <>
      {hideHeader ? null : (
        <ComplianceBanner title={title ?? ''} className="border-b border-[#1a3d32]/20">
          {description ?? <p>Generell informasjon om denne oppføringen.</p>}
        </ComplianceBanner>
      )}

      <div>
        {rows.map((row) => (
          <div key={row.id} className={WPSTD_FORM_ROW_GRID}>
            {row.htmlFor ? (
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={row.htmlFor}>
                {row.label}
                {row.required ? <span className="ml-1 text-red-500">*</span> : null}
              </label>
            ) : (
              <span className={WPSTD_FORM_FIELD_LABEL}>
                {row.label}
                {row.required ? <span className="ml-1 text-red-500">*</span> : null}
              </span>
            )}
            <div className="min-w-0">
              {row.value === null || row.value === undefined || row.value === '' ? (
                <span className="text-sm text-neutral-400">—</span>
              ) : (
                row.value
              )}
            </div>
          </div>
        ))}
      </div>

      {footer ? (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 md:px-5">{footer}</div>
      ) : null}
    </>
  )

  if (!withCard) {
    return <div className={className}>{body}</div>
  }

  return <ModuleSectionCard className={className}>{body}</ModuleSectionCard>
}
