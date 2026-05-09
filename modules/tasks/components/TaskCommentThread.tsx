// TaskCommentThread — add and view comments on a task item.
// Authors may delete their own comments (author_user_id match).
// Threaded replies are not rendered yet — parent_comment_id is stored but
// all comments appear flat, sorted oldest-first.

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

type Comment = {
  id: string
  body: string
  authorName: string
  authorUserId: string | null
  createdAt: string
  editedAt: string | null
}

type Props = { taskItemId: string }

function fmtTs(s: string) {
  try {
    return new Date(s).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return s
  }
}

export function TaskCommentThread({ taskItemId }: Props) {
  const { supabase, user } = useOrgSetupContext()
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_comments')
      .select('id, body, author_name, author_user_id, created_at, edited_at')
      .eq('task_item_id', taskItemId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (data) {
      setComments(
        data.map((r) => ({
          id: String(r.id),
          body: String(r.body ?? ''),
          authorName: String(r.author_name ?? 'Ukjent'),
          authorUserId: r.author_user_id ? String(r.author_user_id) : null,
          createdAt: String(r.created_at),
          editedAt: r.edited_at ? String(r.edited_at) : null,
        })),
      )
    }
  }, [supabase, taskItemId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    if (!supabase || !body.trim()) return
    setSubmitting(true)
    const authorName = (user as { email?: string } | null)?.email?.split('@')[0] ?? 'Ukjent'
    const { data } = await supabase
      .from('task_comments')
      .insert({
        task_item_id: taskItemId,
        body: body.trim(),
        author_name: authorName,
        author_user_id: user?.id ?? null,
      })
      .select('id, body, author_name, author_user_id, created_at, edited_at')
      .single()
    if (data) {
      setComments((prev) => [
        ...prev,
        {
          id: String(data.id),
          body: String(data.body),
          authorName: String(data.author_name ?? authorName),
          authorUserId: data.author_user_id ? String(data.author_user_id) : null,
          createdAt: String(data.created_at),
          editedAt: null,
        },
      ])
    }
    setBody('')
    setSubmitting(false)
    textRef.current?.focus()
  }

  const remove = async (id: string) => {
    if (!supabase) return
    setComments((prev) => prev.filter((c) => c.id !== id))
    await supabase
      .from('task_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-neutral-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Kommentarer {comments.length > 0 ? `· ${comments.length}` : ''}
        </span>
      </div>

      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
                {c.authorName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-neutral-800">{c.authorName}</span>
                  <span className="text-[11px] text-neutral-400">{fmtTs(c.createdAt)}</span>
                  {c.editedAt && (
                    <span className="text-[11px] text-neutral-400">(redigert)</span>
                  )}
                  {user?.id && c.authorUserId === user.id && (
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      className="ml-auto hidden text-neutral-400 transition hover:text-red-500 group-hover:block"
                      aria-label="Slett kommentar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <textarea
          ref={textRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit()
          }}
          rows={2}
          placeholder="Skriv en kommentar… (Ctrl+Enter for å sende)"
          className="flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !body.trim()}
          className="flex shrink-0 items-center gap-1 self-end rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40"
          aria-label="Send kommentar"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
