// MarkdownBody — renders Markdown (bodyMarkdown / deepDive fields) or legacy
// sanitised HTML (body field) depending on what's present in the module
// content. Falls back gracefully so old HTML modules keep working unchanged.

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, ChevronUp, BookOpen, Lightbulb } from 'lucide-react'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { normalizeModuleHtml } from '../../lib/richTextDisplay'

// ── Shared prose class ───────────────────────────────────────────────────────
const PROSE =
  'prose prose-sm w-full max-w-none text-neutral-800 ' +
  'prose-headings:font-semibold prose-headings:text-neutral-900 ' +
  'prose-a:text-emerald-800 prose-a:underline ' +
  'prose-li:my-0.5 prose-blockquote:border-l-4 prose-blockquote:border-[#1a3d32] ' +
  'prose-blockquote:bg-[#f0f9f5] prose-blockquote:px-4 prose-blockquote:py-1 ' +
  'prose-table:text-xs prose-th:bg-neutral-100 prose-code:bg-neutral-100 prose-code:px-1 prose-code:rounded'

// ── Markdown renderer ────────────────────────────────────────────────────────
export function MarkdownBody({ markdown }: { markdown: string }) {
  return (
    <div className={PROSE}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  )
}

// ── HTML renderer (legacy) ───────────────────────────────────────────────────
export function HtmlBody({ html }: { html: string }) {
  const safe = sanitizeLearningHtml(normalizeModuleHtml(html))
  return <div className={PROSE} dangerouslySetInnerHTML={{ __html: safe }} />
}

// ── Auto-dispatch: markdown wins if bodyMarkdown is present ─────────────────
export function ModuleBody({
  body,
  bodyMarkdown,
  bodyFormat,
}: {
  body?: string
  bodyMarkdown?: string
  bodyFormat?: 'markdown' | 'html'
}) {
  if (bodyMarkdown) return <MarkdownBody markdown={bodyMarkdown} />
  if (bodyFormat === 'markdown' && body) return <MarkdownBody markdown={body} />
  if (body) return <HtmlBody html={body} />
  return null
}

// ── Deep Dive collapsible ────────────────────────────────────────────────────
export function DeepDiveAccordion({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-emerald-900 hover:bg-emerald-100/60 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <BookOpen className="size-4 shrink-0" />
          Fordypning
        </span>
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-emerald-200 px-4 py-4">
          <MarkdownBody markdown={markdown} />
        </div>
      )}
    </div>
  )
}

// ── Key Takeaways ─────────────────────────────────────────────────────────────
export function KeyTakeaways({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Lightbulb className="size-4 shrink-0" />
        Nøkkelpunkter
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
            <span className="mt-0.5 size-4 shrink-0 rounded-full bg-amber-200 text-center text-[10px] font-bold leading-4 text-amber-800">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
