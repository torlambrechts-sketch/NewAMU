import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Eye, Filter, Pencil, Search } from 'lucide-react'
import { employees, type Employee } from '../data/employees'

type DeptFilter = 'All' | 'Development' | 'Design' | 'Marketing'

export function HrmEmployees() {
  const [dept, setDept] = useState<DeptFilter>('All')
  const [page, setPage] = useState(1)
  const perPage = 8

  const filtered = useMemo(() => {
    if (dept === 'All') return employees
    return employees.filter((e) => e.department === dept)
  }, [dept])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageSafe = Math.min(page, totalPages)
  const slice = filtered.slice((pageSafe - 1) * perPage, pageSafe * perPage)

  const stats = useMemo(() => {
    const perm = employees.filter((e) => e.type === 'Permanent').length
    const interns = employees.filter((e) => e.type === 'Intern').length
    const fresh = employees.filter((e) => e.type === 'Fresher').length
    const m = employees.filter((e) => e.gender === 'M').length
    const f = employees.filter((e) => e.gender === 'F').length
    const ratio =
      m + f === 0 ? '—' : `${Math.round((m / (m + f)) * 100)}:${Math.round((f / (m + f)) * 100)}`
    return {
      total: employees.length,
      perm,
      interns,
      fresh,
      ratio,
    }
  }, [])

  function formatDate(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-6 md:py-10">
      <div className="mx-auto max-w-5xl px-4">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-[#0d1f14] px-4 py-3 text-white md:px-6">
            <span className="font-semibold">HRM Module</span>
            <nav className="flex gap-6 text-sm">
              <span className="border-b-2 border-[#7ee081] pb-0.5 font-medium text-white">
                Employee
              </span>
              <Link to="/hrm/salary" className="text-white/70 hover:text-white">
                Salary
              </Link>
              <span className="cursor-not-allowed text-white/40">Attendance</span>
            </nav>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Copy">
                <Copy className="size-4" />
              </button>
              <div
                className="size-8 rounded-full bg-gradient-to-br from-lime-300 to-emerald-600"
                role="img"
                aria-label="Profile"
              />
            </div>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 md:px-6">
            <nav className="text-sm text-neutral-600">
              <Link to="/" className="text-emerald-800 hover:underline">
                Home
              </Link>
              <span className="mx-1.5 text-neutral-400">/</span>
              <span className="font-medium text-neutral-900">Employee</span>
            </nav>
            <div className="relative min-w-[200px] flex-1 md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                placeholder="Search employees..."
                className="w-full rounded-full border border-neutral-200 py-2 pl-10 pr-4 text-sm focus:border-[#7ee081] focus:outline-none focus:ring-1 focus:ring-[#7ee081]"
              />
            </div>
          </div>

          <div className="px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <ArrowLeft className="size-4" />
                Back
              </Link>
              <h1 className="text-lg font-semibold text-neutral-900 md:text-xl">Employee list</h1>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#7ee081] px-4 py-2 text-sm font-semibold text-[#0d1f14] hover:bg-[#6bcf72]"
              >
                + New employee
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs md:text-sm">
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-700">
                Total <strong>{stats.total}</strong>
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-700">
                Permanent <strong>{stats.perm}</strong>
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-700">
                Interns <strong>{stats.interns}</strong>
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-700">
                Freshers <strong>{stats.fresh}</strong>
              </span>
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-700">
                Gender ratio <strong>{stats.ratio}</strong>
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg bg-neutral-100 p-1">
                {(['All', 'Development', 'Design', 'Marketing'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDept(d)
                      setPage(1)
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      dept === d
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Filter className="size-4" />
                Filter
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Job title</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Date of hire</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((e: Employee) => (
                    <tr key={e.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={`https://i.pravatar.cc/40?u=${encodeURIComponent(e.id)}`}
                            alt=""
                            className="size-10 rounded-full"
                          />
                          <div>
                            <div className="font-medium text-neutral-900">{e.name}</div>
                            <div className="text-xs text-neutral-500">{e.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-800">{e.jobTitle}</td>
                      <td className="px-4 py-3 text-neutral-800">{e.department}</td>
                      <td className="px-4 py-3 text-neutral-600">{formatDate(e.dateOfHire)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="mr-1 inline-flex rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
                          aria-label="View"
                        >
                          <Eye className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
                          aria-label="Edit"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
              <button
                type="button"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`size-8 rounded-md text-sm font-medium ${
                      n === pageSafe
                        ? 'bg-[#7ee081] text-[#0d1f14]'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
