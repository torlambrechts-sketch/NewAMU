import type { CSSProperties } from 'react'
import { ComponentDesignPreview } from './ComponentDesignPreview'
import { LayoutWidgetPreview } from './LayoutWidgetPreview'
import { alignSelfCss, cellFlexStyle, flexAlignItemsCss } from '../../lib/layoutCompositionFlex'
import type { LayoutCompositionRow, LayoutCompositionTypography } from '../../types/layoutComposition'
import type { PlatformDesignerPayload } from '../../types/platformDesignerPayload'

type LibraryMap = Map<string, PlatformDesignerPayload>

type Props = {
  rows: LayoutCompositionRow[]
  typography: LayoutCompositionTypography
  libraryMap: LibraryMap
  /** Gap between rows (canvas gap at root; omit when parent already stacks rows with gap). */
  verticalGap?: string
}

export function LayoutCompositionPreview({ rows, typography, libraryMap, verticalGap }: Props) {
  const inner = rows.map((row) => {
        const rs = row.rowStyle
        const n = row.cells.length || 1
    return (
          <div
            key={row.id}
            className="flex flex-wrap"
            style={{
              gap: row.gap,
              alignItems: flexAlignItemsCss(row.alignItems),
              backgroundColor: rs.backgroundColor,
              padding: rs.padding,
              borderRadius: rs.borderRadius,
              borderWidth: rs.borderWidth,
              borderStyle: rs.borderStyle as CSSProperties['borderStyle'],
              borderColor: rs.borderColor,
              boxShadow: rs.boxShadow === 'none' ? undefined : rs.boxShadow,
              marginTop: rs.marginTop,
              marginBottom: rs.marginBottom,
            }}
          >
            {row.cells.map((slot) => {
              const comp = slot.componentReferenceKey ? libraryMap.get(slot.componentReferenceKey) : undefined
              const st = slot.slotStyle
              const flexStyle = cellFlexStyle(slot.span, row.columnMode, n)
              return (
                <div
                  key={slot.id}
                  className="min-w-0"
                  style={{
                    ...flexStyle,
                    alignSelf: alignSelfCss(slot),
                  }}
                >
                  <div
                    className="h-full min-h-0"
                    style={{
                      backgroundColor: st?.backgroundColor,
                      padding: st?.padding,
                      borderRadius: st?.borderRadius,
                      borderWidth: st?.borderWidth,
                      borderStyle: st?.borderStyle as CSSProperties['borderStyle'],
                      borderColor: st?.borderColor,
                      boxShadow: st?.boxShadow === 'none' ? undefined : st?.boxShadow,
                    }}
                  >
                    {slot.mode === 'component' && comp ? (
                      <ComponentDesignPreview payload={comp} />
                    ) : slot.mode === 'widget' && slot.widget ? (
                      slot.widget.kind === 'layout' ? (
                        <div
                          className="min-h-0"
                          style={{
                            padding: slot.widget.containerStyle.padding,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: slot.widget.containerStyle.gap,
                            backgroundColor: slot.widget.containerStyle.backgroundColor,
                            borderRadius: slot.widget.containerStyle.borderRadius,
                            borderWidth: slot.widget.containerStyle.borderWidth,
                            borderStyle: slot.widget.containerStyle.borderStyle as CSSProperties['borderStyle'],
                            borderColor: slot.widget.containerStyle.borderColor,
                            boxShadow:
                              slot.widget.containerStyle.boxShadow === 'none' ? undefined : slot.widget.containerStyle.boxShadow,
                          }}
                        >
                          <LayoutCompositionPreview rows={slot.widget.rows} typography={typography} libraryMap={libraryMap} />
                        </div>
                      ) : (
                        <div className="p-3">
                          <LayoutWidgetPreview widget={slot.widget} typography={typography} />
                        </div>
                      )
                    ) : (
                      <p className="p-4 text-center text-sm text-neutral-500">Tom celle</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
    )
  })

  if (verticalGap != null && verticalGap !== '') {
    return (
      <div className="flex flex-col" style={{ gap: verticalGap }}>
        {inner}
      </div>
    )
  }
  return <>{inner}</>
}
