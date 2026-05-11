// Moderation queue for documents collaboration.
//
// Only visible to org admin / documents.manage / whistleblowing.committee.
// Lists flagged comments that the harassment-keyword trigger has hidden,
// alongside their context (page, author, matched terms, reason). The
// reviewer can release the comment (un-hide for everyone), keep it hidden,
// or escalate it to varsling (turns it into a confidential append-only
// row that goes into the whistleblowing channel).

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ShieldAlert, ShieldOff, Lock } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WarningBox } from '../../components/ui/AlertBox'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import {
  useDocumentModerationQueue,
  type ModerationAction,
  type ModerationFlag,
} from '../../hooks/useDocumentModerationQueue'

const FILTER_OPTIONS: { value: ModerationAction | 'all'; label: string }[] = [
  { value: 'pending_review', label: 'Avventer' },
  { value: 'released', label: 'Frigitt' },
  { value: 'kept_hidden', label: 'Skjult' },
  { value: 'escalated_to_varsling', label: 'Varsling' },
  { value: 'all', label: 'Alle' },
]

export function DocumentModerationQueuePage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ModerationAction | 'all'>('pending_review')
  const { flags, loading, error, decide, counts, canModerate } = useDocumentModerationQueue(filter)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      filter === 'all' ? flags : flags.filter((f) => f.action === filter),
    [flags, filter],
  )

  if (!canModerate) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }, { label: 'Moderering' }]}
        title="Moderering"
        description={<p className="max-w-3xl text-sm text-neutral-600">Du har ikke tilgang til moderering.</p>}
      >
        <WarningBox>
          Bare organisasjonsadmin, dokument-administratorer og varslingsutvalget har tilgang til denne siden.
        </WarningBox>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }, { label: 'Moderering' }]}
      title="Moderering av kommentarer"
      description={
        <p className="max-w-3xl text-sm text-neutral-600">
          Kommentarer som inneholder ord som tyder på mobbing, trakassering eller diskriminering (AML § 4-3) skjules
          automatisk fra tråden inntil noen tar en avgjørelse. Frigi kommentaren, hold den skjult, eller eskaler den
          til varsling.
        </p>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.value === 'all' ? flags.length : counts[opt.value as ModerationAction] ?? 0
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`rounded-full px-2 py-0.5 ${
                filter === opt.value
                  ? 'bg-[#0f766e] text-white'
                  : 'border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
              }`}
            >
              {opt.label} ({count})
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="mb-3">
          <WarningBox>{error}</WarningBox>
        </div>
      ) : null}
      {actionErr ? (
        <div className="mb-3">
          <WarningBox>{actionErr}</WarningBox>
        </div>
      ) : null}

      <ModuleSectionCard>
        {loading ? (
          <p className="text-sm text-neutral-500">Laster…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen flagg i denne kategorien.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead>
                <tr className={MODULE_TABLE_TH}>
                  <th className="px-3 py-2">Dokument</th>
                  <th className="px-3 py-2">Forfatter</th>
                  <th className="px-3 py-2">Kommentar</th>
                  <th className="px-3 py-2">Treff</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Handling</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((flag) => (
                  <ModerationRow
                    key={flag.id}
                    flag={flag}
                    note={notes[flag.id] ?? ''}
                    onNoteChange={(v) => setNotes((m) => ({ ...m, [flag.id]: v }))}
                    busy={busyId === flag.id}
                    onDecide={async (action) => {
                      setBusyId(flag.id)
                      setActionErr(null)
                      try {
                        await decide(flag.id, action, notes[flag.id])
                        setNotes((m) => {
                          const next = { ...m }
                          delete next[flag.id]
                          return next
                        })
                      } catch (e) {
                        setActionErr(e instanceof Error ? e.message : 'Kunne ikke oppdatere.')
                      } finally {
                        setBusyId(null)
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => navigate('/documents')}>
          Tilbake til dokumenter
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate('/documents/privacy')}>
          Personvern (GDPR Art. 15 / 17)
        </Button>
      </div>
    </ModulePageShell>
  )
}

function ModerationRow({
  flag,
  note,
  onNoteChange,
  busy,
  onDecide,
}: {
  flag: ModerationFlag
  note: string
  onNoteChange: (v: string) => void
  busy: boolean
  onDecide: (action: Exclude<ModerationAction, 'pending_review'>) => Promise<void>
}) {
  const pending = flag.action === 'pending_review'
  return (
    <tr className={MODULE_TABLE_TR_BODY}>
      <td className="px-3 py-2 align-top">
        <Link to={`/documents/page/${flag.pageId}?tab=diskusjon`} className="font-medium text-[#0f766e] underline">
          {flag.pageTitle}
        </Link>
      </td>
      <td className="px-3 py-2 align-top text-neutral-700">{flag.authorName}</td>
      <td className="px-3 py-2 align-top">
        <p className="line-clamp-3 whitespace-pre-wrap text-neutral-800">{flag.body}</p>
        <p className="mt-1 text-[10px] text-neutral-400">{new Date(flag.flaggedAt).toLocaleString('nb-NO')}</p>
        {!pending && flag.reviewerNote ? (
          <p className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-1.5 text-[11px] italic text-neutral-600">
            {flag.reviewerNote}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top">
        <p className="text-[11px] text-neutral-700">{flag.reason}</p>
        <ul className="mt-1 flex flex-wrap gap-1 text-[10px]">
          {flag.matchedTerms.map((t) => (
            <li key={t} className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-900">
              {t}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-3 py-2 align-top">
        <Badge variant={statusVariant(flag.action)}>{statusLabel(flag.action)}</Badge>
      </td>
      <td className="px-3 py-2 align-top">
        {pending ? (
          <div className="space-y-2">
            <StandardTextarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={2}
              placeholder="Frivillig notat — synlig kun for moderatorer."
              className="text-xs"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() => void onDecide('released')}
                icon={<CheckCircle2 className="size-3.5" aria-hidden />}
              >
                Frigi
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void onDecide('kept_hidden')}
                icon={<ShieldOff className="size-3.5" aria-hidden />}
              >
                Hold skjult
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void onDecide('escalated_to_varsling')}
                icon={<Lock className="size-3.5" aria-hidden />}
              >
                Til varsling
              </Button>
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
            <ShieldAlert className="size-3" aria-hidden />
            {flag.reviewedAt ? new Date(flag.reviewedAt).toLocaleDateString('nb-NO') : ''}
          </span>
        )}
      </td>
    </tr>
  )
}

function statusLabel(action: ModerationAction): string {
  switch (action) {
    case 'pending_review':
      return 'Avventer'
    case 'released':
      return 'Frigitt'
    case 'kept_hidden':
      return 'Skjult'
    case 'escalated_to_varsling':
      return 'Til varsling'
  }
}

function statusVariant(action: ModerationAction): 'warning' | 'success' | 'neutral' | 'danger' {
  switch (action) {
    case 'pending_review':
      return 'warning'
    case 'released':
      return 'success'
    case 'kept_hidden':
      return 'neutral'
    case 'escalated_to_varsling':
      return 'danger'
  }
}
