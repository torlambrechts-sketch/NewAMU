import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Kanban,
  Link2,
  Lock,
  MoreHorizontal,
  Search,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react'
import { departmentRows } from '../data/departments'
import { useHse } from '../hooks/useHse'
import { useCostSettings } from '../hooks/useCostSettings'

const members = [
  { type: 'img' as const, src: 'https://i.pravatar.cc/80?img=1' },
  { type: 'img' as const, src: 'https://i.pravatar.cc/80?img=5' },
  { type: 'initials' as const, text: 'HS', bg: 'bg-[#d4a84b]' },
  { type: 'img' as const, src: 'https://i.pravatar.cc/80?img=8' },
  { type: 'initials' as const, text: 'PA', bg: 'bg-neutral-400' },
  { type: 'initials' as const, text: 'AS', bg: 'bg-orange-400' },
  { type: 'initials' as const, text: 'LO', bg: 'bg-[#e8dcc8]' },
  { type: 'initials' as const, text: 'DV', bg: 'bg-emerald-600' },
  { type: 'initials' as const, text: 'GF', bg: 'bg-[#e8dcc8]' },
  { type: 'initials' as const, text: 'FD', bg: 'bg-neutral-500' },
  { type: 'img' as const, src: 'https://i.pravatar.cc/80?img=12' },
  { type: 'img' as const, src: 'https://i.pravatar.cc/80?img=14' },
]

function StatusBadge({ status }: { status: 'Success' | 'Processing' }) {
  if (status === 'Success') {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        Success
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
      Processing
    </span>
  )
}

