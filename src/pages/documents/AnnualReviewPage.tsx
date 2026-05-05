import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WarningBox } from '../../components/ui/AlertBox'
import {
  ModuleSectionCard,
  MODULE_TABLE_TD,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../components/module'
import { DonutChartBlock, HorizontalMetricRow, InsightCardShell } from '../../components/ui/InsightPanels'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { WikiAnnualReviewItemRow } from '../../api/wikiAnnualReview'

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'pending', label: 'Ikke vurdert' },
  { value: 'ok', label: 'OK' },
  { value: 'needs_update', label: 'Trenger oppdatering' },
  { value: 'not_applicable', label: 'Ikke aktuelt' },
]

const STATUS_BADGE: Record<WikiAnnualReviewItemRow['status'], { label: string; tone: 'success' | 'warning' | 'critical' | 'neutral' }> = {
  ok: { label: 'OK', tone: 'success' },
  needs_update: { label: 'Trenger oppdatering', tone: 'warning' },
  not_applicable: { label: 'Ikke aktuelt', tone: 'neutral' },
  pending: { label: 'Ikke vurdert', tone: 'critical' },
}

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Math.floor(Date.now() / 60_000) * 60_000
}

function groupItems(items: WikiAnnualReviewItemRow[]) {
  const mandatory = items.filter((i) => i.page_id == null)
  const pageRows = items.filter((i) => i.page_id != null)
  const risk = pageRows.filter((i) => i.legal_ref.includes('IK-f §5 nr. 2'))
  const otherPages = pageRows.filter((i) => !i.legal_ref.includes('IK-f §5 nr. 2'))
  return { mandatory, risk, otherPages }
}

