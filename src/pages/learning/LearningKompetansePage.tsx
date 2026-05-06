import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Award,
  CheckCircle2,
  FileUp,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WarningBox } from '../../components/ui/AlertBox'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import {
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
  ModuleSectionCard,
} from '../../components/module'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'

type SubTab = 'mine' | 'ekstern' | 'fornyelse'

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Venter godkjenning', variant: 'warning' },
  approved: { label: 'Godkjent', variant: 'success' },
  rejected: { label: 'Avslått', variant: 'danger' },
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Kompetanse hub — combines:
 *   • Mine kursbevis (issued certificates from system courses)
 *   • Ekstern dokumentasjon (uploaded third-party certificates)
 *   • Fornyelse (recertification window — courses with utløp innen 90 d)
 *
 * Replaces the old `/learning/certifications` and `/learning/external` routes
 * (both still resolve via redirect to `?tab=mine|ekstern`).
 */
export function LearningKompetansePage() {
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const {
    certificates,
    courses,
    externalCertificates,
    submitExternalCertificate,
    approveExternalCertificate,
    learningLoading,
    learningError,
  } = useLearning()

  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab: SubTab =
    searchParams.get('tab') === 'ekstern'
      ? 'ekstern'
      : searchParams.get('tab') === 'fornyelse'
        ? 'fornyelse'
        : 'mine'
  const [tab, setTab] = useState<SubTab>(initialTab)

  const setTabParam = (next: SubTab) => {
    setTab(next)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'mine') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  // ── KPI: shared snapshot across all sub-tabs ───────────────────────────────
  const [nowMs] = useState(() => Date.now())
  const expiringSoon = useMemo(() => {
    const ninetyDays = 90 * 24 * 60 * 60 * 1000
    return certificates.filter((c) => {
      const course = courses.find((x) => x.id === c.courseId)
      if (!course?.recertificationMonths) return false
      const issued = new Date(c.issuedAt).getTime()
      const expires = issued + course.recertificationMonths * 30 * 24 * 60 * 60 * 1000
      return expires - nowMs < ninetyDays && expires > nowMs
    }).length
  }, [certificates, courses, nowMs])

  const expired = useMemo(() => {
    return certificates.filter((c) => {
      const course = courses.find((x) => x.id === c.courseId)
      if (!course?.recertificationMonths) return false
      const issued = new Date(c.issuedAt).getTime()
      const expires = issued + course.recertificationMonths * 30 * 24 * 60 * 60 * 1000
      return expires < nowMs
    }).length
  }, [certificates, courses, nowMs])

  const pendingExternal = externalCertificates.filter((x) => x.status === 'pending').length
  const approvedExternal = externalCertificates.filter((x) => x.status === 'approved').length

  const kpis = useMemo<LayoutScoreStatItem[]>(
    () => [
      { big: String(certificates.length), title: 'Kursbevis', sub: 'Utstedt totalt' },
      { big: String(approvedExternal), title: 'Ekstern dok.', sub: 'Godkjent' },
      { big: String(expiringSoon), title: 'Utløper snart', sub: 'Innen 90 dager' },
      { big: String(expired), title: 'Utløpt', sub: 'Krever fornyelse' },
    ],
    [certificates.length, approvedExternal, expiringSoon, expired],
  )

  const tabItems: TabItem[] = [
    { id: 'mine', label: 'Mine kursbevis', icon: Award, badgeCount: certificates.length },
    {
      id: 'ekstern',
      label: 'Ekstern dokumentasjon',
      icon: FileUp,
      badgeCount: pendingExternal,
      badgeVariant: pendingExternal > 0 && canManage ? 'danger' : 'default',
    },
    { id: 'fornyelse', label: 'Fornyelse', icon: RefreshCw, badgeCount: expiringSoon + expired },
  ]

  return (
    <div className="space-y-6">
      {learningError ? <WarningBox>{learningError}</WarningBox> : null}
      {learningLoading ? <p className="text-sm text-neutral-600">Laster…</p> : null}

      <LayoutScoreStatRow items={kpis} />

      <Tabs items={tabItems} activeId={tab} onChange={(id) => setTabParam(id as SubTab)} overflow="scroll" />

      {tab === 'mine' ? <MineSection /> : null}
      {tab === 'ekstern' ? (
        <EksternSection
          canManage={canManage}
          submit={submitExternalCertificate}
          approve={approveExternalCertificate}
        />
      ) : null}
      {tab === 'fornyelse' ? <FornyelseSection /> : null}
    </div>
  )
}

