import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { learningFlowEntryUrl, qrCodeImageUrl } from '../../lib/learningDeepLink'
import {
  ArrowLeft,
  BarChart3,
  Check,
  Download,
  FileText,
  Layers,
  PlayCircle,
  Plus,
  Save,
  Scale,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { LearningModuleRail } from '../../components/learning/LearningModuleRail'
import {
  downloadJson,
  jsonFilename,
  parseCourseJson,
  pickJsonFile,
  serialiseCourse,
  serialiseModule,
} from '../../lib/learning/courseJsonIo'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { Course, CourseModule } from '../../types/learning'
import { LEARNING_MODULE_LEGAL_REFERENCES } from '../../components/learning/learningLegalReferences'
import { LearningMetadataSchemaEditor } from './LearningMetadataSchemaEditor'
import { RichTextEditor } from '../../components/learning/RichTextEditor'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WarningBox } from '../../components/ui/AlertBox'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { ModuleLegalBanner, ModulePageShell, ModuleSectionCard } from '../../components/module'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'

// Tab IDs match the editor design (`ui_kits/elearning/editor`): innhold
// (modules first, the primary task), detaljer (course info + sertifikat
// authoring + metadata schema), lovverk (canonical law-reference picker),
// participants/insights kept as informational tabs. The legacy `cert`
// tab is gone — its content folds into the Detaljer tab as a Sertifikat
// sub-card.
type MainTab = 'innhold' | 'detaljer' | 'lovverk' | 'participants' | 'insights'

