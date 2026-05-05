import { TipTapRichTextEditor } from '../documents/TipTapRichTextEditor'

type Props = {
  value: string
  onChange: (html: string) => void
  className?: string
  placeholder?: string
  /** Default `full` — minimal hides most formatting controls. */
  toolbar?: 'full' | 'minimal' | 'none'
  readOnly?: boolean
}

/**
 * Rich text editor for the learning module — wraps the shared TipTap editor used
 * by documents/wiki so authoring tools and behaviour stay consistent across the app.
 */
export function RichTextEditor({
  value,
  onChange,
  className = '',
  placeholder = 'Skriv innhold…',
  toolbar = 'full',
  readOnly = false,
}: Props) {
  return (
    <TipTapRichTextEditor
      value={value}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      toolbar={toolbar}
      readOnly={readOnly}
    />
  )
}
