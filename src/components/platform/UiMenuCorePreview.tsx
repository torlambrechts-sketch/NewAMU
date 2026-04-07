import { useMemo, useState, type CSSProperties } from 'react'
import type { UiMenuCoreDesign } from '../../types/uiMenuCore'

export function UiMenuCorePreview({ design }: { design: UiMenuCoreDesign }) {
  const [active, setActive] = useState(0)

  const barBg = useMemo(() => {
    if (design.colors.barTone === 'slate') return design.colors.slate
    return design.colors.accent
  }, [design.colors])

  const activeFillBg =
    design.activeFill === 'white' ? '#ffffff' : design.activeTab.backgroundColor || '#f5f0e8'

  const barStyle = useMemo((): CSSProperties => {
    const b = design.bar
    const omitBottom = b.omitBottomBorder || design.tabLayout === 'flush'
    return {
      marginTop: b.marginTop,
      overflow: b.overflow as CSSProperties['overflow'],
      borderRadius: design.tabLayout === 'flush' ? 0 : b.borderRadius,
      borderWidth: b.borderWidth,
      borderStyle: b.borderStyle as CSSProperties['borderStyle'],
      borderColor: b.borderColor,
      borderTopWidth: b.borderTopWidth,
      borderBottomWidth: omitBottom ? 0 : b.borderBottomWidth,
      borderBottomStyle: omitBottom ? 'none' : undefined,
      boxShadow: b.boxShadow,
      backgroundColor: barBg,
    }
  }, [design, barBg])

  const tabRadius = () => {
    if (design.tabLayout === 'flush' || design.tabLayout === 'squared') return '0'
    if (design.tabRounding === 'full') return '9999px'
    if (design.tabRounding === 'none') return '0'
    return design.activeTab.borderRadius || '12px'
  }

  const tabBase = (isActive: boolean): CSSProperties => ({
    fontSize: isActive ? design.activeTab.fontSize : design.inactiveTab.fontSize,
    fontWeight: isActive
      ? (design.activeTab.fontWeight as CSSProperties['fontWeight'])
      : (design.inactiveTab.fontWeight as CSSProperties['fontWeight']),
    padding: isActive ? design.activeTab.padding : design.inactiveTab.padding,
    minHeight: isActive ? design.activeTab.minHeight : design.inactiveTab.minHeight,
    borderRadius: tabRadius(),
    boxShadow: isActive ? design.activeTab.boxShadow : 'none',
    transition: `${design.animation.transitionProperty} ${design.animation.transitionDuration} ${design.animation.transitionTimingFunction}`,
    cursor: design.interaction.cursor as CSSProperties['cursor'],
    border: 'none',
    flex: design.tabLayout === 'flush' ? 1 : undefined,
  })

  const labels = [design.demo.activeLabel, design.demo.inactiveLabel]

  return (
    <div style={barStyle}>
      <div
        style={{
          display: design.innerRow.display as CSSProperties['display'],
          flexWrap: design.innerRow.flexWrap as CSSProperties['flexWrap'],
          alignItems: design.innerRow.alignItems as CSSProperties['alignItems'],
          gap: design.innerRow.gap,
          padding: design.tabLayout === 'flush' ? 0 : design.innerRow.padding,
          minHeight: design.innerRow.minHeight,
        }}
      >
        {labels.map((label, i) => {
          const isActive = active === i
          return (
            <button
              key={label}
              type="button"
              style={{
                ...tabBase(isActive),
                backgroundColor: isActive ? activeFillBg : 'transparent',
                color: isActive ? design.activeTab.color : design.inactiveTab.color,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = design.inactiveTab.hoverBackground
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
              }}
              onClick={() => setActive(i)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