export function LearningCourseBuilder() {
  const navigate = useNavigate()
  const { courseId } = useParams<{ courseId: string }>()
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const canDelete = isAdmin || can('learning.delete') || canManage
  const learning = useLearning()
  const {
    courses,
    updateCourse,
    deleteCourse,
    updateModule,
    deleteModule,
    addModule,
    reorderModules,
    forkSystemCourse,
    learningLoading,
    learningError,
    upsertIltEvent,
    bumpCourseVersion,
  } = learning
  const otherCourses = courses.filter((c) => c.id !== courseId)
  const course = courses.find((c) => c.id === courseId)
  const isSystemCatalog =
    course && course.origin === 'system' && course.sourceSystemCourseId && course.modules.length > 0

  const [mainTab, setMainTab] = useState<MainTab>('innhold')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [builderActionError, setBuilderActionError] = useState<string | null>(null)

  const selected = course?.modules.find((m) => m.id === selectedId) ?? null
  const sections = course?.sections ?? []

  const breadcrumb = [
    { label: 'Arbeidsflate', to: '/' },
    { label: 'E-læring', to: '/learning' },
    { label: 'Kurs', to: '/learning/courses' },
    { label: course?.title ?? 'Kurs' },
  ]

  if (learningLoading && courseId && !course) {
    return (
      <ModulePageShell breadcrumb={breadcrumb} title="Laster kurs…" loading>
        {null}
      </ModulePageShell>
    )
  }

  if (!course) {
    return (
      <ModulePageShell
        breadcrumb={breadcrumb}
        title="Kurs ikke funnet"
        notFound={{
          title: 'Kurset finnes ikke',
          backLabel: '← Tilbake til kurslisten',
          onBack: () => navigate('/learning/courses'),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (canManage && isSystemCatalog && course?.sourceSystemCourseId) {
    return (
      <ModulePageShell
        breadcrumb={breadcrumb}
        title={course.title}
        description="Dette kurset leveres fra Klarert sin systemkatalog."
        headerActions={
          <Button
            type="button"
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/learning/courses')}
          >
            Tilbake til kurs
          </Button>
        }
      >
        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Systemkurs — kun lesetilgang</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Dette kurset leveres fra felles katalog og kan ikke redigeres direkte. Kopier det til
            organisasjonen din for å tilpasse innhold, rekkefølge og publisering.
          </p>
          {builderActionError ? (
            <div className="mt-3">
              <WarningBox>{builderActionError}</WarningBox>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <Link
              to={`/learning/play/${course.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <PlayCircle className="h-4 w-4" />
              Forhåndsvisning
            </Link>
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                void (async () => {
                  setBuilderActionError(null)
                  const r = await forkSystemCourse(course.sourceSystemCourseId!)
                  if (r.ok && r.newCourseId) {
                    navigate(`/learning/courses/${r.newCourseId}`)
                  } else if (!r.ok) {
                    setBuilderActionError(r.error)
                  }
                })()
              }}
            >
              Kopier og tilpass
            </Button>
          </div>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={breadcrumb}
        title={course.title}
        description="Du har ikke tilgang til kursbyggeren."
        headerActions={
          <Button
            type="button"
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/learning/courses')}
          >
            Tilbake til kurs
          </Button>
        }
      >
        <ModuleSectionCard className="p-5 md:p-6">
          <WarningBox>
            Du har ikke tilgang til kursbyggeren. Bruk{' '}
            <Link to={`/learning/play/${course.id}`} className="font-medium text-[#1a3d32] underline">
              forhåndsvisning
            </Link>{' '}
            for å ta kurset, eller be om rettigheten «E-learning — opprette og redigere kurs».
          </WarningBox>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  // Order matches the editor design (modules-first since editing content
  // is the primary builder task). The Sertifikat content from the legacy
  // `cert` tab now lives as a sub-card inside Detaljer.
  const tabItems: TabItem[] = [
    { id: 'innhold', label: 'Innhold', icon: Layers, badgeCount: course.modules.length },
    { id: 'detaljer', label: 'Detaljer', icon: FileText },
    {
      id: 'lovverk',
      label: 'Lovverk',
      icon: Scale,
      badgeCount: (course.lawRefs?.length ?? 0) || undefined,
    },
    { id: 'participants', label: 'Deltakere', icon: Users },
    { id: 'insights', label: 'Innsikt', icon: BarChart3 },
  ]

  const statusBadgeVariant: 'active' | 'draft' | 'neutral' =
    course.status === 'published' ? 'active' : course.status === 'draft' ? 'draft' : 'neutral'
  const statusLabel =
    course.status === 'published' ? 'Publisert' : course.status === 'draft' ? 'Utkast' : 'Arkivert'

  const handleDeleteCourse = () => {
    if (!canDelete) return
    if (
      !window.confirm(
        `Slette kurset «${course.title}»? Modul, fremdrift og sertifikater fjernes også. Dette kan ikke angres.`,
      )
    ) {
      return
    }
    void (async () => {
      const r = await deleteCourse(course.id)
      if (!r.ok) setBuilderActionError(r.error)
      else navigate('/learning/courses')
    })()
  }

  // ── JSON I/O ─────────────────────────────────────────────────────────────
  // Serialise the entire course (or a single module) to JSON so authors
  // can hand-edit + re-import. See src/lib/learning/courseJsonIo.ts for
  // the schema. Per-module export lives in the rail's "..." menu.
  const handleExportCourse = () => {
    setBuilderActionError(null)
    downloadJson(jsonFilename(course.title, 'kurs'), serialiseCourse(course))
  }
  const handleImportCourse = async () => {
    setBuilderActionError(null)
    const json = await pickJsonFile()
    if (json == null) return
    const parsed = parseCourseJson(json)
    if (!parsed.ok) {
      setBuilderActionError(`Importfeil: ${parsed.error}`)
      return
    }
    if (
      !window.confirm(
        `Importere ${parsed.value.modules.length} moduler fra fil? Eksisterende moduler beholdes; nye legges til på slutten.`,
      )
    ) {
      return
    }
    // Course-level fields: only update what the JSON explicitly sets,
    // leaving the rest untouched. We don't overwrite status (importer
    // shouldn't accidentally publish a draft).
    const patch: Partial<Course> = {}
    if (parsed.value.title) patch.title = parsed.value.title
    if (parsed.value.description !== undefined) patch.description = parsed.value.description
    if (parsed.value.tags) patch.tags = parsed.value.tags
    if (parsed.value.recertificationMonths !== undefined) {
      patch.recertificationMonths = parsed.value.recertificationMonths
    }
    if (parsed.value.categoryId !== undefined) patch.categoryId = parsed.value.categoryId
    if (parsed.value.lawRefs) patch.lawRefs = parsed.value.lawRefs
    if (Object.keys(patch).length > 0) updateCourse(course.id, patch)
    // Append modules in order. addModule mints fresh ids; the module's
    // own `order` field is recomputed from its position at insert time.
    for (const m of parsed.value.modules) {
      const created = addModule(course.id, m.kind, m.title, m.sectionId ?? null)
      if (created) {
        updateModule(course.id, created.id, {
          durationMinutes: m.durationMinutes,
          content: m.content as CourseModule['content'],
        })
      }
    }
  }

  const handleExportModule = (mod: CourseModule) => {
    setBuilderActionError(null)
    downloadJson(jsonFilename(mod.title || 'modul', `modul-${mod.kind}`), serialiseModule(mod))
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <AddTaskLink
        title={`Oppfølging: ${course.title}`}
        description="Oppfølgingsoppgave fra kursbygger"
        module="learning"
        sourceType="learning_course"
        sourceId={course.id}
        sourceLabel={course.title}
        ownerRole="Læringsansvarlig"
      />
      <Button
        type="button"
        variant="secondary"
        icon={<Download className="h-4 w-4" />}
        onClick={handleExportCourse}
        title="Last ned hele kurset som JSON"
      >
        Eksporter
      </Button>
      <Button
        type="button"
        variant="secondary"
        icon={<Upload className="h-4 w-4" />}
        onClick={() => void handleImportCourse()}
        title="Importer JSON og legg modulene til kurset"
      >
        Importer
      </Button>
      <Button
        type="button"
        variant="secondary"
        icon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => navigate('/learning/courses')}
      >
        Tilbake til katalog
      </Button>
      <Link
        to={`/learning/play/${course.id}?preview=1`}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
      >
        <PlayCircle className="h-4 w-4" />
        Forhåndsvisning
      </Link>
      {canDelete ? (
        <Button
          type="button"
          variant="danger"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={handleDeleteCourse}
        >
          Slett kurs
        </Button>
      ) : null}
    </div>
  )

  return (
    <ModulePageShell
      breadcrumb={breadcrumb}
      title={course.title}
      description={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
          <span className="text-xs text-neutral-500">
            v{course.courseVersion ?? 1} · {course.modules.length} moduler
            {sections.length > 0 ? ` · ${sections.length} seksjoner` : ''}
          </span>
        </div>
      }
      headerActions={headerActions}
      tabs={
        <Tabs
          items={tabItems}
          activeId={mainTab}
          onChange={(id) => setMainTab(id as MainTab)}
          overflow="scroll"
        />
      }
    >
      <ModuleLegalBanner
        title="Regelverk for dette kurset"
        intro={
          <>
            Innholdet skal dokumentere lovpålagt opplæring. Knytt kursmodulene til de aktuelle
            paragrafene under for å gjøre samsvar enklere å revidere.
          </>
        }
        references={LEARNING_MODULE_LEGAL_REFERENCES}
      />

      {learningError ? <WarningBox>{learningError}</WarningBox> : null}
      {builderActionError ? <WarningBox>{builderActionError}</WarningBox> : null}

      {mainTab === 'detaljer' && (
        <div className="space-y-6">
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="course-title">
                Tittel
              </label>
              <StandardInput
                id="course-title"
                value={course.title}
                onChange={(e) => updateCourse(course.id, { title: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="course-recert">
                Resertifisering (måneder)
              </label>
              <StandardInput
                id="course-recert"
                type="number"
                min={0}
                max={120}
                value={course.recertificationMonths ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    updateCourse(course.id, { recertificationMonths: null })
                    return
                  }
                  const n = Number(raw)
                  if (Number.isNaN(n)) return
                  updateCourse(course.id, { recertificationMonths: Math.min(120, Math.max(0, n)) })
                }}
                placeholder="La stå tom for ingen fornyelse"
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Klarert sender automatisk varsel 60 dager før utløp.
              </p>
            </div>
            <div className="lg:col-span-2">
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="course-desc">
                Beskrivelse
              </label>
              <StandardTextarea
                id="course-desc"
                value={course.description}
                onChange={(e) => updateCourse(course.id, { description: e.target.value })}
                rows={4}
                className="mt-1.5"
              />
            </div>
            <div className="lg:col-span-2">
              <span className={WPSTD_FORM_FIELD_LABEL}>Tagger</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {course.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700"
                  >
                    {t}
                    <button
                      type="button"
                      className="ml-0.5 text-neutral-400 hover:text-red-600"
                      onClick={() => updateCourse(course.id, { tags: course.tags.filter((x) => x !== t) })}
                      aria-label={`Fjern etikett ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <StandardInput
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault()
                      if (!course.tags.includes(tagInput.trim())) {
                        updateCourse(course.id, { tags: [...course.tags, tagInput.trim()] })
                      }
                      setTagInput('')
                    }
                  }}
                  placeholder="+ Legg til etikett"
                  className="w-44 py-1 text-xs"
                />
              </div>
            </div>
            {otherCourses.length > 0 ? (
              <div className="lg:col-span-2 border-t border-neutral-100 pt-4">
                <span className={WPSTD_FORM_FIELD_LABEL}>Forutsetninger</span>
                <p className="mt-1 text-xs text-neutral-500">
                  Velg kurs som må fullføres før dette blir tilgjengelig for deltakere.
                </p>
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
                  {otherCourses.map((oc) => (
                    <li key={oc.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-neutral-900">{oc.title}</span>
                        <span className="ml-2 text-xs text-neutral-500">
                          ({oc.status === 'published' ? 'Publisert' : oc.status === 'draft' ? 'Utkast' : 'Arkivert'})
                        </span>
                      </div>
                      <ToggleSwitch
                        checked={course.prerequisiteCourseIds?.includes(oc.id) ?? false}
                        onChange={(on) => {
                          const cur = course.prerequisiteCourseIds ?? []
                          const next = on ? [...cur, oc.id] : cur.filter((x) => x !== oc.id)
                          updateCourse(course.id, { prerequisiteCourseIds: next })
                        }}
                        label={`Forutsetning: ${oc.title}`}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="lg:col-span-2 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
              <span>
                Kursversjon: <strong className="tabular-nums text-neutral-900">{course.courseVersion ?? 1}</strong>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!window.confirm('Øke kursversjon? Nye fullføringer får ny versjon på sertifikatet.')) return
                  void (async () => {
                    setBuilderActionError(null)
                    const r = await bumpCourseVersion(course.id)
                    if (!r.ok) setBuilderActionError(r.error)
                  })()
                }}
              >
                Øk versjon
              </Button>
            </div>
          </div>
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5 md:p-6">
          <h3 className="text-base font-semibold text-neutral-900">Sertifikat</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Kursbevis utstedes når deltakeren fullfører alle obligatoriske moduler.
            Administrer alle utstedte kursbevis under{' '}
            <Link to="/learning/certifications" className="font-medium text-[#1a3d32] underline">
              Sertifiseringer
            </Link>
            .
          </p>
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
              Hoveddata på kursbevis
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Definer ekstra opplysninger som hentes ved fullføring. Innebygde typer
              (lokasjon, avdeling, team) snapshottes automatisk fra organisasjonsmedlemskap.
            </p>
            <div className="mt-3">
              <LearningMetadataSchemaEditor
                schema={course.metadataSchema ?? null}
                onChange={(next) => updateCourse(course.id, { metadataSchema: next })}
              />
            </div>
          </div>
        </ModuleSectionCard>
        </div>
      )}

      {mainTab === 'innhold' && (
        // Three-pane layout matching the Klarert dashboard kit's
        // CourseEditor design (`ui_kits/elearning/editor`): 320px
        // module rail on the left, flex editor pane on the right.
        // Modules display flat (no section grouping) per the design.
        <div
          className="grid h-[calc(100vh-260px)] min-h-[640px] grid-cols-1 overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50 lg:grid-cols-[320px_minmax(0,1fr)]"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <aside className="overflow-hidden border-b border-neutral-200 bg-white lg:border-b-0 lg:border-r">
            <LearningModuleRail
              modules={course.modules}
              activeId={selectedId}
              isLocked={!canManage}
              onSelect={(id) => setSelectedId(id)}
              onMove={(idx, dir) => {
                const next = course.modules.slice()
                const target = idx + dir
                if (target < 0 || target >= next.length) return
                const tmp = next[idx]!
                next[idx] = next[target]!
                next[target] = tmp
                void reorderModules(
                  course.id,
                  next.map((m) => m.id),
                )
              }}
              onDuplicate={(id) => {
                const src = course.modules.find((m) => m.id === id)
                if (!src) return
                const created = addModule(
                  course.id,
                  src.kind,
                  `${src.title || 'Modul'} (kopi)`,
                  src.sectionId ?? null,
                )
                if (created) setSelectedId(created.id)
              }}
              onDelete={(id) => {
                if (!window.confirm('Slett denne modulen?')) return
                deleteModule(course.id, id)
                if (selectedId === id) setSelectedId(null)
              }}
              onAdd={(kind) => {
                const created = addModule(course.id, kind, 'Ny modul', null)
                if (created) setSelectedId(created.id)
              }}
              onExport={(id) => {
                const target = course.modules.find((m) => m.id === id)
                if (target) handleExportModule(target)
              }}
            />
          </aside>
          <main className="overflow-y-auto p-5 md:p-6">
            {selected ? (
              <ModuleEditor
                key={selected.id}
                courseId={course.id}
                mod={selected}
                updateModule={updateModule}
                deleteModule={deleteModule}
                upsertIltEvent={upsertIltEvent}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <Layers className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
                  <p className="mt-3 text-sm text-neutral-500">
                    Velg en modul fra listen, eller legg til en ny.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {mainTab === 'lovverk' && (
        <div className="space-y-6">
          <ModuleSectionCard className="p-5 md:p-6">
            <h3 className="text-base font-semibold text-neutral-900">Lovgrunnlag</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Velg paragrafene som hjemler kurset. Disse refereres i AMU-årsrapporten og
              vises for deltakeren ved fullføring.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {LEARNING_MODULE_LEGAL_REFERENCES.map((ref) => {
                const on = (course.lawRefs ?? []).includes(ref.code)
                return (
                  <button
                    key={ref.code}
                    type="button"
                    onClick={() => {
                      const cur = course.lawRefs ?? []
                      const next = on ? cur.filter((c) => c !== ref.code) : [...cur, ref.code]
                      updateCourse(course.id, { lawRefs: next })
                    }}
                    className={
                      'flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ' +
                      (on
                        ? 'border-[#1a3d32] bg-[#e7efe9]'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50')
                    }
                  >
                    <span
                      className={
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ' +
                        (on
                          ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                          : 'border-neutral-300 bg-white')
                      }
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Badge variant="info">{ref.code}</Badge>
                      <p className="mt-1.5 text-sm text-neutral-700">{ref.text}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            {(course.lawRefs?.length ?? 0) === 0 ? (
              <p className="mt-4 text-xs text-neutral-500">
                Ingen paragrafer valgt. Som minimum bør AML § 3-2 og IK-forskriften
                § 5 nr. 2 være på plass for opplæringskurs.
              </p>
            ) : null}
          </ModuleSectionCard>
        </div>
      )}

      {mainTab === 'participants' && (
        <ModuleSectionCard className="p-5 md:p-6">
          <p className="text-sm text-neutral-700">
            Deltakeroversikt kobles til organisasjonens Supabase-profiler. Fremdrift for påmeldte vises i{' '}
            <Link to="/learning/participants" className="font-medium text-[#1a3d32] underline">
              Deltakere
            </Link>
            .
          </p>
        </ModuleSectionCard>
      )}

      {mainTab === 'insights' && (
        <ModuleSectionCard className="p-5 md:p-6">
          <p className="text-sm text-neutral-700">
            Antall moduler: <strong className="text-neutral-900">{course.modules.length}</strong> · Seksjoner:{' '}
            <strong className="text-neutral-900">{sections.length}</strong> · Publisert:{' '}
            <strong className="text-neutral-900">{course.status === 'published' ? 'Ja' : 'Nei'}</strong>.
          </p>
        </ModuleSectionCard>
      )}
    </ModulePageShell>
  )
}

function ModuleEditor({
  courseId,
  mod,
  updateModule,
  deleteModule,
  upsertIltEvent,
  onDeleted,
}: {
  courseId: string
  mod: CourseModule
  updateModule: ReturnType<typeof useLearning>['updateModule']
  deleteModule: ReturnType<typeof useLearning>['deleteModule']
  upsertIltEvent: ReturnType<typeof useLearning>['upsertIltEvent']
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(mod.title)
  const [dur, setDur] = useState(mod.durationMinutes)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="me-title">
            Modultittel
          </label>
          <StandardInput
            id="me-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              updateModule(courseId, mod.id, { title: e.target.value })
            }}
            className="mt-1.5 font-medium"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-7 text-red-600 hover:bg-red-50"
          onClick={() => {
            if (window.confirm('Slett denne modulen?')) {
              deleteModule(courseId, mod.id)
              onDeleted()
            }
          }}
          aria-label="Slett modul"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="me-duration">
          Varighet (minutter)
        </label>
        <StandardInput
          id="me-duration"
          type="number"
          min={1}
          max={15}
          value={dur}
          onChange={(e) => {
            const v = Math.min(15, Math.max(1, Number(e.target.value) || 1))
            setDur(v)
            updateModule(courseId, mod.id, { durationMinutes: v })
          }}
          className="mt-1.5 w-24"
        />
        <p className="mt-1 text-xs text-neutral-500">Mikrolæring: anbefalt maks ~3 min lesing/seing per modul.</p>
      </div>

      {mod.kind === 'on_job' ? (
        <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-700">QR for stedet (flow-of-work)</p>
          <p className="mt-1.5 text-xs text-neutral-600">
            Skriv ut og fest på f.eks. førstehjelpskasse eller truck. Skanning åpner modulen direkte uten å navigere i
            kursbiblioteket.
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <img
              src={qrCodeImageUrl(learningFlowEntryUrl(courseId, mod.id))}
              alt=""
              className="size-36 rounded-lg border border-white bg-white p-1 shadow"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`me-deeplink-${mod.id}`}>
                Dypelenke (flow)
              </label>
              <StandardInput
                id={`me-deeplink-${mod.id}`}
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/learning/flow?course=${encodeURIComponent(courseId)}&module=${encodeURIComponent(mod.id)}`}
                className="mt-1.5 font-mono text-[11px]"
                onFocus={(e) => e.target.select()}
              />
              <p className="text-xs text-neutral-500">
                Bruk denne i HMS-hendelser eller automasjon; tildeling lagres i <code>learning_module_assignments</code>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {mod.kind === 'event' ? (
        <IltScheduleForm
          courseId={courseId}
          moduleId={mod.id}
          defaultTitle={mod.title}
          upsertIltEvent={upsertIltEvent}
        />
      ) : null}

      <ContentFields courseId={courseId} mod={mod} updateModule={updateModule} />
    </div>
  )
}

function IltScheduleForm({
  courseId,
  moduleId,
  defaultTitle,
  upsertIltEvent,
}: {
  courseId: string
  moduleId: string
  defaultTitle: string
  upsertIltEvent: ReturnType<typeof useLearning>['upsertIltEvent']
}) {
  const [title, setTitle] = useState(defaultTitle)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [locationText, setLocationText] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [instructorName, setInstructorName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-700">Planlegg ILT / vILT-økt</p>
      <p className="mt-1.5 text-xs text-neutral-600">
        Én økt per modul. Deltakere kan RSVP og oppmøte registreres i spilleren.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`ilt-title-${moduleId}`}>
            Tittel på økt
          </label>
          <StandardInput
            id={`ilt-title-${moduleId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`ilt-start-${moduleId}`}>
            Start (lokal tid)
          </label>
          <StandardInput
            id={`ilt-start-${moduleId}`}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`ilt-end-${moduleId}`}>
            Slutt (valgfritt)
          </label>
          <StandardInput
            id={`ilt-end-${moduleId}`}
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`ilt-loc-${moduleId}`}>
            Sted / rom
          </label>
          <StandardInput
            id={`ilt-loc-${moduleId}`}
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`ilt-url-${moduleId}`}>
            Teams / Meet-lenke
          </label>
          <StandardInput
            id={`ilt-url-${moduleId}`}
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`ilt-instr-${moduleId}`}>
            Instruktør
          </label>
          <StandardInput
            id={`ilt-instr-${moduleId}`}
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end border-t border-neutral-200/80 pt-4">
        <Button
          type="button"
          variant="primary"
          icon={<Save className="h-4 w-4" />}
          onClick={() => {
            if (!startsAt) {
              setMsg('Velg starttidspunkt.')
              return
            }
            const isoStart = new Date(startsAt).toISOString()
            const isoEnd = endsAt ? new Date(endsAt).toISOString() : null
            void (async () => {
              const r = await upsertIltEvent({
                courseId,
                moduleId,
                title: title.trim() || defaultTitle,
                startsAt: isoStart,
                endsAt: isoEnd,
                locationText: locationText.trim() || null,
                meetingUrl: meetingUrl.trim() || null,
                instructorName: instructorName.trim() || null,
              })
              setMsg(r.ok ? 'Lagret økt.' : r.error)
            })()
          }}
        >
          Lagre økt
        </Button>
      </div>
      {msg ? (
        <p className="mt-3 text-xs text-neutral-700" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  )
}

function ContentFields({
  courseId,
  mod,
  updateModule,
}: {
  courseId: string
  mod: CourseModule
  updateModule: ReturnType<typeof useLearning>['updateModule']
}) {
  const c = mod.content

  if (c.kind === 'flashcard') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-[#6b6f68]">Kortbasert (trykk for å snu i deltakervisten).</p>
        {c.slides.map((s, idx) => (
          <div key={s.id} className="rounded-lg border border-[#e3ddcc] bg-[#f7f5ee] p-3">
            <div className="text-xs font-medium text-[#6b6f68]">Kort {idx + 1}</div>
            <StandardInput
              value={s.front}
              onChange={(e) => {
                const slides = c.slides.map((x) =>
                  x.id === s.id ? { ...x, front: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, slides } })
              }}
              placeholder="Forside"
              className="mt-1"
            />
            <StandardInput
              value={s.back}
              onChange={(e) => {
                const slides = c.slides.map((x) =>
                  x.id === s.id ? { ...x, back: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, slides } })
              }}
              placeholder="Bakside"
              className="mt-2"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[#1a3d32] hover:underline"
          onClick={() => {
            const slides = [
              ...c.slides,
              { id: crypto.randomUUID(), front: 'Forside', back: 'Bakside' },
            ]
            updateModule(courseId, mod.id, { content: { ...c, slides } })
          }}
        >
          + Legg til kort
        </Button>
      </div>
    )
  }

  if (c.kind === 'quiz') {
    return (
      <div className="space-y-4">
        {c.questions.map((q) => (
          <div key={q.id} className="rounded-lg border border-[#e3ddcc] bg-[#f7f5ee] p-3">
            <StandardInput
              value={q.question}
              onChange={(e) => {
                const questions = c.questions.map((x) =>
                  x.id === q.id ? { ...x, question: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, questions } })
              }}
              className="font-medium"
            />
            {q.options.map((opt, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={q.correctIndex === i ? 'primary' : 'secondary'}
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    const questions = c.questions.map((x) =>
                      x.id === q.id ? { ...x, correctIndex: i } : x,
                    )
                    updateModule(courseId, mod.id, { content: { ...c, questions } })
                  }}
                >
                  Riktig
                </Button>
                <StandardInput
                  value={opt}
                  onChange={(e) => {
                    const options = [...q.options]
                    options[i] = e.target.value
                    const questions = c.questions.map((x) =>
                      x.id === q.id ? { ...x, options } : x,
                    )
                    updateModule(courseId, mod.id, { content: { ...c, questions } })
                  }}
                  className="min-w-0 flex-1"
                />
              </div>
            ))}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[#1a3d32] hover:underline"
          onClick={() => {
            const questions = [
              ...c.questions,
              {
                id: crypto.randomUUID(),
                question: 'Nytt spørsmål',
                options: ['A', 'B', 'C'],
                correctIndex: 0,
              },
            ]
            updateModule(courseId, mod.id, { content: { ...c, questions } })
          }}
        >
          + Legg til spørsmål
        </Button>
      </div>
    )
  }

  if (c.kind === 'text') {
    return (
      <RichTextEditor
        value={c.body}
        onChange={(html) =>
          updateModule(courseId, mod.id, { content: { kind: 'text', body: html } })
        }
      />
    )
  }

  if (c.kind === 'image') {
    return (
      <div className="space-y-2">
        <StandardInput
          value={c.imageUrl}
          onChange={(e) =>
            updateModule(courseId, mod.id, {
              content: { ...c, imageUrl: e.target.value },
            })
          }
          placeholder="Bilde-URL"
        />
        <StandardInput
          value={c.caption}
          onChange={(e) =>
            updateModule(courseId, mod.id, {
              content: { ...c, caption: e.target.value },
            })
          }
          placeholder="Bildetekst"
          className="mt-2"
        />
        <img src={c.imageUrl} alt="" className="max-h-48 rounded-lg object-cover" />
      </div>
    )
  }

  if (c.kind === 'video') {
    return (
      <div className="space-y-2">
        <StandardInput
          value={c.url}
          onChange={(e) =>
            updateModule(courseId, mod.id, { content: { ...c, url: e.target.value } })
          }
          placeholder="Video-URL (MP4 eller side)"
        />
        <StandardInput
          value={c.caption}
          onChange={(e) =>
            updateModule(courseId, mod.id, { content: { ...c, caption: e.target.value } })
          }
          placeholder="Bildetekst (valgfritt)"
          className="mt-2"
        />
      </div>
    )
  }

  if (c.kind === 'checklist') {
    return (
      <ul className="space-y-2">
        {c.items.map((it) => (
          <li key={it.id} className="flex gap-2">
            <StandardInput
              value={it.label}
              onChange={(e) => {
                const items = c.items.map((x) =>
                  x.id === it.id ? { ...x, label: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, items } })
              }}
            />
          </li>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[#1a3d32] hover:underline"
          onClick={() => {
            const items = [...c.items, { id: crypto.randomUUID(), label: 'Nytt punkt' }]
            updateModule(courseId, mod.id, { content: { ...c, items } })
          }}
        >
          + Punkt
        </Button>
      </ul>
    )
  }

  if (c.kind === 'tips') {
    return (
      <ul className="space-y-2">
        {c.items.map((tip, i) => (
          <li key={i}>
            <StandardInput
              value={tip}
              onChange={(e) => {
                const items = [...c.items]
                items[i] = e.target.value
                updateModule(courseId, mod.id, { content: { ...c, items } })
              }}
            />
          </li>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[#1a3d32] hover:underline"
          onClick={() =>
            updateModule(courseId, mod.id, {
              content: { ...c, items: [...c.items, 'Nytt tips'] },
            })
          }
        >
          + Tips
        </Button>
      </ul>
    )
  }

  if (c.kind === 'event') {
    return (
      <RichTextEditor
        value={c.instructions}
        onChange={(html) => updateModule(courseId, mod.id, { content: { kind: 'event', instructions: html } })}
      />
    )
  }

  if (c.kind === 'on_job') {
    return (
      <div className="space-y-3">
        {c.tasks.map((t) => (
          <div key={t.id} className="rounded-lg border border-[#e3ddcc] bg-[#f7f5ee] p-2">
            <StandardInput
              value={t.title}
              onChange={(e) => {
                const tasks = c.tasks.map((x) =>
                  x.id === t.id ? { ...x, title: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, tasks } })
              }}
              className="font-medium"
            />
            <StandardTextarea
              value={t.description}
              onChange={(e) => {
                const tasks = c.tasks.map((x) =>
                  x.id === t.id ? { ...x, description: e.target.value } : x,
                )
                updateModule(courseId, mod.id, { content: { ...c, tasks } })
              }}
              rows={2}
              className="mt-1"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[#1a3d32] hover:underline"
          onClick={() => {
            const tasks = [
              ...c.tasks,
              { id: crypto.randomUUID(), title: 'Oppgave', description: '' },
            ]
            updateModule(courseId, mod.id, { content: { ...c, tasks } })
          }}
        >
          + Oppgave
        </Button>
      </div>
    )
  }

  if (c.kind === 'other') {
    return (
      <div>
        <StandardInput
          value={c.title}
          onChange={(e) =>
            updateModule(courseId, mod.id, {
              content: { ...c, title: e.target.value },
            })
          }
          className="mb-2 font-medium"
        />
        <RichTextEditor
          value={c.body}
          onChange={(html) =>
            updateModule(courseId, mod.id, { content: { ...c, body: html } })
          }
        />
      </div>
    )
  }

  return null
}
