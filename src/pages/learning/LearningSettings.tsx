import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Cog,
  Copy,
  Database,
  Download,
  GitBranch,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  Webhook,
} from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'
import { Button } from '../../components/ui/Button'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { Tabs, type TabItem } from '../../components/ui/Tabs'
import { ModuleSectionCard } from '../../components/module'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'

type SettingsTab = 'generelt' | 'stier' | 'system' | 'integrasjoner' | 'eksport'

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slugTitle(title: string) {
  return (
    title
      .slice(0, 40)
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase() || 'course'
  )
}

function SectionHeading({
  title,
  description,
  icon,
}: {
  title: string
  description?: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: '#e7efe9', color: '#1a3d32' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {description ? <p className="mt-1.5 text-sm text-neutral-600">{description}</p> : null}
      </div>
    </div>
  )
}

/**
 * Innstillinger-orchestrator with five sub-tabs (matches Documents settings IA):
 *   • Generelt — lagring + reset
 *   • Læringsstier — rolle-baserte løp (was /learning/paths)
 *   • Systemkurs — toggle systemkurs av/på, fork to org
 *   • Integrasjoner — Teams / Slack / generic webhooks
 *   • Eksport & personvern — JSON ut/inn + GDPR-grunnlag
 *
 * URL: `?tab=generelt|stier|system|integrasjoner|eksport`. Default `generelt`.
 */
export function LearningSettings() {
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const [searchParams, setSearchParams] = useSearchParams()
  const initial: SettingsTab = (() => {
    const t = searchParams.get('tab')
    if (t === 'stier' || t === 'system' || t === 'integrasjoner' || t === 'eksport') return t
    return 'generelt'
  })()
  const [tab, setTab] = useState<SettingsTab>(initial)

  const setTabParam = (next: SettingsTab) => {
    setTab(next)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'generelt') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  const tabItems: TabItem[] = [
    { id: 'generelt', label: 'Generelt', icon: Cog },
    { id: 'stier', label: 'Læringsstier', icon: GitBranch },
    { id: 'system', label: 'Systemkurs', icon: Copy },
    { id: 'integrasjoner', label: 'Integrasjoner', icon: Webhook },
    { id: 'eksport', label: 'Eksport & personvern', icon: ShieldCheck },
  ]

  if (!canManage) {
    return (
      <ModuleSectionCard className="p-5 md:p-6">
        <WarningBox>
          Innstillinger er kun tilgjengelig for kursansvarlige med rettigheten «E-learning — opprette og redigere
          kurs».
        </WarningBox>
      </ModuleSectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs items={tabItems} activeId={tab} onChange={(id) => setTabParam(id as SettingsTab)} overflow="scroll" />

      {tab === 'generelt' ? <GeneraltSection /> : null}
      {tab === 'stier' ? <StierSection /> : null}
      {tab === 'system' ? <SystemkursSection /> : null}
      {tab === 'integrasjoner' ? <IntegrasjonerSection /> : null}
      {tab === 'eksport' ? <EksportSection /> : null}
    </div>
  )
}

// ── Generelt — lagringstype + tilbakestill demodata ──────────────────────────
function GeneraltSection() {
  const { supabaseConfigured, organization } = useOrgSetupContext()
  const { resetDemo } = useLearning()
  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <SectionHeading
          icon={<Database className="h-5 w-5" />}
          title="Lagring"
          description={
            supabaseConfigured && organization
              ? 'Kurs, fremdrift og sertifikater lagres i databasen for organisasjonen din.'
              : 'Uten innlogget organisasjon lagres e-læringsdata lokalt i nettleseren (demo).'
          }
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant={supabaseConfigured ? 'success' : 'warning'}>
            {supabaseConfigured ? 'Supabase aktivert' : 'Lokal demo'}
          </Badge>
          {organization ? <Badge variant="info">{organization.name}</Badge> : null}
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <SectionHeading
          icon={<RefreshCcw className="h-5 w-5" />}
          title="Tilbakestill demodata"
          description="Sletter kurs, fremdrift og sertifikater i denne nettleseren og gjenoppretter demodata («Sikkerhet 101»)."
        />
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button
            type="button"
            variant="danger"
            icon={<RefreshCcw className="h-4 w-4" />}
            onClick={() => {
              if (
                window.confirm('Tilbakestille all e-læringsdata i denne nettleseren? Dette kan ikke angres.')
              )
                resetDemo()
            }}
          >
            Tilbakestill opplæringsdata
          </Button>
        </div>
      </ModuleSectionCard>
    </div>
  )
}

