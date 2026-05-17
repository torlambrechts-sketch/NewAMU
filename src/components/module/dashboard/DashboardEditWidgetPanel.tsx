// DashboardEditWidgetPanel — per-widget config: rename, set subtitle,
// switch chart type (where the dataset shape supports it), pick
// colSpan / rowBreak, and live-preview the result before saving.
//
// Lossless kind switching: when the user flips kpi → bar → kpi, the
// kpi's `valuePath` (and other kind-specific fields) are preserved
// under `_archive` so a round-trip restores the previous config.
//
// Caller passes `datasets` so the live preview renders against real
// data. Duplicate / Remove buttons hand the current widget back to the
// page; the editor closes after either.

import { useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { SlidePanel } from '../../layout/SlidePanel'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { ToggleSwitch } from '../../ui/FormToggles'
import { WPSTD_FORM_FIELD_LABEL } from '../../layout/WorkplaceStandardFormPanel'
import { ReportModuleWidget } from '../../reports/ReportModuleWidget'
import type {
  ReportModule,
  ReportModuleColSpan,
  ReportModuleKind,
} from '../../../types/reportBuilder'

type Props = {
  open: boolean
  widget: ReportModule | null
  /** Live datasets for the preview — typically the same map the page renders. */
  datasets: Record<string, unknown>
  onClose: () => void
  onSave: (next: ReportModule) => Promise<boolean> | boolean
  onDuplicate?: (widget: ReportModule) => void
  onRemove?: (widget: ReportModule) => void
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
  heatmap: 'Heatmap',
  scorecard: 'Scorecard',
  bowtie: 'Bowtie',
  benchmark: 'Benchmark (anonymisert)',
}

// ── Lossless kind-switch helpers ────────────────────────────────────────────
// We stash the kind-specific fields in a hidden `_archive` keyed by the
// previous kind so flipping back restores the user's config (e.g. the
// kpi valuePath, the donut segmentsPath).

type Archive = Partial<Record<ReportModuleKind, Record<string, unknown>>>

function archiveOf(m: ReportModule): Archive {
  const a = (m as ReportModule & { _archive?: Archive })._archive
  return a && typeof a === 'object' ? a : {}
}

function snapshotKindSpecifics(m: ReportModule): Record<string, unknown> {
  if (m.kind === 'kpi') return { valuePath: m.valuePath, subtitle: m.subtitle }
  if (m.kind === 'bar') return { seriesKeys: m.seriesKeys }
  if (m.kind === 'donut') return { segmentsPath: m.segmentsPath }
  if (m.kind === 'line') return { pointsPath: m.pointsPath, xLabel: m.xLabel, yLabel: m.yLabel }
  if (m.kind === 'table') return { rowKeys: m.rowKeys }
  if (m.kind === 'scorecard' || m.kind === 'bowtie') {
    return { groupsPath: m.groupsPath, drillDimensionId: m.drillDimensionId }
  }
  if (m.kind === 'benchmark') {
    return { metric: m.metric, valueLabel: m.valueLabel, goalDirection: m.goalDirection }
  }
  return {}
}

function buildSwitched(
  source: ReportModule,
  nextKind: ReportModuleKind,
  base: { title: string; subtitle: string | undefined; colSpan: ReportModuleColSpan; rowBreak: boolean },
): ReportModule {
  const archive: Archive = {
    ...archiveOf(source),
    [source.kind]: snapshotKindSpecifics(source),
  }
  const restored = archive[nextKind] ?? {}
  const common = {
    id: source.id,
    title: base.title,
    datasetKey: source.datasetKey,
    colSpan: base.colSpan,
    rowBreak: base.rowBreak,
    subtitle: base.subtitle,
    _archive: archive,
  } as const

  if (nextKind === 'kpi') {
    return {
      ...common,
      kind: 'kpi',
      valuePath: (restored.valuePath as string) ?? '',
    } as ReportModule
  }
  if (nextKind === 'bar') {
    return {
      ...common,
      kind: 'bar',
      seriesKeys: (restored.seriesKeys as string[]) ?? [],
    } as ReportModule
  }
  if (nextKind === 'donut') {
    return {
      ...common,
      kind: 'donut',
      segmentsPath: (restored.segmentsPath as string) ?? '',
    } as ReportModule
  }
  if (nextKind === 'line') {
    return {
      ...common,
      kind: 'line',
      pointsPath: (restored.pointsPath as string) ?? '',
      xLabel: restored.xLabel as string | undefined,
      yLabel: restored.yLabel as string | undefined,
    } as ReportModule
  }
  if (nextKind === 'heatmap') {
    return {
      ...common,
      kind: 'heatmap',
      rowsPath: restored.rowsPath as string | undefined,
      columnsPath: restored.columnsPath as string | undefined,
      cellsPath: restored.cellsPath as string | undefined,
      valueMin: restored.valueMin as number | undefined,
      valueMax: restored.valueMax as number | undefined,
      valueLabel: restored.valueLabel as string | undefined,
    } as ReportModule
  }
  if (nextKind === 'scorecard' || nextKind === 'bowtie') {
    return {
      ...common,
      kind: nextKind,
      groupsPath: (restored.groupsPath as string | undefined) ?? '',
      drillDimensionId: restored.drillDimensionId as string | undefined,
    } as ReportModule
  }
  if (nextKind === 'benchmark') {
    return {
      ...common,
      kind: 'benchmark',
      metric: (restored.metric as ReportModuleBenchmarkMetric | undefined) ?? 'findings_critical_per_org',
      valueLabel: restored.valueLabel as string | undefined,
      goalDirection: (restored.goalDirection as 'increase' | 'decrease' | undefined) ?? 'decrease',
    } as ReportModule
  }
  return {
    ...common,
    kind: 'table',
    rowKeys: (restored.rowKeys as string[]) ?? [],
  } as ReportModule
}

type ReportModuleBenchmarkMetric =
  | 'findings_critical_per_org'
  | 'vernerunder_per_quarter'
  | 'overdue_actions_pct'
  | 'course_certificates_per_employee'
  | 'sjekkliste_completion_pct'

// ── Component ──────────────────────────────────────────────────────────────

export function DashboardEditWidgetPanel({
  open,
  widget,
  datasets,
  onClose,
  onSave,
  onDuplicate,
  onRemove,
  compatibleKinds,
}: Props) {
  const [title, setTitle] = useState(widget?.title ?? '')
  const [subtitle, setSubtitle] = useState(widget?.subtitle ?? '')
  const [colSpan, setColSpan] = useState<ReportModuleColSpan>(widget?.colSpan ?? 'md')
  const [rowBreak, setRowBreak] = useState<boolean>(widget?.rowBreak ?? false)
  const [kind, setKind] = useState<ReportModuleKind>(widget?.kind ?? 'kpi')
  const [submitting, setSubmitting] = useState(false)

  const [lastId, setLastId] = useState(widget?.id ?? null)
  if (widget && widget.id !== lastId) {
    setLastId(widget.id)
    setTitle(widget.title)
    setSubtitle(widget.subtitle ?? '')
    setColSpan(widget.colSpan ?? 'md')
    setRowBreak(widget.rowBreak ?? false)
    setKind(widget.kind)
  }

  if (!widget) return null

  const kindOptions = (compatibleKinds ?? [widget.kind]).map((k) => ({
    value: k,
    label: KIND_LABELS[k],
  }))
  const canSwitchKind = kindOptions.length > 1

  const previewWidget: ReportModule =
    kind === widget.kind
      ? ({ ...widget, title, subtitle: subtitle || undefined, colSpan, rowBreak } as ReportModule)
      : buildSwitched(widget, kind, {
          title,
          subtitle: subtitle || undefined,
          colSpan,
          rowBreak,
        })

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const ok = await onSave(previewWidget)
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDuplicate = () => {
    if (!onDuplicate) return
    onDuplicate(previewWidget)
    onClose()
  }

  const handleRemove = () => {
    if (!onRemove) return
    if (!window.confirm(`Fjerne widgeten «${widget.title}» fra oppsettet?`)) return
    onRemove(widget)
    onClose()
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="dashboard-edit-widget"
      title={`Rediger ${widget.title}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {onDuplicate ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={handleDuplicate}
                disabled={submitting}
              >
                Dupliser
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={handleRemove}
                disabled={submitting}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Fjern
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Avbryt
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={submitting}>
              {submitting ? 'Lagrer …' : 'Lagre'}
            </Button>
          </div>
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
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="widget-subtitle">
            Kontekstlinje (valgfritt)
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            Vises under tittelen — f.eks. «Siste 12 måneder · Gruppert per pakke».
          </p>
          <StandardTextarea
            id="widget-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            rows={2}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Bredde</label>
            <SearchableSelect
              value={colSpan}
              options={COL_SPAN_OPTIONS}
              onChange={(v) => setColSpan(v as ReportModuleColSpan)}
            />
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Bryt rad</span>
            <p className="mb-1 mt-1 text-xs text-neutral-500">
              Tving widgeten til å starte på en ny rad i rutenettet.
            </p>
            <ToggleSwitch
              checked={rowBreak}
              onChange={setRowBreak}
              label="Bryt rad før denne widgeten"
            />
          </div>
        </div>

        <div className="rounded-md border border-neutral-200 bg-neutral-50/50 p-3 text-xs text-neutral-600">
          <p>
            Datakilde: <span className="font-mono">{widget.datasetKey}</span>. Bytt widget
            for å bruke en annen datakilde.
          </p>
        </div>

        {/* ── Live preview ──────────────────────────────────────────── */}
        <div>
          <p className={`${WPSTD_FORM_FIELD_LABEL} mb-2`}>Forhåndsvisning</p>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-3">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <ReportModuleWidget
                module={previewWidget}
                datasets={datasets}
                accent="#1a3d32"
                layoutMode="grid12"
                emptyLabel="Ingen data."
              />
            </div>
          </div>
        </div>
      </div>
    </SlidePanel>
  )
}
