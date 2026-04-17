import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Printer } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRepresentatives } from '../../hooks/useRepresentatives'
import { useCouncil } from '../../hooks/useCouncil'
import { useInternalControl } from '../../hooks/useInternalControl'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { formatBrregAddress } from '../../lib/brreg'
import type { BrregEnhet } from '../../types/brreg'
import { fetchOrgModulePayload } from '../../lib/orgModulePayload'
import { findVarslingRoutinePage, varslingAcknowledgementRate } from '../../lib/inspectionReadiness'
import type { AnnualReview } from '../../types/internalControl'
import type { WikiPage } from '../../types/documents'

function brregIndustry(snapshot: Record<string, unknown> | null): string {
  if (!snapshot) return '—'
  const n1 = snapshot.naeringskode1 as { kode?: string; beskrivelse?: string } | undefined
  if (n1?.kode) return `${n1.kode}${n1.beskrivelse ? ` — ${n1.beskrivelse}` : ''}`
  const n2 = snapshot.naeringskode2 as { kode?: string; beskrivelse?: string } | undefined
  if (n2?.kode) return `${n2.kode}${n2.beskrivelse ? ` — ${n2.beskrivelse}` : ''}`
  return '—'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('no-NO')
  } catch {
    return '—'
  }
}

function authorLabel(page: WikiPage, memberNames: Map<string, string>): string {
  return memberNames.get(page.authorId) ?? page.authorId.slice(0, 8) + '…'
}

function maskName(name: string, show: boolean): string {
  if (show) return name
  if (!name.trim()) return '—'
  return '[redigert]'
}

type DeviationAgg = { open: number; closed: number; total: number }

async function fetchDeviationAgg(supabase: SupabaseClient, orgId: string): Promise<DeviationAgg> {
  const since = new Date()
  since.setMonth(since.getMonth() - 12)
  const { data, error } = await supabase
    .from('deviations')
    .select('status')
    .eq('organization_id', orgId)
    .gte('created_at', since.toISOString())
  if (error || !data) return { open: 0, closed: 0, total: 0 }
  let open = 0
  let closed = 0
  for (const row of data as { status?: string | null }[]) {
    const s = (row.status ?? 'open').toLowerCase()
    if (s === 'closed' || s === 'resolved' || s === 'done') closed += 1
    else open += 1
  }
  return { open, closed, total: data.length }
}

async function fetchLearningCertCount(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('learning_certificates')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
  if (error) return 0
  return count ?? 0
}

