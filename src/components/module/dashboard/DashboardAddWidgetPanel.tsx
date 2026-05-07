// DashboardAddWidgetPanel — slide-panel UX for adding a widget from
// the registered scope's catalog. Lists every catalog entry grouped by
// `category`; supports text search; clicking "Legg til" instantiates a
// fresh ReportModule (registry mints the id) and appends it to the
// current layout via onAdd.

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { SlidePanel } from '../../layout/SlidePanel'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { Badge } from '../../ui/Badge'
import {
  getDashboardScope,
  instantiateWidget,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'
import type { ReportModule } from '../../../types/reportBuilder'

type Props = {
  open: boolean
  onClose: () => void
  scopeId: string
  /** Called with the newly instantiated module — caller appends to layout + saves. */
  onAdd: (next: ReportModule) => Promise<boolean> | boolean
}

export function DashboardAddWidgetPanel({ open, onClose, scopeId, onAdd }: Props) {
  const scope = getDashboardScope(scopeId)
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState<string | null>(null)

  const grouped = useMemo(() => {
    if (!scope) return [] as { category: string; entries: WidgetCatalogEntry[] }[]
    const q = query.trim().toLowerCase()
    const matches = scope.widgetCatalog.filter((e) => {
      if (!q) return true
      return (
        e.label.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.template.datasetKey.toLowerCase().includes(q)
      )
    })
    const byCat = new Map<string, WidgetCatalogEntry[]>()
    for (const e of matches) {
      const list = byCat.get(e.category) ?? []
      list.push(e)
      byCat.set(e.category, list)
    }
    return [...byCat.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'nb'))
      .map(([category, entries]) => ({
        category,
        entries: entries.sort((a, b) => a.label.localeCompare(b.label, 'nb')),
      }))
  }, [scope, query])

  const handleAdd = async (entry: WidgetCatalogEntry) => {
    setSubmitting(entry.catalogId)
    try {
      const widget = instantiateWidget(entry)
      const ok = await onAdd(widget)
      if (ok) onClose()
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="dashboard-add-widget"
      title="Legg til widget"
      footer={
        <div className="flex w-full justify-end">
          <Button variant="secondary" onClick={onClose}>
            Lukk
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <StandardInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk etter widget …"
            className="pl-9"
            aria-label="Søk widget"
          />
        </div>

        {!scope ? (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            Ingen widgets registrert for dette området ennå.
          </p>
        ) : grouped.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
            Ingen treff på «{query}».
          </p>
        ) : (
          grouped.map((g) => (
            <div key={g.category}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                {g.category}
              </p>
              <ul className="space-y-2">
                {g.entries.map((entry) => {
                  const isSubmitting = submitting === entry.catalogId
                  return (
                    <li
                      key={entry.catalogId}
                      className="flex items-start gap-3 rounded-lg border border-neutral-200/80 bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900">{entry.label}</p>
                        {entry.description ? (
                          <p className="mt-1 text-xs text-neutral-600">{entry.description}</p>
                        ) : null}
                        <p className="mt-1.5 text-xs text-neutral-500">
                          <Badge variant="neutral">{entry.template.kind}</Badge>{' '}
                          <span className="ml-1 font-mono">{entry.template.datasetKey}</span>
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => void handleAdd(entry)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? '…' : 'Legg til'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </SlidePanel>
  )
}
