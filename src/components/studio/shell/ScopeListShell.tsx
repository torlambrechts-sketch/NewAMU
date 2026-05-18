// ScopeListShell — visual consistency wrapper for scopes whose Advanced
// view doesn't yet have a full StudioCanvas builder.
//
// Renders a uniform header + body card so all 8 scopes share the same
// chrome (header band, container, padding). The inner content is
// whatever the embedder hands in (legacy module-admin page,
// CloneDeepLinkRedirect banner, etc).
//
// This is the visual minimum: every scope at /studio?mode=advanced
// presents the same outer surface even if the inner editor depth
// varies.

import type { ReactNode } from 'react'

export type ScopeListShellProps = {
  title: ReactNode
  subtitle?: ReactNode
  headerActions?: ReactNode
  children: ReactNode
  /** If true, omits the white inner card (used when the child is a
   *  full-bleed legacy page). */
  bare?: boolean
}

export function ScopeListShell({ title, subtitle, headerActions, children, bare }: ScopeListShellProps) {
  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 font-serif">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p> : null}
        </div>
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </header>
      {bare ? (
        children
      ) : (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">{children}</section>
      )}
    </div>
  )
}