export function InspectionArbeidstilsynetExportPage() {
  const docs = useDocuments()
  const { organization, members, profile, supabase, isAdmin } = useOrgSetupContext()
  const rep = useRepresentatives()
  const council = useCouncil()
  const ic = useInternalControl()

  const [includeNames, setIncludeNames] = useState(false)
  const [devAgg, setDevAgg] = useState<DeviationAgg | null>(null)
  const [certCount, setCertCount] = useState<number | null>(null)
  const [icAnnualPayload, setIcAnnualPayload] = useState<AnnualReview[] | null>(null)
  const [payloadErr, setPayloadErr] = useState<string | null>(null)
  const [varslingContact, setVarslingContact] = useState<string | null>(null)

  const orgId = organization?.id
  const year = new Date().getFullYear()

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void (async () => {
      try {
        const [agg, certs, payload] = await Promise.all([
          fetchDeviationAgg(supabase, orgId),
          fetchLearningCertCount(supabase, orgId),
          fetchOrgModulePayload<{ annualReviews?: AnnualReview[] }>(supabase, orgId, 'internal_control'),
        ])
        if (cancelled) return
        setDevAgg(agg)
        setCertCount(certs)
        setIcAnnualPayload(Array.isArray(payload?.annualReviews) ? payload!.annualReviews! : [])
        const { data: orgRow, error: orgErr } = await supabase
          .from('organizations')
          .select('varsling_contact_email')
          .eq('id', orgId)
          .maybeSingle()
        if (!cancelled && !orgErr && orgRow && 'varsling_contact_email' in orgRow && orgRow.varsling_contact_email) {
          const em = String(orgRow.varsling_contact_email).trim()
          if (em) setVarslingContact(em)
        }
      } catch (e) {
        if (!cancelled) setPayloadErr(e instanceof Error ? e.message : 'Kunne ikke laste tilleggsdata')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const brreg = (organization?.brreg_snapshot ?? null) as BrregEnhet | Record<string, unknown> | null
  const address = brreg && typeof brreg === 'object' && 'navn' in brreg ? formatBrregAddress(brreg as BrregEnhet) : '—'

  const memberNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of members) {
      m.set(row.id, row.display_name)
    }
    return m
  }, [members])

  const hmsLead = useMemo(() => {
    const primary = members[0]
    return {
      name: profile?.display_name ?? primary?.display_name ?? '—',
      title: profile?.job_title?.trim() || '—',
      email: profile?.email ?? primary?.email ?? '—',
      phone: profile?.phone ?? '—',
    }
  }, [members, profile])

  const verneombud = useMemo(() => {
    const flagged = rep.members.filter((m) => m.isVerneombud)
    const list = flagged.length > 0 ? flagged : rep.members.filter((m) => m.officeRole === 'employee_chair')
    return list.map((m) => ({
      name: m.name,
      elected: m.startedAt,
      mandateUntil: m.termUntil ?? '—',
    }))
  }, [rep.members])

  const amuLastMeeting = useMemo(() => {
    const done = council.meetings.filter((m) => m.status === 'completed')
    if (done.length === 0) return null
    const best = done.reduce((a, b) => (a.startsAt > b.startsAt ? a : b))
    return best.startsAt
  }, [council.meetings])

  const annualLockedThisYear = useMemo(() => {
    const list = icAnnualPayload ?? ic.annualReviews
    const r = list.find((a) => a.year === year && (a.status === 'locked' || a.locked))
    if (!r) return null
    const sig = r.signatures && r.signatures.length > 0 ? r.signatures[r.signatures.length - 1] : undefined
    return {
      at: r.reviewedAt,
      by: sig?.signerName ?? r.reviewer,
      summary: r.sections
        ? [r.sections.pdcaCheckActNotes, r.sections.goalsNextYear].filter(Boolean).join(' ').slice(0, 400)
        : r.summary?.slice(0, 400) ?? '',
    }
  }, [ic.annualReviews, icAnnualPayload, year])

  const varslingPage = useMemo(() => findVarslingRoutinePage(docs.pages), [docs.pages])
  const varslingRate = useMemo(
    () => varslingAcknowledgementRate(varslingPage, docs.receipts, members.length),
    [varslingPage, docs.receipts, members.length],
  )

  const coverageRows = useMemo(() => {
    return docs.legalCoverage.map((item) => {
      const coveredBy = docs.pages.filter(
        (p) =>
          p.status === 'published' &&
          item.templateIds.some((tid) => {
            const tpl = docs.pageTemplates.find((t) => t.id === tid)
            if (!tpl) return false
            return tpl.page.legalRefs.some((r) => p.legalRefs.includes(r))
          }),
      )
      const primary = coveredBy[0]
      const stale = coveredBy.some((p) => {
        if (!p.nextRevisionDueAt) return false
        return new Date(p.nextRevisionDueAt).getTime() < Date.now()
      })
      let status = 'Mangler'
      if (coveredBy.length > 0 && !stale) status = 'OK'
      else if (coveredBy.length > 0 && stale) status = 'Forfalt'
      return {
        ref: item.ref,
        label: item.label,
        status,
        title: primary?.title ?? '—',
        lastRev: primary?.updatedAt ? formatDate(primary.updatedAt) : '—',
        nextRev: primary?.nextRevisionDueAt ? formatDate(primary.nextRevisionDueAt) : '—',
        author: primary ? authorLabel(primary, memberNames) : '—',
      }
    })
  }, [docs.legalCoverage, docs.pages, docs.pageTemplates, memberNames])

  const rosPages = useMemo(
    () => docs.pages.filter((p) => p.status === 'published' && p.legalRefs.some((r) => r.startsWith('IK-f §5 nr. 2'))),
    [docs.pages],
  )

  const voTrainingOk = useMemo(() => {
    return rep.members.some((m) => {
      if (!m.isVerneombud && m.officeRole !== 'employee_chair') return false
      const checklist = m.trainingChecklist ?? {}
      return Object.values(checklist).filter(Boolean).length >= 5
    })
  }, [rep.members])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const industry = brregIndustry(organization?.brreg_snapshot ?? null)

  return (
    <DocumentsModuleLayout
      subHeader={
        <nav className="mt-6 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 pb-6 text-sm text-neutral-600">
          <Link to="/documents" className="text-neutral-500 hover:text-[#1a3d32]">
            Bibliotek
          </Link>
          <span className="text-neutral-400">→</span>
          <Link to="/documents/compliance" className="text-neutral-500 hover:text-[#1a3d32]">
            Samsvar
          </Link>
          <span className="text-neutral-400">→</span>
          <span className="font-medium text-neutral-800">Arbeidstilsynet-rapport</span>
        </nav>
      }
    >
      <style>
        {`
          @media print {
            body * { visibility: hidden !important; }
            #inspection-report-root, #inspection-report-root * { visibility: visible !important; }
            #inspection-report-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; }
          }
        `}
      </style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-none border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Arbeidstilsynet-rapport (utkast)</h1>
          <p className="text-xs text-neutral-500">
            Strukturert oversikt for tilsyn — genereres lokalt i nettleseren. Bruk «Skriv ut» og lagre som PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={includeNames}
                onChange={(e) => setIncludeNames(e.target.checked)}
                className="size-4 rounded border-neutral-300"
              />
              Inkluder medarbeidernavn
            </label>
          ) : null}
          <button
            type="button"
            onClick={handlePrint}
            aria-label="Generer tilsynsrapport — åpner utskriftsvindu"
            className="inline-flex items-center gap-1.5 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-3 py-2 text-xs font-medium text-white"
          >
            <Printer className="size-3.5" aria-hidden />
            Generer tilsynsrapport
          </button>
        </div>
      </div>

      {payloadErr ? <p className="no-print mb-2 text-xs text-amber-800">{payloadErr}</p> : null}

      <div id="inspection-report-root" className="rounded-none border border-neutral-200 bg-white p-6 text-sm text-neutral-900 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-neutral-200 pb-4">
          <h2 className="text-xl font-bold text-[#1a3d32]">Arbeidstilsynet — dokumentasjonsrapport</h2>
          <p className="mt-1 text-xs text-neutral-500">Generert {new Date().toLocaleString('no-NO')}</p>
        </header>

        <section className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">A — Virksomhetsopplysninger</h3>
          <table className="mt-2 w-full border-collapse text-xs">
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5 pr-4 font-medium text-neutral-600">Virksomhet</td>
                <td className="py-1.5">{organization?.name ?? '—'}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5 pr-4 font-medium text-neutral-600">Org.nr.</td>
                <td className="py-1.5">{organization?.organization_number ?? '—'}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5 pr-4 font-medium text-neutral-600">Adresse</td>
                <td className="py-1.5">{address}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5 pr-4 font-medium text-neutral-600">Næringskode</td>
                <td className="py-1.5">{industry}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5 pr-4 font-medium text-neutral-600">Antall medlemmer (register)</td>
                <td className="py-1.5">{members.length}</td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5 pr-4 font-medium text-neutral-600">HMS-ansvarlig</td>
                <td className="py-1.5">
                  {hmsLead.name} — {hmsLead.title}
                  <br />
                  E-post: {hmsLead.email} · Tlf.: {hmsLead.phone}
                </td>
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="py-1.5 pr-4 font-medium text-neutral-600 align-top">Verneombud</td>
                <td className="py-1.5">
                  {verneombud.length === 0 ? (
                    <span className="text-amber-800">Ikke registrert i representantmodulen</span>
                  ) : (
                    <ul className="list-inside list-disc">
                      {verneombud.map((v) => (
                        <li key={v.name}>
                          {maskName(v.name, includeNames)} — valgt {formatDate(v.elected)} · Mandat til {formatDate(v.mandateUntil)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-medium text-neutral-600 align-top">AMU</td>
                <td className="py-1.5">
                  Etablert: {council.board.length > 0 || council.meetings.length > 0 ? 'Ja' : 'Ukjent / ikke registrert'}
                  <br />
                  Siste møtedato (fullført): {amuLastMeeting ? formatDate(amuLastMeeting) : '—'}
                  <br />
                  Medlemmer (Council):{' '}
                  {council.board.length > 0
                    ? council.board.map((b) => maskName(b.name, includeNames)).join(', ')
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">B — Dokumentasjon (IK-f §5)</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse border border-neutral-200 text-xs">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="border border-neutral-200 px-2 py-2 text-left">Krav</th>
                  <th className="border border-neutral-200 px-2 py-2 text-left">Status</th>
                  <th className="border border-neutral-200 px-2 py-2 text-left">Dokument</th>
                  <th className="border border-neutral-200 px-2 py-2 text-left">Sist revidert</th>
                  <th className="border border-neutral-200 px-2 py-2 text-left">Neste revisjon</th>
                  <th className="border border-neutral-200 px-2 py-2 text-left">Forfatter</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.map((row) => (
                  <tr key={row.ref}>
                    <td className="border border-neutral-200 px-2 py-1.5">
                      <span className="font-mono text-[11px]">{row.ref}</span>
                      <div className="text-neutral-600">{row.label}</div>
                    </td>
                    <td className="border border-neutral-200 px-2 py-1.5">{row.status}</td>
                    <td className="border border-neutral-200 px-2 py-1.5">{row.title}</td>
                    <td className="border border-neutral-200 px-2 py-1.5">{row.lastRev}</td>
                    <td className="border border-neutral-200 px-2 py-1.5">{row.nextRev}</td>
                    <td className="border border-neutral-200 px-2 py-1.5">{maskName(row.author, includeNames)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">C — Risikovurderinger (IK-f §5 nr. 2)</h3>
          {rosPages.length === 0 ? (
            <p className="mt-2 text-xs text-neutral-600">Ingen publiserte sider med denne lovhenvisningen.</p>
          ) : (
            <ul className="mt-2 list-inside list-disc text-xs">
              {rosPages.map((p) => (
                <li key={p.id}>
                  <strong>{p.title}</strong> — status {p.status} · oppdatert {formatDate(p.updatedAt)} · ansvarlig
                  dokument: {maskName(authorLabel(p, memberNames), includeNames)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">D — Avviksbehandling (12 mnd)</h3>
          {devAgg == null ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 className="size-4 animate-spin" /> Laster avvik…
            </p>
          ) : (
            <p className="mt-2 text-xs">
              Totalt registrert: <strong>{devAgg.total}</strong> · Åpne: <strong>{devAgg.open}</strong> · Lukket:{' '}
              <strong>{devAgg.closed}</strong>
            </p>
          )}
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">E — HMS-opplæring</h3>
          <p className="mt-2 text-xs">
            Utstedte kursbevis (organisasjon):{' '}
            <strong>{certCount == null ? '…' : certCount}</strong> (fra læringsmodulen der tilgjengelig).
          </p>
          <p className="mt-1 text-xs">
            Verneombud 40 t (AML §6-5) — sjekkliste i representantregister:{' '}
            <strong>{voTrainingOk ? 'Delvis dokumentert' : 'Ikke bekreftet'}</strong>
          </p>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">F — Årsgjennomgang ({year})</h3>
          {annualLockedThisYear ? (
            <div className="mt-2 text-xs">
              <p>
                <strong>Fullført:</strong> {formatDate(annualLockedThisYear.at)} av {annualLockedThisYear.by}
              </p>
              <p className="mt-2 text-neutral-700">{annualLockedThisYear.summary || '—'}</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-800">Ingen låst årsgjennomgang registrert for inneværende år i internkontroll.</p>
          )}
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-700">G — Varsling</h3>
          <p className="mt-2 text-xs">
            Rutine publisert: <strong>{varslingPage ? 'Ja' : 'Nei / ikke funnet'}</strong>
            {varslingPage ? ` («${varslingPage.title}»)` : ''}
          </p>
          <p className="mt-1 text-xs">
            Bekreftelsesgrad (ansatte med siste versjon):{' '}
            <strong>
              {varslingRate == null
                ? '—'
                : `${Math.round(varslingRate * 100)} % (${docs.receipts.filter((r) => r.pageId === varslingPage?.id && r.pageVersion === varslingPage.version).length} av ${members.length})`}
            </strong>
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Varslingskontakt: <strong>{varslingContact ?? '—'}</strong> (fra organisasjonsinnstillinger når feltet finnes)
          </p>
        </section>

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-[10px] text-neutral-500">
          Rapporten er et støtteverktøy og erstatter ikke juridisk rådgivning. Kontroller alle opplysninger før innsending til Arbeidstilsynet.
        </footer>
      </div>
    </DocumentsModuleLayout>
  )
}
