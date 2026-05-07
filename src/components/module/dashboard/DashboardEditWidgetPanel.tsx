// DashboardEditWidgetPanel — per-widget config: rename, switch the
// chart type (where the dataset shape supports it), and resize the
// widget on the dashboard grid.
//
// Compatible-kind heuristic — keep simple in v1:
//   - segments-shaped dataset (Record<label, number>): donut ↔ bar ↔ table
//   - kpi-record dataset: kpi only (table possible later)
//   - line-shaped dataset (array of {x,y}): line only
// Caller can override via `compatibleKinds`.

import { useState } from 'react'
import { SlidePanel } from '../../layout/SlidePanel'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../../layout/WorkplaceStandardFormPanel'
import type {
  ReportModule,
  ReportModuleColSpan,
  ReportModuleKind,
} from '../../../types/reportBuilder'

type Props = {
  open: boolean
  widget: ReportModule | null
  onClose: () => void
  onSave: (next: ReportModule) => Promise<boolean> | boolean
  /**
   * Optional override list of kinds the widget can switch to. When
   * undefined the panel falls back to a "same kind only" rule.
   */
  compatibleKinds?: ReportModuleKind[]
}

const COL_SPAN_OPTIONS: { value: ReportModuleColSpan; label: string }[] = [
  { value: 'sm', label: 'Smal (1/4 bred)' },
  { value: 'md', label: 'Standard (1/2 bred)' },
  { value: 'lg', label: 'Bred (3/4 bred)' },
  { value: 'full', label: 'Full bredde' },
]

const KIND_LABELS: Record<ReportModuleKind, string> = {
  kpi: 'KPI-tall',
  bar: 'Søylediagram',
  donut: 'Kakediagram',
  line: 'Linjediagram',
  table: 'Tabell',
}

export function DashboardEditWidgetPanel({
  open,
  widget,
  onClose,
  onSave,
  compatibleKinds,
}: Props) {
  const [title, setTitle] = useState(widget?.title ?? '')
  const [colSpan, setColSpan] = useState<ReportModuleColSpan>(widget?.colSpan ?? 'md')
  const [kind, setKind] = useState<ReportModuleKind>(widget?.kind ?? 'kpi')
  const [submitting, setSubmitting] = useState(false)

  // Resync when target widget changes (set-state-during-render pattern;
  // avoids a useEffect that the React Compiler flags).
  const [lastId, setLastId] = useState(widget?.id ?? null)
  if (widget && widget.id !== lastId) {
    setLastId(widget.id)
    setTitle(widget.title)
    setColSpan(widget.colSpan ?? 'md')
    setKind(widget.kind)
  }

  if (!widget) return null

  const kindOptions = (compatibleKinds ?? [widget.kind]).map((k) => ({
    value: k,
    label: KIND_LABELS[k],
  }))

  const canSwitchKind = kindOptions.length > 1

  const handleSave = async () => {
    setSubmitting(true)
    try {
      // Type narrowing: when switching kinds we synthesise the missing
      // fields conservatively. The renderer is forgiving — bar widgets
      // with empty seriesKeys infer them at render time, donut with
      // empty segmentsPath uses the dataset directly, etc.
      let next: ReportModule
      if (kind === widget.kind) {
        next = { ...widget, title, colSpan }
      } else if (kind === 'donut') {
        next = {
          id: widget.id,
          title,
          datasetKey: widget.datasetKey,
          colSpan,
          kind: 'donut',
          segmentsPath: '',
        }
      } else if (kind === 'bar') {
        next = {
          id: widget.id,
          title,
          datasetKey: widget.datasetKey,
          colSpan,
          kind: 'bar',
          seriesKeys: [],
        }
      } else if (kind === 'table') {
        next = {
          id: widget.id,
          title,
          datasetKey: widget.datasetKey,
          colSpan,
          kind: 'table',
          rowKeys: [],
        }
      } else if (kind === 'line') {
        next = {
          id: widget.id,
          title,
          datasetKey: widget.datasetKey,
          colSpan,
          kind: 'line',
          pointsPath: '',
        }
      } else {
        // kpi — preserve valuePath if the widget already had one, else
        // default to a numeric leaf the renderer will probe.
        const valuePath = widget.kind === 'kpi' ? widget.valuePath : ''
        next = {
          id: widget.id,
          title,
          datasetKey: widget.datasetKey,
          colSpan,
          kind: 'kpi',
          valuePath,
        }
      }
      const ok = await onSave(next)
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="dashboard-edit-widget"
      title={`Rediger ${widget.title}`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={submitting}>
            {submitting ? 'Lagrer …' : 'Lagre'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="widget-title">
            Tittel
          </label>
          <StandardInput
            id="widget-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Visualisering</label>
          {canSwitchKind ? (
            <SearchableSelect
              value={kind}
              options={kindOptions}
              onChange={(v) => setKind(v as ReportModuleKind)}
            />
          ) : (
            <p className="mt-1 text-xs text-neutral-500">
              {KIND_LABELS[widget.kind]} — denne datatypen støtter bare denne visualiseringen.
            </p>
          )}
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Bredde</label>
          <SearchableSelect
            value={colSpan}
            options={COL_SPAN_OPTIONS}
            onChange={(v) => setColSpan(v as ReportModuleColSpan)}
          />
          <p className="mt-1 text-xs text-neutral-500">
            På store skjermer plasseres widgetene i et 12-kolonners rutenett. På
            mindre skjermer flyter alle som én kolonne.
          </p>
        </div>

        <div className="rounded-md border border-neutral-200 bg-neutral-50/50 p-3 text-xs text-neutral-600">
          <p>
            <span className="font-mono">{widget.datasetKey}</span> — datakilden er låst.
            Bytt widget for å bruke en annen datakilde.
          </p>
        </div>
      </div>
    </SlidePanel>
  )
}

