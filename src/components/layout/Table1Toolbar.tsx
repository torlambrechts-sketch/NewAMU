import { useState, type ReactNode } from 'react'
import { Check, Filter, Search, Settings } from 'lucide-react'
import type { LayoutLabPayload } from '../../types/layoutLab'
import { DEFAULT_TABLE_1_TOOLBAR } from '../../types/layoutLab'
import { mergeLayoutPayload } from '../../lib/layoutLabTokens'
import { useUiThemeOptional } from '../../hooks/useUiTheme'
import { DEFAULT_LAYOUT_LAB } from '../../types/layoutLab'

type Props = {
  payloadOverride?: LayoutLabPayload
  searchSlot?: ReactNode
  segmentSlot?: ReactNode
}

function toolbarFromPayload(p: LayoutLabPayload) {
  return { ...DEFAULT_TABLE_1_TOOLBAR, ...p.table_1?.toolbar }
}

export function Table1Toolbar({ payloadOverride, searchSlot, segmentSlot }: Props) {
  const ctx = useUiThemeOptional()
  const merged = mergeLayoutPayload(payloadOverride ?? ctx?.payload ?? DEFAULT_LAYOUT_LAB)
  const tb = toolbarFromPayload(merged)
  const accent = merged.accent || DEFAULT_LAYOUT_LAB.accent
  const rMd =
    merged.radius === 'sm' ? 'rounded-sm' : merged.radius === 'md' ? 'rounded-md' : 'rounded-lg'

  const [demoSegment, setDemoSegment] = useState<'all' | 'b' | 'c'>('all')

  const hasTop = tb.search || tb.advanced || tb.filters
  const hasBottom = tb.segments || segmentSlot

  if (!hasTop && !tb.helpText && !hasBottom) {
    return null
  }

  return (
    <div className="border-b border-neutral-100">
      {hasTop && (
        <div className="flex flex-wrap items-center gap-3 p-4">
          {tb.search ? searchSlot : null}
          {tb.advanced && (
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50 ${rMd}`}
            >
              <Search className="size-3.5" /> Avansert
            </button>
          )}
          {tb.filters && (
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:bg-neutral-50 ${rMd}`}
            >
              <Filter className="size-3.5" /> Filtre
            </button>
          )}
        </div>
      )}
      {tb.helpText && (
        <p className="px-4 pb-2 text-xs text-neutral-500">
          Kombiner søk, filtre og segment for å snevre inn listen.
        </p>
      )}
      {hasBottom && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-1">
          <div className="min-w-0 flex-1">
            {segmentSlot
              ? segmentSlot
              : tb.segments && (
                  <div className={`inline-flex border border-neutral-200 bg-neutral-50/80 p-1 ${rMd}`}>
                    {(
                      [
                        ['all', 'Alle'],
                        ['b', 'Gruppe B'],
                        ['c', 'Gruppe C'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDemoSegment(id)}
                        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition ${rMd} ${
                          demoSegment === id ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-white'
                        }`}
                        style={demoSegment === id ? { backgroundColor: accent, color: '#fff' } : undefined}
                      >
                        {demoSegment === id ? (
                          <span className="flex size-4 items-center justify-center rounded-full bg-white/20">
                            <Check className="size-3" />
                          </span>
                        ) : (
                          <span className="size-4 rounded-full border-2 border-neutral-300" />
                        )}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
          </div>
          {(tb.segments || segmentSlot) && (
            <button
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-700 hover:bg-neutral-50 ${rMd}`}
            >
              <Settings className="size-3.5" /> Konfigurer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
