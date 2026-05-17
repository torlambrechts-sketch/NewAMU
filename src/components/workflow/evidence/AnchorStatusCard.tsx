// AnchorStatusCard — TSA anchor status surface for the evidence panel.
//
// Reads the most recent workflow_evidence_anchors row for the current
// org and renders: period, Merkle root (truncated), TSA provider,
// signed_at, status. "Verifiser nå" re-runs workflow_verify_anchor
// server-side. If the latest anchor is older than 35 days, we surface
// a WarningBox — Arkivforskriften § 7 / eIDAS expect ≤ monthly anchoring
// so a 35-day gap is the first sign of cron drift.

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Loader2, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { Button } from '../../ui/Button'
import { WarningBox } from '../../ui/AlertBox'

type AnchorRow = {
  id: string
  organization_id: string | null
  chain_key: string | null
  period_start: string
  period_end: string
  merkle_root_sha256: string
  evidence_count: number
  tsa_provider: string | null
  tsa_serial_number: string | null
  tsa_signed_at: string | null
  status: 'pending' | 'signed' | 'verified' | 'failed' | 'archived'
  failure_reason: string | null
  created_at: string
}

const STATUS_LABEL: Record<AnchorRow['status'], string> = {
  pending: 'Venter på TSA',
  signed: 'Signert av TSA',
  verified: 'Verifisert',
  failed: 'Feilet',
  archived: 'Arkivert',
}

const STATUS_TONE: Record<AnchorRow['status'], string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  signed: 'bg-sky-50 text-sky-800 border-sky-200',
  verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-rose-50 text-rose-800 border-rose-200',
  archived: 'bg-neutral-100 text-neutral-700 border-neutral-200',
}

function formatNoDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((Date.now() - t) / 86400_000)
}

export function AnchorStatusCard() {
  const { supabase, organization } = useOrgSetupContext()
  const [anchor, setAnchor] = useState<AnchorRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !organization) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: e } = await supabase
        .from('workflow_evidence_anchors')
        .select(
          'id, organization_id, chain_key, period_start, period_end, ' +
            'merkle_root_sha256, evidence_count, tsa_provider, tsa_serial_number, ' +
            'tsa_signed_at, status, failure_reason, created_at',
        )
        .eq('organization_id', organization.id)
        .is('chain_key', null)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle<AnchorRow>()
      if (cancelled) return
      if (e) setError(e.message)
      setAnchor(data ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, organization])

  const verifyNow = async () => {
    if (!supabase || !anchor) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const { data, error: e } = await supabase.rpc('workflow_verify_anchor', {
        p_anchor_id: anchor.id,
      })
      if (e) throw e
      const ok = data === true
      setVerifyResult({
        ok,
        message: ok
          ? 'Merkle-rot stemmer. Anker bekreftet.'
          : 'Mismatch — kritisk varsel sendt til org-admin.',
      })
      // Refresh anchor row (status may have flipped).
      const { data: refreshed } = await supabase
        .from('workflow_evidence_anchors')
        .select(
          'id, organization_id, chain_key, period_start, period_end, ' +
            'merkle_root_sha256, evidence_count, tsa_provider, tsa_serial_number, ' +
            'tsa_signed_at, status, failure_reason, created_at',
        )
        .eq('id', anchor.id)
        .maybeSingle<AnchorRow>()
      if (refreshed) setAnchor(refreshed)
    } catch (err) {
      setVerifyResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Ukjent feil ved verifikasjon',
      })
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Laster anker-status …
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Kunne ikke lese ankerstatus: {error}
      </div>
    )
  }

  if (!anchor) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
        <div>
          <p className="font-medium text-neutral-800">Ingen bevis-anker enda</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Det første månedlige ankeret opprettes automatisk natt til den 1. i hver
            måned. Bevis-kjeden er foreløpig kun intern tamper-evident.
          </p>
        </div>
      </div>
    )
  }

  const ageDays = daysSince(anchor.tsa_signed_at ?? anchor.period_end)
  const stale = ageDays !== null && ageDays > 35
  const merkleShort = `${anchor.merkle_root_sha256.slice(0, 12)}…${anchor.merkle_root_sha256.slice(-8)}`

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
          <ShieldCheck className="h-4 w-4 text-[#1a3d32]" />
          <h3 className="text-sm font-semibold text-neutral-900">TSA-anker (eIDAS)</h3>
          <span
            className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[anchor.status]}`}
          >
            {STATUS_LABEL[anchor.status]}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 px-4 py-3 text-xs text-neutral-700 sm:grid-cols-2">
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-500">
              Periode
            </span>
            <span className="font-medium">
              {formatNoDate(anchor.period_start)} – {formatNoDate(anchor.period_end)}
            </span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-500">
              Signert
            </span>
            <span className="font-medium">{formatNoDate(anchor.tsa_signed_at)}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-500">
              TSA-leverandør
            </span>
            <span className="font-medium">{anchor.tsa_provider ?? '—'}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-neutral-500">
              Serienummer
            </span>
            <code className="break-all text-[11px] text-neutral-700">
              {anchor.tsa_serial_number ?? '—'}
            </code>
          </div>
          <div className="sm:col-span-2">
            <span className="block text-[11px] uppercase tracking-wide text-neutral-500">
              Merkle-rot ({anchor.evidence_count} bevis)
            </span>
            <code className="break-all text-[11px] text-neutral-700">{merkleShort}</code>
          </div>
          {anchor.status === 'failed' && anchor.failure_reason && (
            <p className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800 sm:col-span-2">
              {anchor.failure_reason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-2.5">
          <Button
            type="button"
            variant="secondary"
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={verifyNow}
            disabled={verifying || anchor.status === 'pending'}
          >
            {verifying ? 'Verifiserer …' : 'Verifiser nå'}
          </Button>
          {ageDays !== null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <Clock className="h-3 w-3" />
              {ageDays} dager siden signering
            </span>
          )}
          {verifyResult && (
            <span
              className={`text-[11px] font-medium ${verifyResult.ok ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {verifyResult.message}
            </span>
          )}
        </div>
      </div>
      {stale && (
        <WarningBox>
          Bevis-kjede er ikke ankret i over 30 dager. Sjekk at den månedlige cron
          (workflow_monthly_anchor_compose) kjører og at workflow-tsa-anchor edge-funksjonen
          har gyldig TSA-konfigurasjon.
        </WarningBox>
      )}
    </div>
  )
}
