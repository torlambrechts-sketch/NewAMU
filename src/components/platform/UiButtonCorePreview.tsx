import { useMemo, useState, type CSSProperties } from 'react'
import type { UiButtonCoreDesign } from '../../types/uiButtonCore'

export function UiButtonCorePreview({ design }: { design: UiButtonCoreDesign }) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const [focus, setFocus] = useState(false)

  const style = useMemo((): CSSProperties => {
    const d = design.defaultState
    const h = design.hoverState
    const a = design.activeState
    const f = design.focusState
    const scale = active ? a.scale : hover ? h.scale : 1
    const rotate = hover ? h.rotate : '0deg'
    const grad = d.backgroundGradient?.trim()
    let background: string | undefined
    let backgroundColor: string | undefined
    if (active) {
      backgroundColor = a.backgroundColor
    } else if (hover && h.backgroundColor) {
      backgroundColor = h.backgroundColor
    } else if (grad) {
      background = grad
    } else {
      backgroundColor = d.backgroundColor
    }

    return {
      display: design.layout.display as CSSProperties['display'],
      position: design.layout.position as CSSProperties['position'],
      width: design.layout.width,
      minWidth: design.layout.minWidth,
      height: design.layout.height,
      minHeight: design.layout.minHeight,
      padding: design.layout.padding,
      margin: design.layout.margin,
      borderRadius: design.layout.borderRadius,
      gap: design.layout.gap,
      alignItems: design.layout.alignItems as CSSProperties['alignItems'],
      justifyContent: design.layout.justifyContent as CSSProperties['justifyContent'],

      fontFamily: design.typography.fontFamily,
      fontSize: design.typography.fontSize,
      fontWeight: design.typography.fontWeight as CSSProperties['fontWeight'],
      lineHeight: design.typography.lineHeight,
      letterSpacing: design.typography.letterSpacing,
      textTransform: design.typography.textTransform as CSSProperties['textTransform'],
      color: active ? a.color : hover && h.color ? h.color : design.typography.color,
      textAlign: design.typography.textAlign as CSSProperties['textAlign'],

      background,
      backgroundColor,
      borderWidth: d.borderWidth,
      borderStyle: d.borderStyle as CSSProperties['borderStyle'],
      borderColor: hover && h.borderColor ? h.borderColor : d.borderColor,
      boxShadow: focus
        ? f.boxShadow
        : active
          ? a.boxShadow
          : hover && h.boxShadow
            ? h.boxShadow
            : d.boxShadow,
      opacity: d.opacity,
      outline: focus ? f.outline : 'none',
      outlineOffset: focus ? f.outlineOffset : undefined,

      transform: `scale(${scale}) rotate(${rotate})`,
      backdropFilter: design.advancedVisuals.backdropFilter === 'none' ? undefined : design.advancedVisuals.backdropFilter,
      filter: design.advancedVisuals.filter === 'none' ? undefined : design.advancedVisuals.filter,

      transition: `${design.animation.transitionProperty} ${design.animation.transitionDuration} ${design.animation.transitionTimingFunction} ${design.animation.transitionDelay}`,
      cursor: design.interaction.cursor as CSSProperties['cursor'],
      userSelect: design.interaction.userSelect as CSSProperties['userSelect'],
      pointerEvents: design.interaction.pointerEvents as CSSProperties['pointerEvents'],
    }
  }, [design, hover, active, focus])

  const disabledStyle = useMemo((): CSSProperties => {
    const ds = design.disabledState
    return {
      ...style,
      opacity: ds.opacity,
      cursor: ds.cursor as CSSProperties['cursor'],
      backgroundColor: ds.backgroundColor,
      color: ds.color,
      pointerEvents: 'none',
    }
  }, [design.disabledState, style])

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        style={style}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false)
          setActive(false)
        }}
        onMouseDown={() => setActive(true)}
        onMouseUp={() => setActive(false)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      >
        {design.demo.label}
      </button>
      {design.demo.showDisabledPreview ? (
        <button type="button" style={disabledStyle} disabled>
          {design.demo.label} (disabled)
        </button>
      ) : null}
    </div>
  )
}
