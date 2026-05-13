/**
 * Dataset key — the lookup key into the runtime's `datasets` map.
 *
 * Was a closed string union; opened to plain `string` so individual
 * scopes (compliance_checklist, survey, …) can register their own
 * keys without touching this core type. Convention: namespace with the
 * scope id, e.g. `checklist:executions_by_status`. Older keys without
 * the prefix continue to work since this is just a lookup string.
 */
export type ReportDatasetKey = string

export type ReportModuleKind =
  | 'kpi'
  | 'table'
  | 'bar'
  | 'donut'
  | 'line'
  | 'heatmap'
  | 'scorecard'

/**
 * Widget layout hint, mapped to a 12-column responsive grid by the
 * dashboard runtime.
 *   sm    →  3 cols  (KPI tile, 4-up on lg)
 *   md    →  6 cols  (donut, bar — 2-up on lg)
 *   lg    →  9 cols  (wide chart with side legend)
 *   full  → 12 cols  (table, single highlight chart)
 * Defaults to 'md' when omitted so existing layouts keep their look.
 */
export type ReportModuleColSpan = 'sm' | 'md' | 'lg' | 'full'

export type ReportModuleBase = {
  id: string
  title: string
  /** Optional context line under the title (e.g. "Last 12 months · Grouped by pack"). */
  subtitle?: string
  datasetKey: ReportDatasetKey
  /** Visual width on the dashboard grid (lg breakpoint). */
  colSpan?: ReportModuleColSpan
  /** Force this widget to start on a new grid row (visual section break). */
  rowBreak?: boolean
}

export type ReportModuleKpi = ReportModuleBase & {
  kind: 'kpi'
  /** Dot-path into resolved dataset for numeric value, e.g. "activeEmployees" */
  valuePath: string
  subtitle?: string
  /**
   * Optional dataset key holding the comparison value (e.g. previous period).
   * When omitted, the renderer reads `comparisonValuePath` against the same
   * dataset as `valuePath` — useful when the page bakes both numbers into a
   * single kpi-record (`{ current: 12, previous: 10 }`).
   */
  comparisonDatasetKey?: string
  /** Dot-path to the comparison number. Renders no delta when unset. */
  comparisonValuePath?: string
  /** Free text shown next to the delta chip (e.g. "vs. forrige måned"). */
  comparisonLabel?: string
  /**
   * Whether higher = better. 'increase' colours upward deltas green,
   * 'decrease' inverts (e.g. "antall kritiske avvik"). Defaults to 'increase'.
   */
  comparisonGoal?: 'increase' | 'decrease'
  /** Optional dataset key for the inline sparkline trend (defaults to the KPI dataset). */
  sparklineDatasetKey?: string
  /** Dot-path to an array of `{ x, y }` points for the inline sparkline. */
  sparklinePath?: string
}

export type ReportModuleTable = ReportModuleBase & {
  kind: 'table'
  rowKeys: string[]
}

export type ReportModuleBar = ReportModuleBase & {
  kind: 'bar'
  /** Keys in dataset object whose values are numbers */
  seriesKeys: string[]
  /**
   * When set, segments become clickable and the runtime emits a
   * drill-down event tagged with this dimension id. The page receives the
   * raw segment label and decides how to translate it into a chip value.
   */
  drillDimensionId?: string
}

export type ReportModuleDonut = ReportModuleBase & {
  kind: 'donut'
  /** Path to array of { label, value } */
  segmentsPath: string
  /**
   * When set, slices become clickable and the runtime emits a
   * drill-down event tagged with this dimension id (see Bar above).
   */
  drillDimensionId?: string
}

export type ReportModuleLine = ReportModuleBase & {
  kind: 'line'
  /**
   * Path to an array of { x: string|number; y: number } points. When
   * empty string, the dataset itself is treated as the array.
   */
  pointsPath: string
  /** Optional axis labels. */
  xLabel?: string
  yLabel?: string
  /** Optional dataset key holding the comparison series (defaults to the line dataset). */
  comparisonDatasetKey?: string
  /** Dot-path to the comparison `{ x, y }[]` series. Renders dashed alongside the primary path. */
  comparisonPointsPath?: string
  /** Legend label for the primary series (defaults to `title`). */
  primaryLabel?: string
  /** Legend label for the comparison series. */
  comparisonLabel?: string
}

/**
 * Two-dimensional grid where each cell is colour-coded by its numeric value.
 * Default shape consumed: `{ rows: string[]; columns: string[]; cells: number[][] }`
 * — `cells[r][c]` is the value at row `r` × column `c`. When any of `rowsPath`,
 * `columnsPath`, or `cellsPath` are non-empty, the renderer reads from that
 * dot-path inside the resolved dataset instead of the top-level keys.
 *
 * Values are min-maxed across the visible grid; pass `valueMax` to lock the
 * upper bound (e.g. 1 for completion ratios, 100 for score-out-of-100).
 */
export type ReportModuleHeatmap = ReportModuleBase & {
  kind: 'heatmap'
  rowsPath?: string
  columnsPath?: string
  cellsPath?: string
  /** Optional explicit value range; clamps colour scale. */
  valueMin?: number
  valueMax?: number
  /** Tooltip label for the value (e.g. "Fullført %"). */
  valueLabel?: string
}

/**
 * Scorecard widget — category-grouped cards with per-row status pills.
 * Dataset shape consumed: `Array<{ category, total, covered, partial?,
 * needsAttention?, rows: Array<{ id, label, title?, applies?,
 * obligation?, status }> }>`. `status` ∈ 'covered'|'partial'|'only_avvik'
 * |'uncovered'. When `groupsPath` is empty the dataset itself is the array.
 * Row clicks emit a drill-down event tagged with `drillDimensionId`,
 * carrying `row.id` as the `segmentLabel`.
 */
export type ReportModuleScorecard = ReportModuleBase & {
  kind: 'scorecard'
  groupsPath?: string
  drillDimensionId?: string
}

export type ReportModule =
  | ReportModuleKpi
  | ReportModuleTable
  | ReportModuleBar
  | ReportModuleDonut
  | ReportModuleLine
  | ReportModuleHeatmap
  | ReportModuleScorecard

export type CustomReportTemplate = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  modules: ReportModule[]
  /** DB `report_definitions.version` for optimistic locking (remote only). */
  rowVersion?: number
}

export type ReportBuilderPayload = {
  templates: CustomReportTemplate[]
}
