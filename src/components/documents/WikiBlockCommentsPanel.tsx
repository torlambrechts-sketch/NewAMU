// Per-block discussion panel for wiki pages.
//
// Surfaces threaded comments, suggestions, and proposed avvik with the right
// compliance posture: anonymity is opt-in (medvirkning, AML § 3-1); confidential
// rows route through the same UI as the whistleblowing vault (append-only,
// AML § 2A); retention is inherited from the parent page (GDPR Art. 5(1)(e)).

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock, MessageSquare, Pencil, Reply, ShieldAlert, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { Button } from '../ui/Button'
import { ToggleSwitch } from '../ui/FormToggles'
import { Badge } from '../ui/Badge'
import { MentionAutocomplete, type MentionUser } from './MentionAutocomplete'
import { canEditComment } from '../../hooks/useWikiPageComments'
import { useTickingClock } from '../../lib/useTickingClock'
import type {
  WikiPageComment,
  WikiPageCommentKind,
  WikiPageCommentSeverity,
} from '../../types/documents'

export type AddCommentArgs = {
  blockIndex: number
  body: string
  parentCommentId?: string | null
  kind: WikiPageCommentKind
  severity?: WikiPageCommentSeverity | null
  isAnonymous: boolean
  isConfidential: boolean
  mentionedUserIds: string[]
}

type Props = {
  blockIndex: number
  /** All comments for the page; panel filters by block. */
  comments: WikiPageComment[]
  currentUserId: string | undefined
  canView: boolean
  canComment: boolean
  mentionUsers: MentionUser[]
  /** "Bevares i 5 år (HMS-dokumentasjon)" — shown under the composer. */
  retentionHint?: string
  /** True if the viewer holds whistleblowing.committee or is org admin. */
  canSeeConfidential?: boolean
  /** When the page is a draft and the viewer can edit, surfaces a "Inviter
   *  en kollega" CTA in the empty state, deep-linking to the editor's
   *  Samarbeid tab. */
  inviteCollaboratorsHref?: string
  onAdd: (args: AddCommentArgs) => Promise<void>
  onEdit: (commentId: string, body: string) => Promise<void>
  onResolve: (commentId: string, resolved: boolean) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  /** Optional: when present, "Meld som avvik" appears on plain comments /
   *  suggestions that aren't already linked. Returning a deviation id is
   *  enough; caller refreshes its avvik list. */
  onPromoteToAvvik?: (input: {
    commentId: string
    body: string
    severity: WikiPageCommentSeverity
  }) => Promise<string | null>
}

const KIND_OPTIONS: { value: WikiPageCommentKind; label: string; description: string }[] = [
  { value: 'comment', label: 'Kommentar', description: 'Spørsmål eller diskusjon' },
  { value: 'suggestion', label: 'Forslag', description: 'Forbedringsforslag (AML § 3-1)' },
  { value: 'avvik_proposal', label: 'Avvik', description: 'Mistanke om avvik (IK-f § 5 nr. 7)' },
  { value: 'varsling', label: 'Varsling', description: 'Konfidensiell kanal (AML § 2A)' },
]

const SEVERITY_OPTIONS: { value: WikiPageCommentSeverity; label: string }[] = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

function kindChip(kind: WikiPageCommentKind): { label: string; className: string; icon: ReactNode } {
  switch (kind) {
    case 'suggestion':
      return {
        label: 'Forslag',
        className: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
        icon: <Sparkles className="size-3" aria-hidden />,
      }
    case 'avvik_proposal':
      return {
        label: 'Avvik',
        className: 'bg-orange-50 text-orange-900 border border-orange-200',
        icon: <ShieldAlert className="size-3" aria-hidden />,
      }
    case 'varsling':
      return {
        label: 'Varsling',
        className: 'bg-red-50 text-red-900 border border-red-300',
        icon: <Lock className="size-3" aria-hidden />,
      }
    default:
      return {
        label: 'Kommentar',
        className: 'bg-neutral-50 text-neutral-700 border border-neutral-200',
        icon: <MessageSquare className="size-3" aria-hidden />,
      }
  }
}

type FilterKey = 'all' | WikiPageCommentKind

