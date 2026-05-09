// ExecutionCommentThread — timestamped discussion log on a checklist execution.
//
// Each comment is scoped to the execution or to a specific item (item_key).
// @mention: typing "@" in the compose box opens a member picker filtered by the
// partial name that follows. Selecting a member inserts "@DisplayName" into the
// body and records their UUID in the mentions array. Mentions are highlighted on
// render. Authors can edit or delete their own comments inline.

import { useEffect, useRef, useState } from 'react'
import { AtSign, Pencil, Send, Trash2 } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Button } from '../../../src/components/ui/Button'
import type { ChecklistCommentRow } from '../types'
import type { OrganizationMemberRow } from '../../../src/types/organization'

// ── @mention helpers ─────────────────────────────────────────────────────────

/** Find the `@partial` being typed at the caret, or null. */
function getMentionQuery(text: string, caretPos: number): string | null {
  const before = text.slice(0, caretPos)
  const match = before.match(/@([\w.\-æøåÆØÅ]*)$/)
  return match ? match[1] : null
}

/** Replace the trailing `@partial` with `@displayName `. */
function replaceMentionQuery(text: string, caretPos: number, displayName: string): string {
  const before = text.slice(0, caretPos)
  const after = text.slice(caretPos)
  const replaced = before.replace(/@([\w.\-æøåÆØÅ]*)$/, `@${displayName} `)
  return replaced + after
}