export function ProjectDashboard() {
  const [region, setRegion] = useState<'all' | 'usa' | 'europe'>('all')
  const [expandedId, setExpandedId] = useState<string | null>('d2')
  const [privateOn, setPrivateOn] = useState(true)
  const [showCostSettings, setShowCostSettings] = useState(false)
  const hse = useHse()
  const cost = useCostSettings()

  const filtered = departmentRows.filter((row) => {
    if (region === 'usa') return row.country === 'India'
    if (region === 'europe')
      return ['The Netherlands', 'Poland'].includes(row.country)
    return true
  })

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <span>
          <span className="text-neutral-500">Projects</span>
          <span className="mx-2 text-neutral-400">→</span>
          <span className="font-medium text-neutral-800">Adobe Analytics</span>
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            to="/council"
            className="rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            Council
          </Link>
          <Link
            to="/members"
            className="rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            Members
          </Link>
          <Link
            to="/org-health"
            className="rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            Org health
          </Link>
          <Link
            to="/hse"
            className="rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            HSE
          </Link>
          <Link
            to="/internal-control"
            className="rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            Internkontroll
          </Link>
          <Link
            to="/learning"
            className="rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            Learning
          </Link>
          <Link
            to="/hrm/employees"
            className="rounded-full border border-neutral-200/90 bg-white px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            HRM module
          </Link>
          <Link to="/action-board" className="inline-flex items-center gap-1 rounded-full border border-[#1a3d32]/20 bg-[#1a3d32]/5 px-3 py-1 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-[#1a3d32]/10">
            <Kanban className="size-3.5" /> Action Board
          </Link>
          <Link to="/aarshjul" className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm hover:bg-amber-100">
            <CalendarRange className="size-3.5" /> Årshjul
          </Link>
        </div>
      </nav>

      {/* ── Cost summary widget ───────────────────────────────────────────── */}
      {cost.settings.enabled && (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <span className="font-semibold text-neutral-800">Estimerte kostnader — arbeidsmiljø</span>
            </div>
            <button type="button" onClick={() => setShowCostSettings((v) => !v)}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700">
              <Settings2 className="size-3.5" /> Innstillinger
            </button>
          </div>
          {showCostSettings && (
            <div className="mt-4 grid gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">Timesats (NOK inkl. sosiale kostnader)</label>
                <input type="number" min={100} max={5000} value={cost.settings.hourlyRateNok}
                  onChange={(e) => cost.update({ hourlyRateNok: Number(e.target.value) || 650 })}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Arbeidstimer per dag</label>
                <input type="number" min={4} max={12} step={0.5} value={cost.settings.hoursPerDay}
                  onChange={(e) => cost.update({ hoursPerDay: Number(e.target.value) || 7.5 })}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm" />
              </div>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(() => {
              const activeSickDays = hse.sickLeaveCases
                .filter((c) => c.status === 'active' || c.status === 'partial')
                .reduce((acc, c) => {
                  const days = Math.max(0, Math.ceil((Date.now() - new Date(c.sickFrom).getTime()) / 86400000))
                  return acc + days * (c.sicknessDegree / 100)
                }, 0)
              const sickCost = cost.sickLeaveCost(Math.round(activeSickDays))
              const openHighInc = hse.incidents.filter((i) => i.status !== 'closed' && (i.severity === 'high' || i.severity === 'critical')).length
              const incCost = cost.incidentCost(openHighInc * 8)
              return (
                <>
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                    <div className="text-xl font-bold tabular-nums text-orange-800">kr {sickCost.toLocaleString('no-NO')}</div>
                    <div className="text-xs text-neutral-600">Aktive sykefravær (~{Math.round(activeSickDays)} dagsverk)</div>
                  </div>
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                    <div className="text-xl font-bold tabular-nums text-red-800">kr {incCost.toLocaleString('no-NO')}</div>
                    <div className="text-xs text-neutral-600">{openHighInc} åpne alvorlige hendelser (est. 8t/stk)</div>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 flex items-center gap-3">
                    <Calendar className="size-5 text-neutral-400 shrink-0" />
                    <div>
                      <Link to="/action-board" className="text-sm font-semibold text-[#1a3d32] hover:underline">
                        {hse.stats.overdueMilestones + hse.stats.openInspections} forfalte punkter →
                      </Link>
                      <div className="text-xs text-neutral-500">Se Action Board for full oversikt</div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
          <p className="mt-2 text-[10px] text-neutral-400">Estimat basert på kr {cost.settings.hourlyRateNok}/t × {cost.settings.hoursPerDay}t/dag. Ikke regnskapsmessig nøyaktig — kun indikativt for ledelsesformål.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-4 border-b border-neutral-200/80 pb-6">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#e1251b] text-3xl font-bold text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-2xl font-semibold text-neutral-900 md:text-3xl"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  Adobe Analytics
                </h1>
                <CheckCircle2 className="size-5 text-neutral-400" aria-hidden />
                <button type="button" className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100">
                  <Link2 className="size-5" />
                </button>
                <button type="button" className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100">
                  <MoreHorizontal className="size-5" />
                </button>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                5,321 Employees | Digital Product
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
                Adobe Analytics helps you create a holistic view of your business by turning
                customer interactions into actionable insights.
              </p>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Project Managers
                </p>
                <div className="mt-2 flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://i.pravatar.cc/48?img=33"
                      alt=""
                      className="size-10 rounded-full ring-2 ring-white"
                    />
                    <span className="text-sm font-medium text-neutral-800">Kyle O.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src="https://i.pravatar.cc/48?img=47"
                      alt=""
                      className="size-10 rounded-full ring-2 ring-white"
                    />
                    <span className="text-sm font-medium text-neutral-800">Jannies P.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-neutral-900">Departments</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-neutral-200/80 p-1">
                {(
                  [
                    ['all', 'All'],
                    ['usa', 'USA'],
                    ['europe', 'Europe'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRegion(key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      region === key
                        ? 'bg-[#1a3d32] text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50"
                  aria-label="Search departments"
                >
                  <Search className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50"
                >
                  <Calendar className="size-4 text-neutral-500" />
                  May 11, 2022 – Aug 18, 2022
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                >
                  <SlidersHorizontal className="size-4" />
                  Filters
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600">
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" aria-label="Select all" />
                    </th>
                    <th className="px-3 py-3 font-medium">Departments, Country</th>
                    <th className="px-3 py-3 font-medium">Hire employees</th>
                    <th className="px-3 py-3 font-medium">
                      <span className="inline-flex items-center gap-1">
                        Deadline
                        <span className="text-neutral-400" aria-hidden>
                          ↓
                        </span>
                      </span>
                    </th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Recruiter</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-b border-neutral-100 hover:bg-neutral-50/80">
                        <td className="px-3 py-3 align-top">
                          <input type="checkbox" className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() =>
                              setExpandedId((id) => (id === row.id ? null : row.id))
                            }
                          >
                            <div className="font-semibold text-neutral-900">{row.department}</div>
                            <div className="text-neutral-500">{row.country}</div>
                          </button>
                        </td>
                        <td className="px-3 py-3 align-top text-neutral-800">
                          {row.hireEmployees.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 align-top text-neutral-700">{row.deadline}</td>
                        <td className="px-3 py-3 align-top">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center gap-2">
                            {row.recruiter.initials ? (
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-xs font-semibold text-neutral-800">
                                {row.recruiter.initials}
                              </span>
                            ) : (
                              <img
                                src={`https://i.pravatar.cc/40?u=${encodeURIComponent(row.recruiter.email)}`}
                                alt=""
                                className="size-9 rounded-full"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-neutral-900">{row.recruiter.name}</div>
                              <div className="truncate text-xs text-neutral-500">{row.recruiter.email}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id && row.id === 'd2' && (
                        <tr className="bg-[#faf8f4]">
                          <td colSpan={6} className="px-4 py-5">
                            <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                                  8,000 Employees
                                  <Link2 className="size-4 text-neutral-400" />
                                </div>
                              </div>
                              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div>
                                  <p className="text-sm text-neutral-600">
                                    Hired <span className="font-semibold text-[#1a3d32]">74%</span>{' '}
                                    (5,321)
                                  </p>
                                  <p className="text-sm text-neutral-600">
                                    Processing <span className="font-semibold">38%</span> (2,679)
                                  </p>
                                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-neutral-200">
                                    <div className="h-full w-[74%] bg-[#1a3d32]" />
                                    <div className="h-full flex-1 bg-neutral-300" />
                                  </div>
                                </div>
                              </div>
                              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-neutral-100 bg-[#faf8f4] p-3">
                                  <div className="text-xl font-semibold text-neutral-900">1,216</div>
                                  <div className="text-xs text-neutral-600">27% On staff</div>
                                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                                    <div className="h-full w-[27%] bg-[#d4a84b]" />
                                  </div>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-[#faf8f4] p-3">
                                  <div className="text-xl font-semibold text-neutral-900">1,791</div>
                                  <div className="text-xs text-neutral-600">31% Out source</div>
                                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                                    <div className="h-full w-[31%] bg-orange-400" />
                                  </div>
                                </div>
                                <div className="rounded-lg border border-neutral-100 bg-[#faf8f4] p-3">
                                  <div className="text-xl font-semibold text-neutral-900">2,467</div>
                                  <div className="text-xs text-neutral-600">42% Out staff</div>
                                  <div className="mt-3 flex h-16 items-end justify-center gap-1">
                                    {[40, 55, 35, 70, 45, 60, 50].map((h, i) => (
                                      <div
                                        key={i}
                                        className="w-2 rounded-t bg-[#1a3d32]/40"
                                        style={{ height: `${h}%` }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-neutral-900">
              Members <span className="text-neutral-400">|</span>{' '}
              <span className="font-normal text-neutral-600">15</span>
            </h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
            >
              <span className="text-lg leading-none">+</span> Invite
            </button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {members.map((m, i) =>
              m.type === 'img' ? (
                <img
                  key={i}
                  src={m.src}
                  alt=""
                  className="aspect-square w-full rounded-full object-cover ring-1 ring-neutral-100"
                />
              ) : (
                <div
                  key={i}
                  className={`flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold text-white ${m.bg}`}
                >
                  {m.text}
                </div>
              ),
            )}
          </div>
          <div className="mt-5 space-y-3 border-t border-neutral-100 pt-4">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              <span aria-hidden>🏳️</span> Hire Employees
            </button>
            <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-neutral-700">
                <Lock className="size-4 text-neutral-500" />
                Private
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={privateOn}
                onClick={() => setPrivateOn(!privateOn)}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  privateOn ? 'bg-orange-400' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${
                    privateOn ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