// ── Sub-tab: Mine kursbevis ────────────────────────────────────────────────
function MineSection() {
  const { certificates } = useLearning()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return certificates
    return certificates.filter(
      (c) =>
        c.courseTitle.toLowerCase().includes(needle) ||
        c.learnerName.toLowerCase().includes(needle) ||
        c.verifyCode.toLowerCase().includes(needle),
    )
  }, [certificates, q])

  return (
    <ModuleSectionCard className="!p-0">
      <LayoutTable1PostingsShell
        wrap={false}
        titleTypography="sans"
        title="Utstedte sertifikater"
        description="Søk på kurs, deltaker eller verifiseringskode."
        toolbar={
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk på navn, kurs eller kode…"
              className="pl-9"
              aria-label="Søk i sertifikater"
            />
          </div>
        }
        footer={
          <span>
            Viser {filtered.length} av {certificates.length} sertifikater
          </span>
        }
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <Award className="h-8 w-8 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-600">
              {certificates.length === 0
                ? 'Ingen sertifikater ennå. Fullfør et publisert kurs for å få utstedt ett.'
                : 'Ingen treff for søket.'}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-neutral-50/60">
              <tr>
                <th className={MODULE_TABLE_TH}>Kurs</th>
                <th className={MODULE_TABLE_TH}>Mottaker</th>
                <th className={MODULE_TABLE_TH}>Utstedt</th>
                <th className={MODULE_TABLE_TH}>Versjon</th>
                <th className={MODULE_TABLE_TH}>Verifiseringskode</th>
                <th className={MODULE_TABLE_TH}>Status</th>
                <th className={MODULE_TABLE_TH} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={MODULE_TABLE_TR_BODY}>
                  <td className="px-5 py-3 font-medium text-neutral-900">{c.courseTitle}</td>
                  <td className="px-5 py-3 text-neutral-700">{c.learnerName}</td>
                  <td className="px-5 py-3 text-neutral-700">{fmtDate(c.issuedAt)}</td>
                  <td className="px-5 py-3 tabular-nums text-neutral-700">
                    {c.courseVersion ? `v${c.courseVersion}` : '—'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-neutral-600">{c.verifyCode}</td>
                  <td className="px-5 py-3">
                    <Badge variant="success">Gyldig</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/learning/certificates/${c.id}/print`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      Skriv ut
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </LayoutTable1PostingsShell>
    </ModuleSectionCard>
  )
}

// ── Sub-tab: Ekstern dokumentasjon ─────────────────────────────────────────
type SubmitExternalFn = ReturnType<typeof useLearning>['submitExternalCertificate']
type ApproveExternalFn = ReturnType<typeof useLearning>['approveExternalCertificate']

function EksternSection({
  canManage,
  submit,
  approve,
}: {
  canManage: boolean
  submit: SubmitExternalFn
  approve: ApproveExternalFn
}) {
  const { externalCertificates } = useLearning()
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  const upload = () => {
    if (!title.trim() || !file) {
      setMsg('Tittel og fil er påkrevd.')
      return
    }
    void (async () => {
      setUploading(true)
      const r = await submit({
        title: title.trim(),
        issuer: issuer.trim() || undefined,
        validUntil: validUntil || null,
        file,
      })
      setUploading(false)
      setMsg(r.ok ? 'Sendt til godkjenning.' : r.error)
      if (r.ok) {
        setTitle('')
        setIssuer('')
        setValidUntil('')
        setFile(null)
      }
    })()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-[#1a3d32]" />
          <h2 className="text-lg font-semibold text-neutral-900">Ny dokumentasjon</h2>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Fyll inn detaljer og last opp PDF eller bilde av kursbevis.
        </p>
        <div className="mt-5 space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-title">
              Tittel / kursnavn
            </label>
            <StandardInput
              id="ext-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              placeholder="F.eks. Kran- og løfteopplæring G4"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-issuer">
              Utsteder (valgfritt)
            </label>
            <StandardInput
              id="ext-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className="mt-1.5"
              placeholder="F.eks. Norsk Sertifisering"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-valid-until">
              Gyldig til (valgfritt)
            </label>
            <StandardInput
              id="ext-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ext-file">
              Fil (PDF eller bilde)
            </label>
            <p className="mt-1 text-xs text-neutral-500">
              Maks 10&nbsp;MB. Aksepterte formater: PDF, JPG, PNG.
            </p>
            <input
              id="ext-file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-label="Last opp PDF eller bilde av kursbevis"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 file:mr-3 file:rounded-l-md file:border-0 file:border-r file:border-neutral-300 file:bg-neutral-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-neutral-100"
            />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button
            type="button"
            variant="primary"
            onClick={upload}
            disabled={uploading}
            icon={<FileUp className="h-4 w-4" />}
          >
            {uploading ? 'Laster opp…' : 'Send inn'}
          </Button>
        </div>
        {msg ? (
          <p className="mt-3 text-xs text-neutral-700" role="status">
            {msg}
          </p>
        ) : null}
      </ModuleSectionCard>

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title="Innsendt dokumentasjon"
          description={canManage ? 'Godkjenn eller avslå innsendinger.' : 'Dine innsendinger og status.'}
          toolbar={
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Godkjent dokumentasjon teller som lovpålagt opplæring
            </div>
          }
          footer={<span>{externalCertificates.length} innsendinger</span>}
        >
          {externalCertificates.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-neutral-500">
              Ingen innsendte dokumenter ennå.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50/60">
                <tr>
                  <th className={MODULE_TABLE_TH}>Tittel</th>
                  <th className={MODULE_TABLE_TH}>Utsteder</th>
                  <th className={MODULE_TABLE_TH}>Gyldig til</th>
                  <th className={MODULE_TABLE_TH}>Status</th>
                  {canManage ? <th className={MODULE_TABLE_TH} /> : null}
                </tr>
              </thead>
              <tbody>
                {externalCertificates.map((x) => {
                  const meta =
                    STATUS_BADGE[x.status] ?? { label: x.status, variant: 'warning' as const }
                  return (
                    <tr key={x.id} className={MODULE_TABLE_TR_BODY}>
                      <td className="px-5 py-3 font-medium text-neutral-900">{x.title}</td>
                      <td className="px-5 py-3 text-neutral-700">{x.issuer ?? '—'}</td>
                      <td className="px-5 py-3 text-neutral-700">{fmtDate(x.validUntil)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      {canManage ? (
                        <td className="px-5 py-3 text-right">
                          {x.status === 'pending' ? (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                                onClick={() => {
                                  void (async () => {
                                    const r = await approve(x.id, true)
                                    if (!r.ok) setApproveError(r.error)
                                  })()
                                }}
                              >
                                Godkjenn
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<XCircle className="h-3.5 w-3.5" />}
                                onClick={() => {
                                  void (async () => {
                                    const r = await approve(x.id, false)
                                    if (!r.ok) setApproveError(r.error)
                                  })()
                                }}
                              >
                                Avslå
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </LayoutTable1PostingsShell>
        {approveError ? (
          <div className="border-t border-neutral-100 p-4">
            <WarningBox>{approveError}</WarningBox>
          </div>
        ) : null}
      </ModuleSectionCard>
    </div>
  )
}

// ── Sub-tab: Fornyelse / Resertifisering ───────────────────────────────────
function FornyelseSection() {
  const { certificates, courses } = useLearning()
  const [nowMs] = useState(() => Date.now())

  const renewals = useMemo(() => {
    const out = certificates
      .map((c) => {
        const course = courses.find((x) => x.id === c.courseId)
        if (!course?.recertificationMonths) return null
        const issued = new Date(c.issuedAt).getTime()
        const expires = issued + course.recertificationMonths * 30 * 24 * 60 * 60 * 1000
        const daysLeft = Math.round((expires - nowMs) / (24 * 60 * 60 * 1000))
        return {
          cert: c,
          course,
          expires,
          daysLeft,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft)
    return out
  }, [certificates, courses, nowMs])

  const expired = renewals.filter((r) => r.daysLeft < 0)
  const within30 = renewals.filter((r) => r.daysLeft >= 0 && r.daysLeft < 30)
  const within90 = renewals.filter((r) => r.daysLeft >= 30 && r.daysLeft < 90)
  const ok = renewals.filter((r) => r.daysLeft >= 90)

  return (
    <ModuleSectionCard className="!p-0">
      <LayoutTable1PostingsShell
        wrap={false}
        titleTypography="sans"
        title="Fornyelse av sertifikater"
        description="Klarert varsler automatisk 60 dager før utløp; kursansvarlig kan re-tildele kurset herfra."
        toolbar={
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              Utløpt ({expired.length})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-orange-400" />
              &lt; 30 d ({within30.length})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
              30–90 d ({within90.length})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              Gyldig ({ok.length})
            </span>
          </div>
        }
        footer={
          <span>
            {renewals.length} sertifikater med resertifiseringsplikt
          </span>
        }
      >
        {renewals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <RefreshCw className="h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-600">
              Ingen kurs har resertifiseringsplikt — sett <code>recertificationMonths</code> i kursbyggeren for å spore fornyelse.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50/60">
              <tr>
                <th className={MODULE_TABLE_TH}>Kurs</th>
                <th className={MODULE_TABLE_TH}>Mottaker</th>
                <th className={MODULE_TABLE_TH}>Utstedt</th>
                <th className={MODULE_TABLE_TH}>Utløper</th>
                <th className={MODULE_TABLE_TH}>Dager</th>
                <th className={MODULE_TABLE_TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {renewals.map((r) => {
                const status: { label: string; variant: 'success' | 'warning' | 'high' | 'danger' } =
                  r.daysLeft < 0
                    ? { label: 'Utløpt', variant: 'danger' }
                    : r.daysLeft < 30
                      ? { label: 'Krever fornyelse', variant: 'high' }
                      : r.daysLeft < 90
                        ? { label: 'Forfaller snart', variant: 'warning' }
                        : { label: 'Gyldig', variant: 'success' }
                return (
                  <tr key={r.cert.id} className={MODULE_TABLE_TR_BODY}>
                    <td className="px-5 py-3 font-medium text-neutral-900">{r.course.title}</td>
                    <td className="px-5 py-3 text-neutral-700">{r.cert.learnerName}</td>
                    <td className="px-5 py-3 text-neutral-700">{fmtDate(r.cert.issuedAt)}</td>
                    <td className="px-5 py-3 text-neutral-700">{fmtDate(new Date(r.expires).toISOString())}</td>
                    <td
                      className={`px-5 py-3 tabular-nums ${
                        r.daysLeft < 0
                          ? 'font-semibold text-red-600'
                          : r.daysLeft < 30
                            ? 'font-semibold text-orange-600'
                            : 'text-neutral-700'
                      }`}
                    >
                      {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)} d siden` : `${r.daysLeft} d igjen`}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </LayoutTable1PostingsShell>
    </ModuleSectionCard>
  )
}
