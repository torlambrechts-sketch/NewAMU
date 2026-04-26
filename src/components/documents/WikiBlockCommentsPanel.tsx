import { useMemo, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '../ui/Button'
import { StandardTextarea } from '../ui/Textarea'
import { ToggleSwitch } from '../ui/FormToggles'
import type { WikiPageComment } from '../../types/documents'

type Props = {
  blockIndex: number
  comments: WikiPageComment[]
  currentUserId: string | undefined
  canView: boolean
  canComment: boolean
  onAdd: (blockIndex: number, body: string) => Promise<void>
  onResolve: (commentId: string, resolved: boolean) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

export function WikiBlockCommentsPanel({
  blockIndex,
  comments,
  currentUserId,
  canView,
  canComment,
  onAdd,
  onResolve,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  if (!canView) return null

  const forBlock = useMemo(
    () => comments.filter((c) => c.blockIndex === blockIndex),
    [comments, blockIndex],
  )
  const visible = useMemo(
    () => forBlock.filter((c) => showResolved || !c.resolved),
    [forBlock, showResolved],
  )

  async function submit() {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    setErr(null)
    try {
      await onAdd(blockIndex, body)
      setDraft('')
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kunne ikke lagre kommentar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 border-t border-neutral-100 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-neutral-600"
          icon={<MessageSquare className="size-3.5" />}
          onClick={() => setOpen((o) => !o)}
        >
          Kommentarer ({forBlock.length})
        </Button>
        {forBlock.some((c) => c.resolved) ? (
          <label className="flex items-center gap-2 text-[11px] text-neutral-600">
            <ToggleSwitch checked={showResolved} onChange={setShowResolved} label="Vis løste kommentarer" />
            Vis løste
          </label>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3">
          {visible.length === 0 ? (
            <p className="text-xs text-neutral-500">Ingen kommentarer.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {visible.map((c) => (
                <li
                  key={c.id}
                  className={`rounded border px-2 py-1.5 ${
                    c.resolved ? 'border-neutral-200 bg-white/60 opacity-70' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-medium text-neutral-800">{c.authorName}</span>
                    <span className="text-[10px] text-neutral-400">{new Date(c.createdAt).toLocaleString('nb-NO')}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-neutral-700">{c.body}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {currentUserId === c.authorId ? (
                      <button type="button" className="text-[11px] text-red-600 underline" onClick={() => void onDelete(c.id)}>
                        Slett
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-[11px] text-[#1a3d32] underline"
                      onClick={() => void onResolve(c.id, !c.resolved)}
                    >
                      {c.resolved ? 'Gjenåpne' : 'Løs ut'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canComment ? (
            <>
              <StandardTextarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Skriv kommentar…"
                className="text-xs"
              />
              {err ? <p className="text-xs text-red-600">{err}</p> : null}
              <Button type="button" variant="secondary" size="sm" disabled={busy || !draft.trim()} onClick={() => void submit()}>
                {busy ? 'Sender…' : 'Legg til'}
              </Button>
            </>
          ) : (
            <p className="text-[11px] text-neutral-500">Logg inn for å kommentere.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
