import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'

export type MarkdownShortcutKind = 'h2' | 'h3' | 'divider' | 'alert'

type Props = {
  value: string
  onChange: (html: string) => void
  className?: string
  /** When true, typing ## / ### / --- / ! at line start triggers callback and removes the prefix */
  markdownShortcuts?: boolean
  onMarkdownShortcut?: (kind: MarkdownShortcutKind) => void
  /** When the only content on the current line is "/" (e.g. empty line then /) */
  onSlashLine?: () => void
}

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean'],
]

function tryMarkdownPrefix(quill: Quill, onShortcut: (k: MarkdownShortcutKind) => void) {
  const sel = quill.getSelection()
  if (!sel || sel.length > 0) return
  const before = quill.getText(0, sel.index)
  const lineStart = before.lastIndexOf('\n') + 1
  const prefix = quill.getText(lineStart, sel.index - lineStart)
  const triggers: { text: string; kind: MarkdownShortcutKind }[] = [
    { text: '### ', kind: 'h3' },
    { text: '## ', kind: 'h2' },
    { text: '--- ', kind: 'divider' },
    { text: '! ', kind: 'alert' },
  ]
  for (const { text, kind } of triggers) {
    if (prefix === text) {
      quill.deleteText(lineStart, text.length, 'user')
      onShortcut(kind)
      return
    }
  }
}

function trySlashLine(quill: Quill, onSlash: () => void) {
  const sel = quill.getSelection()
  if (!sel || sel.length > 0) return
  const before = quill.getText(0, sel.index)
  const lineStart = before.lastIndexOf('\n') + 1
  const line = quill.getText(lineStart, sel.index - lineStart)
  if (line === '/') {
    quill.deleteText(lineStart, 1, 'user')
    onSlash()
  }
}

export function RichTextEditor({
  value,
  onChange,
  className = '',
  markdownShortcuts = false,
  onMarkdownShortcut,
  onSlashLine,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)
  const mdRef = useRef({ markdownShortcuts, onMarkdownShortcut })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const slashRef = useRef(onSlashLine)
  useEffect(() => {
    slashRef.current = onSlashLine
  }, [onSlashLine])

  useEffect(() => {
    mdRef.current = { markdownShortcuts, onMarkdownShortcut }
  }, [markdownShortcuts, onMarkdownShortcut])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const quill = new Quill(el, {
      theme: 'snow',
      modules: {
        toolbar: toolbarOptions,
      },
      placeholder: 'Skriv innhold…',
    })
    quillRef.current = quill

    const initial = normalizeModuleHtml(value ?? '')
    quill.clipboard.dangerouslyPasteHTML(initial)

    const handler = () => {
      onChangeRef.current(quill.root.innerHTML)
      const { markdownShortcuts: md, onMarkdownShortcut: cb } = mdRef.current
      if (md && cb) tryMarkdownPrefix(quill, cb)
      if (slashRef.current) trySlashLine(quill, () => slashRef.current?.())
    }
    quill.on('text-change', handler)

    return () => {
      quill.off('text-change', handler)
      quillRef.current = null
      el.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; Quill owns content
  }, [])

  return (
    <div
      className={`learning-quill rounded-lg border border-neutral-200 bg-white [&_.ql-container]:min-h-[200px] [&_.ql-editor]:min-h-[180px] [&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-lg ${className}`}
    >
      <div ref={hostRef} />
    </div>
  )
}
