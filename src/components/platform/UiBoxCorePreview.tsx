import { createElement, useMemo, useState, type CSSProperties } from 'react'
import type { UiBoxCoreDesign } from '../../types/uiBoxCore'

function parseZIndex(z: string): number | undefined {
  if (!z || z === 'auto') return undefined
  const n = Number(z)
  return Number.isFinite(n) ? n : undefined
}

export function UiBoxCorePreview({ design, className }: { design: UiBoxCoreDesign; className?: string }) {
  const [hover, setHover] = useState(false)

  const boxStyle = useMemo((): CSSProperties => {
    const { layout, flexbox, styling, advancedVisuals, borders, transforms, animation, interaction } = design
    const scale = hover ? interaction.hoverState.scale * transforms.scale : transforms.scale
    const rotate = hover ? interaction.hoverState.rotate || transforms.rotate : transforms.rotate
    const transform = `translate(${transforms.translateX}, ${transforms.translateY}) rotate(${rotate}) scale(${scale}) skew(${transforms.skewX}, ${transforms.skewY})`

    const backgroundImage =
      styling.backgroundGradient?.trim()
        ? styling.backgroundGradient
        : styling.backgroundImage?.trim()
          ? styling.backgroundImage.startsWith('url(')
            ? styling.backgroundImage
            : `url(${styling.backgroundImage})`
          : undefined

    return {
      display: layout.display as CSSProperties['display'],
      position: layout.position as CSSProperties['position'],
      width: layout.width,
      height: layout.height === 'auto' ? 'auto' : layout.height,
      minHeight: layout.minHeight,
      margin: layout.margin,
      padding: layout.padding,
      overflow: layout.overflow as CSSProperties['overflow'],
      zIndex: parseZIndex(layout.zIndex),

      flexDirection: flexbox.flexDirection as CSSProperties['flexDirection'],
      justifyContent: flexbox.justifyContent as CSSProperties['justifyContent'],
      alignItems: flexbox.alignItems as CSSProperties['alignItems'],
      gap: flexbox.gap,
      flexWrap: flexbox.flexWrap as CSSProperties['flexWrap'],

      backgroundColor:
        hover && interaction.hoverState.backgroundColor
          ? interaction.hoverState.backgroundColor
          : styling.backgroundColor,
      backgroundImage,
      backgroundSize: styling.backgroundSize,
      backgroundPosition: styling.backgroundPosition,
      backgroundAttachment: styling.backgroundAttachment as CSSProperties['backgroundAttachment'],
      backgroundBlendMode: styling.backgroundBlendMode as CSSProperties['backgroundBlendMode'],
      opacity: styling.opacity,

      backdropFilter: advancedVisuals.backdropFilter === 'none' ? undefined : advancedVisuals.backdropFilter,
      filter: advancedVisuals.filter === 'none' ? undefined : advancedVisuals.filter,
      clipPath: advancedVisuals.clipPath === 'none' ? undefined : advancedVisuals.clipPath,
      mixBlendMode: advancedVisuals.mixBlendMode as CSSProperties['mixBlendMode'],

      borderWidth: borders.borderWidth,
      borderStyle: borders.borderStyle as CSSProperties['borderStyle'],
      borderColor: borders.borderColor,
      borderRadius: borders.borderRadius,
      boxShadow:
        hover && interaction.hoverState.boxShadow
          ? interaction.hoverState.boxShadow
          : borders.boxShadow,

      transform,
      transformOrigin: transforms.transformOrigin,

      transitionProperty: animation.transitionProperty,
      transitionDuration: animation.transitionDuration,
      transitionTimingFunction: animation.transitionTimingFunction,
      transitionDelay: animation.transitionDelay,

      cursor: interaction.cursor as CSSProperties['cursor'],
    }
  }, [design, hover])

  const baseTextStyle = useMemo((): CSSProperties => {
    const b = design.typography.base
    return {
      fontFamily: b.fontFamily,
      color: b.color,
      textAlign: b.textAlign as CSSProperties['textAlign'],
      fontSize: b.fontSize,
      lineHeight: b.lineHeight,
    }
  }, [design.typography.base])

  const headingStyle = useMemo((): CSSProperties => {
    const h = design.typography.heading
    return {
      color: h.color,
      fontSize: h.fontSize,
      fontWeight: h.fontWeight as CSSProperties['fontWeight'],
      lineHeight: h.lineHeight,
      letterSpacing: h.letterSpacing,
      textTransform: h.textTransform as CSSProperties['textTransform'],
      marginBottom: h.marginBottom,
      marginTop: 0,
    }
  }, [design.typography.heading])

  const HTag = design.typography.heading.tag

  return (
    <div className={className}>
      <div
        role="presentation"
        style={boxStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {design.typography.heading.enabled
          ? createElement(HTag, { style: headingStyle }, design.typography.heading.text)
          : null}
        <p style={baseTextStyle}>
          Eksempeltekst i boksen — juster typografi under «Typografi → base». Designet lagres med referansen{' '}
          <code className="rounded bg-black/5 px-1">{design.metadata.name}</code>.
        </p>
      </div>
    </div>
  )
}
