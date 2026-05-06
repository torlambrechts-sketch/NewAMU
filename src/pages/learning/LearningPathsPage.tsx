import { useMemo, useState } from 'react'
import { GitBranch, Plus, Tag, Trash2 } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WarningBox } from '../../components/ui/AlertBox'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { ModuleSectionCard } from '../../components/module'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'

const SERIF_FAMILY = "'Libre Baskerville', Georgia, serif"

export function LearningPathsPage() {
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
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

  const kpis = useMemo<LayoutScoreStatItem[]>(
    () => [
      { big: String(learningPaths.length), title: 'Læringsløp', sub: 'Definert' },
      { big: String(pathEnrollments.length), title: 'Påmeldinger', sub: 'Aktive' },
      { big: String(published.length), title: 'Tilgjengelige kurs', sub: 'Publisert i katalog' },
      { big: String(courses.length), title: 'Kurs i katalog', sub: 'Inkl. utkast' },
    ],
    [learningPaths.length, pathEnrollments.length, published.length, courses.length],
  )

  return (
    <div className="space-y-6">
      {learningError ? <WarningBox>{learningError}</WarningBox> : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster…</p> : null}

      <LayoutScoreStatRow items={kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ModuleSectionCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-[#1a3d32]" />
              <h2
                className="text-lg font-semibold text-neutral-900"
                style={{ fontFamily: SERIF_FAMILY }}
              >
                Dine læringsløp
              </h2>
            </div>
            <span className="text-xs text-neutral-500">{learningPaths.length} totalt</span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            Brukere meldes inn automatisk når metadata-flagget treffer regelen.
          </p>
          {learningPaths.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/40 px-5 py-10 text-center text-sm text-neutral-500">
              Ingen løp opprettet ennå.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {learningPaths.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-neutral-200 bg-neutral-50/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900">{p.name}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-neutral-500">
                        <Tag className="h-3 w-3" /> {p.slug}
                      </div>
                      {p.description ? (
                        <p className="mt-1 text-sm text-neutral-600">{p.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-neutral-500">
                        {p.courseIds.length} kurs · Regel:{' '}
                        {p.rules
                          .map((r) => `${r.metadataKey}=${JSON.stringify(r.expectedValue)}`)
                          .join(', ') || '—'}
                      </p>
                    </div>
                    <Badge variant={enrolledSet.has(p.id) ? 'active' : 'neutral'}>
                      {enrolledSet.has(p.id) ? 'Påmeldt' : 'Ikke påmeldt'}
                    </Badge>
                  </div>
                  {canManage ? (
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => {
                          if (!window.confirm('Slette dette læringsløpet?')) return
                          void (async () => {
                            const r = await deleteLearningPath(p.id)
                            setMsg(r.ok ? 'Slettet.' : r.error)
                          })()
                        }}
                      >
                        Slett
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </ModuleSectionCard>

        {canManage ? (
          <ModuleSectionCard>
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#1a3d32]" />
              <h2
                className="text-lg font-semibold text-neutral-900"
                style={{ fontFamily: SERIF_FAMILY }}
              >
                Nytt læringsløp
              </h2>
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Definer regel og velg kursene som skal være obligatoriske.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="lp-name">
                  Navn
                </label>
                <StandardInput
                  id="lp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="lp-slug">
                  Slug (kortnavn)
                </label>
                <StandardInput
                  id="lp-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="f.eks. safety-rep"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="lp-desc">
                  Beskrivelse
                </label>
                <StandardTextarea
                  id="lp-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                />
              </div>
              <div>
                <span className={WPSTD_FORM_FIELD_LABEL}>Kurs i rekkefølge</span>
                <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-2">
                  {published.length === 0 ? (
                    <li className="px-2 py-1 text-xs text-neutral-500">
                      Ingen publiserte kurs tilgjengelig.
                    </li>
                  ) : (
                    published.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-neutral-50"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{c.title}</span>
                        <ToggleSwitch
                          checked={selectedCourses.includes(c.id)}
                          onChange={(on) => {
                            if (on) {
                              if (!selectedCourses.includes(c.id))
                                setSelectedCourses((prev) => [...prev, c.id])
                            } else {
                              setSelectedCourses((prev) => prev.filter((x) => x !== c.id))
                            }
                          }}
                          label={`Velg kurs: ${c.title}`}
                        />
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="lp-meta-key">
                    Metadata-nøkkel
                  </label>
                  <StandardInput
                    id="lp-meta-key"
                    value={metaKey}
                    onChange={(e) => setMetaKey(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="lp-meta-val">
                    Forventet verdi
                  </label>
                  <StandardInput
                    id="lp-meta-val"
                    value={metaVal}
                    onChange={(e) => setMetaVal(e.target.value)}
                    placeholder="true / false / tekst"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
              <Button
                type="button"
                variant="primary"
                onClick={submit}
                icon={<Plus className="h-4 w-4" />}
              >
                Opprett læringsløp
              </Button>
            </div>
            {msg ? <p className="mt-2 text-xs text-neutral-700">{msg}</p> : null}
          </ModuleSectionCard>
        ) : (
          <ModuleSectionCard>
            <p className="text-sm text-neutral-600">
              Kun kursansvarlige kan opprette læringsløp. Du ser dine påmeldinger til venstre.
            </p>
          </ModuleSectionCard>
        )}
      </div>
    </div>
  )
}
