import type { ReactNode } from 'react'
import { LayoutScoreStatRow } from '../layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../layout/platformLayoutKit'
import { LayoutTable1PostingsShell } from '../layout/LayoutTable1PostingsShell'
import { ModuleSectionCard } from './ModuleSectionCard'

/**
 * Module records table with a KPI row stacked on top.
 *
 * This is the composition used by ROS «Tiltak» and ROS «Farekilder» — a row of
 * 3–4 KPI tiles above a `LayoutTable1PostingsShell` that wraps the records
 * table. Reuse this for every module records view (Inspeksjonsrunder avvik,
 * ROS tiltak, ROS farekilder, future SJA/Avvik lists …) so the spacing,
 * typography, toolbar and title chrome stay identical.
 *
 * Pass the actual `<table>…</table>` as `children` — the shell handles the
 * KPI tiles, the white card surround, and the table title/toolbar/footer.
 */
export interface ModuleRecordsTableShellProps {
  /** KPI tiles rendered above the table. Typically 3–4 items. */
  kpiItems?: LayoutScoreStatItem[]
  /** Table title (rendered inside the postings shell header row). */
  title: string
  description?: string
  /** Optional right-aligned content in the title row (e.g. «+ Nytt avvik» CTA). */
  headerActions?: ReactNode
  /** Toolbar row below the title — e.g. filter chips, search input. */
  toolbar: ReactNode
  /** Optional footer strip (e.g. «N treff»). */
  footer?: ReactNode
  /** The `<table>` JSX for the records. */
  children: ReactNode
  /**
   * When `true` (default) the shell and KPIs share a white card surround,
   * matching ROS tiltak/farekilder. Set to `false` to render without the
   * outer card, e.g. when the consumer already provides one.
   */
  wrapInCard?: boolean
  /** Optional override for the postings shell's title typography. */
  titleTypography?: 'serif' | 'sans'
}

export function ModuleRecordsTableShell({
  kpiItems,
  title,
  description,
  headerActions,
  toolbar,
  footer,
  children,
  wrapInCard = true,
  titleTypography = 'sans',
}: ModuleRecordsTableShellProps) {
  const kpi = kpiItems && kpiItems.length > 0 ? <LayoutScoreStatRow items={kpiItems} /> : null

  const tableShell = (
    <LayoutTable1PostingsShell
      wrap={false}
      titleTypography={titleTypography}
      title={title}
      description={description}
      headerActions={headerActions}
      toolbar={toolbar}
      footer={footer}
    >
      {children}
    </LayoutTable1PostingsShell>
  )

  if (wrapInCard) {
    return (
      <div className="space-y-6">
        {kpi}
        <ModuleSectionCard>{tableShell}</ModuleSectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {kpi}
      {tableShell}
    </div>
  )
}
