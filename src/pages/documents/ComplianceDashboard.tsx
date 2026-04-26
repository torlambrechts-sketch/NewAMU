import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ExternalLink, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModuleSectionCard, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module'
import { Button } from '../../components/ui/Button'

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
}

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

export function ComplianceDashboard() {
  const docs = useDocuments()
  const { members, isAdmin, can } = useOrgSetupContext()
  const [panelRef, setPanelRef] = useState<string | null>(null)
  const nowMs = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const employeeCount = members.length
  const amuSpace = useMemo(
    () => docs.spaces.find((s) => s.isAmuSpace === true || /amu/i.test(s.title)),
    [docs.spaces],
  )
  const amuPageIds = useMemo(
    () => (amuSpace ? docs.pages.filter((p) => p.spaceId === amuSpace.id).map((p) => p.id) : []),
    [docs.pages, amuSpace],
  )
  const amuCompliance = useMemo(() => {
    if (employeeCount < 50) {
      return {
        applies: false as const,
        hasAmuSpace: Boolean(amuSpace),
        annualReportOk: false,
        protocolRecentOk: false,
        lastProtocolAt: null as string | null,
        meetingsPublishedLast12m: 0,
      }
    }
    const annualReportOk = docs.pages.some(
      (p) =>
        p.status === 'published' &&
        p.legalRefs.some((r) => r.includes('7-2')) &&
        p.legalRefs.some((r) => r.includes('7-4')),
    )
    const publishedInAmu = docs.auditLedger.filter(
      (e) =>
        e.action === 'published' &&
        amuPageIds.includes(e.pageId) &&
        new Date(e.at).getTime() > nowMs - 90 * 86400000,
    )
    const lastProtocolAt =
      publishedInAmu.length > 0
        ? publishedInAmu.reduce((best, e) => (e.at > best ? e.at : best), publishedInAmu[0]!.at)
        : null
    const protocolRecentOk = publishedInAmu.length > 0
    const meetingsPublishedLast12m = docs.auditLedger.filter(
      (e) =>
        e.action === 'published' &&
        amuPageIds.includes(e.pageId) &&
        new Date(e.at).getTime() > nowMs - 365 * 86400000,
    ).length
    return {
      applies: true as const,
      hasAmuSpace: Boolean(amuSpace),
      annualReportOk,
      protocolRecentOk,
      lastProtocolAt,
      meetingsPublishedLast12m,
    }
  }, [employeeCount, docs.pages, docs.auditLedger, amuSpace, amuPageIds, nowMs])

  const amuProtocolsOk =
    amuCompliance.applies &&
    amuCompliance.hasAmuSpace &&
    amuCompliance.annualReportOk &&
    amuCompliance.protocolRecentOk

  const [viewCounts, setViewCounts] = useState<Map<string, number>>(() => new Map())
  const showViewAgg = Boolean(isAdmin || can('documents.manage'))

  useEffect(() => {
    if (!showViewAgg) {
      setViewCounts(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await docs.fetchOrgPageViewCounts()
        if (cancelled) return
        const m = new Map<string, number>()
        for (const r of rows) m.set(r.pageId, r.uniqueViewers)
        setViewCounts(m)
      } catch {
        if (!cancelled) setViewCounts(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showViewAgg, docs.fetchOrgPageViewCounts])

  const coverage = docs.legalCoverage.map((item) => {
    const coveredBy = docs.pages
      .filter((p) => {
        if (p.status !== 'published') return false
        return item.templateIds.some((tid) => {
          const tpl = docs.pageTemplates.find((t) => t.id === tid)
          if (!tpl) return false
          if (tid === 'tpl-verneombud-mandat') {
            return p.legalRefs.some((r) => r === 'AML §6-1' || r.startsWith('AML §6-1'))
          }
          return tpl.page.legalRefs.some((r) => p.legalRefs.includes(r))
        })
      })
      .map((p) => {
        const ackCount = docs.receipts.filter((r) => r.pageId === p.id && r.pageVersion === p.version).length
        const viewCount = showViewAgg ? viewCounts.get(p.id) ?? 0 : null
        return { page: p, ackCount, viewCount }
      })
    const stale = coveredBy.some(({ page: p }) => {
      if (!p.nextRevisionDueAt) return false
      return new Date(p.nextRevisionDueAt).getTime() < nowMs
    })
    return { ...item, coveredBy, covered: coveredBy.length > 0, stale }
  })

  const verneombudMandate = useMemo(() => {
    const candidates = docs.pages.filter(
      (p) => p.status === 'published' && p.legalRefs.some((r) => r === 'AML §6-1' || r.startsWith('AML §6-1')),
    )
    const pick =
      candidates.length === 0
        ? null
        : [...candidates].sort((a, b) => {
            const at = new Date(a.updatedAt).getTime()
            const bt = new Date(b.updatedAt).getTime()
            return bt - at
          })[0] ?? null
    let status: 'missing' | 'stale' | 'covered' = 'missing'
    let mandateExpires: string | null = null
    if (pick) {
      mandateExpires = pick.nextRevisionDueAt ?? null
      const overdue = pick.nextRevisionDueAt && new Date(pick.nextRevisionDueAt).getTime() < nowMs
      status = overdue ? 'stale' : 'covered'
    }
    return { status, mandateExpires, page: pick }
  }, [docs.pages, nowMs])

  const panelRow = useMemo(
    () => (panelRef ? coverage.find((c) => c.ref === panelRef) ?? null : null),
    [coverage, panelRef],
  )

  useBodyScrollLock(Boolean(panelRef))

  useEffect(() => {
    if (!panelRef) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelRef(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelRef])

  const total = coverage.length
  const covered = coverage.filter((c) => c.covered).length
  const pct = total ? Math.round((covered / total) * 100) : 0

  return (
    <>
      <ModuleSectionCard className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-4xl font-bold tabular-nums text-[#1a3d32]">{pct}%</div>
            <div className="text-sm text-neutral-600">av {total} lovkrav dekket av publiserte sider</div>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <div>
              <strong className="text-emerald-700">{covered}</strong> dekket
            </div>
            <div>
              <strong className="text-amber-600">{total - covered}</strong> mangler
            </div>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </ModuleSectionCard>

      {employeeCount >= 50 ? (
        <div className="mt-8 space-y-4">
          <ModuleSectionCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">AMU (AML §7 — store virksomheter)</h2>
              <p className="text-xs text-neutral-500">
                Kravene under gjelder når virksomheten har AMU-plikt (her: {employeeCount} registrerte medlemmer som
                terskel). AMU-protokoller skal være tilgjengelige for ansatte (AML §7-4).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr>
                    <th className={MODULE_TABLE_TH}>Hjemmel</th>
                    <th className={MODULE_TABLE_TH}>Krav</th>
                    <th className={MODULE_TABLE_TH}>Status</th>
                    <th className={MODULE_TABLE_TH}>Siste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr className={MODULE_TABLE_TR_BODY}>
                    <td className="px-4 py-3 font-mono text-xs text-[#1a3d32]">AML §7-4</td>
                    <td className="px-4 py-3 text-neutral-700">AMU-protokoller tilgjengelig</td>
                    <td className="px-4 py-3">
                      {amuProtocolsOk ? (
                        <CheckCircle2 className="size-5 text-emerald-600" aria-label="OK" />
                      ) : (
                        <Circle className="size-5 text-amber-400" aria-label="Mangler" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">
                      {amuCompliance.lastProtocolAt
                        ? new Date(amuCompliance.lastProtocolAt).toLocaleDateString('no-NO')
                        : '—'}
                      {!amuCompliance.hasAmuSpace ? (
                        <span className="mt-1 block text-amber-700">Mangler AMU-mappe</span>
                      ) : null}
                      {!amuCompliance.annualReportOk ? (
                        <span className="mt-1 block text-amber-700">Mangler publisert AMU-årsrapport (§7-2/7-4)</span>
                      ) : null}
                      {amuCompliance.hasAmuSpace && amuCompliance.annualReportOk && !amuCompliance.protocolRecentOk ? (
                        <span className="mt-1 block text-amber-700">Ingen protokoll publisert siste 3 mnd.</span>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ModuleSectionCard>

          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              amuCompliance.meetingsPublishedLast12m >= 4
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
          >
            <p className="font-medium">AMU-møtefrekvens (AML §7-3)</p>
            <p className="mt-1 text-neutral-800">
              {amuCompliance.meetingsPublishedLast12m} av 4 planlagte AMU-møter protokollert siste år
              {amuSpace ? (
                <span className="text-neutral-600">
                  {' '}
                  (publiseringer i «{amuSpace.title}», fra aktivitetslogg)
                </span>
              ) : null}
            </p>
            {amuCompliance.meetingsPublishedLast12m < 4 ? (
              <p className="mt-2 text-xs text-amber-900">
                Virksomheter med AMU bør dokumentere minst fire møter i året. Opprett/publiser protokoller i AMU-mappen.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-xs text-neutral-500">
          Utvidet AMU-samsvar (mappe, protokoller, møtefrekvens) vises når organisasjonen har minst 50 registrerte
          medlemmer — typisk AMU-plikt.
        </p>
      )}

      <ModuleSectionCard className="mt-8 overflow-hidden p-0">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Verneombud (AML §6-1)</h2>
          <p className="text-xs text-neutral-500">Mandat og valgperiode — revisjonsfrist følger 2-årsvalg.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                <th className={MODULE_TABLE_TH}>Hjemmel</th>
                <th className={MODULE_TABLE_TH}>Krav</th>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH}>Mandat utløper</th>
              </tr>
            </thead>
            <tbody>
              <tr className={MODULE_TABLE_TR_BODY}>
                <td className="px-4 py-3 font-mono text-xs text-[#1a3d32]">AML §6-1</td>
                <td className="px-4 py-3 text-neutral-700">Verneombud valgt og dokumentert</td>
                <td className="px-4 py-3">
                  {verneombudMandate.status === 'covered' ? (
                    <CheckCircle2 className="size-5 text-emerald-600" aria-label="OK" />
                  ) : verneombudMandate.status === 'stale' ? (
                    <span className="text-xs font-medium text-amber-800" title="Valgperiode eller revisjon forfalt">
                      ⚠
                    </span>
                  ) : (
                    <Circle className="size-5 text-amber-400" aria-label="Mangler" />
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600">
                  {verneombudMandate.mandateExpires ? (
                    <>
                      {new Date(verneombudMandate.mandateExpires).toLocaleDateString('no-NO')}
                      {verneombudMandate.page ? (
                        <Link
                          to={`/documents/page/${verneombudMandate.page.id}`}
                          className="mt-1 block font-medium text-[#1a3d32] hover:underline"
                        >
                          {verneombudMandate.page.title}
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-amber-800">Ingen publisert mandat-side (AML §6-1)</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="mb-8 mt-8 overflow-hidden p-0">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Krav per lovhenvisning</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH}>Hjemmel</th>
                <th className={MODULE_TABLE_TH}>Krav</th>
                <th className={MODULE_TABLE_TH}>Neste revideringsdato</th>
                <th className={MODULE_TABLE_TH}>Dekket av</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {coverage.map((c) => (
                <tr
                  key={c.ref}
                  className={`cursor-pointer transition-colors hover:bg-neutral-50 ${
                    c.covered && !c.stale ? '' : 'bg-amber-50/40'
                  }`}
                  onClick={() => setPanelRef(c.ref)}
                >
                  <td className="px-4 py-3">
                    {c.covered && !c.stale ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : c.covered && c.stale ? (
                      <span
                        className="text-xs font-medium text-amber-800"
                        title="Dokument funnet, men revisjonsfrist passert"
                      >
                        ⚠
                      </span>
                    ) : (
                      <Circle className="size-5 text-amber-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a3d32]">
                      {c.ref}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{c.label}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {c.coveredBy.length === 0 ? (
                      <span className="text-amber-700">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {c.coveredBy.map(({ page: p }) => (
                          <li key={p.id}>
                            {p.nextRevisionDueAt ? (
                              new Date(p.nextRevisionDueAt).toLocaleDateString('no-NO')
                            ) : (
                              <span className="text-neutral-400">Ikke satt</span>
                            )}{' '}
                            <span className="text-neutral-400">({p.title})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.coveredBy.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.coveredBy.map(({ page: p, ackCount, viewCount }) => (
                          <span
                            key={p.id}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                            title={
                              showViewAgg
                                ? `Signert: ${ackCount} av ${employeeCount} · Unike visninger: ${viewCount}`
                                : `Signert: ${ackCount} av ${employeeCount}`
                            }
                          >
                            {p.title}
                            {p.requiresAcknowledgement ? (
                              <span className="ml-1 text-[10px] text-emerald-900/80">
                                ({ackCount}/{employeeCount})
                              </span>
                            ) : null}
                            {showViewAgg ? (
                              <span className="ml-1 text-[10px] text-emerald-900/70">· {viewCount} visninger</span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700">Ingen publisert side dekker dette kravet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Compliance-kvitteringer</h2>
          <p className="text-xs text-neutral-500">
            Sider som krever «Lest og forstått»-signatur, og antall registrerte kvitteringer.
          </p>
        </div>
        {docs.pages.filter((p) => p.requiresAcknowledgement && p.status === 'published').length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen publiserte sider krever signatur ennå.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr>
                  <th className={MODULE_TABLE_TH}>Side</th>
                  <th className={MODULE_TABLE_TH}>Versjon</th>
                  <th className={MODULE_TABLE_TH}>Kvitteringer</th>
                  <th className={MODULE_TABLE_TH}>Siste signatur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {docs.pages
                  .filter((p) => p.requiresAcknowledgement && p.status === 'published')
                  .map((p) => {
                    const recs = docs.receipts.filter((r) => r.pageId === p.id)
                    const last = recs.sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt))[0]
                    return (
                      <tr key={p.id} className={MODULE_TABLE_TR_BODY}>
                        <td className="px-4 py-3">
                          <Link to={`/documents/page/${p.id}`} className="font-medium text-[#1a3d32] hover:underline">
                            {p.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">v{p.version}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                              recs.length > 0
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }`}
                          >
                            {recs.length} signert
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">
                          {last
                            ? `${last.userName} · ${new Date(last.acknowledgedAt).toLocaleDateString('no-NO')}`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>

      <div className="mt-6 flex justify-end">
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
        <div className="fixed inset-0 z-[60] flex justify-end">
          <Button
            type="button"
            variant="ghost"
            aria-label="Lukk"
            className="absolute inset-0 h-auto min-h-0 rounded-sm bg-black/40 p-0 hover:bg-black/50"
            onClick={() => setPanelRef(null)}
          />
          <div
            className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Krav {panelRow.ref}</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Lukk panel"
                onClick={() => setPanelRef(null)}
                icon={<X className="h-5 w-5" />}
              />
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <p className="text-neutral-700">{panelRow.label}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
                <p className="mt-1 text-neutral-800">
                  {panelRow.covered && !panelRow.stale
                    ? 'Dekket av publiserte sider'
                    : panelRow.covered && panelRow.stale
                      ? 'Dekket, men minst én side har passert revisjonsfrist'
                      : 'Ikke dekket'}
                </p>
              </div>
              {panelRow.coveredBy.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Publiserte sider</p>
                  <ul className="mt-2 space-y-2">
                    {panelRow.coveredBy.map(({ page: p, ackCount, viewCount }) => (
                      <li key={p.id}>
                        <Link to={`/documents/page/${p.id}`} className="font-medium text-[#1a3d32] hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-xs text-neutral-500">
                          Revisjon:{' '}
                          {p.nextRevisionDueAt
                            ? new Date(p.nextRevisionDueAt).toLocaleDateString('no-NO')
                            : 'Ikke satt'}
                        </p>
                        {p.requiresAcknowledgement ? (
                          <p className="text-xs text-neutral-500">
                            Sett av {ackCount} av {employeeCount} ansatte
                            {showViewAgg ? ` · unike visninger: ${viewCount}` : ''}
                          </p>
                        ) : showViewAgg ? (
                          <p className="text-xs text-neutral-500">Unike visninger: {viewCount}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
