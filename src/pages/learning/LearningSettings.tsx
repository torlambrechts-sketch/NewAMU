import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Copy,
  Database,
  Download,
  RefreshCcw,
  Save,
  ShieldCheck,
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
import { ModuleSectionCard } from '../../components/module'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'

const SERIF_FAMILY = "'Libre Baskerville', Georgia, serif"

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

function SectionHeading({ title, description, icon }: { title: string; description?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#e7efe9', color: '#1a3d32' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-neutral-900" style={{ fontFamily: SERIF_FAMILY }}>
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
      </div>
    </div>
  )
}

export function LearningSettings() {
  const navigate = useNavigate()
  const { supabaseConfigured, organization, can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const {
    resetDemo,
    exportJson,
    importFromJson,
    courses,
    exportCourseJson,
    exportProgressSliceJson,
    exportCertificatesSliceJson,
    importPartialJson,
    systemCourseSettings,
    setSystemCourseEnabled,
    forkSystemCourse,
    flowSettings,
    saveFlowSettings,
  } = useLearning()
  const fileRefFull = useRef<HTMLInputElement>(null)
  const fileRefPartial = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [teamsUrl, setTeamsUrl] = useState<string | null>(null)
  const [slackUrl, setSlackUrl] = useState<string | null>(null)
  const [genericUrl, setGenericUrl] = useState<string | null>(null)
  const [flowMsg, setFlowMsg] = useState<string | null>(null)
  const [systemCourseActionError, setSystemCourseActionError] = useState<string | null>(null)
  const [flowSaveError, setFlowSaveError] = useState<string | null>(null)

  const teamsDisplay = teamsUrl ?? flowSettings?.teamsWebhookUrl ?? ''
  const slackDisplay = slackUrl ?? flowSettings?.slackWebhookUrl ?? ''
  const genericDisplay = genericUrl ?? flowSettings?.genericWebhookUrl ?? ''

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
      if (result.ok) {
        setImportMsg({ type: 'ok', text: 'Full tilstand importert.' })
      } else {
        setImportMsg({ type: 'err', text: result.error })
      }
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
      if (result.ok) {
        setImportMsg({ type: 'ok', text: 'Delvis data flettet inn (kurs / fremdrift / sertifikater).' })
      } else {
        setImportMsg({ type: 'err', text: result.error })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <ModuleSectionCard>
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

      {supabaseConfigured && organization && canManage && systemCourseSettings.length > 0 ? (
        <ModuleSectionCard>
          <SectionHeading
            icon={<Copy className="h-5 w-5" />}
            title="Systemkurs for organisasjonen"
            description="Slå av kurs du ikke vil tilby. «Kopier som mal» lager et eget utkast du kan redigere og publisere."
          />
          {systemCourseActionError ? (
            <div className="mt-4">
              <WarningBox>{systemCourseActionError}</WarningBox>
            </div>
          ) : null}
          <ul className="mt-4 space-y-2">
            {systemCourseSettings.map((s) => (
              <li
                key={s.systemCourseId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50/40 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{s.title}</p>
                  <p className="font-mono text-xs text-neutral-500">{s.slug}</p>
                  {s.forkedCourseId ? (
                    <Link
                      to={`/learning/courses/${s.forkedCourseId}`}
                      className="mt-1 inline-block text-xs font-medium text-[#1a3d32] underline"
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
                          setSystemCourseActionError(null)
                          const r = await setSystemCourseEnabled(s.systemCourseId, v)
                          if (!r.ok) setSystemCourseActionError(r.error)
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
                        setSystemCourseActionError(null)
                        const r = await forkSystemCourse(s.systemCourseId)
                        if (r.ok && r.newCourseId) {
                          navigate(`/learning/courses/${r.newCourseId}`)
                        } else if (!r.ok) {
                          setSystemCourseActionError(r.error)
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
        </ModuleSectionCard>
      ) : null}

      {supabaseConfigured && organization && canManage ? (
        <ModuleSectionCard>
          <SectionHeading
            icon={<Webhook className="h-5 w-5" />}
            title="Flow-of-work — kanaler"
            description="Innkommende webhooks for Microsoft Teams eller Slack. Bruk for ukentlige mikromodul-utdrag."
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>
                Teams (incoming webhook)
              </label>
              <StandardInput
                value={teamsDisplay}
                onChange={(e) => setTeamsUrl(e.target.value)}
                placeholder="https://…"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>
                Slack (incoming webhook)
              </label>
              <StandardInput
                value={slackDisplay}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/…"
                className="font-mono text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className={WPSTD_FORM_FIELD_LABEL}>
                Generisk HTTPS-endpoint
              </label>
              <StandardInput
                value={genericDisplay}
                onChange={(e) => setGenericUrl(e.target.value)}
                placeholder="https://…"
                className="font-mono text-xs"
              />
            </div>
          </div>
          {flowSaveError ? (
            <div className="mt-3">
              <WarningBox>{flowSaveError}</WarningBox>
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <p className="text-xs text-neutral-500">
              Auto-tildelinger fra HMS bruker RPC{' '}
              <code className="rounded bg-neutral-100 px-1">learning_assign_module</code>.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<Save className="h-3.5 w-3.5" />}
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
          {flowMsg ? <p className="mt-2 text-xs text-emerald-700">{flowMsg}</p> : null}
        </ModuleSectionCard>
      ) : null}

      <ModuleSectionCard>
        <SectionHeading
          icon={<Download className="h-5 w-5" />}
          title="Eksport og import (JSON)"
          description="Full sikkerhetskopi, eller del-eksport per kurs / fremdrift / sertifikater."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={handleExportFull}
          >
            Last ned alt
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Upload className="h-3.5 w-3.5" />}
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

        <details className="group mt-5 rounded-md border border-neutral-200 bg-neutral-50/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-neutral-800 marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Per kurs og andre deler</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-neutral-200 px-4 pb-4 pt-3">
            <p className="text-xs text-neutral-500">
              Delvise filer flettes inn: eksisterende kurs med samme ID erstattes; fremdrift og sertifikater merges på ID.
            </p>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Kurs</h3>
              <ul className="mt-2 space-y-1.5">
                {courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium text-neutral-900">{c.title}</span>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={<Download className="h-3 w-3" />}
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
                        icon={<Upload className="h-3 w-3" />}
                        onClick={() => fileRefPartial.current?.click()}
                      >
                        Importer
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {courses.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">Ingen kurs ennå.</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-neutral-900">Fremdrift</h3>
                <p className="mt-1 text-xs text-neutral-500">Alle CourseProgress-rader i én fil.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<Download className="h-3 w-3" />}
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
                    icon={<Upload className="h-3 w-3" />}
                    onClick={() => fileRefPartial.current?.click()}
                  >
                    Importer
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-neutral-900">Sertifikater</h3>
                <p className="mt-1 text-xs text-neutral-500">Alle utstedte sertifikater i én fil.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<Download className="h-3 w-3" />}
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
                    icon={<Upload className="h-3 w-3" />}
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
        </details>

        {importMsg ? (
          <p
            className={`mt-4 text-sm ${importMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
            role="status"
          >
            {importMsg.text}
          </p>
        ) : null}
      </ModuleSectionCard>

      <ModuleSectionCard>
        <SectionHeading
          icon={<RefreshCcw className="h-5 w-5" />}
          title="Tilbakestill demodata"
          description="Sletter kurs, fremdrift og sertifikater i denne nettleseren og gjenoppretter demodata («Sikkerhet 101»)."
        />
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button
            type="button"
            variant="danger"
            size="sm"
            icon={<RefreshCcw className="h-3.5 w-3.5" />}
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

      <ModuleSectionCard>
        <SectionHeading
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Personvern og databehandling"
          description="Klarert e-læring samler inn opplæringsdata for å dokumentere opplæring etter IK-forskriften § 5 og AML."
        />
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Rettslig grunnlag</dt>
            <dd className="mt-1 text-neutral-700">
              GDPR art. 6(1)(c) — rettslig forpliktelse (AML, IK-forskriften), supplert av (f) berettiget interesse.
            </dd>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Lagringstid</dt>
            <dd className="mt-1 text-neutral-700">
              Opplæringsdata lagres så lenge arbeidsforholdet varer. Sertifikater bevares som dokumentasjon.
            </dd>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Rettigheter</dt>
            <dd className="mt-1 text-neutral-700">
              Innsyn, retting og sletting på forespørsel — kontakt dataansvarlig i organisasjonen.
            </dd>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50/40 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Sikkerhet</dt>
            <dd className="mt-1 text-neutral-700">
              Row-level security per organisasjon. Kursinnhold og progresjon er kryptert i hvile (Supabase).
            </dd>
          </div>
        </dl>
      </ModuleSectionCard>
    </div>
  )
}
