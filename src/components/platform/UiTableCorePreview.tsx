import { useMemo, type CSSProperties } from 'react'
import type { UiTableCoreDesign } from '../../types/uiTableCore'

const DEMO_HEADERS = ['Kolonne A', 'Kolonne B', 'Status']
const DEMO_ROWS = [
  ['Verdi 1', 'Tekst', 'Åpen'],
  ['Verdi 2', 'Mer', 'Lukket'],
  ['Verdi 3', 'Data', 'Åpen'],
]

export function UiTableCorePreview({ design }: { design: UiTableCoreDesign }) {
  const shellStyle = useMemo((): CSSProperties => {
    const hasGrad = Boolean(design.shell.backgroundGradient?.trim())
    return {
      width: design.shell.width,
      maxWidth: design.shell.maxWidth,
      margin: design.shell.margin,
      padding: design.shell.padding,
      background: hasGrad ? design.shell.backgroundGradient : design.shell.backgroundColor,
      backgroundColor: hasGrad ? undefined : design.shell.backgroundColor,
      overflow: design.shell.overflow as CSSProperties['overflow'],
      borderWidth: design.borders.wrapperBorderWidth,
      borderStyle: design.borders.wrapperBorderStyle as CSSProperties['borderStyle'],
      borderColor: design.borders.wrapperBorderColor,
      borderRadius: design.borders.wrapperBorderRadius,
      boxShadow: design.borders.wrapperBoxShadow,
      backdropFilter: design.advancedVisuals.backdropFilter === 'none' ? undefined : design.advancedVisuals.backdropFilter,
      filter: design.advancedVisuals.filter === 'none' ? undefined : design.advancedVisuals.filter,
    }
  }, [design])

  const thStyle = useMemo((): CSSProperties => {
    const t = design.th
    return {
      padding: t.padding,
      fontSize: t.fontSize,
      fontWeight: t.fontWeight as CSSProperties['fontWeight'],
      lineHeight: t.lineHeight,
      letterSpacing: t.letterSpacing,
      textTransform: t.textTransform as CSSProperties['textTransform'],
      color: t.color,
      textAlign: t.textAlign as CSSProperties['textAlign'],
      borderBottomWidth: t.borderBottomWidth,
      borderBottomStyle: t.borderBottomStyle as CSSProperties['borderBottomStyle'],
      borderBottomColor: t.borderBottomColor,
      whiteSpace: t.whiteSpace as CSSProperties['whiteSpace'],
      cursor: design.interaction.headerCursor as CSSProperties['cursor'],
    }
  }, [design])

  const tdStyle = useMemo((): CSSProperties => {
    const t = design.td
    return {
      padding: t.padding,
      fontSize: t.fontSize,
      lineHeight: t.lineHeight,
      color: t.color,
      borderBottomWidth: t.borderBottomWidth,
      borderBottomStyle: t.borderBottomStyle as CSSProperties['borderBottomStyle'],
      borderBottomColor: t.borderBottomColor,
      verticalAlign: t.verticalAlign as CSSProperties['verticalAlign'],
      borderRight: design.borders.cellSeparator ? `1px solid ${design.borders.cellSeparatorColor}` : undefined,
    }
  }, [design])

  const theadStyle = useMemo((): CSSProperties => {
    return {
      backgroundColor: design.thead.backgroundColor,
      position: design.thead.position as CSSProperties['position'],
      zIndex: design.thead.zIndex === 'auto' ? undefined : Number(design.thead.zIndex) || undefined,
    }
  }, [design])

  return (
    <div style={shellStyle}>
      <table
        style={{
          width: design.table.width,
          borderCollapse: design.table.borderCollapse,
          tableLayout: design.table.tableLayout,
          borderSpacing: design.table.borderSpacing,
        }}
      >
        {design.caption.enabled ? (
          <caption
            style={{
              captionSide: design.caption.captionSide,
              color: design.caption.color,
              fontSize: design.caption.fontSize,
              fontWeight: design.caption.fontWeight as CSSProperties['fontWeight'],
              padding: design.caption.padding,
            }}
          >
            {design.caption.text}
          </caption>
        ) : null}
        <thead style={theadStyle}>
          <tr>
            {DEMO_HEADERS.map((h) => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEMO_ROWS.map((row, ri) => {
            const bg = design.tbody.zebra
              ? ri % 2 === 0
                ? design.tbody.oddRowBackground
                : design.tbody.evenRowBackground
              : design.tbody.oddRowBackground
            return (
              <tr
                key={ri}
                style={{
                  backgroundColor: bg,
                  transition: design.tbody.rowTransition,
                  cursor: design.interaction.rowCursor as CSSProperties['cursor'],
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = design.tbody.rowHoverBackground
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = bg
                }}
              >
                {row.map((cell) => (
                  <td key={cell} style={tdStyle}>
                    {cell}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
