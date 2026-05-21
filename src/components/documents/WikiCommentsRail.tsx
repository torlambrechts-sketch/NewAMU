/* eslint-disable no-restricted-syntax -- filter pills are intentionally styled native buttons */
import { useMemo, useState } from 'react'
import { ArrowUp, Check, CheckCheck, ListPlus, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { StandardTextarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { AddTaskLink } from '../tasks/AddTaskLink'
import { THREAD_COLORS } from '../../lib/wikiCommentHighlights'
import type { WikiPageComment } from '../../types/documents'

/**
 * Inline comment thread rail (Claude Design "Rec05 — Inline kommentarer").
 *
 * A right-hand rail of comment threads — filter pills, numbered threads with
 * the anchored quote, replies, a reply box and resolve/delete. Replaces the
 * per-block comment footers in the document viewer.
 */

type FilterKey = 'all' | 'open' | 'suggestion' | 'resolved'

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Bubble({ comment, small }: { comment: WikiPageComment; small?: boolean }) {
  const name = comment.isAnonymous ? 'Anonym ansatt' : comment.authorName || 'Bruker'
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
          small ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]'
        }`}
        style={{ background: '#0f766e' }}
      >
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <p className={`font-semibold text-neutral-900 ${small ? 'text-[12px]' : 'text-[13px]'}`}>{name}</p>
          <p className="text-[10px] text-neutral-500">{timeLabel(comment.createdAt)}</p>
        </div>
        <p className={`mt-0.5 whitespace-pre-wrap text-neutral-800 ${small ? 'text-[12px]' : 'text-[13px]'}`}>
          {comment.body}
        </p>
      </div>
    </div>
  )
}

export function WikiCommentsRail({
  comments,
  canComment,
  busy,
  onAddComment,
  onReply,
  onResolve,
  onDelete,
  onSuggestion,
  onAcknowledge,
  pendingQuote,
  onClearQuote,
}: {
  comments: WikiPageComment[]
  canComment: boolean
  busy?: boolean
  onAddComment: (body: string) => Promise<void> | void
  onReply: (parentId: string, blockIndex: number, body: string) => Promise<void> | void
  onResolve: (commentId: string, resolved: boolean) => Promise<void> | void
  onDelete: (commentId: string) => Promise<void> | void
  /** Accept / reject a `suggestion`-kind comment (Rec06 track-changes). */
  onSuggestion?: (commentId: string, decision: 'accepted' | 'rejected') => Promise<void> | void
  /** Mark a comment as acknowledged — logs a lifecycle event. */
  onAcknowledge?: (commentId: string) => Promise<void> | void
  /** Text selected in the document — the new comment will anchor to it. */
  pendingQuote?: string | null
  onClearQuote?: () => void
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [newText, setNewText] = useState('')

  const visible = useMemo(() => comments.filter((c) => !c.deletedAt), [comments])

  const threads = useMemo(() => {
    const tops = visible.filter((c) => !c.parentCommentId)
    // `number` is the stable 1-based position among all top-level comments,
    // so it matches the document highlight markers regardless of the filter.
    return tops.map((top, i) => ({
      top,
      number: i + 1,
      replies: visible
        .filter((c) => c.parentCommentId === top.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    }))
  }, [visible])

  const counts = useMemo(() => {
    const tops = visible.filter((c) => !c.parentCommentId)
    return {
      all: tops.length,
      open: tops.filter((c) => !c.resolved).length,
      suggestion: tops.filter((c) => c.kind === 'suggestion').length,
      resolved: tops.filter((c) => c.resolved).length,
    }
  }, [visible])

  const filteredThreads = threads.filter(({ top }) => {
    if (filter === 'open') return !top.resolved
    if (filter === 'resolved') return top.resolved
    if (filter === 'suggestion') return top.kind === 'suggestion'
    return true
  })

  const pill = (key: FilterKey, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
        filter === key ? 'bg-[#0f766e] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
      }`}
    >
      {label} {count}
    </button>
  )

  return (
    <div className="sticky top-4 flex max-h-[calc(100dvh-7rem)] flex-col gap-3 self-start overflow-y-auto pr-1">
      <ModuleSectionCard className="!p-3 sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-1.5">
          {pill('all', 'Alle', counts.all)}
          {pill('open', 'Åpne', counts.open)}
          {pill('suggestion', 'Forslag', counts.suggestion)}
          {pill('resolved', 'Løste', counts.resolved)}
        </div>
      </ModuleSectionCard>

      {filteredThreads.length === 0 ? (
        <ModuleSectionCard className="!p-4">
          <p className="text-center text-[12px] text-neutral-500">
            <MessageSquare className="mx-auto mb-1.5 h-5 w-5 text-neutral-300" aria-hidden />
            Ingen kommentarer i dette utvalget.
          </p>
        </ModuleSectionCard>
      ) : (
        filteredThreads.map(({ top, replies, number }) => {
          const color = THREAD_COLORS[(number - 1) % THREAD_COLORS.length]
          const quote = top.anchor?.quotedText
          return (
            <ModuleSectionCard key={top.id} id={`cm-thread-${top.id}`} className="!p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  document
                    .querySelector(`mark[data-comment-id="${top.id}"]`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className="flex w-full items-start gap-2 border-b border-neutral-100 px-3 py-2 text-left hover:bg-neutral-50"
              >
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0f766e] px-1 text-[10px] font-bold text-white">
                  {number}
                </span>
                {quote ? (
                  <span className="flex-1 truncate text-[11px] text-neutral-600">
                    <span className="rounded-sm px-1" style={{ background: color }}>
                      «{quote.length > 46 ? `${quote.slice(0, 46)}…` : quote}»
                    </span>
                  </span>
                ) : (
                  <span className="flex-1 text-[11px] text-neutral-500">Kommentar</span>
                )}
                {top.kind === 'suggestion' ? (
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-800">
                    FORSLAG
                  </span>
                ) : null}
                {top.resolved ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                    LØST
                  </span>
                ) : null}
              </button>

              <div className="px-3 py-3">
                <Bubble comment={top} />

                {top.suggestion ? (
                  <div className="ml-9 mt-2 rounded-md border border-purple-200 bg-purple-50/60 px-2.5 py-2 text-[12px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Forslag</p>
                    <p className="mt-1">
                      <span className="rounded bg-red-100 px-1 line-through decoration-red-500">
                        {top.suggestion.remove}
                      </span>{' '}
                      <span className="rounded bg-emerald-100 px-1 underline decoration-emerald-600">
                        {top.suggestion.add}
                      </span>
                    </p>
                    {!top.resolved && onSuggestion ? (
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          size="sm"
                          className="!px-2 !py-1 !text-[11px]"
                          disabled={busy}
                          onClick={() => void onSuggestion(top.id, 'accepted')}
                        >
                          Aksepter
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="!px-2 !py-1 !text-[11px]"
                          disabled={busy}
                          onClick={() => void onSuggestion(top.id, 'rejected')}
                        >
                          Avvis
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {replies.length > 0 ? (
                  <div className="ml-9 mt-3 space-y-3 border-l-2 border-neutral-100 pl-3">
                    {replies.map((r) => (
                      <Bubble key={r.id} comment={r} small />
                    ))}
                  </div>
                ) : null}

                {canComment && replyOpen === top.id ? (
                  <div className="ml-9 mt-3">
                    <StandardTextarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      placeholder="Skriv et svar…"
                    />
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setReplyOpen(null)
                          setReplyText('')
                        }}
                      >
                        Avbryt
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy || !replyText.trim()}
                        icon={<ArrowUp className="h-3.5 w-3.5" aria-hidden />}
                        onClick={async () => {
                          await onReply(top.id, top.blockIndex, replyText.trim())
                          setReplyOpen(null)
                          setReplyText('')
                        }}
                      >
                        Svar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/60 px-3 py-1.5 text-[11px]">
                <span className="text-neutral-500">{replies.length + 1} innlegg</span>
                <div className="flex flex-wrap items-center justify-end gap-0.5">
                  {canComment && replyOpen !== top.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!px-2 !py-1 !text-[11px]"
                      onClick={() => {
                        setReplyOpen(top.id)
                        setReplyText('')
                      }}
                    >
                      Svar
                    </Button>
                  ) : null}
                  {onAcknowledge ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!px-2 !py-1 !text-[11px]"
                      icon={<CheckCheck className="h-3 w-3" aria-hidden />}
                      title="Bekreft kommentaren"
                      onClick={() => void onAcknowledge(top.id)}
                    >
                      Bekreft
                    </Button>
                  ) : null}
                  <AddTaskLink
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
                    title={`Følg opp kommentar: ${top.body.slice(0, 60)}`}
                    description={top.body}
                    sourceId={top.id}
                    sourceLabel="Kommentar"
                  >
                    <ListPlus className="h-3 w-3" aria-hidden />
                    Lag oppgave
                  </AddTaskLink>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!px-2 !py-1 !text-[11px]"
                    icon={
                      top.resolved ? (
                        <RotateCcw className="h-3 w-3" aria-hidden />
                      ) : (
                        <Check className="h-3 w-3" aria-hidden />
                      )
                    }
                    onClick={() => void onResolve(top.id, !top.resolved)}
                  >
                    {top.resolved ? 'Gjenåpne' : 'Løs'}
                  </Button>
                  {!top.isConfidential ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!px-1.5 !py-1 text-neutral-400 hover:text-red-700"
                      title="Slett kommentaren"
                      icon={<Trash2 className="h-3 w-3" aria-hidden />}
                      onClick={() => void onDelete(top.id)}
                    >
                      Slett
                    </Button>
                  ) : null}
                </div>
              </div>
            </ModuleSectionCard>
          )
        })
      )}

      {canComment ? (
        <ModuleSectionCard className="!p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Ny kommentar</p>
          {pendingQuote ? (
            <div className="mb-2 flex items-start gap-1.5 rounded-md bg-[#fde68a]/50 px-2 py-1.5 text-[11px] text-neutral-700">
              <span className="min-w-0 flex-1">
                Kommenterer: «{pendingQuote.length > 80 ? `${pendingQuote.slice(0, 80)}…` : pendingQuote}»
              </span>
              {onClearQuote ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="!h-5 !min-w-0 !px-1 !py-0 !text-[11px]"
                  title="Fjern markering"
                  onClick={onClearQuote}
                >
                  ✕
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mb-2 text-[11px] text-neutral-400">
              Marker en setning i dokumentet for å feste kommentaren til den.
            </p>
          )}
          <StandardTextarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={3}
            placeholder="Skriv en kommentar til dokumentet…"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              disabled={busy || !newText.trim()}
              icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}
              onClick={async () => {
                await onAddComment(newText.trim())
                setNewText('')
              }}
            >
              Kommenter
            </Button>
          </div>
        </ModuleSectionCard>
      ) : null}
    </div>
  )
}
