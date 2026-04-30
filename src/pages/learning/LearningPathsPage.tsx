import { useMemo, useState } from 'react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'

export function LearningPathsPage() {
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const {
    courses,
    learningPaths,
    pathEnrollments,
    learningLoading,
    learningError,
    saveLearningPath,
    deleteLearningPath,
  } = useLearning()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [metaKey, setMetaKey] = useState('is_safety_rep')
  const [metaVal, setMetaVal] = useState('true')
  const [msg, setMsg] = useState<string | null>(null)

  const published = useMemo(() => courses.filter((c) => c.status === 'published'), [courses])
  const enrolledSet = useMemo(() => new Set(pathEnrollments.map((e) => e.pathId)), [pathEnrollments])

  const toggleCourse = (id: string) => {
    setSelectedCourses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submit = () => {
    if (!name.trim() || !slug.trim()) {
      setMsg('Navn og kortnavn (slug) er påkrevd.')
      return
    }
    let expected: unknown = metaVal
    if (metaVal === 'true') expected = true
    if (metaVal === 'false') expected = false
    void (async () => {
      const r = await saveLearningPath({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        courseIds: selectedCourses,
        rules: [{ metadataKey: metaKey.trim() || 'is_safety_rep', expectedValue: expected }],
      })
      setMsg(r.ok ? 'Lagret læringsløp og oppdatert påmeldinger.' : r.error)
      if (r.ok) {
        setName('')
        setSlug('')
        setDescription('')
        setSelectedCourses([])
      }
    })()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold" style={{ color: PIN_GREEN }}>
          Læringsløp
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Grupper kurs og koble til profilflagg (f.eks. HMS-representant). Brukere meldes inn automatisk når flagget
          stemmer med regelen.
        </p>
      </div>
      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-[#fbf9f3] p-6 shadow-sm">
          <h2 className="font-semibold" style={{ color: PIN_GREEN }}>
            Dine løp
          </h2>
          <ul className="mt-4 space-y-3">
            {learningPaths.map((p) => (
              <li key={p.id} className="rounded-lg border border-neutral-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium" style={{ color: PIN_GREEN }}>
                      {p.name}
                    </div>
                    <div className="text-xs text-neutral-500">{p.slug}</div>
                    {p.description ? <p className="mt-1 text-sm text-neutral-600">{p.description}</p> : null}
                    <p className="mt-2 text-xs text-neutral-500">
                      {p.courseIds.length} kurs · Regel: {p.rules.map((r) => `${r.metadataKey}=${JSON.stringify(r.expectedValue)}`).join(', ') || '—'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      enrolledSet.has(p.id) ? 'bg-emerald-100 text-emerald-900' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {enrolledSet.has(p.id) ? 'Påmeldt' : 'Ikke påmeldt'}
                  </span>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-red-700 hover:underline"
                    onClick={() => {
                      if (!confirm('Slette dette læringsløpet?')) return
                      void (async () => {
                        const r = await deleteLearningPath(p.id)
                        setMsg(r.ok ? 'Slettet.' : r.error)
                      })()
                    }}
                  >
                    Slett
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {learningPaths.length === 0 ? <p className="text-sm text-neutral-500">Ingen løp opprettet ennå.</p> : null}
        </div>

        {canManage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6">
            <h2 className="font-semibold" style={{ color: PIN_GREEN }}>
              Nytt læringsløp
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-neutral-600">
                Navn
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-600">
                Slug (kortnavn)
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="f.eks. safety-rep"
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-600">
                Beskrivelse
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <div>
                <p className="text-xs font-medium text-neutral-600">Kurs i rekkefølge</p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 bg-[#fbf9f3] p-2">
                  {published.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(c.id)}
                          onChange={() => toggleCourse(c.id)}
                          className="rounded border-neutral-300"
                        />
                        {c.title}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-neutral-600">
                  Metadata-nøkkel
                  <input
                    value={metaKey}
                    onChange={(e) => setMetaKey(e.target.value)}
                    className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs text-neutral-600">
                  Forventet verdi (true/false eller tekst)
                  <input
                    value={metaVal}
                    onChange={(e) => setMetaVal(e.target.value)}
                    className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: PIN_GREEN }}
                onClick={submit}
              >
                Opprett læringsløp
              </button>
              {msg ? <p className="text-xs text-neutral-700">{msg}</p> : null}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-[#fbf9f3] p-6 text-sm text-neutral-600">
            Kun kursansvarlige kan opprette læringsløp. Du ser dine påmeldinger til venstre.
          </div>
        )}
      </div>
    </div>
  )
}
