// DashboardAddWidgetPanel — slide-panel UX for adding a widget from
// the registered scope's catalog. Lists every catalog entry grouped by
// `category`; supports text search; clicking "Legg til" instantiates a
// fresh ReportModule (registry mints the id) and appends it to the
// current layout via onAdd.
//
// Dataset-shape-aware (3.2.7): a "Datakilde" filter narrows the catalog
// by the underlying dataset shape (kpi-record / segments / series / rows),
// and entries that declare `compatibleKinds` show a kind selector so the
// user can instantiate the same dataset as e.g. a donut OR a bar.

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { SlidePanel } from '../../layout/SlidePanel'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { Badge } from '../../ui/Badge'
import {
  getDashboardScope,
  instantiateWidget,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'
import type { ReportModule, ReportModuleKind } from '../../../types/reportBuilder'
import { defaultCompatibleKinds } from './dashboardWidgetKinds'

type Props = {
  open: boolean
  onClose: () => void
  scopeId: string
  /** Called with the newly instantiated module — caller appends to layout + saves. */
  onAdd: (next: ReportModule) => Promise<boolean> | boolean
}

const SHAPE_LABEL: Record<DatasetMeta['shape'], string> = {
  'kpi-record': 'KPI-tall',
  segments: 'Segmenter',
  series: 'Tidsserie',
  rows: 'Rader',
}

const KIND_LABEL: Record<ReportModuleKind, string> = {
  kpi: 'KPI',
  bar: 'Søylediagram',
  donut: 'Kakediagram',
  line: 'Linjediagram',
  table: 'Tabell',
  heatmap: 'Heatmap',
  scorecard: 'Scorecard',
  bowtie: 'Bowtie',
  benchmark: 'Benchmark',
}

export function DashboardAddWidgetPanel({ open, onClose, scopeId, onAdd }: Props) {
  const scope = getDashboardScope(scopeId)
  const [query, setQuery] = useState('')
  const [shapeFilter, setShapeFilter] = useState<DatasetMeta['shape'] | ''>('')
  const [kindOverride, setKindOverride] = useState<Record<string, ReportModuleKind>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  const datasetShapeByKey = useMemo(() => {
    const m = new Map<string, DatasetMeta['shape']>()
    for (const d of scope?.datasets ?? []) m.set(d.key, d.shape)
    return m
  }, [scope])

  const compatibleFor = (entry: WidgetCatalogEntry): ReportModuleKind[] =>
    entry.compatibleKinds && entry.compatibleKinds.length > 0
      ? entry.compatibleKinds
      : defaultCompatibleKinds(entry.template.kind)

  const grouped = useMemo(() => {
    if (!scope) return [] as { category: string; entries: WidgetCatalogEntry[] }[]
    const q = query.trim().toLowerCase()
    const matches = scope.widgetCatalog.filter((e) => {
      if (shapeFilter) {
        const shape = datasetShapeByKey.get(e.template.datasetKey)
        if (shape !== shapeFilter) return false
      }
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
  }, [scope, query, shapeFilter, datasetShapeByKey])

  const handleAdd = async (entry: WidgetCatalogEntry) => {
    setSubmitting(entry.catalogId)
    try {
      const desiredKind = kindOverride[entry.catalogId] ?? entry.template.kind
      const widget = instantiateWidget(entry)
      // Apply kind override when the user picked a different compatible
      // kind from the dropdown. Cast is safe because compatibleFor()
      // gates the dropdown to kinds the dataset shape supports.
      const final = (
        desiredKind === entry.template.kind
          ? widget
          : { ...(widget as Record<string, unknown>), kind: desiredKind }
      ) as ReportModule
      const ok = await onAdd(final)
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

        {/* Shape filter (3.2.7). Datasets the scope publishes drive the
            options — narrows the catalog to "what can I do with this
            kind of data?" */}
        {scope?.datasets && scope.datasets.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Datakilde
            </span>
            <div className="min-w-[200px]">
              <SearchableSelect
                value={shapeFilter}
                options={[
                  { value: '', label: 'Alle' },
                  ...[...new Set(scope.datasets.map((d) => d.shape))].map((s) => ({
                    value: s,
                    label: SHAPE_LABEL[s],
                  })),
                ]}
                onChange={(v) => setShapeFilter((v as DatasetMeta['shape']) || '')}
                placeholder="Alle"
              />
            </div>
          </div>
        ) : null}

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
                  const compatible = compatibleFor(entry)
                  const datasetShape = datasetShapeByKey.get(entry.template.datasetKey)
                  const selectedKind =
                    kindOverride[entry.catalogId] ?? entry.template.kind
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
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                          <Badge variant="neutral">
                            {KIND_LABEL[selectedKind] ?? selectedKind}
                          </Badge>
                          {datasetShape ? (
                            <Badge variant="neutral">{SHAPE_LABEL[datasetShape]}</Badge>
                          ) : null}
                          <span className="ml-1 font-mono">{entry.template.datasetKey}</span>
                        </p>
                        {/* Kind override (3.2.7) — only when the entry has
                            more than one compatible kind. */}
                        {compatible.length > 1 ? (
                          <div className="mt-2 max-w-[220px]">
                            <SearchableSelect
                              value={selectedKind}
                              options={compatible.map((k) => ({
                                value: k,
                                label: KIND_LABEL[k] ?? k,
                              }))}
                              onChange={(v) =>
                                setKindOverride((prev) => ({
                                  ...prev,
                                  [entry.catalogId]: v as ReportModuleKind,
                                }))
                              }
                              aria-label="Vis som"
                            />
                          </div>
                        ) : null}
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
