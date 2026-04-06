import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Download, Loader2, RefreshCw } from 'lucide-react'
import { useReporting } from '../hooks/useReporting'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-xs leading-relaxed text-neutral-800">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function ReportingEnginePage() {
  const { organization, supabaseConfigured } = useOrgSetupContext()
  const rep = useReporting()
  const year = new Date().getFullYear()
  const [y, setY] = useState(year)
  const [amu, setAmu] = useState<unknown>(null)
  const [ik, setIk] = useState<unknown>(null)
  const [arp, setArp] = useState<unknown>(null)
  const [sick, setSick] = useState<unknown>(null)
  const [corr, setCorr] = useState<unknown>(null)
  const [cost, setCost] = useState<unknown>(null)
  const [score, setScore] = useState<unknown>(null)
  const [tab, setTab] = useState<
    'amu' | 'ik' | 'arp' | 'privacy' | 'analytics' | 'compliance' | 'integration'
  >('amu')

  const orgName = organization?.name ?? 'Organisasjon'

  const loadCompliance = useCallback(async () => {
    const s = await rep.fetchComplianceScore()
    setScore(s)
  }, [rep])

  useEffect(() => {
    queueMicrotask(() => {
      void loadCompliance()
    })
  }, [loadCompliance])

  const runAmu = useCallback(async () => {
    const d = await rep.fetchAmuAnnual(y)
    setAmu(d)
  }, [rep, y])

  const runIk = useCallback(async () => {
    const d = await rep.fetchAnnualIk(y)
    setIk(d)
  }, [rep, y])

  const runArp = useCallback(async () => {
    const d = await rep.fetchArp(y)
    setArp(d)
  }, [rep, y])

  const runSick = useCallback(async () => {
    const d = await rep.fetchSickByDept(y, 5)
    setSick(d)
  }, [rep, y])

  const runCorr = useCallback(async () => {
    const d = await rep.fetchCorrelation(y)
    setCorr(d)
  }, [rep, y])

  const runCost = useCallback(async () => {
    const d = await rep.fetchCostFriction(y)
    setCost(d)
  }, [rep, y])

  const tabs = useMemo(
    () =>
      [
        { id: 'amu' as const, label: 'AMU årsrapport' },
        { id: 'ik' as const, label: 'Årlig gjennomgang (IK)' },
        { id: 'arp' as const, label: 'ARP' },
        { id: 'privacy' as const, label: 'Personvern (k-anonymitet)' },
        { id: 'analytics' as const, label: 'Kryssmodul-analyse' },
        { id: 'compliance' as const, label: 'Compliance-score' },
        { id: 'integration' as const, label: 'Eksport & drift' },
      ] as const,
    [],
  )

  async function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className={PAGE_WRAP}>
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Rapporter</span>
      </nav>

      <div className="flex flex-wrap items-start gap-6 border-b border-neutral-200/80 pb-8">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#1a3d32] text-[#c9a227]">
          <BarChart3 className="size-9" />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Rapportering & compliance
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{orgName}</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-600">
            Forhåndsbygde rapportpakker (SQL/RPC) henter data på tvers av Council, HSE, oppgaver, wiki og
            e-læring. PDF-eksport kan kobles på senere; nå eksporterer du JSON for videre bruk.
          </p>
          {!supabaseConfigured && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Supabase er ikke konfigurert — rapportene krever database.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="text-xs font-medium text-neutral-600">
          År
          <input
            type="number"
            value={y}
            min={2000}
            max={2100}
            onChange={(e) => setY(Number(e.target.value))}
            className="ml-2 w-24 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          />
        </label>
        {rep.error && (
          <p className="text-sm text-red-700">{rep.error}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-neutral-200/80 bg-white/60 p-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-[#1a3d32] text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        {tab === 'amu' && (
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">AMU årsrapport</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={rep.loading}
                  onClick={() => void runAmu()}
                  className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:opacity-50"
                >
                  {rep.loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Generer
                    </>
                  ) : (
                    'Generer'
                  )}
                </button>
                {amu != null && (
                  <button
                    type="button"
                    onClick={() => void downloadJson(`amu-annual-${y}.json`, amu)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white hover:opacity-95"
                  >
                    <Download className="size-4" /> JSON
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Møter (council_meetings), hendelser og sykefravær (HSE JSON), sertifikater (learning_certificates),
              oppgaver (Kanban/tasks-modulen).
            </p>
            {amu ? <div className="mt-4"><JsonBlock data={amu} /></div> : (
              <p className="mt-4 text-sm text-neutral-500">Klikk «Generer» for å hente data for {y}.</p>
            )}
          </section>
        )}

        {tab === 'ik' && (
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Årlig gjennomgang — internkontroll (§ 5.8)</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={rep.loading}
                  onClick={() => void runIk()}
                  className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:opacity-50"
                >
                  {rep.loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Generer
                    </>
                  ) : (
                    'Generer'
                  )}
                </button>
                {ik != null && (
                  <button
                    type="button"
                    onClick={() => void downloadJson(`annual-review-ik-${y}.json`, ik)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white"
                  >
                    <Download className="size-4" /> JSON
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Wiki-sider og revisjonsversjoner, vernerunder og ROS (JSON), fjorårets årsgjennomgang. Felt for
              mål neste år kan utvides med lagring i `reporting_arp_snapshots` eller egne tabeller.
            </p>
            {ik ? <div className="mt-4"><JsonBlock data={ik} /></div> : (
              <p className="mt-4 text-sm text-neutral-500">Klikk «Generer».</p>
            )}
          </section>
        )}

        {tab === 'arp' && (
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">ARP — aktivitets- og redegjørelsesplikt</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={rep.loading}
                  onClick={() => void runArp()}
                  className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:opacity-50"
                >
                  {rep.loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Beregn
                    </>
                  ) : (
                    'Beregn'
                  )}
                </button>
                {arp != null && (
                  <button
                    type="button"
                    onClick={() => void downloadJson(`arp-${y}.json`, arp)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white"
                  >
                    <Download className="size-4" /> JSON
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Kjønnsfordeling og ledernivå utledes fra organisasjonskartet (JSON) når feltene{' '}
              <code className="rounded bg-neutral-100 px-1">gender</code>,{' '}
              <code className="rounded bg-neutral-100 px-1">annualSalaryNok</code>,{' '}
              <code className="rounded bg-neutral-100 px-1">salaryCategory</code>,{' '}
              <code className="rounded bg-neutral-100 px-1">parentalLeaveDays</code> er satt på ansatte.
              Narrativ lagres i tabellen <code className="rounded bg-neutral-100 px-1">reporting_arp_snapshots</code>.
            </p>
            {arp ? <div className="mt-4"><JsonBlock data={arp} /></div> : (
              <p className="mt-4 text-sm text-neutral-500">Klikk «Beregn».</p>
            )}
          </section>
        )}

        {tab === 'privacy' && (
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Anonymitetsgrense (k ≥ 5)</h2>
            <p className="mt-2 text-sm text-neutral-600">
              RPC <code className="rounded bg-neutral-100 px-1">reporting_sick_leave_by_department</code> returnerer
              bare avdelinger der antall ansatte i organisasjonskartet er minst 5 — ellers utelates raden for å
              redusere identifikasjonsrisiko (GDPR / helseopplysninger).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={rep.loading}
                onClick={() => void runSick()}
                className="inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:opacity-50"
              >
                {rep.loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Henter…
                  </>
                ) : (
                  'Test sykefravær per avdeling'
                )}
              </button>
              {sick != null && (
                <button
                  type="button"
                  onClick={() => void downloadJson(`sick-by-dept-${y}.json`, sick)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white"
                >
                  <Download className="size-4" /> JSON
                </button>
              )}
            </div>
            {sick ? <div className="mt-4"><JsonBlock data={sick} /></div> : null}
          </section>
        )}

        {tab === 'analytics' && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-neutral-900">Opplæring vs. hendelser (produksjon)</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={rep.loading}
                    onClick={() => void runCorr()}
                    className="inline-flex min-w-[8rem] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {rep.loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Kjør
                      </>
                    ) : (
                      'Kjør analyse'
                    )}
                  </button>
                  {corr != null && (
                    <button
                      type="button"
                      onClick={() => void downloadJson(`training-incident-corr-${y}.json`, corr)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white"
                    >
                      <Download className="size-4" /> JSON
                    </button>
                  )}
                </div>
              </div>
              {corr ? <div className="mt-4"><JsonBlock data={corr} /></div> : (
                <p className="mt-4 text-sm text-neutral-500">Illustrativ korrelasjon basert på avdelingsnavn «produksjon».</p>
              )}
            </div>
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-neutral-900">Cost of friction</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={rep.loading}
                    onClick={() => void runCost()}
                    className="inline-flex min-w-[8rem] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {rep.loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Beregn
                      </>
                    ) : (
                      'Beregn kost'
                    )}
                  </button>
                  {cost != null && (
                    <button
                      type="button"
                      onClick={() => void downloadJson(`cost-friction-${y}.json`, cost)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white"
                    >
                      <Download className="size-4" /> JSON
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                Bruker timepris og dagslengde fra <strong>Kostnadsinnstillinger</strong> (org-modul) og estimerte
                fraværsdager fra HSE.
              </p>
              {cost ? <div className="mt-4"><JsonBlock data={cost} /></div> : null}
            </div>
          </section>
        )}

        {tab === 'compliance' && (
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-900">Materialisert compliance-score</h2>
              <button
                type="button"
                disabled={rep.loading}
                onClick={async () => {
                  await rep.refreshComplianceMv()
                  await loadCompliance()
                }}
                className="inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50 disabled:opacity-50"
              >
                {rep.loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Oppdater MV
              </button>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Poengsum fra <code className="rounded bg-neutral-100 px-1">reporting_compliance_score_mv</code>. I
              produksjon: planlegg <code className="rounded bg-neutral-100 px-1">pg_cron</code> for nattlig refresh.
            </p>
            {score ? <div className="mt-4"><JsonBlock data={score} /></div> : (
              <p className="mt-4 text-sm text-neutral-500">Laster…</p>
            )}
          </section>
        )}

        {tab === 'integration' && (
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">Eksport, BI og jobber</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
              <li>
                <strong>Power BI / Tableau:</strong> Supabase er PostgreSQL — bruk skrivebeskyttet bruker eller
                read replica mot de samme tabellene RPC-ene leser fra.
              </li>
              <li>
                <strong>PDF / e-post:</strong> Koble Edge Function eller cron til RPC-resultat (f.eks. månedlig
                HMS-rapport). <code className="rounded bg-neutral-100 px-1">pg_cron</code> krever Supabase Pro.
              </li>
              <li>
                <strong>Dashbord-widgets:</strong> Konfigurasjon kan lagres i{' '}
                <code className="rounded bg-neutral-100 px-1">reporting_dashboard_layouts</code> (JSON widgets-array).
              </li>
              <li>
                <strong>Revisjonslogg:</strong> Endringer i <code className="rounded bg-neutral-100 px-1">org_module_payloads</code>{' '}
                logges til <code className="rounded bg-neutral-100 px-1">reporting_audit_log</code>.
              </li>
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
