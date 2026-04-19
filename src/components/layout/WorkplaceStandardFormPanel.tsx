import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { WORKPLACE_PAGE_SERIF } from './WorkplacePageHeading1'
import { WORKPLACE_STANDARD_LIST_OVERLAY_Z_INDEX } from './WorkplaceStandardListLayout'

/** Same grid as Tasks slide-over: lead 40% / inset 60% from md. */
export const WPSTD_FORM_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'

export const WPSTD_FORM_INSET = 'rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6'

export const WPSTD_FORM_LEAD = 'text-sm leading-relaxed text-neutral-600'

export const WPSTD_FORM_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'

export const WPSTD_FORM_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'

export const WPSTD_FORM_INPUT_ON_WHITE = `${WPSTD_FORM_INPUT} bg-white`

/** Rounded-md + gray border + brand focus ring — matches inspection create/edit forms. */
export const WPSTD_FORM_INPUT_GRAY =
  'w-full border border-gray-300 rounded-md bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#1a3d32]'

export type WorkplaceStandardFormPanelProps = {
  open: boolean
  onClose: () => void
  titleId: string
  title: ReactNode
  /** Scrollable body (forms, sections) */
  children: ReactNode
  /** Sticky footer (e.g. submit + cancel) */
  footer: ReactNode
}

/**
 * Right slide-over shell matching Tasks create/edit panel (cream surface, serif title, footer band).
 * Use with {@link WorkplaceStandardListLayout} `overlay` prop or standalone.
 */
export function WorkplaceStandardFormPanel({
  open,
  onClose,
  titleId,
  title,
  children,
  footer,
}: WorkplaceStandardFormPanelProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex justify-end bg-black/45 backdrop-blur-[2px]"
      style={{ zIndex: WORKPLACE_STANDARD_LIST_OVERLAY_Z_INDEX }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex h-full w-full max-w-[min(100vw,920px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8 sm:py-6">
          <h2
            id={titleId}
            className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800"
            aria-label="Lukk"
          >
            <X className="size-6" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">{children}</div>
          <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5 sm:px-8">{footer}</footer>
        </div>
      </div>
    </div>
  )
}
