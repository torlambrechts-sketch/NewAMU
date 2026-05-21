/**
 * TipTap-based rich text editor for the documents wiki (tiptap.dev headless editor + React).
 * Toolbar uses app `Button` primitives per docs/UI_PLACEMENT_RULES.md §7 (module code avoids raw toolbar buttons).
 *
 * Note: TipTap’s optional “UI Components” template (`npx @tiptap/cli add simple-editor`) installs copy-paste
 * source and requires an interactive CLI; this implementation follows the same editor stack (StarterKit, Link,
 * Placeholder) with our layout instead.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AnyExtension, Editor } from '@tiptap/core'
import { EditorContent, ReactRenderer, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Mention from '@tiptap/extension-mention'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { WikiPreservedBlock } from './tiptapPreservedBlock'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { twMerge } from 'tailwind-merge'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../ui/Button'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'

export type WikiLinkPageOption = { id: string; title: string }

/** Slash-command block options. `apply` runs after the typed `/query` is deleted. */
type SlashItem = {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  keys: string
  keywords: string
  apply: (editor: Editor) => void
}

const SLASH_ITEMS: SlashItem[] = [
  { id: 'h1', label: 'Overskrift 1', hint: 'Stort kapittel', icon: Heading1, keys: '# ', keywords: 'overskrift heading tittel h1', apply: (e) => e.chain().focus().setNode('heading', { level: 1 }).run() },
  { id: 'h2', label: 'Overskrift 2', hint: 'Underkapittel', icon: Heading2, keys: '## ', keywords: 'overskrift heading h2', apply: (e) => e.chain().focus().setNode('heading', { level: 2 }).run() },
  { id: 'h3', label: 'Overskrift 3', hint: 'Avsnittstittel', icon: Heading3, keys: '### ', keywords: 'overskrift heading h3', apply: (e) => e.chain().focus().setNode('heading', { level: 3 }).run() },
  { id: 'text', label: 'Tekst', hint: 'Vanlig avsnitt', icon: Pilcrow, keys: '', keywords: 'tekst avsnitt paragraph text', apply: (e) => e.chain().focus().setParagraph().run() },
  { id: 'ul', label: 'Punktliste', hint: 'Uordnet liste', icon: List, keys: '- ', keywords: 'liste punkt bullet ul', apply: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'ol', label: 'Nummerert liste', hint: 'Ordnet liste', icon: ListOrdered, keys: '1. ', keywords: 'liste nummerert ordered ol', apply: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'quote', label: 'Sitat', hint: 'Innrammet sitat', icon: Quote, keys: '> ', keywords: 'sitat quote blockquote', apply: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'code', label: 'Kode', hint: 'Monospaced blokk', icon: Code, keys: '```', keywords: 'kode code pre', apply: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: 'hr', label: 'Skillelinje', hint: 'Horisontal strek', icon: Minus, keys: '---', keywords: 'skille linje divider hr', apply: (e) => e.chain().focus().setHorizontalRule().run() },
]
export type WikiMentionProfileOption = { id: string; label: string }

type Props = {
  value: string
  onChange: (html: string) => void
  className?: string
  placeholder?: string
  /** Default `full` — document-style surfaces often use `minimal` (undo/redo only). */
  toolbar?: 'full' | 'minimal' | 'none'
  /** When true, the document is view-only (toolbar hidden, no edits). */
  readOnly?: boolean
  /** Fires when the editor instance is ready; called with `null` on unmount. */
  onEditorReady?: (editor: Editor | null) => void
  /** For `[[` internal wiki links (P3.3). */
  wikiLinkPages?: WikiLinkPageOption[]
  /** For `@` mentions (P3.4). */
  mentionProfiles?: WikiMentionProfileOption[]
  /** After blur, emit latest HTML for mention notifications (optional). */
  onEditorBlurHtml?: (html: string) => void
}