/** Extract UUID mention IDs from the body text using a name→id map. */
function extractMentionIds(body: string, members: OrganizationMemberRow[]): string[] {
  const nameToId = new Map(members.map((m) => [m.display_name.toLowerCase(), m.id]))
  const ids: string[] = []
  const matches = body.matchAll(/@([\w.\-æøåÆØÅ]+(?:\s+[\w.\-æøåÆØÅ]+)?)/g)
  for (const m of matches) {
    const id = nameToId.get(m[1].toLowerCase())
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/** Wrap @Name occurrences in a highlight span. */
function renderBody(body: string): React.ReactNode {
  const parts = body.split(/(@[\w.\-æøåÆØÅ]+(?:\s+[\w.\-æøåÆØÅ]+)?)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <mark
        key={i}
        className="rounded bg-[#1a3d32]/10 px-0.5 font-medium text-[#1a3d32] not-italic"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

type CommentItemProps = {
  comment: ChecklistCommentRow
  currentUserId: string | null
  onUpdate: (body: string, mentions: string[]) => Promise<void>
  onDelete: () => Promise<void>
  members: OrganizationMemberRow[]
}

function CommentItem({ comment, currentUserId, onUpdate, onDelete, members }: CommentItemProps) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState(0)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const isAuthor = comment.author_id === currentUserId

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null) {
      if (e.key === 'Escape') {
        setMentionQuery(null)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'Escape') {
      setEditing(false)
      setEditBody(comment.body)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void saveEdit()
    }
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setEditBody(val)
    const pos = e.target.selectionStart ?? val.length
    setMentionAnchor(pos)
    setMentionQuery(getMentionQuery(val, pos))
  }

  const pickMentionEdit = (member: OrganizationMemberRow) => {
    const next = replaceMentionQuery(editBody, mentionAnchor, member.display_name)
    setEditBody(next)
    setMentionQuery(null)
    editRef.current?.focus()
  }

  const saveEdit = async () => {
    const body = editBody.trim()
    if (!body) return
    const mentions = extractMentionIds(body, members)
    await onUpdate(body, mentions)
    setEditing(false)
  }

  const mentionCandidates = mentionQuery !== null
    ? members
        .filter((m) => m.display_name.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 6)
    : []

  return (
    <li className="group flex gap-3">
      {/* Avatar letter */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a3d32]/10 text-xs font-semibold text-[#1a3d32]">
        {comment.author_name.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-neutral-900">{comment.author_name}</span>
          <span className="text-xs text-neutral-400">
            {new Date(comment.created_at).toLocaleString('nb-NO', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {comment.updated_at !== comment.created_at ? (
            <span className="text-xs italic text-neutral-400">(redigert)</span>
          ) : null}
        </div>

        {editing ? (
          <div className="relative mt-1">
            <textarea
              ref={editRef}
              value={editBody}
              onChange={handleEditChange}
              onKeyDown={handleEditKeyDown}
              rows={3}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
            />
            {mentionCandidates.length > 0 ? (
              <MentionDropdown members={mentionCandidates} onSelect={pickMentionEdit} />
            ) : null}
            <div className="mt-1.5 flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={saveEdit}>
                Lagre
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditing(false)
                  setEditBody(comment.body)
                }}
              >
                Avbryt
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm text-neutral-800 whitespace-pre-wrap">
            {renderBody(comment.body)}
          </p>
        )}
      </div>

      {isAuthor && !editing ? (
        <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Rediger"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Slett denne kommentaren?')) void onDelete()
            }}
            title="Slett"
            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </li>
  )
}

function MentionDropdown({
  members,
  onSelect,
}: {
  members: OrganizationMemberRow[]
  onSelect: (m: OrganizationMemberRow) => void
}) {
  return (
    <ul className="absolute left-0 z-20 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
      {members.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(m)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a3d32]/10 text-xs font-semibold text-[#1a3d32]">
              {m.display_name.charAt(0).toUpperCase()}
            </span>
            <span className="font-medium">{m.display_name}</span>
            {m.email ? <span className="text-xs text-neutral-500">{m.email}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  executionId: string
  /** Filter to a specific item, or null for execution-level comments. */
  itemKey?: string | null
  currentUserId: string | null
  comments: ChecklistCommentRow[]
  members: OrganizationMemberRow[]
  onLoad: () => Promise<void>
  onAdd: (payload: { executionId: string; itemKey?: string; body: string; mentions: string[] }) => Promise<unknown>
  onUpdate: (payload: { commentId: string; body: string; mentions: string[] }) => Promise<void>
  onDelete: (commentId: string, executionId: string) => Promise<void>
}

export function ExecutionCommentThread({
  executionId,
  itemKey = null,
  currentUserId,
  comments,
  members,
  onLoad,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [body, setBody] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void onLoad()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId])

  const visible = itemKey === null
    ? comments.filter((c) => c.item_key === null)
    : comments.filter((c) => c.item_key === itemKey)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setBody(val)
    const pos = e.target.selectionStart ?? val.length
    setMentionAnchor(pos)
    setMentionQuery(getMentionQuery(val, pos))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null) {
      if (e.key === 'Escape') {
        setMentionQuery(null)
        e.preventDefault()
      }
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  const pickMention = (member: OrganizationMemberRow) => {
    const next = replaceMentionQuery(body, mentionAnchor, member.display_name)
    setBody(next)
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  const submit = async () => {
    const trimmed = body.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    const mentions = extractMentionIds(trimmed, members)
    await onAdd({
      executionId,
      itemKey: itemKey ?? undefined,
      body: trimmed,
      mentions,
    })
    setBody('')
    setMentionQuery(null)
    setSubmitting(false)
  }

  const mentionCandidates = mentionQuery !== null
    ? members
        .filter((m) => m.display_name.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 6)
    : []

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex items-center gap-2">
        <AtSign className="h-4 w-4 text-neutral-500" />
        <h2 className="text-lg font-semibold text-neutral-900">Kommentarer og oppdateringer</h2>
        {visible.length > 0 ? (
          <span className="ml-auto text-xs text-neutral-500">{visible.length} melding{visible.length !== 1 ? 'er' : ''}</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Logg spørsmål, avklaringer og statusoppdateringer. Bruk @navn for å nevne en kollega.
      </p>

      {visible.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {visible.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              members={members}
              onUpdate={(b, m) => onUpdate({ commentId: c.id, body: b, mentions: m })}
              onDelete={() => onDelete(c.id, executionId)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-neutral-400 italic">Ingen kommentarer ennå.</p>
      )}

      {/* Compose box */}
      <div className="relative mt-4 border-t border-neutral-100 pt-4">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Skriv en kommentar … (Ctrl+Enter for å sende, @ for å nevne noen)"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
        />

        {mentionCandidates.length > 0 ? (
          <MentionDropdown members={mentionCandidates} onSelect={pickMention} />
        ) : null}

        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-neutral-400">Ctrl+Enter for å sende</p>
          <Button
            variant="primary"
            size="sm"
            icon={<Send className="h-3.5 w-3.5" />}
            disabled={!body.trim() || submitting}
            onClick={submit}
          >
            Send
          </Button>
        </div>
      </div>
    </ModuleSectionCard>
  )
}
