/**
 * TipTap-based rich text editor for the documents wiki (tiptap.dev headless editor + React).
 * Toolbar uses app `Button` primitives per docs/UI_PLACEMENT_RULES.md §7 (module code avoids raw toolbar buttons).
 *
 * Note: TipTap’s optional “UI Components” template (`npx @tiptap/cli add simple-editor`) installs copy-paste
 * source and requires an interactive CLI; this implementation follows the same editor stack (StarterKit, Link,
 * Placeholder) with our layout instead.
 */
import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { twMerge } from 'tailwind-merge'
import {
  Bold,
  Braces,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'

type Props = {
  value: string
  onChange: (html: string) => void
  className?: string
  placeholder?: string
  /** Default `full` — document-style surfaces often use `minimal` (undo/redo only). */
  toolbar?: 'full' | 'minimal' | 'none'
  /** Fires when the editor instance is ready; called with `null` on unmount. */
  onEditorReady?: (editor: Editor | null) => void
}

function TipTapMinimalToolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const state = useEditorState({
    editor,
    selector: (snap) => ({
      canUndo: snap.editor.can().chain().focus().undo().run(),
      canRedo: snap.editor.can().chain().focus().redo().run(),
    }),
  })
  if (!state) return null
  const { canUndo, canRedo } = state
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50/90 px-2 py-2"
      role="toolbar"
      aria-label="Angre / gjør om"
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Undo2 className="h-3.5 w-3.5" />}
        disabled={!canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Redo2 className="h-3.5 w-3.5" />}
        disabled={!canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  )
}

function TipTapToolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const state = useEditorState({
    editor,
    selector: (snap) => ({
      bold: snap.editor.isActive('bold'),
      italic: snap.editor.isActive('italic'),
      strike: snap.editor.isActive('strike'),
      code: snap.editor.isActive('code'),
      h2: snap.editor.isActive('heading', { level: 2 }),
      h3: snap.editor.isActive('heading', { level: 3 }),
      bulletList: snap.editor.isActive('bulletList'),
      orderedList: snap.editor.isActive('orderedList'),
      blockquote: snap.editor.isActive('blockquote'),
      codeBlock: snap.editor.isActive('codeBlock'),
      link: snap.editor.isActive('link'),
      canUndo: snap.editor.can().chain().focus().undo().run(),
      canRedo: snap.editor.can().chain().focus().redo().run(),
    }),
  })

  if (!state) return null

  const { bold, italic, strike, code, h2, h3, bulletList, orderedList, blockquote, codeBlock, link, canUndo, canRedo } =
    state

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Lenke-URL (https://…)', prev ?? 'https://')
    if (url === null) return
    const trimmed = url.trim()
    if (!trimmed) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50/90 px-2 py-2"
      role="toolbar"
      aria-label="Formatering"
    >
      <Button
        type="button"
        variant={bold ? 'primary' : 'secondary'}
        size="sm"
        icon={<Bold className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-pressed={bold}
      />
      <Button
        type="button"
        variant={italic ? 'primary' : 'secondary'}
        size="sm"
        icon={<Italic className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-pressed={italic}
      />
      <Button
        type="button"
        variant={strike ? 'primary' : 'secondary'}
        size="sm"
        icon={<Strikethrough className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        aria-pressed={strike}
      />
      <Button
        type="button"
        variant={code ? 'primary' : 'secondary'}
        size="sm"
        icon={<Code className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleCode().run()}
        aria-pressed={code}
      />
      <span className="mx-1 hidden h-6 w-px bg-neutral-200 sm:inline" aria-hidden />
      <Button
        type="button"
        variant={h2 ? 'primary' : 'secondary'}
        size="sm"
        icon={<Heading2 className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-pressed={h2}
      />
      <Button
        type="button"
        variant={h3 ? 'primary' : 'secondary'}
        size="sm"
        icon={<Heading3 className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-pressed={h3}
      />
      <span className="mx-1 hidden h-6 w-px bg-neutral-200 sm:inline" aria-hidden />
      <Button
        type="button"
        variant={bulletList ? 'primary' : 'secondary'}
        size="sm"
        icon={<List className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-pressed={bulletList}
      />
      <Button
        type="button"
        variant={orderedList ? 'primary' : 'secondary'}
        size="sm"
        icon={<ListOrdered className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-pressed={orderedList}
      />
      <Button
        type="button"
        variant={blockquote ? 'primary' : 'secondary'}
        size="sm"
        icon={<Quote className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        aria-pressed={blockquote}
      />
      <Button
        type="button"
        variant={codeBlock ? 'primary' : 'secondary'}
        size="sm"
        icon={<Braces className="h-3.5 w-3.5" />}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        aria-pressed={codeBlock}
      />
      <span className="mx-1 hidden h-6 w-px bg-neutral-200 sm:inline" aria-hidden />
      <Button
        type="button"
        variant={link ? 'primary' : 'secondary'}
        size="sm"
        icon={<Link2 className="h-3.5 w-3.5" />}
        onClick={toggleLink}
        aria-pressed={link}
      />
      <span className="mx-1 hidden h-6 w-px bg-neutral-200 sm:inline" aria-hidden />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Undo2 className="h-3.5 w-3.5" />}
        disabled={!canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Redo2 className="h-3.5 w-3.5" />}
        disabled={!canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  )
}

export function TipTapRichTextEditor({
  value,
  onChange,
  className = '',
  placeholder = 'Skriv innhold…',
  toolbar = 'full',
  onEditorReady,
}: Props) {
  const lastEmitted = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  const onEditorReadyRef = useRef(onEditorReady)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    onEditorReadyRef.current = onEditorReady
  }, [onEditorReady])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, HTMLAttributes: { class: 'text-[#1a3d32] underline underline-offset-2' } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: normalizeModuleHtml(value ?? ''),
    editorProps: {
      attributes: {
        class: 'tiptap-editor-root min-h-[220px] max-w-none px-3 py-3 text-sm leading-relaxed text-neutral-800 outline-none focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      lastEmitted.current = html
      onChangeRef.current(html)
    },
  })

  // Sync external value (e.g. hydration, undo outside editor) without fighting local typing
  useEffect(() => {
    if (!editor) return
    const normalized = normalizeModuleHtml(value ?? '')
    if (lastEmitted.current === normalized) return
    const current = editor.getHTML()
    if (current === normalized) return
    editor.commands.setContent(normalized, { emitUpdate: false })
    lastEmitted.current = normalized
  }, [editor, value])

  useEffect(() => {
    if (!editor) {
      onEditorReadyRef.current?.(null)
      return
    }
    onEditorReadyRef.current?.(editor)
    return () => {
      onEditorReadyRef.current?.(null)
    }
  }, [editor])

  if (!editor) {
    return (
      <div className={twMerge('rounded-lg border border-neutral-200 bg-white px-3 py-8 text-center text-sm text-neutral-500', className)}>
        Laster redigeringsfelt…
      </div>
    )
  }

  return (
    <div
      className={twMerge(
        'tiptap-rich-text-editor overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm',
        '[&_.tiptap-editor-root]:min-h-[220px]',
        '[&_.tiptap-editor-root_p]:mb-2 [&_.tiptap-editor-root_p:last-child]:mb-0',
        '[&_.tiptap-editor-root_h2]:mt-4 [&_.tiptap-editor-root_h2]:mb-2 [&_.tiptap-editor-root_h2]:text-lg [&_.tiptap-editor-root_h2]:font-semibold [&_.tiptap-editor-root_h2]:text-neutral-900',
        '[&_.tiptap-editor-root_h3]:mt-3 [&_.tiptap-editor-root_h3]:mb-1.5 [&_.tiptap-editor-root_h3]:text-base [&_.tiptap-editor-root_h3]:font-semibold [&_.tiptap-editor-root_h3]:text-neutral-900',
        '[&_.tiptap-editor-root_ul]:my-2 [&_.tiptap-editor-root_ul]:list-disc [&_.tiptap-editor-root_ul]:pl-5',
        '[&_.tiptap-editor-root_ol]:my-2 [&_.tiptap-editor-root_ol]:list-decimal [&_.tiptap-editor-root_ol]:pl-5',
        '[&_.tiptap-editor-root_blockquote]:my-2 [&_.tiptap-editor-root_blockquote]:border-l-4 [&_.tiptap-editor-root_blockquote]:border-neutral-300 [&_.tiptap-editor-root_blockquote]:pl-3 [&_.tiptap-editor-root_blockquote]:italic [&_.tiptap-editor-root_blockquote]:text-neutral-700',
        '[&_.tiptap-editor-root_pre]:my-2 [&_.tiptap-editor-root_pre]:overflow-x-auto [&_.tiptap-editor-root_pre]:rounded-md [&_.tiptap-editor-root_pre]:bg-neutral-900 [&_.tiptap-editor-root_pre]:p-3 [&_.tiptap-editor-root_pre]:text-xs [&_.tiptap-editor-root_pre]:text-neutral-100',
        '[&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:float-left [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:text-neutral-400 [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:pointer-events-none',
        className,
      )}
    >
      {toolbar === 'full' ? <TipTapToolbar editor={editor} /> : null}
      {toolbar === 'minimal' ? <TipTapMinimalToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  )
}
