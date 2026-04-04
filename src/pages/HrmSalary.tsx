import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'

const rows = [
  { name: 'Jane Cooper', salary: '₹ 85,000', status: 'Paid' as const, date: 'Mar 28, 2026' },
  { name: 'Leslie Alexander', salary: '₹ 92,400', status: 'Paid' as const, date: 'Mar 28, 2026' },
  { name: 'Cody Fisher', salary: '₹ 78,200', status: 'Unpaid' as const, date: '—' },
]

export function HrmSalary() {
  return (
    <div className="min-h-screen bg-neutral-100 py-6 md:py-10">
      <div className="mx-auto max-w-5xl px-4">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-[#0d1f14] px-4 py-3 text-white md:px-6">
            <span className="font-semibold">HRM Module</span>
            <nav className="flex gap-6 text-sm">
              <Link to="/hrm/employees" className="text-white/70 hover:text-white">
                Employee
              </Link>
              <span className="border-b-2 border-[#7ee081] pb-0.5 font-medium text-white">Salary</span>
              <span className="cursor-not-allowed text-white/40">Attendance</span>
            </nav>
            <button
              type="button"
              className="rounded-lg bg-[#7ee081] px-3 py-1.5 text-xs font-semibold text-[#0d1f14] hover:bg-[#6bcf72]"
            >
              Run payroll
            </button>
          </header>

          <div className="grid gap-6 p-6 md:grid-cols-[1fr_280px]">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">Employee salary</h1>
              <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Salary</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Payment date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.name} className="border-b border-neutral-100">
                        <td className="px-4 py-3 font-medium text-neutral-900">{r.name}</td>
                        <td className="px-4 py-3 text-neutral-800">{r.salary}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              r.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <TrendingUp className="size-4 text-emerald-600" />
                Total monthly salary
              </div>
              <div className="mt-4 flex h-32 items-end justify-between gap-1 px-1">
                {[42, 55, 48, 62].map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full max-w-[40px] rounded-t bg-[#7ee081]"
                      style={{ height: `${h * 1.2}px` }}
                    />
                    <span className="text-[10px] text-neutral-500">
                      {['Feb', 'Mar', 'Apr', 'May'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 px-6 py-4">
            <Link to="/hrm/employees" className="text-sm font-medium text-emerald-800 hover:underline">
              ← Employee list
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
