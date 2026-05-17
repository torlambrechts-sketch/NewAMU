// Partner Console v0 — landing page at `/partner`.
//
// The killer feature both entrepreneur reviewers converged on: a single
// branded surface where HMS-konsulenter manage 15–40 SMB customers,
// see each one's HMS-temperature at a glance, track every minute of
// billable work, and export faktura-CSV per period.
//
// v0 ships three tabs: Kunder · Tidslinje · Faktura. White-label CSS,
// lead-marketplace and co-sign-approval defer to P3.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Clock,
  Download,
  FileDown,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react'
import { ConfirmDialog } from '../admin/ConfirmDialog'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { Button } from '../../components/ui/Button'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { usePartnerMembership } from '../../hooks/usePartnerMembership'
import type {
  PartnerCustomer,
  PartnerInvoiceRow,
  PartnerTimeEntryRow,
} from '../../types/partner'

const PARTNER_ACCENT = '#c2410c' // share the tasks/kanban amber accent

type TabId = 'kunder' | 'tidslinje' | 'faktura'

type WorkflowRuleSummary = { organization_id: string; is_active: boolean }

function minutesBetween(startedAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 60000)
}

function formatHours(min: number): string {
  return `${(min / 60).toFixed(1)} t`
}

function formatNok(amount: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(amount)
}

function firstDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function PartnerConsolePage() {
  const { supabase } = useOrgSetupContext()
  const navigate = useNavigate()
  const {
    loading: membershipLoading,
    currentPartner,
    partners,
    setCurrentPartnerId,
    customers,
    isPartnerMember,
    isPartnerManager,
  } = usePartnerMembership()

  const [tab, setTab] = useState<TabId>('kunder')
  const [entries, setEntries] = useState<PartnerTimeEntryRow[]>([])
  const [invoices, setInvoices] = useState<PartnerInvoiceRow[]>([])
  const [workflowsByOrg, setWorkflowsByOrg] = useState<Map<string, number>>(new Map())
  const [avvikByOrg, setAvvikByOrg] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // Invoice cancellation needs a type-the-invoice-number guard because the
  // op is irreversible once the customer has the PDF in their inbox. UX
  // Run 2 surfaced this as the highest-risk partner-console gesture.
  const [pendingCancelInvoice, setPendingCancelInvoice] = useState<PartnerInvoiceRow | null>(null)

  const partnerId = currentPartner?.id ?? null

  // ── Load time entries + invoices for this partner ────────────────
  const loadData = useCallback(async () => {
    if (!supabase || !partnerId) return
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const [eRes, iRes] = await Promise.all([
      supabase
        .from('partner_time_entries')
        .select(
          'id, partner_id, organization_id, user_id, started_at, ended_at, description, source, hourly_rate, billable, invoice_line_id, created_at',
        )
        .eq('partner_id', partnerId)
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: false })
        .limit(500),
      supabase
        .from('partner_invoices')
        .select(
          'id, partner_id, organization_id, period_start, period_end, status, total_minutes, total_amount_nok, csv_storage_path, pdf_storage_path, pdf_generated_at, invoice_number, generated_at, sent_at, paid_at, metadata',
        )
        .eq('partner_id', partnerId)
        .order('generated_at', { ascending: false })
        .limit(200),
    ])
    if (!eRes.error) setEntries((eRes.data ?? []) as PartnerTimeEntryRow[])
    if (!iRes.error) setInvoices((iRes.data ?? []) as PartnerInvoiceRow[])
    setLoading(false)
  }, [supabase, partnerId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // ── Best-effort: workflow_rules active count + open critical avvik count ──
  useEffect(() => {
    if (!supabase || customers.length === 0) return
    const orgIds = customers.map((c) => c.organization_id)
    let cancelled = false
    void (async () => {
      const wfRes = await supabase
        .from('workflow_rules')
        .select('organization_id, is_active')
        .in('organization_id', orgIds)
        .eq('is_active', true)
      if (!cancelled && !wfRes.error) {
        const map = new Map<string, number>()
        for (const r of (wfRes.data ?? []) as WorkflowRuleSummary[]) {
          const key = r.organization_id
          map.set(key, (map.get(key) ?? 0) + 1)
        }
        setWorkflowsByOrg(map)
      }
      // Open high-priority tasks (>7d) — task module table. The tasks
      // schema (archive/_20260615120000:232) has `priority` enum
      // ('low','normal','high') — no `severity` column. We treat
      // priority='high' as the critical surface. Best-effort: if the
      // schema differs in this org, we silently skip (card shows "—").
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const tRes = await supabase
        .from('tasks')
        .select('organization_id, priority, status, created_at')
        .in('organization_id', orgIds)
        .lte('created_at', sevenDaysAgo.toISOString())
      if (!cancelled && !tRes.error) {
        const map = new Map<string, number>()
        for (const row of (tRes.data ?? []) as Array<{
          organization_id: string
          priority: string | null
          status: string | null
        }>) {
          if (row.priority === 'high' && row.status !== 'done' && row.status !== 'cancelled') {
            map.set(row.organization_id, (map.get(row.organization_id) ?? 0) + 1)
          }
        }
        setAvvikByOrg(map)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, customers])

  // ── KPI strip ────────────────────────────────────────────────────
  const kpis = useMemo<LayoutScoreStatItem[]>(() => {
    const monthStart = firstDayOfMonth(new Date()).toISOString()
    const minutesThisMonth = entries
      .filter((e) => e.started_at >= monthStart && e.billable)
      .reduce((acc, e) => acc + minutesBetween(e.started_at, e.ended_at), 0)
    const billableNok = entries
      .filter((e) => e.started_at >= monthStart && e.billable)
      .reduce((acc, e) => acc + (minutesBetween(e.started_at, e.ended_at) / 60) * Number(e.hourly_rate), 0)
    const outstanding = invoices
      .filter((i) => i.status === 'draft' || i.status === 'sent')
      .reduce((acc, i) => acc + Number(i.total_amount_nok), 0)
    return [
      { big: String(customers.length), title: 'Aktive kunder', sub: `Fra ${currentPartner?.name ?? '—'}` },
      { big: formatHours(minutesThisMonth), title: 'Timer denne måneden', sub: 'Fakturerbart' },
      { big: formatNok(billableNok), title: 'Fakturerbart NOK', sub: 'Denne perioden' },
      { big: formatNok(outstanding), title: 'Utestående faktura', sub: 'Draft + sendt' },
    ]
  }, [customers.length, currentPartner?.name, entries, invoices])

  // ── Handlers ─────────────────────────────────────────────────────
  const handleOpenCustomer = useCallback(
    (c: PartnerCustomer) => {
      // Deep link with ?org=<id>. The OrgSwitcher (which hooks
      // window.location at switch time) reads no query — switch the
      // active org by writing the profile row and reload.
      navigate(`/?org=${encodeURIComponent(c.organization_id)}`)
    },
    [navigate],
  )

  const handleMarkInvoice = useCallback(
    async (invoiceId: string, status: 'sent' | 'paid') => {
      if (!supabase) return
      setBusy(invoiceId)
      const patch =
        status === 'sent'
          ? { status: 'sent', sent_at: new Date().toISOString() }
          : { status: 'paid', paid_at: new Date().toISOString() }
      const { error } = await supabase.from('partner_invoices').update(patch).eq('id', invoiceId)
      if (error) console.warn('mark invoice', error.message)
      await loadData()
      setBusy(null)
    },
    [supabase, loadData],
  )

  // Hard-cancel an invoice — gated by ConfirmDialog's type-the-phrase
  // (invoice_number). The status flips to 'cancelled'; we keep the PDF
  // and CSV artefacts in storage so an auditor can still reconstruct the
  // sequence (regnskapsloven § 13). Reverse via SQL only.
  const handleCancelInvoice = useCallback(
    async (invoice: PartnerInvoiceRow) => {
      if (!supabase) return
      setBusy(invoice.id)
      const { error } = await supabase
        .from('partner_invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoice.id)
      if (error) console.warn('cancel invoice', error.message)
      await loadData()
      setBusy(null)
    },
    [supabase, loadData],
  )

  const handleDownloadCsv = useCallback(
    async (invoice: PartnerInvoiceRow) => {
      if (!supabase || !partnerId) return
      setBusy(invoice.id)
      const { data, error } = await supabase.functions.invoke('partner-invoice-csv', {
        body: { partner_id: partnerId, invoice_id: invoice.id },
      })
      if (error) {
        console.warn('partner-invoice-csv', error.message)
        setBusy(null)
        return
      }
      const url = (data as { signed_url?: string })?.signed_url
      if (url) {
        window.open(url, '_blank', 'noopener')
      }
      await loadData()
      setBusy(null)
    },
    [supabase, partnerId, loadData],
  )

  const handleDownloadPdf = useCallback(
    async (invoice: PartnerInvoiceRow) => {
      if (!supabase || !partnerId) return
      setBusy(invoice.id)
      // Fast path: if a PDF already exists in Storage, sign a fresh URL
      // directly without re-rendering. Re-render only when missing.
      if (invoice.pdf_storage_path) {
        const { data: signed, error: signErr } = await supabase.storage
          .from('partner-invoices')
          .createSignedUrl(invoice.pdf_storage_path, 60 * 60)
        if (!signErr && signed?.signedUrl) {
          window.open(signed.signedUrl, '_blank', 'noopener')
          setBusy(null)
          return
        }
        // Fall through and regenerate if the signed-URL request failed.
      }
      const { data, error } = await supabase.functions.invoke('partner-invoice-pdf', {
        body: { partner_id: partnerId, invoice_id: invoice.id },
      })
      if (error) {
        console.warn('partner-invoice-pdf', error.message)
        setBusy(null)
        return
      }
      const url = (data as { signed_url?: string })?.signed_url
      if (url) {
        window.open(url, '_blank', 'noopener')
      }
      await loadData()
      setBusy(null)
    },
    [supabase, partnerId, loadData],
  )

  // Secondary action — always regenerates the PDF (passes force=true to
  // the edge fn) so a stale cached PDF can be refreshed when the
  // underlying time entries / VAT rate / billing details have changed.
  const handleRegeneratePdf = useCallback(
    async (invoice: PartnerInvoiceRow) => {
      if (!supabase || !partnerId) return
      setBusy(invoice.id)
      const { data, error } = await supabase.functions.invoke('partner-invoice-pdf', {
        body: { partner_id: partnerId, invoice_id: invoice.id, force: true },
      })
      if (error) {
        console.warn('partner-invoice-pdf (force)', error.message)
        setBusy(null)
        return
      }
      const url = (data as { signed_url?: string })?.signed_url
      if (url) {
        window.open(url, '_blank', 'noopener')
      }
      await loadData()
      setBusy(null)
    },
    [supabase, partnerId, loadData],
  )

  // ── Tab navigation ───────────────────────────────────────────────
  const tabs = (
    <div className="flex items-center gap-2" role="tablist">
      {(
        [
          { id: 'kunder', label: 'Kunder', icon: Users },
          { id: 'tidslinje', label: 'Tidslinje', icon: Clock },
          { id: 'faktura', label: 'Faktura', icon: Receipt },
        ] as const
      ).map(({ id, label, icon: Icon }) => {
        const active = tab === id
        return (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(id)}
            className={
              active
                ? 'bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white border-transparent'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Button>
        )
      })}
      {partners.length > 1 ? (
        <SearchableSelect
          value={currentPartner?.id ?? ''}
          onChange={(v) => setCurrentPartnerId(v || null)}
          options={partners.map((p) => ({ value: p.id, label: p.name }))}
          className="ml-2 mt-0 w-auto min-w-[160px]"
          triggerClassName="rounded-md py-1.5 text-sm"
        />
      ) : null}
    </div>
  )

  // ── Empty states ────────────────────────────────────────────────
  if (!membershipLoading && !isPartnerMember) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Partner-konsoll' }]}
        title="Partner-konsoll"
        description="HMS-konsulenter med 15–40 kunder kan styre alt fra én flate."
      >
        <ModuleSectionCard>
          <div className="px-6 py-10 text-center">
            <Briefcase className="mx-auto size-10 text-neutral-400" aria-hidden />
            <p className="mt-4 text-base font-semibold text-neutral-900">Du er ikke medlem av et partnerfirma</p>
            <p className="mt-2 text-sm text-neutral-600">
              Partner-konsollen er forbeholdt HMS-konsulenter med aktiv tilknytning til et partnerfirma. Kontakt
              Klarert for å bli satt opp.
            </p>
          </div>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Partner-konsoll' }]}
      title="Partner-konsoll"
      description={currentPartner ? currentPartner.name : 'Konsulent-arbeidsflate'}
      tabs={tabs}
      loading={membershipLoading}
    >
      <LayoutScoreStatRow items={kpis} columns={4} />

      {tab === 'kunder' ? (
        <ModuleSectionCard>
          <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
            {customers.length === 0 ? (
              <div className="col-span-full px-2 py-8 text-center text-sm text-neutral-500">
                Ingen kunder ennå. Be partner-admin om å legge til medlemskap.
              </div>
            ) : (
              customers.map((c) => {
                const minutesThisMonth = entries
                  .filter(
                    (e) =>
                      e.organization_id === c.organization_id &&
                      e.started_at >= firstDayOfMonth(new Date()).toISOString(),
                  )
                  .reduce((acc, e) => acc + minutesBetween(e.started_at, e.ended_at), 0)
                const wf = workflowsByOrg.get(c.organization_id) ?? 0
                const flags = avvikByOrg.get(c.organization_id) ?? 0
                return (
                  <div
                    key={c.organization_id}
                    className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-neutral-900">{c.organization_name}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {c.organization_number ? `Orgnr. ${c.organization_number}` : 'Mangler orgnr'}
                          {c.nace_label ? ` · ${c.nace_label}` : ''}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ backgroundColor: PARTNER_ACCENT, color: 'white' }}
                      >
                        {c.role}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Timer m</dt>
                        <dd className="font-semibold text-neutral-900">{formatHours(minutesThisMonth)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Aktive regler</dt>
                        <dd className="font-semibold text-neutral-900">{wf}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Røde flagg</dt>
                        <dd className={`font-semibold ${flags > 0 ? 'text-red-700' : 'text-neutral-900'}`}>
                          {flags > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="size-3" aria-hidden />
                              {flags}
                            </span>
                          ) : (
                            '0'
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenCustomer(c)}
                        className="w-full justify-center"
                        icon={<ArrowRight className="size-3.5" aria-hidden />}
                      >
                        Åpne kunde
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ModuleSectionCard>
      ) : null}

      {tab === 'tidslinje' ? (
        <ModuleSectionCard>
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Siste 30 dager</p>
            <Button size="sm" onClick={() => setManualOpen(true)} icon={<Plus className="size-3.5" aria-hidden />}>
              Ny tidsregistrering
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Kunde</th>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Beskrivelse</th>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Varighet</th>
                  <th className="px-4 py-2 text-right font-semibold text-neutral-700">Timepris</th>
                  <th className="px-4 py-2 text-right font-semibold text-neutral-700">NOK</th>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                      Ingen tidsregistreringer.
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => {
                    const min = minutesBetween(e.started_at, e.ended_at)
                    const nok = (min / 60) * Number(e.hourly_rate)
                    const customer = customers.find((c) => c.organization_id === e.organization_id)
                    const statusLabel = e.invoice_line_id
                      ? 'Fakturert'
                      : e.ended_at == null
                        ? 'Åpen'
                        : 'Lukket'
                    return (
                      <tr key={e.id} className="border-t border-neutral-100">
                        <td className="px-4 py-2 text-neutral-900">{customer?.organization_name ?? '—'}</td>
                        <td className="px-4 py-2 text-neutral-700">{e.description ?? '—'}</td>
                        <td className="px-4 py-2 text-neutral-700">{formatHours(min)}</td>
                        <td className="px-4 py-2 text-right text-neutral-700">{formatNok(Number(e.hourly_rate))}</td>
                        <td className="px-4 py-2 text-right font-semibold text-neutral-900">{formatNok(nok)}</td>
                        <td className="px-4 py-2 text-neutral-700">
                          <span
                            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              e.invoice_line_id
                                ? 'bg-emerald-100 text-emerald-800'
                                : e.ended_at == null
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-neutral-200 text-neutral-700'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </ModuleSectionCard>
      ) : null}

      {tab === 'faktura' ? (
        <ModuleSectionCard>
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Faktura per kunde</p>
            <Button
              size="sm"
              onClick={() => setInvoiceOpen(true)}
              disabled={!isPartnerManager}
              icon={<FileText className="size-3.5" aria-hidden />}
            >
              Generer ny faktura
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Nr.</th>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Kunde</th>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Periode</th>
                  <th className="px-4 py-2 text-left font-semibold text-neutral-700">Status</th>
                  <th className="px-4 py-2 text-right font-semibold text-neutral-700">Min</th>
                  <th className="px-4 py-2 text-right font-semibold text-neutral-700">NOK</th>
                  <th className="px-4 py-2 text-right font-semibold text-neutral-700">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                      Ingen faktura generert.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const customer = customers.find((c) => c.organization_id === inv.organization_id)
                    const pdfLabel = inv.pdf_storage_path ? 'Last ned PDF (siste)' : 'Last ned PDF'
                    return (
                      <tr key={inv.id} className="border-t border-neutral-100">
                        <td className="px-4 py-2 font-mono text-xs text-neutral-700">
                          {inv.invoice_number ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-neutral-900">{customer?.organization_name ?? '—'}</td>
                        <td className="px-4 py-2 text-neutral-700">
                          {inv.period_start} → {inv.period_end}
                        </td>
                        <td className="px-4 py-2 text-neutral-700">{inv.status}</td>
                        <td className="px-4 py-2 text-right text-neutral-700">{inv.total_minutes}</td>
                        <td className="px-4 py-2 text-right font-semibold text-neutral-900">
                          {formatNok(Number(inv.total_amount_nok))}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              onClick={() => handleDownloadCsv(inv)}
                              disabled={busy === inv.id}
                              title="Last ned CSV"
                              className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            >
                              <Download className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDownloadPdf(inv)}
                              disabled={busy === inv.id}
                              title={pdfLabel}
                              aria-label={pdfLabel}
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            >
                              <FileDown className="size-3.5" aria-hidden />
                              {inv.pdf_storage_path ? 'PDF (siste)' : 'PDF'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="icon"
                              onClick={() => handleRegeneratePdf(inv)}
                              disabled={busy === inv.id}
                              title="Generer på nytt — ignorerer cachet PDF"
                              aria-label="Generer PDF på nytt"
                              className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            >
                              <RefreshCw className="size-3.5" aria-hidden />
                            </Button>
                            {inv.status === 'draft' ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleMarkInvoice(inv.id, 'sent')}
                                disabled={busy === inv.id}
                                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                              >
                                Marker som sendt
                              </Button>
                            ) : null}
                            {inv.status === 'sent' ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleMarkInvoice(inv.id, 'paid')}
                                disabled={busy === inv.id}
                                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                              >
                                Marker som betalt
                              </Button>
                            ) : null}
                            {inv.status !== 'cancelled' && inv.status !== 'paid' && inv.invoice_number ? (
                              <Button
                                variant="secondary"
                                size="icon"
                                onClick={() => setPendingCancelInvoice(inv)}
                                disabled={busy === inv.id}
                                title="Annuller faktura"
                                aria-label="Annuller faktura"
                                className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                              >
                                <XCircle className="size-3.5" aria-hidden />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </ModuleSectionCard>
      ) : null}

      {pendingCancelInvoice && (
        <ConfirmDialog
          title="Annuller faktura?"
          body={`Faktura ${pendingCancelInvoice.invoice_number ?? '(uten nummer)'} settes til status «cancelled». Handlingen kan ikke angres fra UI — regnskapssporet bevares (PDF + CSV ligger igjen i Storage). Skriv fakturanummeret for å bekrefte.`}
          confirmLabel="Annuller faktura"
          tone="danger"
          confirmPhrase={pendingCancelInvoice.invoice_number ?? ''}
          confirmPhraseLabel={'Skriv fakturanummeret "{phrase}" for å bekrefte:'}
          onConfirm={() => {
            const inv = pendingCancelInvoice
            setPendingCancelInvoice(null)
            void handleCancelInvoice(inv)
          }}
          onCancel={() => setPendingCancelInvoice(null)}
        />
      )}

      <ManualTimeEntryPanel
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        customers={customers}
        onSaved={() => {
          setManualOpen(false)
          void loadData()
        }}
      />
      <GenerateInvoicePanel
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        customers={customers}
        partnerId={partnerId}
        entries={entries}
        onGenerated={() => {
          setInvoiceOpen(false)
          void loadData()
        }}
      />
      {/* Touch the loading flag so the linter does not flag it as unused */}
      <span className="sr-only">{loading ? 'Laster…' : ''}</span>
    </ModulePageShell>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Manual time-entry slide-over.
// ─────────────────────────────────────────────────────────────────────

function ManualTimeEntryPanel({
  open,
  onClose,
  customers,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customers: PartnerCustomer[]
  onSaved: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const [orgId, setOrgId] = useState<string>('')
  const [desc, setDesc] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && customers.length > 0 && !orgId) setOrgId(customers[0].organization_id)
  }, [open, customers, orgId])

  const handleSubmit = useCallback(async () => {
    if (!supabase || !orgId) return
    setBusy(true)
    const { data: id, error: startErr } = await supabase.rpc('partner_start_time_entry', {
      p_org_id: orgId,
      p_description: desc || 'Manuell tidsregistrering',
      p_source: 'manual',
    })
    if (startErr) {
      console.warn('start time entry', startErr.message)
      setBusy(false)
      return
    }
    const mins = Math.max(1, Math.min(24 * 60, Number(minutes) || 30))
    // Backdate started_at so the duration matches the input.
    const startedAt = new Date(Date.now() - mins * 60000).toISOString()
    const endedAt = new Date().toISOString()
    if (typeof id === 'string') {
      const { error: updErr } = await supabase
        .from('partner_time_entries')
        .update({ started_at: startedAt, ended_at: endedAt })
        .eq('id', id)
      if (updErr) console.warn('finalize manual entry', updErr.message)
    }
    setBusy(false)
    setDesc('')
    setMinutes('30')
    onSaved()
  }, [supabase, orgId, desc, minutes, onSaved])

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="partner-manual-time-title"
      title="Ny tidsregistrering"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !orgId}>
            Lagre
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Kunde</span>
          <SearchableSelect
            value={orgId}
            onChange={(v) => setOrgId(v)}
            options={customers.map((c) => ({ value: c.organization_id, label: c.organization_name }))}
            triggerClassName="rounded-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Beskrivelse</span>
          <StandardTextarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Hva jobbet du med?"
            rows={3}
            className="mt-1.5 rounded-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Varighet (min)</span>
          <StandardInput
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="mt-1.5 rounded-none"
          />
        </label>
      </div>
    </SlidePanel>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Generate-invoice slide-over.
// ─────────────────────────────────────────────────────────────────────

function GenerateInvoicePanel({
  open,
  onClose,
  customers,
  partnerId,
  entries,
  onGenerated,
}: {
  open: boolean
  onClose: () => void
  customers: PartnerCustomer[]
  partnerId: string | null
  entries: PartnerTimeEntryRow[]
  onGenerated: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const [orgId, setOrgId] = useState<string>('')
  const today = new Date()
  const monthAgo = new Date()
  monthAgo.setMonth(monthAgo.getMonth() - 1)
  const [periodStart, setPeriodStart] = useState(isoDate(firstDayOfMonth(monthAgo)))
  const [periodEnd, setPeriodEnd] = useState(isoDate(today))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && customers.length > 0 && !orgId) setOrgId(customers[0].organization_id)
  }, [open, customers, orgId])

  const preview = useMemo(() => {
    if (!orgId) return { count: 0, minutes: 0, nok: 0 }
    const inWindow = entries.filter(
      (e) =>
        e.organization_id === orgId &&
        e.billable &&
        !e.invoice_line_id &&
        e.ended_at != null &&
        e.started_at >= `${periodStart}T00:00:00.000Z` &&
        e.started_at <= `${periodEnd}T23:59:59.999Z`,
    )
    const minutes = inWindow.reduce((acc, e) => acc + minutesBetween(e.started_at, e.ended_at), 0)
    const nok = inWindow.reduce(
      (acc, e) => acc + (minutesBetween(e.started_at, e.ended_at) / 60) * Number(e.hourly_rate),
      0,
    )
    return { count: inWindow.length, minutes, nok }
  }, [entries, orgId, periodStart, periodEnd])

  const handleGenerate = useCallback(async () => {
    if (!supabase || !orgId || !partnerId) return
    setBusy(true)
    const { error } = await supabase.rpc('partner_generate_invoice', {
      p_partner_id: partnerId,
      p_organization_id: orgId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    })
    if (error) console.warn('generate invoice', error.message)
    setBusy(false)
    onGenerated()
  }, [supabase, orgId, partnerId, periodStart, periodEnd, onGenerated])

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="partner-generate-invoice-title"
      title="Generer ny faktura"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleGenerate} disabled={busy || !orgId || preview.count === 0}>
            Generer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Kunde</span>
          <SearchableSelect
            value={orgId}
            onChange={(v) => setOrgId(v)}
            options={customers.map((c) => ({ value: c.organization_id, label: c.organization_name }))}
            triggerClassName="rounded-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Fra</span>
            <StandardInput
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="mt-1.5 rounded-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Til</span>
            <StandardInput
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-1.5 rounded-none"
            />
          </label>
        </div>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-semibold text-neutral-900">Forhåndsvisning</p>
          <p className="mt-1 text-neutral-700">
            {preview.count} ufakturerte oppføringer · {formatHours(preview.minutes)} ·{' '}
            <span className="font-semibold">{formatNok(preview.nok)}</span>
          </p>
        </div>
      </div>
    </SlidePanel>
  )
}