// ── Læringsstier (was /learning/paths) ──────────────────────────────────────
function StierSection() {
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const { courses, learningPaths, pathEnrollments, learningError, saveLearningPath, deleteLearningPath } =
    useLearning()

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

  return (
    <div className="space-y-6">
      {learningError ? <WarningBox>{learningError}</WarningBox> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ModuleSectionCard className="p-5 md:p-6">
          <SectionHeading
            icon={<GitBranch className="h-5 w-5" />}
            title="Dine læringsløp"
            description="Brukere meldes inn automatisk når metadata-flagget treffer regelen."
          />
          {learningPaths.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-10 text-center text-sm text-neutral-500">
              Ingen løp opprettet ennå.
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {learningPaths.map((p) => (
                <li
                  key={p.id}
                  className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900">{p.name}</div>
                      <div className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-500">
                        <Tag className="h-3 w-3" /> {p.slug}
                      </div>
                      {p.description ? (
                        <p className="mt-2 text-sm text-neutral-600">{p.description}</p>
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
                    <div className="flex justify-end border-t border-neutral-200/80 pt-3">
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
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
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

        <ModuleSectionCard className="p-5 md:p-6">
          <SectionHeading
            icon={<Plus className="h-5 w-5" />}
            title="Nytt læringsløp"
            description="Definer regel og velg kursene som skal være obligatoriske."
          />
          <div className="mt-5 space-y-5">
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
              <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3">
                {published.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-neutral-500">
                    Ingen publiserte kurs tilgjengelig.
                  </li>
                ) : (
                  published.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-neutral-50"
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
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              type="button"
              variant="primary"
              onClick={submit}
              icon={<Plus className="h-4 w-4" />}
            >
              Opprett læringsløp
            </Button>
          </div>
          {msg ? (
            <p className="mt-3 text-xs text-neutral-700" role="status">
              {msg}
            </p>
          ) : null}
        </ModuleSectionCard>
      </div>
    </div>
  )
}

// ── Systemkurs ──────────────────────────────────────────────────────────────
function SystemkursSection() {
  const navigate = useNavigate()
  const { supabaseConfigured, organization } = useOrgSetupContext()
  const { systemCourseSettings, setSystemCourseEnabled, forkSystemCourse } = useLearning()
  const [actionError, setActionError] = useState<string | null>(null)

  if (!supabaseConfigured || !organization) {
    return (
      <ModuleSectionCard className="p-5 md:p-6">
        <WarningBox>Systemkurs krever en innlogget organisasjon med Supabase-aktivert oppsett.</WarningBox>
      </ModuleSectionCard>
    )
  }

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <SectionHeading
        icon={<Copy className="h-5 w-5" />}
        title="Systemkurs for organisasjonen"
        description="Slå av kurs du ikke vil tilby. «Kopier som mal» lager et eget utkast du kan redigere og publisere."
      />
      {actionError ? (
        <div className="mt-4">
          <WarningBox>{actionError}</WarningBox>
        </div>
      ) : null}
      {systemCourseSettings.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-10 text-center text-sm text-neutral-500">
          Ingen systemkurs publisert ennå.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {systemCourseSettings.map((s) => (
            <li
              key={s.systemCourseId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">{s.title}</p>
                <p className="mt-0.5 font-mono text-xs text-neutral-500">{s.slug}</p>
                {s.forkedCourseId ? (
                  <Link
                    to={`/learning/courses/${s.forkedCourseId}`}
                    className="mt-2 inline-block text-xs font-medium text-[#1a3d32] underline"
                  >
                    Åpne tilpasset kurs (utkast)
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={s.enabled}
                    onChange={(v) => {
                      void (async () => {
                        setActionError(null)
                        const r = await setSystemCourseEnabled(s.systemCourseId, v)
                        if (!r.ok) setActionError(r.error)
                      })()
                    }}
                    label={`Aktiv: ${s.title}`}
                  />
                  <span className="text-sm text-neutral-700">Aktiv</span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={() => {
                    void (async () => {
                      setActionError(null)
                      const r = await forkSystemCourse(s.systemCourseId)
                      if (r.ok && r.newCourseId) {
                        navigate(`/learning/courses/${r.newCourseId}`)
                      } else if (!r.ok) {
                        setActionError(r.error)
                      }
                    })()
                  }}
                >
                  Kopier som mal
                </Button>
                <Link
                  to={`/learning/courses/${s.systemCourseId}`}
                  className="text-xs font-medium text-[#1a3d32] underline"
                >
                  Systemkurs
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModuleSectionCard>
  )
}

// ── Integrasjoner ──────────────────────────────────────────────────────────
function IntegrasjonerSection() {
  const { supabaseConfigured, organization } = useOrgSetupContext()
  const { flowSettings, saveFlowSettings } = useLearning()

  const [teamsUrl, setTeamsUrl] = useState<string | null>(null)
  const [slackUrl, setSlackUrl] = useState<string | null>(null)
  const [genericUrl, setGenericUrl] = useState<string | null>(null)
  const [flowMsg, setFlowMsg] = useState<string | null>(null)
  const [flowSaveError, setFlowSaveError] = useState<string | null>(null)

  const teamsDisplay = teamsUrl ?? flowSettings?.teamsWebhookUrl ?? ''
  const slackDisplay = slackUrl ?? flowSettings?.slackWebhookUrl ?? ''
  const genericDisplay = genericUrl ?? flowSettings?.genericWebhookUrl ?? ''

  if (!supabaseConfigured || !organization) {
    return (
      <ModuleSectionCard className="p-5 md:p-6">
        <WarningBox>Integrasjoner krever en innlogget organisasjon med Supabase-aktivert oppsett.</WarningBox>
      </ModuleSectionCard>
    )
  }

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <SectionHeading
        icon={<Webhook className="h-5 w-5" />}
        title="Flow-of-work — kanaler"
        description="Innkommende webhooks for Microsoft Teams eller Slack. Bruk for ukentlige mikromodul-utdrag."
      />
      <div className="mt-5 space-y-5">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ws-teams">
            Teams (incoming webhook)
          </label>
          <StandardInput
            id="ws-teams"
            value={teamsDisplay}
            onChange={(e) => setTeamsUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1.5 font-mono text-xs"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ws-slack">
            Slack (incoming webhook)
          </label>
          <StandardInput
            id="ws-slack"
            value={slackDisplay}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/…"
            className="mt-1.5 font-mono text-xs"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ws-generic">
            Generisk HTTPS-endpoint
          </label>
          <StandardInput
            id="ws-generic"
            value={genericDisplay}
            onChange={(e) => setGenericUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1.5 font-mono text-xs"
          />
        </div>
      </div>
      {flowSaveError ? (
        <div className="mt-4">
          <WarningBox>{flowSaveError}</WarningBox>
        </div>
      ) : null}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        <p className="text-xs text-neutral-500">
          Auto-tildelinger fra HMS bruker RPC{' '}
          <code className="rounded bg-neutral-100 px-1">learning_assign_module</code>.
        </p>
        <Button
          type="button"
          variant="primary"
          icon={<Save className="h-4 w-4" />}
          onClick={() => {
            void (async () => {
              setFlowMsg(null)
              setFlowSaveError(null)
              const r = await saveFlowSettings({
                teamsWebhookUrl: teamsDisplay.trim() || null,
                slackWebhookUrl: slackDisplay.trim() || null,
                genericWebhookUrl: genericDisplay.trim() || null,
              })
              if (r.ok) setFlowMsg('Lagret.')
              else setFlowSaveError(r.error)
            })()
          }}
        >
          Lagre webhooks
        </Button>
      </div>
      {flowMsg ? (
        <p className="mt-3 text-xs text-emerald-700" role="status">
          {flowMsg}
        </p>
      ) : null}
    </ModuleSectionCard>
  )
}

// ── Eksport & personvern ────────────────────────────────────────────────────
function EksportSection() {
  const {
    courses,
    exportJson,
    importFromJson,
    exportCourseJson,
    exportProgressSliceJson,
    exportCertificatesSliceJson,
    importPartialJson,
  } = useLearning()
  const fileRefFull = useRef<HTMLInputElement>(null)
  const fileRefPartial = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleExportFull() {
    const json = exportJson()
    downloadJson(`atics-learning-export-${new Date().toISOString().slice(0, 10)}.json`, json)
  }

  function handleFileFull(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setImportMsg(null)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = importFromJson(text)
      if (result.ok) setImportMsg({ type: 'ok', text: 'Full tilstand importert.' })
      else setImportMsg({ type: 'err', text: result.error })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleFilePartial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setImportMsg(null)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = importPartialJson(text)
      if (result.ok)
        setImportMsg({ type: 'ok', text: 'Delvis data flettet inn (kurs / fremdrift / sertifikater).' })
      else setImportMsg({ type: 'err', text: result.error })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <SectionHeading
          icon={<Download className="h-5 w-5" />}
          title="Eksport og import (JSON)"
          description="Full sikkerhetskopi, eller del-eksport per kurs / fremdrift / sertifikater."
        />
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportFull}
          >
            Last ned alt
          </Button>
          <Button
            type="button"
            variant="secondary"
            icon={<Upload className="h-4 w-4" />}
            onClick={() => fileRefFull.current?.click()}
          >
            Importer alt
          </Button>
          <input
            ref={fileRefFull}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileFull}
          />
        </div>

        <div className="mt-6 space-y-5 border-t border-neutral-100 pt-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Per kurs</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Delvise filer flettes inn: eksisterende kurs med samme ID erstattes; fremdrift og sertifikater
              merges på ID.
            </p>
            <ul className="mt-3 space-y-2">
              {courses.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200/80 bg-white px-4 py-3 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-neutral-900">{c.title}</span>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Download className="h-3.5 w-3.5" />}
                      onClick={() => {
                        const json = exportCourseJson(c.id)
                        if (!json) return
                        downloadJson(`atics-course-${slugTitle(c.title)}-${c.id.slice(0, 8)}.json`, json)
                      }}
                    >
                      Eksporter
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Upload className="h-3.5 w-3.5" />}
                      onClick={() => fileRefPartial.current?.click()}
                    >
                      Importer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {courses.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Ingen kurs ennå.</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-white p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Fremdrift</h3>
              <p className="text-xs text-neutral-500">Alle CourseProgress-rader i én fil.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={() =>
                    downloadJson(
                      `atics-learning-progress-${new Date().toISOString().slice(0, 10)}.json`,
                      exportProgressSliceJson(),
                    )
                  }
                >
                  Eksporter
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="h-3.5 w-3.5" />}
                  onClick={() => fileRefPartial.current?.click()}
                >
                  Importer
                </Button>
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-white p-4">
              <h3 className="text-sm font-semibold text-neutral-900">Sertifikater</h3>
              <p className="text-xs text-neutral-500">Alle utstedte sertifikater i én fil.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={() =>
                    downloadJson(
                      `atics-learning-certificates-${new Date().toISOString().slice(0, 10)}.json`,
                      exportCertificatesSliceJson(),
                    )
                  }
                >
                  Eksporter
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="h-3.5 w-3.5" />}
                  onClick={() => fileRefPartial.current?.click()}
                >
                  Importer
                </Button>
              </div>
            </div>
          </div>
          <input
            ref={fileRefPartial}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFilePartial}
          />
        </div>

        {importMsg ? (
          importMsg.type === 'err' ? (
            <div className="mt-4">
              <WarningBox>{importMsg.text}</WarningBox>
            </div>
          ) : (
            <p className="mt-4 text-sm text-emerald-700" role="status">
              {importMsg.text}
            </p>
          )
        ) : null}
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <SectionHeading
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Personvern og databehandling"
          description="Klarert e-læring samler inn opplæringsdata for å dokumentere opplæring etter IK-forskriften § 5 og AML."
        />
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Rettslig grunnlag</dt>
            <dd className="mt-2 text-neutral-700">
              GDPR art. 6(1)(c) — rettslig forpliktelse (AML, IK-forskriften), supplert av (f) berettiget interesse.
            </dd>
          </div>
          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Lagringstid</dt>
            <dd className="mt-2 text-neutral-700">
              Opplæringsdata lagres så lenge arbeidsforholdet varer. Sertifikater bevares som dokumentasjon.
            </dd>
          </div>
          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Rettigheter</dt>
            <dd className="mt-2 text-neutral-700">
              Innsyn, retting og sletting på forespørsel — kontakt dataansvarlig i organisasjonen.
            </dd>
          </div>
          <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Sikkerhet</dt>
            <dd className="mt-2 text-neutral-700">
              Row-level security per organisasjon. Kursinnhold og progresjon er kryptert i hvile (Supabase).
            </dd>
          </div>
        </dl>
      </ModuleSectionCard>
    </div>
  )
}
