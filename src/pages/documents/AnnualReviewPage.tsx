import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WarningBox } from '../../components/ui/AlertBox'
import { ModuleSectionCard } from '../../components/module'
import type { WikiAnnualReviewItemRow } from '../../api/wikiAnnualReview'

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'pending', label: 'Ikke vurdert' },
  { value: 'ok', label: 'OK' },
  { value: 'needs_update', label: 'Trenger oppdatering' },
  { value: 'not_applicable', label: 'Ikke aktuelt' },
]

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
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
      setErr(e instanceof Error ? e.message : 'Feil ved lasting')
    } finally {
      setLoading(false)
    }
  }, [docs, year])

  useEffect(() => {
    void load()
  }, [load])

  const { mandatory, risk, otherPages } = useMemo(() => groupItems(items), [items])

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
      setErr(e instanceof Error ? e.message : 'Kunne ikke fullføre')
    } finally {
      setFinishing(false)
    }
  }

  const progressPct = itemsTotal > 0 ? Math.round((itemsReviewed / itemsTotal) * 100) : 0

  return (
    <>
      {loading ? (
        <div className="mt-12 flex justify-center text-neutral-600">
          <Loader2 className="size-8 animate-spin text-[#1a3d32]" />
        </div>
      ) : err ? (
        <div className="mt-6">
          <WarningBox>{err}</WarningBox>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
              Årsgjennomgang {year} — IK-f §5 nr. 5
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge variant={status === 'completed' ? 'success' : status === 'overdue' ? 'critical' : 'warning'}>
                {status === 'completed' ? 'Fullført' : status === 'overdue' ? 'Forfalt' : 'Pågår'}
              </Badge>
              {reviewPageId ? (
                <Link to={`/documents/page/${reviewPageId}`} className="text-sm text-[#1a3d32] underline">
                  Åpne oppsummeringsside
                </Link>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              {itemsReviewed} av {itemsTotal} punkter gjennomgått
            </p>
            <div className="mt-2 h-2 max-w-xl overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-[#1a3d32] transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <ModuleSectionCard>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Lovpålagte dokumenter</h2>
            <ItemTable items={mandatory} onPatch={patchItem} disabled={status === 'completed'} />
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Risikovurderinger (IK-f §5 nr. 2)</h2>
            <ItemTable items={risk} onPatch={patchItem} disabled={status === 'completed'} />
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Øvrige dokumenter med hjemmel</h2>
            <ItemTable items={otherPages} onPatch={patchItem} disabled={status === 'completed'} />
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Avviksbehandling</h2>
            <p className="text-sm text-neutral-600">
              Se avviksmodulen for statistikk og åpne saker.
            </p>
            <Link to="/workflow" className="mt-2 inline-block text-sm text-[#1a3d32] underline">
              Arbeidsflyt / avvik
            </Link>
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">HMS-opplæring</h2>
            <p className="text-sm text-neutral-600">Oversikt over kurs og sertifiseringer i læringsmodulen.</p>
            <Link to="/learning" className="mt-2 inline-block text-sm text-[#1a3d32] underline">
              Gå til opplæring
            </Link>
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Verneombud og AMU</h2>
            <p className="text-sm text-neutral-600">
              Publiserte AMU-protokoller siste 12 måneder (fra aktivitetslogg):{' '}
              <strong>{amuPublishes12m}</strong>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Valg av verneombud og AMU-sammensetning følges i HR / organisasjonskart — legg inn referanse i notatfelt
              under ved behov.
            </p>
          </ModuleSectionCard>

          <ModuleSectionCard>
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Hendelser og ulykker</h2>
            <p className="text-sm text-neutral-600">
              Se hendelsesregisteret for siste 12 måneder (arbeidsplassrapportering).
            </p>
            <Link to="/workplace-reporting/incidents" className="mt-2 inline-block text-sm text-[#1a3d32] underline">
              Hendelser
            </Link>
          </ModuleSectionCard>

          <ModuleSectionCard>
            <label className="text-xs font-medium text-neutral-500" htmlFor="ar-notes">
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
            <Button
              type="button"
              variant="primary"
              disabled={status === 'completed' || finishing || !reviewId}
              onClick={() => void handleComplete()}
              className="mt-4"
            >
              {finishing ? 'Fullfører…' : 'Fullfør årsgjennomgang'}
            </Button>
            <p className="mt-2 text-xs text-neutral-500">
              Oppretter og publiserer en side fra malen «Årsgjennomgang av internkontrollen» i HMS-håndbok og registrerer
              hendelsen i revisjonsloggen.
            </p>
          </ModuleSectionCard>
        </div>
      )}
    </>
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

  if (items.length === 0) {
    return <p className="mt-2 text-sm text-neutral-500">Ingen punkter i denne gruppen.</p>
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <th className="py-2 pr-4">Hjemmel / dokument</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Notat</th>
            <th className="py-2">Side</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {items.map((it) => {
            const st = local[it.id]?.status ?? it.status
            const nt = local[it.id]?.notes ?? it.reviewer_notes ?? ''
            return (
              <tr key={it.id}>
                <td className="py-3 pr-4">
                  <div className="font-mono text-xs text-[#1a3d32]">{it.legal_ref}</div>
                  <div className="text-neutral-700">{it.description}</div>
                </td>
                <td className="py-3 pr-4">
                  <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
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
                <td className="py-3 pr-4">
                  <StandardInput
                    type="text"
                    value={nt}
                    disabled={disabled}
                    onChange={(e) => setLocal((s) => ({ ...s, [it.id]: { status: st, notes: e.target.value } }))}
                    onBlur={() => void onPatch(it.id, st, nt)}
                    className="min-w-[160px]"
                  />
                </td>
                <td className="py-3">
                  {it.page_id ? (
                    <Link to={`/documents/page/${it.page_id}`} className="text-[#1a3d32] underline">
                      Åpne
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
    </div>
  )
}