export function WikiBlockCommentsPanel({
  blockIndex,
  comments,
  currentUserId,
  canView,
  canComment,
  mentionUsers,
  retentionHint,
  canSeeConfidential = false,
  inviteCollaboratorsHref,
  onAdd,
  onEdit,
  onResolve,
  onDelete,
  onPromoteToAvvik,
}: Props) {
  const now = useTickingClock()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showResolved, setShowResolved] = useState(false)
  const [replyParent, setReplyParent] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Composer state for new top-level comments + replies (shared).
  const [draft, setDraft] = useState('')
  const [draftKind, setDraftKind] = useState<WikiPageCommentKind>('comment')
  const [draftSeverity, setDraftSeverity] = useState<WikiPageCommentSeverity>('medium')
  const [draftAnonymous, setDraftAnonymous] = useState(false)
  const [draftConfidential, setDraftConfidential] = useState(false)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const forBlock = useMemo(
    () => comments.filter((c) => c.blockIndex === blockIndex && !c.deletedAt),
    [comments, blockIndex],
  )
  const filtered = useMemo(() => {
    if (filter === 'all') return forBlock
    return forBlock.filter((c) => c.kind === filter)
  }, [forBlock, filter])
  const visible = useMemo(
    () => filtered.filter((c) => showResolved || !c.resolved),
    [filtered, showResolved],
  )
  const tops = useMemo(() => visible.filter((c) => !c.parentCommentId), [visible])
  const repliesByParent = useMemo(() => {
    const map = new Map<string, WikiPageComment[]>()
    for (const c of visible) {
      if (c.parentCommentId) {
        if (!map.has(c.parentCommentId)) map.set(c.parentCommentId, [])
        map.get(c.parentCommentId)!.push(c)
      }
    }
    return map
  }, [visible])

  const counts = useMemo(() => {
    const out = { all: forBlock.length, comment: 0, suggestion: 0, avvik_proposal: 0, varsling: 0 }
    for (const c of forBlock) out[c.kind] += 1
    return out
  }, [forBlock])

  if (!canView) return null

  function resetComposer() {
    setDraft('')
    setDraftKind('comment')
    setDraftSeverity('medium')
    setDraftAnonymous(false)
    setDraftConfidential(false)
    setMentionIds([])
    setReplyParent(null)
  }

  async function submit() {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    setErr(null)
    try {
      const isConfidential = draftConfidential || draftKind === 'varsling'
      await onAdd({
        blockIndex,
        body,
        parentCommentId: replyParent,
        kind: draftKind,
        severity:
          draftKind === 'avvik_proposal' || draftKind === 'varsling' ? draftSeverity : null,
        isAnonymous: draftAnonymous,
        isConfidential,
        mentionedUserIds: mentionIds,
      })
      resetComposer()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kunne ikke lagre.')
    } finally {
      setBusy(false)
    }
  }

  async function submitEdit() {
    if (!editing) return
    const body = editing.body.trim()
    if (!body) return
    setBusy(true)
    setErr(null)
    try {
      await onEdit(editing.id, body)
      setEditing(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kunne ikke oppdatere kommentar.')
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
          Diskusjon ({counts.all})
        </Button>
        {forBlock.some((c) => c.resolved) ? (
          <label className="flex items-center gap-2 text-[11px] text-neutral-600">
            <ToggleSwitch checked={showResolved} onChange={setShowResolved} label="Vis løste kommentarer" />
            Vis løste
          </label>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3">
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            {(['all', 'comment', 'suggestion', 'avvik_proposal', 'varsling'] as FilterKey[]).map((k) => {
              const label =
                k === 'all'
                  ? `Alle (${counts.all})`
                  : `${kindChip(k).label} (${counts[k]})`
              if (k === 'varsling' && !canSeeConfidential) return null
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`rounded-full px-2 py-0.5 ${
                    filter === k
                      ? 'bg-[#0f766e] text-white'
                      : 'border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {tops.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-200 bg-white p-3 text-xs text-neutral-500">
              <p>Ingen innlegg ennå. Vær først ut.</p>
              {inviteCollaboratorsHref ? (
                <Link
                  to={inviteCollaboratorsHref}
                  className="mt-2 inline-flex items-center gap-1 text-[#0f766e] underline"
                >
                  <UserPlus className="size-3" aria-hidden />
                  Inviter en kollega til dokumentet
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2">
              {tops.map((c) => (
                <li key={c.id}>
                  <CommentRow
                    comment={c}
                    currentUserId={currentUserId}
                    now={now}
                    onStartEdit={() => setEditing({ id: c.id, body: c.body })}
                    onStartReply={() => {
                      setReplyParent(c.id)
                      setDraft('')
                      setDraftKind('comment')
                      setDraftAnonymous(false)
                      setDraftConfidential(c.isConfidential)
                    }}
                    onResolve={(r) => void onResolve(c.id, r)}
                    onDelete={() => void onDelete(c.id)}
                    onPromoteToAvvik={onPromoteToAvvik}
                  />
                  {repliesByParent.get(c.id)?.length ? (
                    <ul className="ml-5 mt-2 space-y-2 border-l border-neutral-200 pl-3">
                      {repliesByParent.get(c.id)!.map((r) => (
                        <li key={r.id}>
                          <CommentRow
                            comment={r}
                            currentUserId={currentUserId}
                            now={now}
                            onStartEdit={() => setEditing({ id: r.id, body: r.body })}
                            onResolve={(res) => void onResolve(r.id, res)}
                            onDelete={() => void onDelete(r.id)}
                            onPromoteToAvvik={onPromoteToAvvik}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {editing ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs">
              <p className="mb-2 text-[11px] font-medium text-amber-900">Rediger kommentar (innen 15 min)</p>
              <MentionAutocomplete
                value={editing.body}
                onChange={(v) => setEditing((s) => (s ? { ...s, body: v } : s))}
                users={mentionUsers}
                rows={3}
                className="text-xs"
              />
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="primary" size="sm" disabled={busy} onClick={() => void submitEdit()}>
                  Lagre
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  Avbryt
                </Button>
              </div>
            </div>
          ) : canComment ? (
            <div className="rounded border border-neutral-200 bg-white p-3">
              {replyParent ? (
                <p className="mb-2 flex items-center gap-2 text-[11px] text-neutral-600">
                  <Reply className="size-3" aria-hidden />
                  Svarer på kommentar
                  <button
                    type="button"
                    className="ml-auto text-[11px] text-neutral-500 underline"
                    onClick={() => setReplyParent(null)}
                  >
                    Avbryt
                  </button>
                </p>
              ) : (
                <div className="mb-2 flex flex-wrap gap-1">
                  {KIND_OPTIONS.map((opt) => {
                    const active = draftKind === opt.value
                    const chip = kindChip(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setDraftKind(opt.value)
                          if (opt.value === 'varsling') setDraftConfidential(true)
                        }}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                          active ? chip.className + ' ring-2 ring-offset-1 ring-emerald-300' : chip.className + ' opacity-70'
                        }`}
                        title={opt.description}
                      >
                        {chip.icon}
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}

              <MentionAutocomplete
                value={draft}
                onChange={setDraft}
                onMentionsChange={setMentionIds}
                users={mentionUsers}
                rows={3}
                placeholder={
                  replyParent
                    ? 'Skriv svar… (bruk @ for å nevne en kollega)'
                    : 'Skriv innlegg… (@ for å nevne en kollega)'
                }
                className="text-xs"
              />

              {!replyParent && (draftKind === 'avvik_proposal' || draftKind === 'varsling') ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-700">
                  <span>Alvorlighet:</span>
                  {SEVERITY_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setDraftSeverity(s.value)}
                      className={`rounded-full px-2 py-0.5 ${
                        draftSeverity === s.value
                          ? 'bg-[#0f766e] text-white'
                          : 'border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {!replyParent ? (
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-700">
                  <label className="flex items-center gap-2">
                    <ToggleSwitch checked={draftAnonymous} onChange={setDraftAnonymous} label="Send anonymt" />
                    Send anonymt
                  </label>
                  <label className="flex items-center gap-2" title="Append-only kanal. Synlig kun for deg, admin og varslingsutvalget.">
                    <ToggleSwitch
                      checked={draftConfidential || draftKind === 'varsling'}
                      onChange={(v) => {
                        if (draftKind === 'varsling') return
                        setDraftConfidential(v)
                      }}
                      label="Konfidensiell varsling"
                    />
                    Konfidensiell
                  </label>
                </div>
              ) : null}

              {(draftConfidential || draftKind === 'varsling') && !replyParent ? (
                <p className="mt-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-900">
                  <Lock className="mt-0.5 size-3" aria-hidden />
                  <span>
                    Append-only kanal i tråd med AML § 2A. Kommentaren kan ikke endres eller slettes etter
                    publisering, og synlig kun for deg, organisasjonsadmin og varslingsutvalget.
                  </span>
                </p>
              ) : null}

              {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="primary" size="sm" disabled={busy || !draft.trim()} onClick={() => void submit()}>
                  {busy
                    ? 'Sender…'
                    : replyParent
                      ? 'Send svar'
                      : draftKind === 'avvik_proposal'
                        ? 'Meld avvik'
                        : draftKind === 'varsling'
                          ? 'Send varsling'
                          : draftKind === 'suggestion'
                            ? 'Send forslag'
                            : 'Legg til kommentar'}
                </Button>
                {retentionHint ? (
                  <span className="text-[10px] text-neutral-500">{retentionHint}</span>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-500">Logg inn med dokumenttilgang for å delta.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CommentRow({
  comment,
  currentUserId,
  now,
  onStartEdit,
  onStartReply,
  onResolve,
  onDelete,
  onPromoteToAvvik,
}: {
  comment: WikiPageComment
  currentUserId: string | undefined
  now: number
  onStartEdit: () => void
  onStartReply?: () => void
  onResolve: (resolved: boolean) => void
  onDelete: () => void
  onPromoteToAvvik?: (input: {
    commentId: string
    body: string
    severity: WikiPageCommentSeverity
  }) => Promise<string | null>
}) {
  const chip = kindChip(comment.kind)
  const canEdit = canEditComment(comment, currentUserId, now)
  const isOwn = currentUserId === comment.authorId
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const canPromote =
    Boolean(onPromoteToAvvik) &&
    !comment.linkedAvvikId &&
    (comment.kind === 'comment' || comment.kind === 'suggestion') &&
    !comment.deletedAt &&
    !comment.hiddenUntilReviewed &&
    !comment.isConfidential
  return (
    <div
      className={`rounded border px-2 py-1.5 text-xs ${
        comment.hiddenUntilReviewed
          ? 'border-amber-300 bg-amber-50/80'
          : comment.isConfidential
            ? 'border-red-200 bg-red-50/60'
            : comment.resolved
              ? 'border-neutral-200 bg-white/60 opacity-70'
              : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${chip.className}`}
        >
          {chip.icon}
          {chip.label}
        </span>
        {comment.hiddenUntilReviewed ? (
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
            Avventer moderering
          </span>
        ) : null}
        {comment.severity ? (
          <Badge variant={severityVariant(comment.severity)}>{severityLabel(comment.severity)}</Badge>
        ) : null}
        <span className="font-medium text-neutral-800">
          {comment.isAnonymous ? 'Anonym ansatt' : comment.authorName}
        </span>
        <span className="ml-auto text-[10px] text-neutral-400">
          {new Date(comment.createdAt).toLocaleString('nb-NO')}
          {comment.editedHistory.length > 0 ? <span className="ml-1 italic">(redigert)</span> : null}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-neutral-700">{comment.body}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {onStartReply ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-[#0f766e] underline"
            onClick={onStartReply}
          >
            <Reply className="size-3" aria-hidden /> Svar
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-neutral-700 underline"
            onClick={onStartEdit}
          >
            <Pencil className="size-3" aria-hidden /> Rediger
          </button>
        ) : null}
        {!comment.isConfidential ? (
          <button
            type="button"
            className="text-[11px] text-[#1a3d32] underline"
            onClick={() => onResolve(!comment.resolved)}
          >
            {comment.resolved ? 'Gjenåpne' : comment.kind === 'suggestion' ? 'Marker som tatt i bruk' : 'Løs ut'}
          </button>
        ) : null}
        {canPromote ? (
          <div className="relative inline-flex">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] text-orange-700 underline"
              onClick={() => setPromoteOpen((o) => !o)}
            >
              <ShieldAlert className="size-3" aria-hidden /> Meld som avvik
            </button>
            {promoteOpen ? (
              <div className="absolute left-0 top-5 z-20 w-48 rounded-md border border-neutral-200 bg-white p-2 text-[11px] shadow-lg">
                <p className="mb-1 font-medium text-neutral-700">Velg alvorlighet:</p>
                <ul className="space-y-0.5">
                  {(['low', 'medium', 'high', 'critical'] as WikiPageCommentSeverity[]).map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        disabled={promoting}
                        className="w-full rounded px-2 py-1 text-left hover:bg-neutral-50 disabled:opacity-50"
                        onClick={async () => {
                          if (!onPromoteToAvvik) return
                          setPromoting(true)
                          try {
                            await onPromoteToAvvik({
                              commentId: comment.id,
                              body: comment.body,
                              severity: s,
                            })
                            setPromoteOpen(false)
                          } finally {
                            setPromoting(false)
                          }
                        }}
                      >
                        {severityLabel(s)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {comment.linkedAvvikId ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-orange-700">
            <ShieldAlert className="size-3" aria-hidden /> Avvik opprettet
          </span>
        ) : null}
        {isOwn && !comment.isConfidential ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-red-600 underline"
            onClick={onDelete}
          >
            <Trash2 className="size-3" aria-hidden /> Slett
          </button>
        ) : null}
      </div>
    </div>
  )
}

function severityLabel(s: WikiPageCommentSeverity): string {
  switch (s) {
    case 'low':
      return 'Lav'
    case 'medium':
      return 'Middels'
    case 'high':
      return 'Høy'
    case 'critical':
      return 'Kritisk'
  }
}

function severityVariant(s: WikiPageCommentSeverity): 'neutral' | 'success' | 'warning' | 'danger' {
  if (s === 'critical' || s === 'high') return 'danger'
  if (s === 'medium') return 'warning'
  return 'neutral'
}
