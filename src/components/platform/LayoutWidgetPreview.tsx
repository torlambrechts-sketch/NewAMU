import type { CSSProperties } from 'react'
import type { LayoutCompositionTypography, LayoutWidgetPayload } from '../../types/layoutComposition'
import { DEFAULT_WIDGET_TEXT_STYLE } from '../../types/layoutComposition'

type Props = {
  widget: LayoutWidgetPayload
  typography: LayoutCompositionTypography
}

function mergeTextStyle(
  typography: LayoutCompositionTypography,
  partial: Partial<typeof DEFAULT_WIDGET_TEXT_STYLE>,
): typeof DEFAULT_WIDGET_TEXT_STYLE {
  return {
    fontFamily: partial.fontFamily ?? typography.fontFamily,
    fontSize: partial.fontSize ?? typography.baseFontSize,
    fontWeight: partial.fontWeight ?? '400',
    fontStyle: partial.fontStyle ?? 'normal',
    textDecoration: partial.textDecoration ?? 'none',
    color: partial.color ?? typography.textColor,
    lineHeight: partial.lineHeight ?? '1.5',
    letterSpacing: partial.letterSpacing ?? '0',
    textAlign: partial.textAlign ?? 'left',
  }
}

export function LayoutWidgetPreview({ widget, typography }: Props) {
  switch (widget.kind) {
    case 'heading': {
      const st = mergeTextStyle(typography, {
        ...widget.style,
        fontFamily: widget.style.fontFamily ?? typography.headingFontFamily,
        fontSize:
          widget.style.fontSize ??
          (widget.level === 1 ? '1.875rem' : widget.level === 2 ? '1.5rem' : widget.level === 3 ? '1.25rem' : '1.125rem'),
        fontWeight: widget.style.fontWeight ?? '600',
        color: widget.style.color ?? typography.headingColor,
      })
      const Tag = (`h${widget.level}` as 'h1' | 'h2' | 'h3' | 'h4') || 'h2'
      return (
        <Tag
          style={{
            fontFamily: st.fontFamily,
            fontSize: st.fontSize,
            fontWeight: st.fontWeight,
            fontStyle: st.fontStyle,
            textDecoration: st.textDecoration,
            color: st.color,
            lineHeight: st.lineHeight,
            letterSpacing: st.letterSpacing,
            textAlign: st.textAlign,
            margin: 0,
          }}
        >
          {widget.text || '…'}
        </Tag>
      )
    }
    case 'text': {
      const st = mergeTextStyle(typography, widget.style)
      return (
        <p
          style={{
            fontFamily: st.fontFamily,
            fontSize: st.fontSize,
            fontWeight: st.fontWeight,
            fontStyle: st.fontStyle,
            textDecoration: st.textDecoration,
            color: st.color,
            lineHeight: st.lineHeight,
            letterSpacing: st.letterSpacing,
            textAlign: st.textAlign,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {widget.text || '…'}
        </p>
      )
    }
    case 'spacer':
      return <div style={{ height: widget.height }} aria-hidden />
    case 'divider':
      return (
        <hr
          style={{
            border: 'none',
            borderTop: `${widget.thickness} solid ${widget.color}`,
            margin: 0,
          }}
        />
      )
    case 'image':
      return (
        <img
          src={widget.src || 'about:blank'}
          alt={widget.alt}
          className="object-cover"
          style={{
            objectFit: widget.objectFit,
            borderRadius: widget.borderRadius,
            maxHeight: widget.maxHeight,
            width: widget.width,
            display: 'block',
          }}
        />
      )
    case 'button':
      return (
        <a
          href={widget.href || '#'}
          className="inline-block no-underline"
          style={{
            backgroundColor: widget.backgroundColor,
            color: widget.textColor,
            fontWeight: widget.fontWeight,
            fontSize: widget.fontSize,
            borderRadius: widget.borderRadius,
            padding: widget.padding,
            borderWidth: widget.borderWidth,
            borderStyle: widget.borderStyle as CSSProperties['borderStyle'],
            borderColor: widget.borderColor,
            boxShadow: widget.boxShadow === 'none' ? undefined : widget.boxShadow,
          }}
        >
          {widget.label || 'Knapp'}
        </a>
      )
    case 'layout':
      return <p className="text-sm text-neutral-500">[Layout — vises i hovedforhåndsvisning]</p>
    default:
      return <p className="text-sm text-neutral-500">Ukjent widget</p>
  }
}
