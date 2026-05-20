/* eslint-disable no-restricted-syntax -- tree rows are intentionally styled native buttons, not design-system Buttons */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileText, Folder, Search } from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { StandardInput } from '../ui/Input'
import type { WikiPage, WikiSpace } from '../../types/documents'

/**
 * Left-hand page tree for the document viewer (Rec02).
 *
 * Renders every space as a collapsible folder containing its pages. The space
 * holding the active page starts expanded; a filter input narrows the tree.
 */
export function WikiPageTree({
  spaces,
  pages,
  activePageId,
  activeSpaceId,
}: {
  spaces: WikiSpace[]
  pages: WikiPage[]
  activePageId: string
  activeSpaceId?: string | null
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const pagesBySpace = useMemo(() => {
    const map = new Map<string, WikiPage[]>()
    for (const p of pages) {
      const list = map.get(p.spaceId) ?? []
      list.push(p)
      map.set(p.spaceId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title, 'nb'))
    return map
  }, [pages])

  const q = filter.trim().toLowerCase()

  const visibleSpaces = useMemo(
    () =>
      spaces
        .filter((s) => s.status !== 'archived')
        .filter((s) => {
          if (!q) return true
          const sp = pagesBySpace.get(s.id) ?? []
          return (
            s.title.toLowerCase().includes(q) ||
            sp.some((p) => p.title.toLowerCase().includes(q))
          )
        })
        .sort((a, b) => a.title.localeCompare(b.title, 'nb')),
    [spaces, q, pagesBySpace],
  )

  const isCollapsed = (spaceId: string) =>
    q ? false : collapsed.has(spaceId) && spaceId !== activeSpaceId

  return (
    <ModuleSectionCard className="!p-0 sticky top-4 self-start">
      <div className="border-b border-neutral-100 px-3 py-3">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <StandardInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="!py-1.5 !pl-8 !text-xs"
            placeholder="Filtrer sider…"
          />
        </div>
      </div>
      <div className="max-h-[760px] overflow-y-auto px-2 py-2 text-sm">
        {visibleSpaces.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-neutral-400">Ingen treff.</p>
        ) : null}
        {visibleSpaces.map((space) => {
          const spacePages = (pagesBySpace.get(space.id) ?? []).filter(
            (p) => !q || p.title.toLowerCase().includes(q) || space.title.toLowerCase().includes(q),
          )
          const open = !isCollapsed(space.id)
          return (
            <div key={space.id}>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    if (next.has(space.id)) next.delete(space.id)
                    else next.add(space.id)
                    return next
                  })
                }
                className="group flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-[13px] text-neutral-700 hover:bg-neutral-100"
              >
                {open ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                )}
                <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                <span className="flex-1 truncate text-left font-medium">{space.title}</span>
                <span className="text-[10px] tabular-nums text-neutral-400">{spacePages.length}</span>
              </button>
              {open
                ? spacePages.map((page) => {
                    const active = page.id === activePageId
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => navigate(`/documents/page/${page.id}`)}
                        className={`flex w-full items-center gap-1 rounded-md py-1 pr-1.5 text-[13px] ${
                          active
                            ? 'bg-[#e6f2f0] font-semibold text-[#0f766e]'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                        style={{ paddingLeft: 28 }}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                        <span className="flex-1 truncate text-left">{page.title}</span>
                      </button>
                    )
                  })
                : null}
            </div>
          )
        })}
      </div>
    </ModuleSectionCard>
  )
}
