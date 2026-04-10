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
    color: partial.color ?? typography.textColor,
    lineHeight: partial.lineHeight ?? '1.5',
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
            color: st.color,
            lineHeight: st.lineHeight,
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
            color: st.color,
            lineHeight: st.lineHeight,
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
          className="max-h-48 w-full rounded-lg object-cover"
          style={{ objectFit: widget.objectFit }}
        />
      )
    case 'button':
      return (
        <a
          href={widget.href || '#'}
          className="inline-block rounded-lg px-4 py-2 text-sm no-underline"
          style={{
            backgroundColor: widget.backgroundColor,
            color: widget.textColor,
            fontWeight: widget.fontWeight,
          }}
        >
          {widget.label || 'Knapp'}
        </a>
      )
    default:
      return <p className="text-sm text-neutral-500">Ukjent widget</p>
  }
}
