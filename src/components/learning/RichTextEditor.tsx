import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'

type Props = {
  value: string
  onChange: (html: string) => void
  className?: string
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

export function RichTextEditor({ value, onChange, className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

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
