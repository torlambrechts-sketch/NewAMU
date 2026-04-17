import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, ChevronDown, ChevronRight, Circle, Download, ExternalLink, Printer, X } from 'lucide-react'
import { useComplianceDocs } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { MandatoryDocsAlert } from '../../components/documents/MandatoryDocsAlert'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentsSearchBar } from '../../components/documents/DocumentsSearchBar'
import {
  coverageStatusForRef,
  hasAcknowledgedCurrentVersion,
  pageCoversLegalRef,
  userMustAcknowledgePage,
  type CoverageStatus,
} from '../../lib/wikiCompliance'
import type { WikiPage } from '../../types/documents'

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function daysUntilDue(nextRevisionDueAt: string): number {
  const due = new Date(nextRevisionDueAt)
  const dueDay = startOfLocalDay(due)
  const today = startOfLocalDay(new Date())
  return Math.ceil((dueDay - today) / (24 * 60 * 60 * 1000))
}

function revisionStripClass(days: number): string {
  if (days < 0 || days < 14) return 'border-red-300 bg-red-50 text-red-900'
  if (days <= 60) return 'border-amber-300 bg-amber-50 text-amber-950'
  return 'border-emerald-300 bg-emerald-50 text-emerald-900'
}

function localDateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type CoverageFilter = 'all' | 'missing' | 'stale' | 'covered'

function statusLabel(s: CoverageStatus): string {
  if (s === 'covered') return 'Dekket'
  if (s === 'stale') return 'Forfalt'
  return 'Mangler'
}

