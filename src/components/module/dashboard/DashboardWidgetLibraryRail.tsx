// DashboardWidgetLibraryRail — sticky right rail version of
// DashboardAddWidgetPanel for the V3 (edit-mode) dashboard layout. Same
// catalog → click-to-add flow, but rendered inline next to the grid
// instead of as a slide-over.
//
// Klarert dashboard design kit · ui_kits/dashboard/VariationCanvas.jsx ·
// `WidgetLibraryRail`. The kit shows the rail always-visible in edit
// mode; we follow that pattern.

import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect } from '../../ui/SearchableSelect'
import {
  getDashboardScope,
  instantiateWidget,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'
import type { ReportModule, ReportModuleKind } from '../../../types/reportBuilder'
import { defaultCompatibleKinds } from './dashboardWidgetKinds'

type Props = {
  scopeId: string
  /** Called with the newly instantiated module — caller appends to layout + saves. */
  onAdd: (next: ReportModule) => Promise<boolean> | boolean
  /** Optional close button — when set, renders an X in the rail header. */
  onClose?: () => void
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
  compliance_paragraph_grid: 'Paragraf-rutenett',
}

export function DashboardWidgetLibraryRail({ scopeId, onAdd, onClose }: Props) {
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
        (e.description ?? '').toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
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
      const final = (
        desiredKind === entry.template.kind
          ? widget
          : { ...(widget as Record<string, unknown>), kind: desiredKind }
      ) as ReportModule
      await onAdd(final)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <aside
      className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[280px] shrink-0 flex-col rounded-xl border border-neutral-200 bg-white shadow-sm xl:flex"
      aria-label="Widget-bibliotek"
    >
      <header className="flex items-center justify-between border-b border-neutral-200/80 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Legg til widget
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Klikk for å legge til</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Lukk widget-bibliotek"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div className="border-b border-neutral-100 px-4 py-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <StandardInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk widgets …"
            className="pl-8 text-sm"
            aria-label="Søk widget"
          />
        </div>
        {scope?.datasets && scope.datasets.length > 0 ? (
          <div className="mt-2">
            <SearchableSelect
              value={shapeFilter}
              options={[
                { value: '', label: 'Alle datakilder' },
                ...[...new Set(scope.datasets.map((d) => d.shape))].map((s) => ({
                  value: s,
                  label: SHAPE_LABEL[s],
                })),
              ]}
              onChange={(v) => setShapeFilter((v as DatasetMeta['shape']) || '')}
              placeholder="Alle datakilder"
            />
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {!scope ? (
          <p className="text-xs text-neutral-500">Ingen scope registrert.</p>
        ) : grouped.length === 0 ? (
          <p className="text-xs text-neutral-500">Ingen treff.</p>
        ) : (
          grouped.map(({ category, entries }) => (
            <div key={category}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {category}
              </p>
              <div className="space-y-1.5">
                {entries.map((entry) => {
                  const compatible = compatibleFor(entry)
                  const activeKind = kindOverride[entry.catalogId] ?? entry.template.kind
                  return (
                    <div
                      key={entry.catalogId}
                      draggable
                      onDragStart={(e) => {
                        // Custom MIME so the grid drop handler can
                        // distinguish library drops from any other text
                        // drag the user might initiate. Plain text is a
                        // fallback for browsers that ignore custom types.
                        e.dataTransfer.effectAllowed = 'copy'
                        e.dataTransfer.setData(
                          'application/x-klarert-catalog-id',
                          `${entry.catalogId}::${activeKind}`,
                        )
                        e.dataTransfer.setData(
                          'text/plain',
                          `klarert-widget:${entry.catalogId}::${activeKind}`,
                        )
                      }}
                      title="Klikk + eller dra inn i oppsettet"
                      className="cursor-grab rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-[#1a3d32] hover:bg-[#1a3d32]/[0.02] active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            {entry.label}
                          </p>
                          {entry.description ? (
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
                              {entry.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleAdd(entry)}
                          disabled={submitting === entry.catalogId}
                          aria-label={`Legg til ${entry.label}`}
                          className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-[#1a3d32] hover:text-white disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {compatible.length > 1 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {compatible.map((k) => {
                            const on = k === activeKind
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() =>
                                  setKindOverride((s) => ({ ...s, [entry.catalogId]: k }))
                                }
                                className={
                                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ' +
                                  (on
                                    ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50')
                                }
                              >
                                {KIND_LABEL[k]}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="border-t border-neutral-100 px-4 py-3">
        <p className="text-[11px] text-neutral-500">
          Tips: klikk + eller dra widgeten inn i oppsettet.
        </p>
      </footer>
    </aside>
  )
}