export function AnnualReviewPage() {
  const docs = useDocuments()
  const [searchParams] = useSearchParams()
  const nowMs = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)
  const yearParam = Number(searchParams.get('year'))
  const year =
    Number.isFinite(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : new Date().getFullYear()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [status, setStatus] = useState<'in_progress' | 'completed' | 'overdue'>('in_progress')
  const [itemsReviewed, setItemsReviewed] = useState(0)
  const [itemsTotal, setItemsTotal] = useState(0)
  const [reviewPageId, setReviewPageId] = useState<string | null>(null)
  const [items, setItems] = useState<WikiAnnualReviewItemRow[]>([])
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)

  const load = useCallback(async () => {
    if (docs.backend !== 'supabase') {
      setErr('Årsgjennomgang krever tilkoblet organisasjon (Supabase).')
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      let { review, items: it } = await docs.fetchAnnualReview(year)
      if (!review) {
        const ensured = await docs.ensureAnnualReview(year)
        review = ensured.review
        it = ensured.items
      }
      if (!review) {
        setErr('Kunne ikke opprette årsgjennomgang.')
        setLoading(false)
        return
      }
      setReviewId(review.id)
      setStatus(review.status)
      setItemsReviewed(review.items_reviewed)
      setItemsTotal(review.items_total)
      setReviewPageId(review.review_page_id)
      setItems(it)
      setNotes(review.notes ?? '')
    } catch (e) {
      setErr(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [docs, year])

  useEffect(() => {
    void load()
  }, [load])

  const { mandatory, risk, otherPages } = useMemo(() => groupItems(items), [items])

  const tally = useMemo(() => {
    let ok = 0
    let needs = 0
    let na = 0
    let pending = 0
    for (const it of items) {
      if (it.status === 'ok') ok += 1
      else if (it.status === 'needs_update') needs += 1
      else if (it.status === 'not_applicable') na += 1
      else pending += 1
    }
    return { ok, needs, na, pending }
  }, [items])

  const amuSpace = useMemo(
    () => docs.spaces.find((s) => s.isAmuSpace === true || /amu/i.test(s.title)),
    [docs.spaces],
  )
  const amuPageIds = useMemo(
    () => (amuSpace ? docs.pages.filter((p) => p.spaceId === amuSpace.id).map((p) => p.id) : []),
    [docs.pages, amuSpace],
  )
  const amuPublishes12m = useMemo(
    () =>
      docs.auditLedger.filter(
        (e) =>
          e.action === 'published' &&
          amuPageIds.includes(e.pageId) &&
          new Date(e.at).getTime() > nowMs - 365 * 86400000,
      ).length,
    [docs.auditLedger, amuPageIds, nowMs],
  )

  async function patchItem(id: string, status: WikiAnnualReviewItemRow['status'], reviewerNotes: string) {
    if (!reviewId) return
    await docs.updateAnnualReviewItem(reviewId, id, { status, reviewer_notes: reviewerNotes || null })
    const { review, items: it } = await docs.fetchAnnualReview(year)
    if (review) {
      setItemsReviewed(review.items_reviewed)
      setItemsTotal(review.items_total)
      setItems(it)
    }
  }

  async function handleComplete() {
    if (!reviewId || status === 'completed') return
    setFinishing(true)
    setErr(null)
    try {
      await docs.finalizeAnnualReview(reviewId, year, notes)
      await load()
    } catch (e) {
      setErr(getSupabaseErrorMessage(e))
    } finally {
      setFinishing(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-12 flex justify-center text-neutral-600">
        <Loader2 className="size-8 animate-spin text-[#1a3d32]" />
      </div>
    )
  }
  if (err) {
    return <WarningBox>{err}</WarningBox>
  }

  const progressPct = itemsTotal > 0 ? Math.round((itemsReviewed / itemsTotal) * 100) : 0
  const remaining = Math.max(0, itemsTotal - itemsReviewed)
  const donutSegments =
    itemsTotal === 0
      ? [{ pct: 100, color: '#e5e5e5' }]
      : [
          { pct: progressPct, color: '#1a3d32' },
          { pct: 100 - progressPct, color: '#e5e5e5' },
        ]
  const barMax = Math.max(1, tally.ok, tally.needs, tally.na, tally.pending)

  const statusLabel =
    status === 'completed' ? 'Fullført' : status === 'overdue' ? 'Forfalt' : 'Pågår'
  const statusTone: 'success' | 'critical' | 'warning' =
    status === 'completed' ? 'success' : status === 'overdue' ? 'critical' : 'warning'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <InsightCardShell className="flex flex-col overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">IK-f §5 nr. 5</p>
            <p className="mt-0.5 text-sm text-neutral-600">Årsgjennomgang {year}</p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-5">
            <DonutChartBlock
              size={132}
              segments={donutSegments}
              centerLabel="Gjennomgått"
              centerValue={`${progressPct}%`}
            />
            <p className="text-center text-xs text-neutral-500">
              <strong className="text-[#1a3d32]">{itemsReviewed}</strong> av {itemsTotal} punkter gjennomgått
            </p>
          </div>
        </InsightCardShell>

        <InsightCardShell className="flex flex-col overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Statusfordeling</p>
            <p className="mt-0.5 text-sm text-neutral-600">Punkter etter vurdering</p>
          </div>
          <div className="flex flex-1 flex-col justify-center space-y-3 px-4 py-5">
            <HorizontalMetricRow label="OK" value={tally.ok} max={barMax} barColor="#10b981" />
            <HorizontalMetricRow label="Trenger oppdatering" value={tally.needs} max={barMax} barColor="#f59e0b" />
            <HorizontalMetricRow label="Ikke aktuelt" value={tally.na} max={barMax} barColor="#94a3b8" />
            <HorizontalMetricRow label="Ikke vurdert" value={tally.pending} max={barMax} barColor="#f87171" />
          </div>
          <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">
            <p className="text-2xl font-bold tabular-nums text-neutral-900">{itemsTotal}</p>
            <p className="text-xs text-neutral-600">Totalt punkter spores</p>
          </div>
        </InsightCardShell>

        <InsightCardShell className="flex flex-col overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Status</p>
            <p className="mt-0.5 font-semibold text-neutral-900">Årsgjennomgang {year}</p>
          </div>
          <div className="flex flex-1 flex-col gap-3 px-4 py-5">
            <div>
              <Badge variant={statusTone}>{statusLabel}</Badge>
            </div>
            <p className="text-sm text-neutral-600">
              {remaining > 0
                ? `${remaining} punkt${remaining === 1 ? '' : 'er'} gjenstår før gjennomgangen kan fullføres.`
                : status === 'completed'
                  ? 'Gjennomgangen er fullført og signert.'
                  : 'Alle punkter er vurdert — klar for fullføring.'}
            </p>
            {reviewPageId ? (
              <Link
                to={`/documents/page/${reviewPageId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a3d32] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Åpne oppsummeringsside
              </Link>
            ) : (
              <p className="text-xs text-neutral-500">Oppsummeringsside opprettes når gjennomgangen fullføres.</p>
            )}
          </div>
        </InsightCardShell>
      </div>

      <ItemTableCard
        title="Lovpålagte dokumenter"
        description="Krav uten direkte sidekobling — registrer status og notat per krav."
        items={mandatory}
        onPatch={patchItem}
        disabled={status === 'completed'}
      />

      <ItemTableCard
        title="Risikovurderinger (IK-f §5 nr. 2)"
        description="Sider knyttet til risikokartlegging — vurder om dokumentasjonen er oppdatert."
        items={risk}
        onPatch={patchItem}
        disabled={status === 'completed'}
      />

      <ItemTableCard
        title="Øvrige dokumenter med hjemmel"
        description="Sider knyttet til andre lovkrav — vurder revisjonsbehov."
        items={otherPages}
        onPatch={patchItem}
        disabled={status === 'completed'}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ModuleSectionCard className="p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Avviksbehandling</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Se avviksmodulen for statistikk og åpne saker.
          </p>
          <Link
            to="/workflow"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1a3d32] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Arbeidsflyt / avvik
          </Link>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h2 className="text-sm font-semibold text-neutral-900">HMS-opplæring</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Oversikt over kurs og sertifiseringer i læringsmodulen.
          </p>
          <Link
            to="/learning"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1a3d32] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Gå til opplæring
          </Link>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Verneombud og AMU</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Publiserte AMU-protokoller siste 12 måneder:{' '}
            <strong className="text-neutral-900">{amuPublishes12m}</strong>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Valg av verneombud og AMU-sammensetning følges i HR / organisasjonskart.
          </p>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5 md:col-span-3">
          <h2 className="text-sm font-semibold text-neutral-900">Hendelser og ulykker</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Se hendelsesregisteret for siste 12 måneder (arbeidsplassrapportering).
          </p>
          <Link
            to="/workplace-reporting/incidents"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1a3d32] hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Hendelser
          </Link>
        </ModuleSectionCard>
      </div>

      <ModuleSectionCard className="p-5 md:p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Oppsummering og fullføring</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Oppretter og publiserer en side fra malen «Årsgjennomgang av internkontrollen» i HMS-håndbok og registrerer
          hendelsen i revisjonsloggen.
        </p>
        <label className="mt-4 block text-xs font-medium text-neutral-500" htmlFor="ar-notes">
          Notater til oppsummering
        </label>
        <StandardTextarea
          id="ar-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={status === 'completed'}
          className="mt-2 max-w-2xl"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={status === 'completed' || finishing || !reviewId}
            onClick={() => void handleComplete()}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            {finishing ? 'Fullfører…' : 'Fullfør årsgjennomgang'}
          </Button>
          {status === 'completed' ? (
            <span className="text-xs text-emerald-700">Gjennomgangen er fullført.</span>
          ) : null}
        </div>
      </ModuleSectionCard>
    </div>
  )
}

function ItemTableCard({
  title,
  description,
  items,
  onPatch,
  disabled,
}: {
  title: string
  description: string
  items: WikiAnnualReviewItemRow[]
  onPatch: (id: string, status: WikiAnnualReviewItemRow['status'], notes: string) => void
  disabled: boolean
}) {
  const ok = items.filter((i) => i.status === 'ok').length
  const needs = items.filter((i) => i.status === 'needs_update').length
  const pending = items.filter((i) => i.status === 'pending').length

  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
            <p className="mt-1 text-xs text-neutral-500">{description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Badge variant="neutral">{items.length} punkter</Badge>
            {ok > 0 ? <Badge variant="success">{ok} OK</Badge> : null}
            {needs > 0 ? <Badge variant="warning">{needs} oppdater</Badge> : null}
            {pending > 0 ? <Badge variant="critical">{pending} ikke vurdert</Badge> : null}
          </div>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-500">Ingen punkter i denne gruppen.</p>
      ) : (
        <div className="overflow-x-auto">
          <ItemTable items={items} onPatch={onPatch} disabled={disabled} />
        </div>
      )}
    </ModuleSectionCard>
  )
}

function ItemTable({
  items,
  onPatch,
  disabled,
}: {
  items: WikiAnnualReviewItemRow[]
  onPatch: (id: string, status: WikiAnnualReviewItemRow['status'], notes: string) => void
  disabled: boolean
}) {
  const [local, setLocal] = useState<Record<string, { status: WikiAnnualReviewItemRow['status']; notes: string }>>({})

  return (
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead>
        <tr>
          <th className={MODULE_TABLE_TH}>Hjemmel / krav</th>
          <th className={MODULE_TABLE_TH}>Status</th>
          <th className={MODULE_TABLE_TH}>Notat</th>
          <th className={MODULE_TABLE_TH}>Side</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {items.map((it) => {
          const st = local[it.id]?.status ?? it.status
          const nt = local[it.id]?.notes ?? it.reviewer_notes ?? ''
          const meta = STATUS_BADGE[st]
          return (
            <tr key={it.id} className={MODULE_TABLE_TR_BODY}>
              <td className={MODULE_TABLE_TD}>
                <div className="font-mono text-xs text-[#1a3d32]">{it.legal_ref}</div>
                <div className="mt-0.5 text-neutral-700">{it.description}</div>
              </td>
              <td className={MODULE_TABLE_TD}>
                <div className={`flex items-center gap-2 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
                  <Badge variant={meta.tone}>{meta.label}</Badge>
                  <SearchableSelect
                    value={st}
                    options={STATUS_OPTIONS}
                    onChange={(v) => {
                      const val = v as WikiAnnualReviewItemRow['status']
                      setLocal((s) => ({ ...s, [it.id]: { status: val, notes: nt } }))
                      void onPatch(it.id, val, nt)
                    }}
                    triggerClassName="py-1 text-xs"
                  />
                </div>
              </td>
              <td className={MODULE_TABLE_TD}>
                <StandardInput
                  type="text"
                  value={nt}
                  disabled={disabled}
                  placeholder="Legg til vurdering…"
                  onChange={(e) => setLocal((s) => ({ ...s, [it.id]: { status: st, notes: e.target.value } }))}
                  onBlur={() => void onPatch(it.id, st, nt)}
                  className="min-w-[180px]"
                />
              </td>
              <td className={MODULE_TABLE_TD}>
                {it.page_id ? (
                  <Link
                    to={`/documents/page/${it.page_id}`}
                    className="inline-flex items-center gap-1 text-[#1a3d32] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Åpne
                  </Link>
                ) : (
                  <span className="text-xs text-neutral-400">—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
