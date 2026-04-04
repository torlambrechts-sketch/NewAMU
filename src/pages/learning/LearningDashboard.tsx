import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { CREAM, PIN_GREEN } from '../../components/learning/LearningLayout'

export function LearningDashboard() {
  const { stats, courses } = useLearning()
  const published = courses.filter((c) => c.status === 'published')

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-serif text-3xl font-semibold tracking-tight text-[#2D403A] md:text-4xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Courses, micro-learning modules, and certifications in one place.
          </p>
        </div>
        <Link
          to="/learning/courses"
          className="rounded-full border px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-white"
          style={{ borderColor: `${PIN_GREEN}40`, backgroundColor: CREAM }}
        >
          Configure
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Published courses" value={stats.published} href="/learning/courses" />
        <KpiCard label="Drafts" value={stats.drafts} href="/learning/courses" />
        <KpiCard label="Certificates issued" value={stats.certs} href="/learning/certifications" />
        <KpiCard label="Enrolments" value={stats.enrolled} href="/learning/participants" />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-[#2D403A]">Featured courses</h2>
          <Link
            to="/learning/courses"
            className="text-sm font-medium text-emerald-800 hover:underline"
          >
            + Create course
          </Link>
        </div>
        <div className="space-y-3">
          {published.slice(0, 5).map((c) => (
            <Link
              key={c.id}
              to={`/learning/courses/${c.id}`}
              className="block rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#2D403A]">{c.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{c.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                      {c.status.toUpperCase()}
                    </span>
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-500">
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-4" />
                    {c.modules.length} modules
                  </span>
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </Link>
          ))}
          {published.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-8 text-center text-sm text-neutral-500">
              No published courses yet. Open <Link to="/learning/courses" className="text-emerald-800 underline">Courses</Link> to create one.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      to={href}
      className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div>
        <div className="text-3xl font-semibold tabular-nums text-[#2D403A]">{value}</div>
        <div className="mt-1 text-sm text-neutral-600">{label}</div>
      </div>
      <ArrowRight className="size-5 text-neutral-300" />
    </Link>
  )
}
