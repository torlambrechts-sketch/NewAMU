// GovOutboxPage — admin triage for gov_notifications_outbox.
//
// After Schrems-II the SendGrid auto-transport was removed (see
// _121000), so rows of kind manual_datatilsynet_submission /
// manual_arbeidstilsynet_submission / manual_ldo_export accumulate in
// the outbox with payload.status='awaiting_human' until a human files
// them via the regulator's own portal. This page surfaces that queue,
// lets admins record an external reference (e.g. Altinn-saksnummer) or
// cancel with a documented reason, and writes every action to the
// append-only gov_outbox_triage_log (IK-f § 5 nr. 7).

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileWarning,
  Hash,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

// ─── Enum + label maps ─────────────────────────────────────────────────────

// Mirrors the CHECK constraint from
// supabase/migrations/20260907121000_gov_outbox_manual_kinds.sql
type OutboxKind =
  | 'datatilsynet_breach'
  | 'nav_sykefravar_outbox'
  | 'ldo_export_pending'
  | 'datatilsynet_manual_send_required'
  | 'manual_datatilsynet_submission'
  | 'manual_ldo_export'
  | 'manual_arbeidstilsynet_submission'

const KIND_OPTIONS: OutboxKind[] = [
  'manual_datatilsynet_submission',
  'manual_arbeidstilsynet_submission',
  'manual_ldo_export',
  'datatilsynet_breach',
  'datatilsynet_manual_send_required',
  'nav_sykefravar_outbox',
  'ldo_export_pending',
]

const KIND_LABELS: Record<OutboxKind, string> = {
  manual_datatilsynet_submission: 'Datatilsynet — manuell innsending',
  manual_arbeidstilsynet_submission: 'Arbeidstilsynet — manuell innsending',
  manual_ldo_export: 'LDO — eksport',
  datatilsynet_breach: 'Datatilsynet — automatisk',
  datatilsynet_manual_send_required: 'Datatilsynet — krever manuell sending',
  nav_sykefravar_outbox: 'NAV — sykefraværsoppfølging',
  ldo_export_pending: 'LDO — venter på eksport',
}

type OutboxStatus = 'awaiting_human' | 'pending' | 'sent' | 'failed' | 'cancelled'

const STATUS_OPTIONS: OutboxStatus[] = ['awaiting_human', 'pending', 'sent', 'failed', 'cancelled']

const STATUS_LABELS: Record<OutboxStatus, string> = {
  awaiting_human: 'Venter på behandling',
  pending: 'I kø',
  sent: 'Sendt',
  failed: 'Feilet',
  cancelled: 'Avbrutt',
}

const STATUS_BADGE: Record<OutboxStatus, BadgeVariant> = {
  awaiting_human: 'warning',
  pending: 'info',
  sent: 'success',
  failed: 'danger',
  cancelled: 'neutral',
}

// ─── Row shape ─────────────────────────────────────────────────────────────

type OutboxRow = {
  id: string
  organization_id: string
  kind: OutboxKind
  payload: Record<string, unknown>
  resolved_at: string | null
  attempt_count: number
  last_error: string | null
  created_at: string
  updated_at: string
  rule_id: string | null
  run_id: string | null
}

// Derive logical status: resolved_at + payload.status combine.
function deriveStatus(row: OutboxRow): OutboxStatus {
  const ps = typeof row.payload?.status === 'string' ? (row.payload.status as string) : ''
  if (row.resolved_at && ps === 'cancelled') return 'cancelled'
  if (row.resolved_at) return 'sent'
  if (ps === 'awaiting_human') return 'awaiting_human'
  if (row.last_error) return 'failed'
  return 'pending'
}

// ─── Norwegian relative-time formatter ─────────────────────────────────────

