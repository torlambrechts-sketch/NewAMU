import { useEffect, useState } from 'react'
import { List } from 'lucide-react'
import type { WikiTocItem } from '../../lib/wikiPageContent'

type Props = {
  items: WikiTocItem[]
  contentRootRef: React.RefObject<HTMLElement | null>
}

export function WikiPageTocRail({ items, contentRootRef }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (items.length === 0) return
    const root = contentRootRef.current
    if (!root) return
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el != null)
    if (els.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id)
      },
      { root: null, rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5, 1] },
    )
    for (const el of els) obs.observe(el)
    return () => obs.disconnect()
  }, [items, contentRootRef])

  if (items.length === 0) return null

  return (
    <>
      {/* Mobile: floating icon */}
      <div className="wiki-no-print xl:hidden">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
            className="wiki-no-print fixed bottom-20 right-4 z-[90] flex size-12 items-center justify-center rounded-full border border-neutral-200 bg-white text-[#1a3d32] shadow-lg print:hidden"
          aria-expanded={expanded}
          aria-label="Innholdsfortegnelse"
        >
          <List className="size-5" />
        </button>
        {expanded ? (
          <div
            className="wiki-no-print fixed inset-0 z-[89] bg-black/30 xl:hidden print:hidden"
            role="presentation"
            onClick={() => setExpanded(false)}
          >
            <nav
              className="absolute bottom-24 right-4 max-h-[50vh] w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              aria-label="Innholdsfortegnelse"
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">På denne siden</p>
              <ul className="space-y-1 text-sm">
                {items.map((it) => (
                  <li key={it.id}>
                    <a
                      href={`#${it.id}`}
                      onClick={() => setExpanded(false)}
                      className={`block rounded px-2 py-1.5 ${
                        activeId === it.id ? 'bg-[#1a3d32]/10 font-medium text-[#1a3d32]' : 'text-neutral-700 hover:bg-neutral-50'
                      } ${it.level === 1 ? '' : it.level === 2 ? 'pl-3' : 'pl-5'}`}
                    >
                      {it.text || 'Uten tittel'}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : null}
      </div>

      {/* Large screens: sticky rail */}
      <aside className="wiki-no-print hidden w-[220px] shrink-0 xl:block print:hidden">
        <nav
          className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg border border-neutral-200/90 bg-white/90 p-3 text-sm shadow-sm backdrop-blur-sm"
          aria-label="Innholdsfortegnelse"
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">På denne siden</p>
          <ul className="space-y-0.5">
            {items.map((it) => (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  className={`block rounded px-2 py-1.5 leading-snug transition-colors ${
                    activeId === it.id ? 'bg-[#1a3d32]/10 font-medium text-[#1a3d32]' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  } ${it.level === 1 ? 'text-[13px]' : it.level === 2 ? 'pl-2 text-[12px]' : 'pl-4 text-[12px]'}`}
                >
                  {it.text || 'Uten tittel'}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
