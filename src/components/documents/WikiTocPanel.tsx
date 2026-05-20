import { ModuleSectionCard } from '../module/ModuleSectionCard'

/**
 * Left-hand table-of-contents panel for the document viewer.
 *
 * Replaces the page tree in the viewer's left column — the headings of the
 * current page, with the in-view heading highlighted. Clicking scrolls the
 * reader to that heading.
 */
export interface WikiTocEntry {
  id: string
  text: string
  level: number
}

export function WikiTocPanel({
  toc,
  activeId,
}: {
  toc: WikiTocEntry[]
  activeId: string | null
}) {
  return (
    <ModuleSectionCard className="!p-0 sticky top-4 self-start">
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">På denne siden</p>
      </div>
      <nav className="max-h-[760px] overflow-y-auto px-2 py-2" aria-label="Innhold">
        {toc.length === 0 ? (
          <p className="px-2 py-3 text-xs text-neutral-400">Ingen overskrifter på denne siden.</p>
        ) : (
          <ul className="space-y-0.5">
            {toc.map((h) => {
              const active = activeId === h.id
              return (
                <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
                  <a
                    href={`#${h.id}`}
                    className={`flex items-center gap-2 rounded-md py-1 pr-2 text-[13px] leading-5 transition-colors ${
                      active
                        ? 'border-l-2 border-[#0f766e] bg-[#e6f2f0] pl-[8px] font-semibold text-[#0f766e]'
                        : 'pl-2.5 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    {h.level === 1 ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-50" aria-hidden />
                    ) : null}
                    <span className="truncate">{h.text}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </ModuleSectionCard>
  )
}