function ageNorwegian(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return 'akkurat nå'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} ${min === 1 ? 'minutt' : 'minutter'} siden`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr} ${hr === 1 ? 'time' : 'timer'} siden`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day} ${day === 1 ? 'dag' : 'dager'} siden`
  const wk = Math.floor(day / 7)
  if (wk < 8) return `${wk} ${wk === 1 ? 'uke' : 'uker'} siden`
  const mo = Math.floor(day / 30)
  return `${mo} ${mo === 1 ? 'måned' : 'måneder'} siden`
}

function hoursSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000))
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

// ─── Per-kind payload summary ──────────────────────────────────────────────

type SummaryField = { label: string; value: string }

function payloadSummary(row: OutboxRow): SummaryField[] {
  const p = (row.payload ?? {}) as Record<string, unknown>
  const out: SummaryField[] = []
  const push = (label: string, raw: unknown) => {
    if (raw == null) return
    if (typeof raw === 'string') {
      if (raw.trim().length === 0) return
      out.push({ label, value: raw })
      return
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      out.push({ label, value: String(raw) })
      return
    }
    if (Array.isArray(raw)) {
      if (raw.length === 0) return
      out.push({ label, value: raw.map((v) => String(v)).join(', ') })
      return
    }
    if (typeof raw === 'object') {
      out.push({ label, value: JSON.stringify(raw) })
    }
  }

  if (row.kind === 'manual_datatilsynet_submission' || row.kind === 'datatilsynet_breach' || row.kind === 'datatilsynet_manual_send_required') {
    push('Ble kjent (awareAt)', p.awareAt ?? (p as Record<string, unknown>).aware_at)
    push('Bruddets art', p.natureOfBreach ?? (p as Record<string, unknown>).nature_of_breach)
    push('Berørte kategorier', p.affectedCategories ?? (p as Record<string, unknown>).affected_categories)
    push('Instruksjon til melder', p.submitterInstructions ?? (p as Record<string, unknown>).submitter_instructions)
  } else if (row.kind === 'manual_arbeidstilsynet_submission') {
    push('Melders rolle', p.melderRolle ?? (p as Record<string, unknown>).melder_rolle)
    push('Hendelsesdato', p.hendelseDato ?? (p as Record<string, unknown>).hendelse_dato)
    push('Skadetype', p.skadetype)
    push('Personskadekategori', p.personskadeKategori ?? (p as Record<string, unknown>).personskade_kategori)
  } else if (row.kind === 'manual_ldo_export' || row.kind === 'ldo_export_pending') {
    push('Eksport-periode', p.period)
    push('Lovreferanser', p.law_refs)
    push('Manifest sha256', p.ldo_export_manifest_sha256 ?? (p as Record<string, unknown>).manifest_sha256)
  } else if (row.kind === 'nav_sykefravar_outbox') {
    push('Skjema', p.skjema)
  }

  return out
}

// ─── Hash + checksum helpers ───────────────────────────────────────────────

function pickHash(row: OutboxRow): string | null {
  const p = (row.payload ?? {}) as Record<string, unknown>
  const h = p.payload_sha256 ?? p.manifest_sha256 ?? p.sha256 ?? p.ldo_export_manifest_sha256 ?? p.checksum
  return typeof h === 'string' && h.length > 0 ? h : null
}

function truncMid(s: string, head = 8, tail = 6): string {
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

// ─── KPI strip ─────────────────────────────────────────────────────────────

type Kpis = {
  awaiting: number
  sentThisWeek: number
  failedLast7d: number
  oldestPendingHours: number | null
}

function computeKpis(rows: OutboxRow[]): Kpis {
  const now = Date.now()
  const oneWeek = 7 * 86_400_000
  let awaiting = 0
  let sentThisWeek = 0
  let failedLast7d = 0
  let oldest: number | null = null
  for (const row of rows) {
    const status = deriveStatus(row)
    const created = new Date(row.created_at).getTime()
    if (status === 'awaiting_human') {
      awaiting += 1
      const h = hoursSince(row.created_at)
      if (oldest === null || h > oldest) oldest = h
    }
    if (status === 'sent' && row.resolved_at) {
      const t = new Date(row.resolved_at).getTime()
      if (now - t <= oneWeek) sentThisWeek += 1
    }
    if (status === 'failed' && now - created <= oneWeek) failedLast7d += 1
  }
  return { awaiting, sentThisWeek, failedLast7d, oldestPendingHours: oldest }
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <ModuleSectionCard className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className="mt-2 text-3xl font-semibold tabular-nums"
        style={{ color: accent ?? '#1a3d32' }}
      >
        {value}
      </p>
    </ModuleSectionCard>
  )
}

// ─── Filter rail ───────────────────────────────────────────────────────────

type Filters = {
  kinds: Set<OutboxKind>
  statuses: Set<OutboxStatus>
  maxAgeDays: number
}

function FilterRail({
  filters,
  setFilters,
  onResetAge,
}: {
  filters: Filters
  setFilters: (next: Filters) => void
  onResetAge: () => void
}) {
  const toggleKind = (kind: OutboxKind) => {
    const next = new Set(filters.kinds)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    setFilters({ ...filters, kinds: next })
  }
  const toggleStatus = (status: OutboxStatus) => {
    const next = new Set(filters.statuses)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setFilters({ ...filters, statuses: next })
  }

  return (
    <ModuleSectionCard className="space-y-5 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Type melding</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KIND_OPTIONS.map((k) => {
            const active = filters.kinds.has(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {KIND_LABELS[k]}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Status</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const active = filters.statuses.has(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Maks alder
          </p>
          <button
            type="button"
            onClick={onResetAge}
            className="text-[11px] text-neutral-500 underline hover:text-neutral-800"
          >
            Nullstill
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={filters.maxAgeDays}
            onChange={(e) => setFilters({ ...filters, maxAgeDays: Number(e.target.value) })}
            className="flex-1 accent-[#1a3d32]"
            aria-label="Maks alder i dager"
          />
          <span className="w-16 text-right text-sm font-semibold tabular-nums text-neutral-700">
            {filters.maxAgeDays === 0 ? 'alle' : `${filters.maxAgeDays} d`}
          </span>
        </div>
      </div>
    </ModuleSectionCard>
  )
}

// ─── Triage card ───────────────────────────────────────────────────────────

function KindIcon({ kind }: { kind: OutboxKind }) {
  if (kind.startsWith('manual_arbeidstilsynet') || kind === 'nav_sykefravar_outbox') {
    return <ShieldCheck className="size-4 shrink-0 text-[#c2410c]" aria-hidden />
  }
  if (kind.startsWith('manual_ldo') || kind === 'ldo_export_pending') {
    return <Megaphone className="size-4 shrink-0 text-[#0e7490]" aria-hidden />
  }
  return <ShieldCheck className="size-4 shrink-0 text-[#1a3d32]" aria-hidden />
}

function TriageCard({
  row,
  onMarkSent,
  onCancel,
  onShowPayload,
}: {
  row: OutboxRow
  onMarkSent: () => void
  onCancel: () => void
  onShowPayload: () => void
}) {
  const status = deriveStatus(row)
  const summary = payloadSummary(row)
  const hash = pickHash(row)
  const [expanded, setExpanded] = useState(false)

  const canTriage = status === 'awaiting_human' || status === 'pending'

  return (
    <ModuleSectionCard className="space-y-3 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <KindIcon kind={row.kind} />
            <span>{KIND_LABELS[row.kind]}</span>
            <Badge variant={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="size-3" aria-hidden />
            <span>{ageNorwegian(row.created_at)}</span>
            {row.attempt_count > 0 ? <span>· {row.attempt_count} forsøk</span> : null}
          </p>
        </div>
      </header>

      {summary.length > 0 ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {summary.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {f.label}
              </dt>
              <dd className="break-words text-neutral-800">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-neutral-500">Ingen strukturerte felt i payload.</p>
      )}

      {hash ? (
        <div className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-700 hover:text-neutral-900"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
            <Hash className="size-3.5" aria-hidden />
            <span>{expanded ? hash : truncMid(hash, 10, 8)}</span>
          </button>
        </div>
      ) : null}

      {row.last_error ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="break-words">{row.last_error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!canTriage}
          onClick={onMarkSent}
          icon={<CheckCircle2 className="size-3.5" aria-hidden />}
        >
          Marker som sendt manuelt
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canTriage}
          onClick={onCancel}
          icon={<XCircle className="size-3.5" aria-hidden />}
        >
          Avbryt
        </Button>
        <Button variant="ghost" size="sm" onClick={onShowPayload}>
          Vis full payload
        </Button>
      </div>
    </ModuleSectionCard>
  )
}

// ─── Mark-sent dialog ──────────────────────────────────────────────────────

function MarkSentDialog({
  row,
  onClose,
  onSubmit,
  pending,
}: {
  row: OutboxRow
  onClose: () => void
  onSubmit: (input: { externalRef: string; sentAt: string; note: string }) => Promise<void>
  pending: boolean
}) {
  const [externalRef, setExternalRef] = useState('')
  const [sentAt, setSentAt] = useState<string>(() => new Date().toISOString().slice(0, 16))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canSubmit = externalRef.trim().length > 0 && sentAt.length > 0 && !pending

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Lukk"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-sent-title"
        className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
      >
        <h3 id="mark-sent-title" className="text-lg font-semibold text-neutral-900">
          Marker som sendt manuelt
        </h3>
        <p className="mt-1 text-sm text-neutral-600">
          {KIND_LABELS[row.kind]} — bekreft at du har sendt meldingen via regulators portal.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              Tidspunkt for innsending
            </span>
            <StandardInput
              type="datetime-local"
              value={sentAt}
              onChange={(e) => setSentAt(e.target.value)}
              className="mt-1.5"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              Saksnummer / referanse fra regulator
            </span>
            <StandardInput
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="f.eks. Altinn-saksnummer 2026-09-…"
              className="mt-1.5"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              Notat (valgfritt)
            </span>
            <StandardTextarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eventuell kontekst (mottatt PDF arkivert under …)"
              className="mt-1.5"
              rows={3}
            />
          </label>
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSubmit}
            onClick={async () => {
              setError(null)
              try {
                const iso = new Date(sentAt).toISOString()
                await onSubmit({ externalRef: externalRef.trim(), sentAt: iso, note: note.trim() })
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Kunne ikke registrere innsendingen.')
              }
            }}
          >
            Bekreft sendt
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Cancel dialog ─────────────────────────────────────────────────────────

function CancelDialog({
  row,
  onClose,
  onSubmit,
  pending,
}: {
  row: OutboxRow
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
  pending: boolean
}) {
  const [reason, setReason] = useState('')
  // UX Run 2 — type-the-phrase guard. The 10-char reason already protects
  // against accidental clicks, but a typed phrase ("AVBRYT") catches the
  // scarier copy-paste-the-old-reason mistake when the admin meant to
  // cancel a different row.
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const trimmedReason = reason.trim()
  const reasonTooShort = trimmedReason.length > 0 && trimmedReason.length < 10
  const phraseOk = phrase === 'AVBRYT'
  const canSubmit = trimmedReason.length >= 10 && phraseOk && !pending

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Lukk"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 id="cancel-title" className="text-lg font-semibold text-neutral-900">
              Avbryt {KIND_LABELS[row.kind].toLowerCase()}?
            </h3>
            <WarningBox>
              Avbryter du, blir ikke regulator varslet. Forsikre deg om at du har en annen kanal til
              kommunikasjonen.
            </WarningBox>
          </div>
        </div>
        <label className="mt-4 block text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
            Begrunnelse (kreves — minst 10 tegn)
          </span>
          <StandardTextarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="f.eks. duplikat av sak 2026-09-… eller sendt via brev/epost"
            className="mt-1.5"
            rows={3}
            required
            minLength={10}
          />
        </label>
        {reasonTooShort ? (
          <p className="mt-2 text-xs text-rose-700">Begrunnelse må være minst 10 tegn.</p>
        ) : null}
        <label className="mt-4 block text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
            Skriv "AVBRYT" for å bekrefte:
          </span>
          <StandardInput
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="AVBRYT"
            autoComplete="off"
            spellCheck={false}
            className="mt-1.5 font-mono"
            aria-invalid={phrase.length > 0 && !phraseOk}
          />
          {phrase.length > 0 && !phraseOk ? (
            <span className="mt-1 block text-[11px] text-rose-700">
              Frasen må stemme nøyaktig (skiller mellom store og små bokstaver).
            </span>
          ) : null}
        </label>
        {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Behold
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!canSubmit}
            onClick={async () => {
              setError(null)
              try {
                await onSubmit(reason.trim())
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Kunne ikke avbryte raden.')
              }
            }}
          >
            Avbryt meldingen
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Full-payload slide panel ──────────────────────────────────────────────

function PayloadSlidePanel({ row, onClose }: { row: OutboxRow; onClose: () => void }) {
  const hash = pickHash(row)
  const evidencePath =
    (row.payload as Record<string, unknown>)?.evidence_storage_path ??
    (row.payload as Record<string, unknown>)?.evidence_path ??
    (row.payload as Record<string, unknown>)?.signed_url ??
    null
  return (
    <SlidePanel
      open
      onClose={onClose}
      titleId="gov-outbox-payload-title"
      title="Full payload"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Lukk
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            {KIND_LABELS[row.kind]}
          </p>
          <p className="text-sm text-neutral-700">Opprettet {ageNorwegian(row.created_at)}</p>
        </div>

        {hash ? (
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs">
            <p className="font-semibold text-neutral-600">Manifest sha256</p>
            <p className="break-all font-mono text-[11px] text-neutral-800">{hash}</p>
          </div>
        ) : null}

        {evidencePath ? (
          <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs">
            <p className="font-semibold text-neutral-600">Bevis-lagring</p>
            <p className="break-all font-mono text-[11px] text-neutral-800">{String(evidencePath)}</p>
          </div>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Payload
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-800">
            {JSON.stringify(row.payload, null, 2)}
          </pre>
        </div>
      </div>
    </SlidePanel>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function GovOutboxPage() {
  const { supabase, organization } = useOrgSetupContext()
  const [rows, setRows] = useState<OutboxRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<boolean>(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [markSent, setMarkSent] = useState<OutboxRow | null>(null)
  const [cancelRow, setCancelRow] = useState<OutboxRow | null>(null)
  const [payloadRow, setPayloadRow] = useState<OutboxRow | null>(null)

  const [filters, setFilters] = useState<Filters>({
    kinds: new Set<OutboxKind>([
      'manual_datatilsynet_submission',
      'manual_arbeidstilsynet_submission',
      'manual_ldo_export',
    ]),
    statuses: new Set<OutboxStatus>(['awaiting_human', 'pending']),
    maxAgeDays: 30,
  })

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('gov_notifications_outbox')
        .select(
          'id, organization_id, kind, payload, resolved_at, attempt_count, last_error, created_at, updated_at, rule_id, run_id',
        )
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(500)
      if (e) throw e
      setRows((data ?? []) as OutboxRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste utboksen.')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const kpis = useMemo(() => computeKpis(rows), [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.kinds.size > 0 && !filters.kinds.has(row.kind)) return false
      if (filters.statuses.size > 0 && !filters.statuses.has(deriveStatus(row))) return false
      if (filters.maxAgeDays > 0 && daysSince(row.created_at) > filters.maxAgeDays) return false
      return true
    })
  }, [rows, filters])

  const handleMarkSent = useCallback(
    async (input: { externalRef: string; sentAt: string; note: string }) => {
      if (!supabase || !markSent) return
      setActionPending(true)
      setActionError(null)
      try {
        const { error: e } = await supabase.rpc('gov_outbox_mark_sent', {
          p_id: markSent.id,
          p_external_ref: input.externalRef,
          p_sent_at: input.sentAt,
          p_note: input.note.length > 0 ? input.note : null,
        })
        if (e) throw e
        setMarkSent(null)
        await refresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Ukjent feil.')
        throw err
      } finally {
        setActionPending(false)
      }
    },
    [supabase, markSent, refresh],
  )

  const handleCancel = useCallback(
    async (reason: string) => {
      if (!supabase || !cancelRow) return
      setActionPending(true)
      setActionError(null)
      try {
        const { error: e } = await supabase.rpc('gov_outbox_cancel', {
          p_id: cancelRow.id,
          p_reason: reason,
        })
        if (e) throw e
        setCancelRow(null)
        await refresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Ukjent feil.')
        throw err
      } finally {
        setActionPending(false)
      }
    },
    [supabase, cancelRow, refresh],
  )

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Admin', to: '/admin' },
        { label: 'Integrasjoner', to: '/admin/integrations' },
        { label: 'Manuell utboks' },
      ]}
      title="Manuell utboks (statlige meldinger)"
      description="Meldinger som krever at en administrator filer dem manuelt hos regulator (Datatilsynet, Arbeidstilsynet, LDO) — siden SendGrid ble fjernet av personvernhensyn (GDPR Art. 44 / Schrems-II)."
      headerActions={
        <Button variant="secondary" size="sm" onClick={() => void refresh()} icon={<RefreshCw className="size-3.5" aria-hidden />}>
          Oppdater
        </Button>
      }
      loading={loading && rows.length === 0}
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <FileWarning className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
            {error}
          </div>
        ) : null}

        {/* Section A — KPI strip */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Venter på behandling" value={String(kpis.awaiting)} accent="#c2410c" />
          <KpiCard label="Sent denne uka" value={String(kpis.sentThisWeek)} accent="#0f766e" />
          <KpiCard label="Feilet siste 7 dager" value={String(kpis.failedLast7d)} accent="#b91c1c" />
          <KpiCard
            label="Eldste pending (timer)"
            value={kpis.oldestPendingHours === null ? '—' : String(kpis.oldestPendingHours)}
          />
        </section>

        <InfoBox>
          Hver handling fra denne siden logges i <code>gov_outbox_triage_log</code> (IK-f § 5 nr. 7).
          Krever tilgangsnøkkelen <code>gov.outbox_triage</code>.
        </InfoBox>

        {/* Section B + C side by side from lg */}
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <FilterRail
            filters={filters}
            setFilters={setFilters}
            onResetAge={() => setFilters({ ...filters, maxAgeDays: 30 })}
          />

          <section className="space-y-3">
            {filteredRows.length === 0 ? (
              <ModuleSectionCard className="p-8 text-center text-sm text-neutral-600">
                Ingen rader matcher filtrene. Justér filtrene til venstre eller velg en større aldersgrense.
              </ModuleSectionCard>
            ) : (
              filteredRows.map((row) => (
                <TriageCard
                  key={row.id}
                  row={row}
                  onMarkSent={() => setMarkSent(row)}
                  onCancel={() => setCancelRow(row)}
                  onShowPayload={() => setPayloadRow(row)}
                />
              ))
            )}
          </section>
        </div>

        {actionError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {actionError}
          </div>
        ) : null}
      </div>

      {markSent ? (
        <MarkSentDialog
          row={markSent}
          onClose={() => setMarkSent(null)}
          onSubmit={handleMarkSent}
          pending={actionPending}
        />
      ) : null}
      {cancelRow ? (
        <CancelDialog
          row={cancelRow}
          onClose={() => setCancelRow(null)}
          onSubmit={handleCancel}
          pending={actionPending}
        />
      ) : null}
      {payloadRow ? <PayloadSlidePanel row={payloadRow} onClose={() => setPayloadRow(null)} /> : null}
    </ModulePageShell>
  )
}

export default GovOutboxPage