export function ComplianceDashboard() {
  const docs = useComplianceDocs()
  const { profile, can, isAdmin, members } = useOrgSetupContext()
  const canManageDocs = can('documents.manage') || isAdmin
  const isOrgAdminUser = profile?.is_org_admin === true || isAdmin

  const [panelRef, setPanelRef] = useState<string | null>(null)
  const [expandedAckPageId, setExpandedAckPageId] = useState<string | null>(null)
  const [ackReminderBusyId, setAckReminderBusyId] = useState<string | null>(null)
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all')

  const coverageRows = useMemo(() => {
    const summaryByItemId = new Map<string, (typeof docs.complianceSummary)[0]>()
    for (const s of docs.complianceSummary) summaryByItemId.set(s.id, s)
    return docs.legalCoverage.map((item) => {
      const sum = summaryByItemId.get(item.id)
      const status: CoverageStatus = coverageStatusForRef(item.ref, docs.pages)
      const coveredBy = docs.pages.filter((p) => pageCoversLegalRef(p, item.ref))
      const publishedWithRef = docs.pages.filter((p) => p.status === 'published' && p.legalRefs.includes(item.ref))
      const earliest = sum?.earliest_revision_due ?? null
      const ownerId = docs.coverageOwnerByItemId[item.id] ?? null
      const ownerName = ownerId ? docs.orgPeerProfiles.find((p) => p.id === ownerId)?.display_name ?? '—' : '—'
      return {
        item,
        status,
        coveredBy,
        publishedWithRef,
        earliestRevision: earliest,
        ownerId,
        ownerName,
      }
    })
  }, [docs])

  const filteredCoverageRows = useMemo(() => {
    if (coverageFilter === 'all') return coverageRows
    return coverageRows.filter((r) => r.status === coverageFilter)
  }, [coverageRows, coverageFilter])

  const panelRow = useMemo(
    () => (panelRef ? coverageRows.find((c) => c.item.ref === panelRef) ?? null : null),
    [coverageRows, panelRef],
  )

  const coveredCount = useMemo(() => coverageRows.filter((r) => r.status === 'covered').length, [coverageRows])

  useBodyScrollLock(Boolean(panelRef))

  useEffect(() => {
    if (!panelRef) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelRef(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelRef])

  const total = coverageRows.length
  const pct = total ? Math.round((coveredCount / total) * 100) : 0

  const revisionCalendar = useMemo(() => {
    const pages = docs.pages.filter((p) => p.nextRevisionDueAt && p.status === 'published')
    const byDay = new Map<string, WikiPage[]>()
    for (const p of pages) {
      const key = localDateKey(p.nextRevisionDueAt!)
      const arr = byDay.get(key) ?? []
      arr.push(p)
      byDay.set(key, arr)
    }
    const sortedKeys = [...byDay.keys()].sort()
    return { byDay, sortedKeys }
  }, [docs.pages])

  const ackRows = useMemo(() => {
    const pages = docs.pages.filter((p) => p.requiresAcknowledgement && p.status === 'published')
    return pages.map((page) => {
      const eligible = docs.orgPeerProfiles.filter((peer) =>
        userMustAcknowledgePage(page, {
          isOrgAdmin: peer.is_org_admin === true,
          departmentId: peer.department_id,
          learningMetadata: peer.learning_metadata,
        }),
      )
      const receiptsForVersion = docs.receipts.filter((r) => r.pageId === page.id && r.pageVersion === page.version)
      const signedUserIds = new Set(
        eligible
          .filter((peer) =>
            hasAcknowledgedCurrentVersion(page, peer.id, docs.receipts, docs.pageVersions),
          )
          .map((p) => p.id),
      )
      const signedCount = signedUserIds.size
      const eligibleCount = eligible.length
      const unsigned = eligible.filter((p) => !signedUserIds.has(p.id))
      return { page, eligibleCount, signedCount, unsigned, receiptsForVersion }
    })
  }, [docs.pages, docs.receipts, docs.pageVersions, docs.orgPeerProfiles])

  const exportCsv = useCallback(() => {
    const lines = [
      ['Krav', 'Status', 'Siste revidert', 'Ansvarlig', 'Konsekvens', 'Sider'].join(';'),
      ...coverageRows.map((row) => {
        const status = statusLabel(row.status)
        const rev = row.earliestRevision ? new Date(row.earliestRevision).toLocaleDateString('no-NO') : '—'
        const pages = row.coveredBy.map((p) => p.title).join(', ')
        const cons = (row.item.legalConsequence ?? '').replace(/"/g, '""')
        return [row.item.ref, status, rev, row.ownerName, `"${cons}"`, `"${pages.replace(/"/g, '""')}"`].join(';')
      }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `samsvarsrapport-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [coverageRows])

  const printReport = useCallback(() => {
    window.print()
  }, [])

  return (
    <DocumentsModuleLayout
      headerActions={<DocumentsSearchBar />}
      className="compliance-dashboard-root"
      subHeader={
        <div className="compliance-no-print mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-6">
          <p className="max-w-3xl text-sm text-neutral-600">
            Krav er <strong>dekket</strong> kun når minst én <strong>publisert</strong> side viser hjemmelen og revisjonsfristen er i orden
            (ingen frist satt, eller frist etter i dag).
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
              <Download className="size-4" aria-hidden />
              Eksporter CSV
            </button>
            <button type="button" onClick={printReport} className="inline-flex items-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
              <Printer className="size-4" aria-hidden />
              Eksporter samsvarsrapport
            </button>
          </div>
        </div>
      }
    >
      <div className="compliance-no-print mt-6">
        <MandatoryDocsAlert orgEmployeeCount={members.length} />
      </div>

      <div className="compliance-no-print mt-6 rounded-none border border-neutral-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-4xl font-bold tabular-nums text-[#1a3d32]">{pct}%</div>
            <div className="text-sm text-neutral-600">av {total} lovkrav dekket (med gyldig revisjon)</div>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <div>
              <strong className="text-emerald-700">{coveredCount}</strong> dekket
            </div>
            <div>
              <strong className="text-amber-600">{total - coveredCount}</strong> mangler eller forfalt revisjon
            </div>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-none bg-neutral-200">
          <div className="h-full rounded-none bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {revisionCalendar.sortedKeys.length > 0 && (
        <div className="compliance-no-print mt-8 overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-neutral-900">
              <Calendar className="size-4 text-[#1a3d32]" aria-hidden />
              Revisjonskalender
            </h2>
            <p className="mt-1 text-xs text-neutral-500">Klikk en dato for å åpne siden. Grønn &gt;60 dager, amber 14–60, rød &lt;14 eller forfalt.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-4">
            {revisionCalendar.sortedKeys.map((dayKey) => {
              const list = revisionCalendar.byDay.get(dayKey) ?? []
              const first = list[0]!
              const days = daysUntilDue(first.nextRevisionDueAt!)
              return (
                <div key={dayKey} className="min-w-[140px] shrink-0">
                  <p className="mb-1 text-center text-[10px] font-bold uppercase text-neutral-400">{dayKey}</p>
                  <div className={`rounded-none border p-2 text-xs ${revisionStripClass(days)}`}>
                    <ul className="space-y-1">
                      {list.map((p) => (
                        <li key={p.id}>
                          <Link to={`/documents/page/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                            {p.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="compliance-print-report mt-8 hidden print:block">
        <h1 className="mb-4 text-xl font-bold">Samsvarsrapport</h1>
        <p className="mb-4 text-sm text-neutral-600">
          Generert {new Date().toLocaleString('no-NO')} · Dekket = publisert side med hjemmel og revisjon etter i dag (eller uten frist).
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="py-2 pr-2">Krav</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Siste revidert</th>
              <th className="py-2 pr-2">Ansvarlig</th>
              <th className="py-2 pr-2">Konsekvens</th>
              <th className="py-2">Sider</th>
            </tr>
          </thead>
          <tbody>
            {coverageRows.map((row) => (
              <tr key={row.item.ref} className="border-b border-neutral-200">
                <td className="py-2 pr-2 font-mono text-xs">{row.item.ref}</td>
                <td className="py-2 pr-2">{statusLabel(row.status)}</td>
                <td className="py-2 pr-2">
                  {row.earliestRevision ? new Date(row.earliestRevision).toLocaleDateString('no-NO') : '—'}
                </td>
                <td className="py-2 pr-2">{row.ownerName}</td>
                <td className="py-2 pr-2 text-xs">{row.item.legalConsequence ?? '—'}</td>
                <td className="py-2">{row.coveredBy.map((p) => p.title).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="compliance-no-print mb-8 mt-8 overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Krav per lovhenvisning</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { id: 'all' as const, label: 'Alle' },
                { id: 'missing' as const, label: 'Manglende' },
                { id: 'stale' as const, label: 'Forfalt' },
                { id: 'covered' as const, label: 'Dekket' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCoverageFilter(tab.id)}
                className={`rounded-none border px-3 py-1.5 text-xs font-medium ${
                  coverageFilter === tab.id
                    ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Hjemmel</th>
                <th className="px-4 py-3">Krav</th>
                <th className="px-4 py-3">Konsekvens ved manglende oppfyllelse</th>
                <th className="px-4 py-3">Ansvarlig</th>
                <th className="px-4 py-3">Neste revisjon</th>
                <th className="px-4 py-3">Dekket av</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredCoverageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                    Ingen rader i dette filteret.
                  </td>
                </tr>
              ) : null}
              {filteredCoverageRows.map((c) => (
                <tr
                  key={c.item.ref}
                  className={`cursor-pointer transition-colors hover:bg-neutral-50 ${
                    c.status === 'covered' ? '' : 'bg-amber-50/40'
                  }`}
                  onClick={() => setPanelRef(c.item.ref)}
                >
                  <td className="px-4 py-3">
                    {c.status === 'covered' ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : c.status === 'stale' ? (
                      <span className="text-xs font-medium text-amber-800" title="Publisert dekning, men revisjon forfalt">
                        ⚠
                      </span>
                    ) : (
                      <Circle className="size-5 text-amber-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-none bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a3d32]">{c.item.ref}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{c.item.requirement || c.item.label}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-neutral-600">
                    {c.item.legalConsequence ?? '—'}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {canManageDocs && !c.item.id.startsWith('static-') ? (
                      <select
                        value={c.ownerId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value || null
                          void docs.setCoverageItemOwner(c.item.id, v)
                        }}
                        className="max-w-[200px] rounded-none border border-neutral-200 px-2 py-1 text-xs"
                      >
                        <option value="">—</option>
                        {docs.orgPeerProfiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.display_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-neutral-600">{c.ownerName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {c.earliestRevision ? new Date(c.earliestRevision).toLocaleDateString('no-NO') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.coveredBy.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.coveredBy.map((p) => (
                          <span
                            key={p.id}
                            className="rounded-none border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                          >
                            {p.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700">Ingen gyldig publisert dekning</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="compliance-no-print overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Signaturdekning</h2>
          <p className="text-xs text-neutral-500">Sider som krever «Lest og forstått» — antall som har signert gjeldende versjon.</p>
        </div>
        {ackRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen publiserte sider krever signatur ennå.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Versjon</th>
                  <th className="px-4 py-3">Signaturer</th>
                  <th className="px-4 py-3">Siste signatur</th>
                  {canManageDocs ? <th className="px-4 py-3">Påminnelse</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ackRows.map(({ page, eligibleCount, signedCount, unsigned, receiptsForVersion }) => {
                  const expanded = expandedAckPageId === page.id
                  const last = [...receiptsForVersion].sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt))[0]
                  return (
                    <Fragment key={page.id}>
                      <tr>
                        <td className="px-2 py-3">
                          {isOrgAdminUser && eligibleCount > 0 ? (
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => setExpandedAckPageId(expanded ? null : page.id)}
                              className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
                            >
                              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/documents/page/${page.id}`} className="font-medium text-[#1a3d32] hover:underline">
                            {page.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">v{page.version}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-none border px-2 py-0.5 text-xs font-medium ${
                              eligibleCount === 0
                                ? 'border-neutral-200 bg-neutral-50 text-neutral-600'
                                : signedCount >= eligibleCount
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-amber-200 bg-amber-50 text-amber-800'
                            }`}
                          >
                            {eligibleCount === 0
                              ? `${signedCount} signert`
                              : `${signedCount} av ${eligibleCount} har bekreftet lest`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">
                          {last ? `${last.userName} · ${new Date(last.acknowledgedAt).toLocaleDateString('no-NO')}` : '—'}
                        </td>
                        {canManageDocs ? (
                          <td className="px-4 py-3">
                            {unsigned.length > 0 ? (
                              <button
                                type="button"
                                disabled={ackReminderBusyId === page.id}
                                onClick={() => {
                                  setAckReminderBusyId(page.id)
                                  void docs
                                    .queueAckReminderNotifications(page.id)
                                    .then(() => {
                                      /* optional toast */
                                    })
                                    .catch((err) => console.error(err))
                                    .finally(() => setAckReminderBusyId(null))
                                }}
                                className="rounded-none border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {ackReminderBusyId === page.id ? 'Sender…' : 'Send påminnelse'}
                              </button>
                            ) : (
                              <span className="text-xs text-neutral-400">—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                      {expanded && isOrgAdminUser ? (
                        <tr className="bg-neutral-50">
                          <td colSpan={canManageDocs ? 6 : 5} className="px-6 py-3 text-xs text-neutral-700">
                            <p className="mb-2 font-semibold text-neutral-800">Ikke signert ({unsigned.length})</p>
                            {unsigned.length === 0 ? (
                              <p className="text-neutral-500">Alle relevante ansatte har signert.</p>
                            ) : (
                              <ul className="list-inside list-disc space-y-0.5">
                                {unsigned.map((u) => (
                                  <li key={u.id}>{u.display_name}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="compliance-no-print mt-6 flex justify-end">
        <a
          href="https://lovdata.no/forskrift/1996-12-06-1127"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#1a3d32] hover:underline"
        >
          <ExternalLink className="size-4" />
          Internkontrollforskriften på lovdata.no
        </a>
      </div>

      {panelRef && panelRow && (
        <div className="compliance-no-print fixed inset-0 z-[60] flex justify-end">
          <button type="button" aria-label="Lukk" className="absolute inset-0 bg-black/40" onClick={() => setPanelRef(null)} />
          <div
            className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Krav {panelRow.item.ref}</h2>
              <button type="button" onClick={() => setPanelRef(null)} className="rounded-none p-2 text-neutral-500 hover:bg-neutral-100">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <p className="text-neutral-700">{panelRow.item.requirement || panelRow.item.label}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
                <p className="mt-1 text-neutral-800">
                  {panelRow.status === 'covered'
                    ? 'Dekket med gyldig revisjon'
                    : panelRow.status === 'stale'
                      ? 'Publisert dekning finnes, men revisjon er forfalt eller forfaller i dag'
                      : 'Ikke dekket (ingen publisert side med hjemmelen)'}
                </p>
              </div>
              {panelRow.item.legalConsequence ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Konsekvens</p>
                  <p className="mt-1 text-neutral-800">{panelRow.item.legalConsequence}</p>
                </div>
              ) : null}
              {panelRow.coveredBy.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Gyldige publiserte sider</p>
                  <ul className="mt-2 space-y-2">
                    {panelRow.coveredBy.map((p) => (
                      <li key={p.id}>
                        <Link to={`/documents/page/${p.id}`} className="font-medium text-[#1a3d32] hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-xs text-neutral-500">
                          Revisjon:{' '}
                          {p.nextRevisionDueAt ? new Date(p.nextRevisionDueAt).toLocaleDateString('no-NO') : 'Ikke satt'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {panelRow.publishedWithRef.length > panelRow.coveredBy.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Publiserte sider med hjemmel (revisjon kan være forfalt)
                  </p>
                  <ul className="mt-2 space-y-2">
                    {panelRow.publishedWithRef
                      .filter((p) => !panelRow.coveredBy.some((c) => c.id === p.id))
                      .map((p) => (
                        <li key={p.id}>
                          <Link to={`/documents/page/${p.id}`} className="font-medium text-amber-900 hover:underline">
                            {p.title}
                          </Link>
                          <p className="text-xs text-neutral-500">
                            Revisjon:{' '}
                            {p.nextRevisionDueAt ? new Date(p.nextRevisionDueAt).toLocaleDateString('no-NO') : 'Ikke satt'}
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </DocumentsModuleLayout>
  )
}
