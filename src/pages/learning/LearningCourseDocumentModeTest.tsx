// LearningCourseDocumentModeTest — exploratory view that demonstrates
// what a course would look like if it were authored using the
// documents-style editor surface (single rich-text canvas + metadata
// panel) instead of the module-by-module rail.
//
// Read-only sandbox — joins all `text` modules' bodies into one
// continuous TipTap render, surfaces course-level metadata in a side
// panel that mirrors `DocumentMetadataPanel`. Non-text modules
// (quiz / video / flashcard / …) are surrogated by a section title +
// duration so the document keeps its narrative shape.
//
// Linked from the course builder's headerActions ("Test: dokument-
// modus"). Doesn't write to the DB; just shows the layout.

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { InfoBox } from '../../components/ui/AlertBox'
import { TipTapRichTextEditor } from '../../components/documents/TipTapRichTextEditor'
import type { CourseModule } from '../../types/learning'

export function LearningCourseDocumentModeTest() {
  const { courseId } = useParams<{ courseId: string }>()
  const { courses } = useLearning()
  const course = courses.find((c) => c.id === courseId)

  // Join the modules into one document body. Text modules contribute
  // their body verbatim; other kinds contribute a labelled "section
  // surrogate" so the narrative shape is preserved.
  const joinedBody = useMemo(() => {
    if (!course) return ''
    return course.modules.map(moduleAsHtml).join('\n')
  }, [course])

  if (!course) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Læring', to: '/learning' },
          { label: 'Kurs', to: '/learning/courses' },
          { label: 'Test: dokument-modus' },
        ]}
        title="Kurset finnes ikke"
        description="Kunne ikke finne kursrad i denne organisasjonen."
      >
        <ModuleSectionCard className="p-5 md:p-6">
          <Link to="/learning/courses" className="text-sm font-medium text-[#1a3d32] underline">
            Tilbake til kursliste
          </Link>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Læring', to: '/learning' },
        { label: 'Kurs', to: '/learning/courses' },
        { label: course.title, to: `/learning/courses/${course.id}` },
        { label: 'Test: dokument-modus' },
      ]}
      title={course.title}
      description="Eksperimentell visning som låner dokumenteditorens overflate (rik tekst + metadata-panel) for å forfatte kurs som om de var ett dokument."
      headerActions={
        <Link
          to={`/learning/courses/${course.id}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake til kursbygger
        </Link>
      }
    >
      <InfoBox>
        Skissesett — viser hvordan kurset hadde sett ut om det ble skrevet i
        dokumenteditoren. Skrivebeskyttet; redigering skjer fortsatt i kursbyggerens
        modulrail.
      </InfoBox>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ModuleSectionCard className="p-0">
          <div className="border-b border-neutral-200/80 px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Innhold
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {course.modules.length} moduler ·{' '}
              {course.modules.reduce((s, m) => s + (m.durationMinutes || 0), 0)} min totalt
            </p>
          </div>
          <div className="px-6 py-5">
            {joinedBody ? (
              <TipTapRichTextEditor
                value={joinedBody}
                onChange={() => {
                  /* read-only sandbox */
                }}
                toolbar="none"
                readOnly
              />
            ) : (
              <p className="py-12 text-center text-sm text-neutral-500">
                Ingen moduler i kurset ennå.
              </p>
            )}
          </div>
        </ModuleSectionCard>

        <aside className="space-y-4">
          <ModuleSectionCard className="p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Metadata
            </p>
            <dl className="space-y-3 text-sm">
              <MetaRow label="Status" value={
                <Badge variant={course.status === 'published' ? 'active' : 'draft'}>
                  {course.status === 'published'
                    ? 'Publisert'
                    : course.status === 'archived'
                      ? 'Arkivert'
                      : 'Utkast'}
                </Badge>
              } />
              <MetaRow label="Versjon" value={`v${course.courseVersion ?? 1}`} />
              <MetaRow
                label="Resertifisering"
                value={
                  course.recertificationMonths
                    ? `${course.recertificationMonths} mnd`
                    : 'Ingen'
                }
              />
              <MetaRow
                label="Tagger"
                value={
                  course.tags.length === 0 ? (
                    <span className="text-neutral-400">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {course.tags.map((t) => (
                        <Badge key={t} variant="neutral">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  )
                }
              />
            </dl>
          </ModuleSectionCard>

          {(course.lawRefs?.length ?? 0) > 0 ? (
            <ModuleSectionCard className="p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Lovgrunnlag
              </p>
              <ul className="space-y-1.5 text-xs text-neutral-700">
                {(course.lawRefs ?? []).map((code) => (
                  <li key={code} className="font-mono">
                    {code}
                  </li>
                ))}
              </ul>
            </ModuleSectionCard>
          ) : null}

          <ModuleSectionCard className="p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Hva mangler i denne visningen?
            </p>
            <ul className="space-y-1.5 text-xs text-neutral-600">
              <li className="flex items-start gap-2">
                <FileText className="mt-0.5 h-3 w-3 shrink-0 text-neutral-400" />
                Per-kind editorer (quiz / flashcard / video) er ikke representert —
                bare som tittel + varighet.
              </li>
              <li className="flex items-start gap-2">
                <FileText className="mt-0.5 h-3 w-3 shrink-0 text-neutral-400" />
                Lagring til DB er ikke koblet på.
              </li>
              <li className="flex items-start gap-2">
                <FileText className="mt-0.5 h-3 w-3 shrink-0 text-neutral-400" />
                Modul-grenser blir til H2-avsnitt; deltakerens fremdrift per modul
                forsvinner i denne modellen.
              </li>
            </ul>
          </ModuleSectionCard>
        </aside>
      </div>
    </ModulePageShell>
  )
}

function MetaRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-xs text-neutral-500">{label}</dt>
      <dd className="text-right text-sm text-neutral-900">{value}</dd>
    </div>
  )
}

/**
 * Render one course module as HTML for the joined document body.
 * Text modules contribute their body verbatim. Other kinds get a
 * labelled section surrogate so the narrative shape is preserved.
 */
function moduleAsHtml(mod: CourseModule): string {
  const heading = `<h2>${escapeHtml(mod.title || 'Uten tittel')}</h2>`
  const dur = mod.durationMinutes ? `<p><em>~${mod.durationMinutes} min</em></p>` : ''
  if (mod.kind === 'text') {
    const body = (mod.content as { body?: string } | undefined)?.body ?? ''
    return `${heading}${dur}${body}`
  }
  return `${heading}${dur}<p><em>(${kindLabel(mod.kind)} — vises ikke i dokumentmodus)</em></p>`
}

function kindLabel(k: CourseModule['kind']): string {
  switch (k) {
    case 'flashcard':
      return 'Flashkort'
    case 'quiz':
      return 'Quiz'
    case 'image':
      return 'Bilde'
    case 'video':
      return 'Video'
    case 'checklist':
      return 'Sjekkliste'
    case 'tips':
      return 'Tips'
    case 'on_job':
      return 'I praksis'
    case 'event':
      return 'Arrangement'
    default:
      return 'Modul'
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