function MentionListInner(
  props: SuggestionProps<WikiMentionProfileOption>,
  ref: React.Ref<{ onKeyDown: (p: SuggestionKeyDownProps) => boolean }>,
) {
  const [selected, setSelected] = useState(0)
  const items = props.items
  useEffect(() => setSelected(0), [items])
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        props.command(items[selected])
        return true
      }
      return false
    },
  }))
  if (!items.length) {
    return <div className="rounded border border-neutral-200 bg-white p-2 text-xs text-neutral-500">Ingen treff</div>
  }
  return (
    <div className="max-h-48 min-w-[200px] overflow-y-auto rounded border border-neutral-200 bg-white py-1 shadow-lg">
      {items.map((item, idx) => (
        <Button
          key={item.id}
          variant="ghost"
          className={`flex w-full justify-start rounded-none px-3 py-1.5 text-left text-xs font-normal ${
            idx === selected ? 'bg-[#1a3d32]/10 font-medium text-[#1a3d32]' : 'text-neutral-800 hover:bg-neutral-50'
          }`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => props.command(item)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}

const MentionList = forwardRef(MentionListInner)

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

/** One toolbar button — a styled design-system Button. */
function TBtn({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      icon={icon}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
    />
  )
}

function ToolbarSep() {
  return <span className="mx-0.5 hidden h-6 w-px bg-neutral-200 sm:inline" aria-hidden />
}

function TipTapToolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const state = useEditorState({
    editor,
    selector: (snap) => ({
      bold: snap.editor.isActive('bold'),
      italic: snap.editor.isActive('italic'),
      strike: snap.editor.isActive('strike'),
      code: snap.editor.isActive('code'),
      highlight: snap.editor.isActive('highlight'),
      h1: snap.editor.isActive('heading', { level: 1 }),
      h2: snap.editor.isActive('heading', { level: 2 }),
      h3: snap.editor.isActive('heading', { level: 3 }),
      underline: snap.editor.isActive('underline'),
      alignCenter: snap.editor.isActive({ textAlign: 'center' }),
      alignRight: snap.editor.isActive({ textAlign: 'right' }),
      bulletList: snap.editor.isActive('bulletList'),
      orderedList: snap.editor.isActive('orderedList'),
      taskList: snap.editor.isActive('taskList'),
      blockquote: snap.editor.isActive('blockquote'),
      codeBlock: snap.editor.isActive('codeBlock'),
      link: snap.editor.isActive('link'),
      canUndo: snap.editor.can().chain().focus().undo().run(),
      canRedo: snap.editor.can().chain().focus().redo().run(),
    }),
  })

  if (!state) return null

  const {
    bold,
    italic,
    strike,
    code,
    highlight,
    h1,
    h2,
    h3,
    underline,
    alignCenter,
    alignRight,
    bulletList,
    orderedList,
    taskList,
    blockquote,
    codeBlock,
    link,
    canUndo,
    canRedo,
  } = state

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

  const addImage = () => {
    const url = window.prompt('Bilde-URL (https://…)', 'https://')
    if (url === null) return
    const trimmed = url.trim()
    if (!trimmed) return
    editor.chain().focus().setImage({ src: trimmed }).run()
  }

  /** Indent / outdent — works for both bullet/ordered (listItem) and task lists. */
  const indent = (dir: 'in' | 'out') => {
    const cmd = dir === 'in' ? 'sinkListItem' : 'liftListItem'
    if (!editor.chain().focus()[cmd]('listItem').run()) {
      editor.chain().focus()[cmd]('taskItem').run()
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50/90 px-2 py-2"
      role="toolbar"
      aria-label="Formatering"
    >
      <TBtn icon={<Heading1 className="h-3.5 w-3.5" />} label="Overskrift 1" active={h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
      <TBtn icon={<Heading2 className="h-3.5 w-3.5" />} label="Overskrift 2" active={h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <TBtn icon={<Heading3 className="h-3.5 w-3.5" />} label="Overskrift 3" active={h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <ToolbarSep />
      <TBtn icon={<Bold className="h-3.5 w-3.5" />} label="Fet" active={bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <TBtn icon={<Italic className="h-3.5 w-3.5" />} label="Kursiv" active={italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <TBtn icon={<UnderlineIcon className="h-3.5 w-3.5" />} label="Understrek" active={underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <TBtn icon={<Strikethrough className="h-3.5 w-3.5" />} label="Gjennomstrek" active={strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <TBtn icon={<Code className="h-3.5 w-3.5" />} label="Kode" active={code} onClick={() => editor.chain().focus().toggleCode().run()} />
      <TBtn icon={<Highlighter className="h-3.5 w-3.5" />} label="Marker" active={highlight} onClick={() => editor.chain().focus().toggleHighlight().run()} />
      <ToolbarSep />
      <TBtn icon={<AlignLeft className="h-3.5 w-3.5" />} label="Venstrejuster" active={!alignCenter && !alignRight} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
      <TBtn icon={<AlignCenter className="h-3.5 w-3.5" />} label="Midtstill" active={alignCenter} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
      <TBtn icon={<AlignRight className="h-3.5 w-3.5" />} label="Høyrejuster" active={alignRight} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
      <ToolbarSep />
      <TBtn icon={<List className="h-3.5 w-3.5" />} label="Punktliste" active={bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <TBtn icon={<ListOrdered className="h-3.5 w-3.5" />} label="Nummerert liste" active={orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <TBtn icon={<ListChecks className="h-3.5 w-3.5" />} label="Sjekkliste" active={taskList} onClick={() => editor.chain().focus().toggleTaskList().run()} />
      <TBtn icon={<IndentDecrease className="h-3.5 w-3.5" />} label="Mindre innrykk" onClick={() => indent('out')} />
      <TBtn icon={<IndentIncrease className="h-3.5 w-3.5" />} label="Mer innrykk" onClick={() => indent('in')} />
      <ToolbarSep />
      <TBtn icon={<Link2 className="h-3.5 w-3.5" />} label="Lenke" active={link} onClick={toggleLink} />
      <TBtn icon={<ImageIcon className="h-3.5 w-3.5" />} label="Bilde" onClick={addImage} />
      <TBtn icon={<TableIcon className="h-3.5 w-3.5" />} label="Tabell" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <TBtn icon={<Quote className="h-3.5 w-3.5" />} label="Sitat" active={blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <TBtn icon={<Braces className="h-3.5 w-3.5" />} label="Kodeblokk" active={codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <TBtn icon={<Minus className="h-3.5 w-3.5" />} label="Skillelinje" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <ToolbarSep />
      <TBtn icon={<Undo2 className="h-3.5 w-3.5" />} label="Angre" disabled={!canUndo} onClick={() => editor.chain().focus().undo().run()} />
      <TBtn icon={<Redo2 className="h-3.5 w-3.5" />} label="Gjør om" disabled={!canRedo} onClick={() => editor.chain().focus().redo().run()} />
    </div>
  )
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function TipTapRichTextEditor({
  value,
  onChange,
  className = '',
  placeholder = 'Skriv innhold…',
  toolbar = 'full',
  readOnly = false,
  onEditorReady,
  wikiLinkPages,
  mentionProfiles,
  onEditorBlurHtml,
}: Props) {
  const lastEmitted = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  const onEditorReadyRef = useRef(onEditorReady)
  const onEditorBlurHtmlRef = useRef(onEditorBlurHtml)
  const [wikiLinkPickAnchor, setWikiLinkPickAnchor] = useState<number | null>(null)
  const [wikiLinkPickRect, setWikiLinkPickRect] = useState<DOMRect | null>(null)
  const [wikiLinkQuery, setWikiLinkQuery] = useState('')
  const [slashAnchor, setSlashAnchor] = useState<number | null>(null)
  const [slashRect, setSlashRect] = useState<DOMRect | null>(null)
  const [slashQuery, setSlashQuery] = useState('')
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    onEditorReadyRef.current = onEditorReady
  }, [onEditorReady])
  useEffect(() => {
    onEditorBlurHtmlRef.current = onEditorBlurHtml
  }, [onEditorBlurHtml])

  const extensions = useMemo((): AnyExtension[] => {
    const base: AnyExtension[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, HTMLAttributes: { class: 'text-[#1a3d32] underline underline-offset-2' } },
      }),
      Underline,
      Highlight.configure({ HTMLAttributes: { class: 'rounded-sm bg-[#fef3c7] px-0.5' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg border border-neutral-200' } }),
      TableKit.configure({ table: { resizable: true } }),
      WikiPreservedBlock,
      Placeholder.configure({ placeholder }),
    ]
    if (mentionProfiles && mentionProfiles.length > 0 && !readOnly) {
      base.push(
        Mention.configure({
          HTMLAttributes: {
            class: 'mention-chip rounded bg-[#1a3d32]/10 px-1 py-0.5 text-[#1a3d32] font-medium',
            'data-mention': 'true',
          },
          renderText({ node }) {
            return `@${node.attrs.label ?? node.attrs.id ?? ''}`
          },
          renderHTML({ node }) {
            return [
              'span',
              {
                'data-mention': 'true',
                'data-user-id': node.attrs.id,
                class: 'mention-chip rounded bg-[#1a3d32]/10 px-1 py-0.5 text-[#1a3d32] font-medium',
              },
              `@${node.attrs.label ?? node.attrs.id ?? ''}`,
            ]
          },
          suggestions: [
            {
              char: '@',
              items: ({ query }: { query: string }) => {
                const q = query.toLowerCase()
                return mentionProfiles.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 12)
              },
              render: () => {
                let component: ReactRenderer<
                  { onKeyDown: (p: SuggestionKeyDownProps) => boolean },
                  SuggestionProps<WikiMentionProfileOption>
                > | null = null
                function place(el: HTMLElement, rect: (() => DOMRect | null) | null | undefined) {
                  const r = rect?.() ?? null
                  if (!r) return
                  el.style.position = 'fixed'
                  el.style.left = `${r.left}px`
                  el.style.top = `${r.bottom + 4}px`
                  el.style.zIndex = '100'
                }
                return {
                  onStart: (props) => {
                    const inst = new ReactRenderer<
                      { onKeyDown: (p: SuggestionKeyDownProps) => boolean },
                      SuggestionProps<WikiMentionProfileOption>
                    >(MentionList, { props, editor: props.editor })
                    component = inst
                    const el = inst.element as HTMLElement
                    document.body.appendChild(el)
                    place(el, props.clientRect)
                  },
                  onUpdate(props) {
                    component?.updateProps(props)
                    if (component?.element) place(component.element as HTMLElement, props.clientRect)
                  },
                  onKeyDown(props) {
                    if (props.event.key === 'Escape') return true
                    const refObj = component?.ref as { onKeyDown?: (p: SuggestionKeyDownProps) => boolean } | null
                    return refObj?.onKeyDown?.(props) ?? false
                  },
                  onExit() {
                    component?.element.remove()
                    component?.destroy()
                  },
                }
              },
            },
          ],
        }),
      )
    }
    return base
  }, [placeholder, mentionProfiles, readOnly])

  const editor = useEditor({
    editable: !readOnly,
    extensions,
    content: normalizeModuleHtml(value ?? ''),
    editorProps: {
      attributes: {
        class: 'tiptap-editor-root min-h-[220px] max-w-none px-3 py-3 text-sm leading-relaxed text-neutral-800 outline-none focus:outline-none',
      },
    },
    onBlur: ({ editor: ed }) => {
      onEditorBlurHtmlRef.current?.(ed.getHTML())
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      lastEmitted.current = html
      onChangeRef.current(html)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    if (!editor || readOnly || !wikiLinkPages?.length) return
    const sync = () => {
      const { from } = editor.state.selection
      const $from = editor.state.doc.resolve(from)
      const parent = $from.parent
      const textBefore = parent.textBetween(0, $from.parentOffset, '\ufffc', '\ufffc')
      const openIdx = textBefore.lastIndexOf('[[')
      if (openIdx < 0) {
        setWikiLinkPickAnchor(null)
        setWikiLinkPickRect(null)
        return
      }
      const afterOpen = textBefore.slice(openIdx + 2)
      if (afterOpen.includes(']]')) {
        setWikiLinkPickAnchor(null)
        setWikiLinkPickRect(null)
        return
      }
      const anchor = $from.start() + openIdx
      setWikiLinkPickAnchor(anchor)
      setWikiLinkQuery(afterOpen)
      const coords = editor.view.coordsAtPos(from)
      setWikiLinkPickRect(new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top))
    }
    editor.on('transaction', sync)
    editor.on('selectionUpdate', sync)
    return () => {
      editor.off('transaction', sync)
      editor.off('selectionUpdate', sync)
    }
  }, [editor, readOnly, wikiLinkPages])

  // Slash command menu — detect a `/query` typed at the start of an empty
  // paragraph, mirroring the `[[` wiki-link picker pattern.
  useEffect(() => {
    if (!editor || readOnly) return
    const sync = () => {
      const { from, empty } = editor.state.selection
      if (!empty) {
        setSlashAnchor(null)
        return
      }
      const $from = editor.state.doc.resolve(from)
      if ($from.parent.type.name !== 'paragraph') {
        setSlashAnchor(null)
        return
      }
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, '￼', '￼')
      const match = /^\/([\p{L}0-9]*)$/u.exec(textBefore)
      if (!match) {
        setSlashAnchor(null)
        return
      }
      setSlashAnchor($from.start())
      setSlashQuery(match[1] ?? '')
      const coords = editor.view.coordsAtPos(from)
      setSlashRect(new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top))
    }
    editor.on('transaction', sync)
    editor.on('selectionUpdate', sync)
    return () => {
      editor.off('transaction', sync)
      editor.off('selectionUpdate', sync)
    }
  }, [editor, readOnly])

  // Esc closes the slash menu (the menu footer advertises this).
  useEffect(() => {
    if (slashAnchor == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setSlashAnchor(null)
      setSlashRect(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [slashAnchor])

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

  // Hooks must run unconditionally — keep this above the `!editor` early return.
  const filteredWikiPages = useMemo(() => {
    if (!wikiLinkPages) return []
    const q = wikiLinkQuery.toLowerCase()
    return wikiLinkPages.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 20)
  }, [wikiLinkPages, wikiLinkQuery])

  if (!editor) {
    return (
      <div className={twMerge('rounded-lg border border-neutral-200 bg-white px-3 py-8 text-center text-sm text-neutral-500', className)}>
        Laster redigeringsfelt…
      </div>
    )
  }

  const slashQ = slashQuery.toLowerCase()
  const filteredSlashItems = slashQ
    ? SLASH_ITEMS.filter(
        (it) => it.label.toLowerCase().includes(slashQ) || it.keywords.includes(slashQ),
      )
    : SLASH_ITEMS

  const applySlash = (item: SlashItem) => {
    if (slashAnchor == null) return
    const to = editor.state.selection.from
    editor.chain().focus().deleteRange({ from: slashAnchor, to }).run()
    item.apply(editor)
    setSlashAnchor(null)
    setSlashRect(null)
  }

  return (
    <div
      className={twMerge(
        'tiptap-rich-text-editor overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm',
        '[&_.tiptap-editor-root]:min-h-[220px]',
        '[&_.tiptap-editor-root_p]:mb-2 [&_.tiptap-editor-root_p:last-child]:mb-0',
        '[&_.tiptap-editor-root_h1]:mt-4 [&_.tiptap-editor-root_h1]:mb-3 [&_.tiptap-editor-root_h1]:text-xl [&_.tiptap-editor-root_h1]:font-bold [&_.tiptap-editor-root_h1]:text-neutral-900',
        '[&_.tiptap-editor-root_h2]:mt-4 [&_.tiptap-editor-root_h2]:mb-2 [&_.tiptap-editor-root_h2]:text-lg [&_.tiptap-editor-root_h2]:font-semibold [&_.tiptap-editor-root_h2]:text-neutral-900',
        '[&_.tiptap-editor-root_h3]:mt-3 [&_.tiptap-editor-root_h3]:mb-1.5 [&_.tiptap-editor-root_h3]:text-base [&_.tiptap-editor-root_h3]:font-semibold [&_.tiptap-editor-root_h3]:text-neutral-900',
        '[&_.tiptap-editor-root_hr]:my-6 [&_.tiptap-editor-root_hr]:border-neutral-200',
        '[&_.tiptap-editor-root_ul]:my-2 [&_.tiptap-editor-root_ul]:list-disc [&_.tiptap-editor-root_ul]:pl-5',
        '[&_.tiptap-editor-root_ol]:my-2 [&_.tiptap-editor-root_ol]:list-decimal [&_.tiptap-editor-root_ol]:pl-5',
        '[&_.tiptap-editor-root_blockquote]:my-2 [&_.tiptap-editor-root_blockquote]:border-l-4 [&_.tiptap-editor-root_blockquote]:border-neutral-300 [&_.tiptap-editor-root_blockquote]:pl-3 [&_.tiptap-editor-root_blockquote]:italic [&_.tiptap-editor-root_blockquote]:text-neutral-700',
        '[&_.tiptap-editor-root_pre]:my-2 [&_.tiptap-editor-root_pre]:overflow-x-auto [&_.tiptap-editor-root_pre]:rounded-md [&_.tiptap-editor-root_pre]:bg-neutral-900 [&_.tiptap-editor-root_pre]:p-3 [&_.tiptap-editor-root_pre]:text-xs [&_.tiptap-editor-root_pre]:text-neutral-100',
        '[&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:float-left [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:text-neutral-400 [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap-editor-root_p.is-editor-empty:first-child::before]:pointer-events-none',
        // Task list (checklist)
        '[&_ul[data-type=taskList]]:my-2 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-1',
        '[&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2',
        '[&_ul[data-type=taskList]_li_label]:mt-0.5 [&_ul[data-type=taskList]_li_label]:select-none',
        '[&_ul[data-type=taskList]_li_div]:min-w-0 [&_ul[data-type=taskList]_li_div]:flex-1',
        // Tables
        '[&_.tiptap-editor-root_table]:my-3 [&_.tiptap-editor-root_table]:w-full [&_.tiptap-editor-root_table]:border-collapse',
        '[&_.tiptap-editor-root_td]:border [&_.tiptap-editor-root_td]:border-neutral-300 [&_.tiptap-editor-root_td]:px-3 [&_.tiptap-editor-root_td]:py-1.5 [&_.tiptap-editor-root_td]:text-sm [&_.tiptap-editor-root_td]:align-top',
        '[&_.tiptap-editor-root_th]:border [&_.tiptap-editor-root_th]:border-neutral-300 [&_.tiptap-editor-root_th]:bg-neutral-50 [&_.tiptap-editor-root_th]:px-3 [&_.tiptap-editor-root_th]:py-1.5 [&_.tiptap-editor-root_th]:text-left [&_.tiptap-editor-root_th]:text-xs [&_.tiptap-editor-root_th]:font-semibold',
        // Images
        '[&_.tiptap-editor-root_img]:my-3 [&_.tiptap-editor-root_img]:max-w-full [&_.tiptap-editor-root_img]:rounded-lg',
        // Highlight mark
        '[&_.tiptap-editor-root_mark]:rounded-sm [&_.tiptap-editor-root_mark]:bg-[#fef3c7] [&_.tiptap-editor-root_mark]:px-0.5',
        // Preserved (non-prose) block placeholders
        '[&_.wiki-preserved-block]:my-2 [&_.wiki-preserved-block]:rounded-md [&_.wiki-preserved-block]:border [&_.wiki-preserved-block]:border-dashed [&_.wiki-preserved-block]:border-neutral-300 [&_.wiki-preserved-block]:bg-neutral-50 [&_.wiki-preserved-block]:px-3 [&_.wiki-preserved-block]:py-2 [&_.wiki-preserved-block]:text-xs [&_.wiki-preserved-block]:text-neutral-500',
        className,
      )}
    >
      {!readOnly && toolbar === 'full' ? <TipTapToolbar editor={editor} /> : null}
      {!readOnly && toolbar === 'minimal' ? <TipTapMinimalToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      {!readOnly && wikiLinkPickAnchor != null && wikiLinkPickRect && wikiLinkPages?.length ? (
        <div
          className="fixed z-[100] w-72 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl"
          style={{ left: wikiLinkPickRect.left, top: wikiLinkPickRect.bottom + 4 }}
        >
          <p className="mb-1 text-[11px] font-medium text-neutral-500">Velg dokument (intern lenke)</p>
          <ul className="max-h-48 overflow-y-auto text-xs">
            {filteredWikiPages.map((p) => (
              <li key={p.id}>
                <Button
                  variant="ghost"
                  className="w-full truncate justify-start rounded px-2 py-1.5 text-left font-normal hover:bg-neutral-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const to = editor.state.selection.from
                    editor
                      .chain()
                      .focus()
                      .deleteRange({ from: wikiLinkPickAnchor, to })
                      .insertContentAt(
                        wikiLinkPickAnchor,
                        `<a href="/documents/page/${p.id}">${escapeHtml(p.title)}</a>`,
                      )
                      .run()
                    setWikiLinkPickAnchor(null)
                    setWikiLinkPickRect(null)
                  }}
                >
                  {p.title}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full rounded-none text-xs text-neutral-500 hover:bg-transparent hover:underline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setWikiLinkPickAnchor(null)
              setWikiLinkPickRect(null)
            }}
          >
            Avbryt
          </Button>
        </div>
      ) : null}
      {!readOnly && slashAnchor != null && slashRect ? (
        <div
          className="fixed z-[100] w-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl"
          style={{ left: slashRect.left, top: slashRect.bottom + 6 }}
        >
          <div className="border-b border-neutral-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Sett inn blokk
          </div>
          {filteredSlashItems.length === 0 ? (
            <p className="px-3 py-3 text-xs text-neutral-400">Ingen blokk «{slashQuery}».</p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {filteredSlashItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <Button
                      variant="ghost"
                      className="flex w-full items-center gap-2.5 rounded-none px-3 py-1.5 text-left font-normal hover:bg-neutral-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySlash(item)}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-neutral-900">{item.label}</span>
                        <span className="block truncate text-[11px] text-neutral-500">{item.hint}</span>
                      </span>
                      {item.keys ? (
                        <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                          {item.keys}
                        </kbd>
                      ) : null}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t border-neutral-100 px-3 py-1.5 text-[10px] text-neutral-500">
            Skriv for å filtrere · Esc for å lukke
          </div>
        </div>
      ) : null}
    </div>
  )
}
