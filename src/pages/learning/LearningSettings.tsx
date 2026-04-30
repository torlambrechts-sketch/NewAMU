import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, Download, Upload } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'

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
  return title
    .slice(0, 40)
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'course'
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#1a3d32]">Innstillinger</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {supabaseConfigured && organization
            ? 'Kurs, fremdrift og sertifikater lagres i databasen for organisasjonen din.'
            : 'Uten innlogget organisasjon lagres e-læringsdata lokalt i nettleseren (demo).'}
        </p>
      </div>

      {supabaseConfigured && organization && canManage && systemCourseSettings.length > 0 ? (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
          <h2 className="font-semibold text-[#1a3d32]">Systemkurs for organisasjonen</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Slå av kurs du ikke vil tilby. «Kopier som mal» lager et eget utkast du kan redigere og publisere.
          </p>
          <ul className="mt-4 space-y-3">
            {systemCourseSettings.map((s) => (
              <li
                key={s.systemCourseId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#1a3d32]">{s.title}</p>
                  <p className="text-xs text-neutral-500">{s.slug}</p>
                  {s.forkedCourseId ? (
                    <Link
                      to={`/learning/courses/${s.forkedCourseId}`}
                      className="mt-1 inline-block text-xs font-medium text-emerald-800 underline"
                    >
                      Åpne tilpasset kurs (utkast)
                    </Link>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => {
                        void (async () => {
                          const r = await setSystemCourseEnabled(s.systemCourseId, e.target.checked)
                          if (!r.ok) alert(r.error)
                        })()
                      }}
                      className="rounded border-neutral-300"
                    />
                    Aktiv
                  </label>
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50"
                    onClick={() => {
                      void (async () => {
                        const r = await forkSystemCourse(s.systemCourseId)
                        if (r.ok && r.newCourseId) {
                          navigate(`/learning/courses/${r.newCourseId}`)
                        } else if (!r.ok) {
                          alert(r.error)
                        }
                      })()
                    }}
                  >
                    Kopier som mal
                  </button>
                  <Link
                    to={`/learning/courses/${s.systemCourseId}`}
                    className="text-xs font-medium text-emerald-800 underline"
                  >
                    Systemkurs
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {supabaseConfigured && organization && canManage ? (
        <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
          <h2 className="font-semibold text-[#1a3d32]">Flow-of-work & kanaler</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Legg inn innkommende webhooks for Microsoft Teams eller Slack. En planlagt jobb (eller Edge Function) kan
            sende ett mikromodul-utdrag i uken — URL lagres kryptert i produksjon anbefales.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-neutral-500">Teams (incoming webhook)</label>
              <input
                value={teamsDisplay}
                onChange={(e) => setTeamsUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-[#e3ddcc] bg-white px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Slack (incoming webhook)</label>
              <input
                value={slackDisplay}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/..."
                className="mt-1 w-full rounded-lg border border-[#e3ddcc] bg-white px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Generisk HTTPS-endpoint</label>
              <input
                value={genericDisplay}
                onChange={(e) => setGenericUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-[#e3ddcc] bg-white px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
          {flowMsg ? <p className="mt-2 text-sm text-emerald-800">{flowMsg}</p> : null}
          <button
            type="button"
            className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: PIN_GREEN }}
            onClick={() => {
              void (async () => {
                setFlowMsg(null)
                const r = await saveFlowSettings({
                  teamsWebhookUrl: teamsDisplay.trim() || null,
                  slackWebhookUrl: slackDisplay.trim() || null,
                  genericWebhookUrl: genericDisplay.trim() || null,
                })
                if (r.ok) setFlowMsg('Lagret.')
                else alert(r.error)
              })()
            }}
          >
            Lagre webhooks
          </button>
          <p className="mt-3 text-xs text-neutral-500">
            Automatiske tildelinger fra HMS bruker RPC <code className="rounded bg-neutral-100 px-1">learning_assign_module</code>{' '}
            og tabellen <code className="rounded bg-neutral-100 px-1">learning_module_assignments</code>.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
        <h2 className="font-semibold text-[#1a3d32]">Export / import (JSON)</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Full sikkerhetskopi av alt, eller åpne detaljer for å eksportere/importere per kurs, fremdrift eller
          sertifikater.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportFull}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: PIN_GREEN }}
          >
            <Download className="size-4" />
            Export all (JSON)
          </button>
          <button
            type="button"
            onClick={() => fileRefFull.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
          >
            <Upload className="size-4" />
            Import all (JSON)
          </button>
          <input
            ref={fileRefFull}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileFull}
          />
        </div>

        <details className="group mt-6 rounded-lg border border-[#e3ddcc] bg-[#fbf9f3]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[#1a3d32] marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Per kurs og andre deler</span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-6 border-t border-[#e3ddcc] px-4 pb-4 pt-2">
            <p className="text-xs text-neutral-500">
              Delvise filer flettes inn: eksisterende kurs med samme ID erstattes; fremdrift og sertifikater merges på
              ID.
            </p>

            <div>
              <h3 className="text-sm font-semibold text-[#1a3d32]">Kurs</h3>
              <ul className="mt-2 space-y-2">
                {courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 font-medium text-[#1a3d32]">{c.title}</span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const json = exportCourseJson(c.id)
                          if (!json) return
                          downloadJson(
                            `atics-course-${slugTitle(c.title)}-${c.id.slice(0, 8)}.json`,
                            json,
                          )
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-[#e3ddcc] bg-white px-2 py-1 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50"
                      >
                        <Download className="size-3.5" />
                        Export
                      </button>
                      <button
                        type="button"
                        onClick={() => fileRefPartial.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md border border-[#e3ddcc] bg-white px-2 py-1 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50"
                      >
                        <Upload className="size-3.5" />
                        Import
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {courses.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">Ingen kurs ennå.</p>
              ) : null}
            </div>

            <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-3">
              <h3 className="text-sm font-semibold text-[#1a3d32]">Fremdrift (alle kurs)</h3>
              <p className="mt-1 text-xs text-neutral-600">Alle CourseProgress-rader i én fil.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadJson(
                      `atics-learning-progress-${new Date().toISOString().slice(0, 10)}.json`,
                      exportProgressSliceJson(),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: PIN_GREEN }}
                >
                  <Download className="size-3.5" />
                  Export fremdrift
                </button>
                <button
                  type="button"
                  onClick={() => fileRefPartial.current?.click()}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50"
                >
                  <Upload className="size-3.5" />
                  Import fremdrift
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-3">
              <h3 className="text-sm font-semibold text-[#1a3d32]">Sertifikater</h3>
              <p className="mt-1 text-xs text-neutral-600">Alle utstedte sertifikater i én fil.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadJson(
                      `atics-learning-certificates-${new Date().toISOString().slice(0, 10)}.json`,
                      exportCertificatesSliceJson(),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: PIN_GREEN }}
                >
                  <Download className="size-3.5" />
                  Export sertifikater
                </button>
                <button
                  type="button"
                  onClick={() => fileRefPartial.current?.click()}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32] hover:bg-neutral-50"
                >
                  <Upload className="size-3.5" />
                  Import sertifikater
                </button>
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
            className={`mt-4 text-sm ${importMsg.type === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}
            role="status"
          >
            {importMsg.text}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-6">
        <h2 className="font-semibold text-[#1a3d32]">Tilbakestill demodata</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Clears courses, progress, and certificates and restores the seed &quot;Safety 101&quot; course.
        </p>
        <button
          type="button"
          onClick={() => {
            if (confirm('Reset all learning data in this browser?')) resetDemo()
          }}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: PIN_GREEN }}
        >
          Tilbakestill opplæringsdata
        </button>
      </div>

      <details className="rounded-lg border border-[#e3ddcc] bg-[#fbf9f3] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#1a3d32]">
          Personvern og databehandling
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#6b6f68]">
          <p>Klarert e-læring samler inn og lagrer opplæringsdata (kursfremdrift, fullføringer, sertifikater og quizsvar) for å dokumentere opplæring i henhold til IK-forskriften § 5 og arbeidsmiljølovens krav.</p>
          <p><strong className="text-[#1d1f1c]">Rettslig grunnlag:</strong> Berettiget interesse (GDPR art. 6(1)(f)) — dokumentasjon av lovpålagt opplæring.</p>
          <p><strong className="text-[#1d1f1c]">Lagringstid:</strong> Opplæringsdata oppbevares så lenge arbeidsforholdet varer, og slettes på forespørsel.</p>
          <p><strong className="text-[#1d1f1c]">Rettigheter:</strong> Du kan be om innsyn, retting eller sletting ved å kontakte dataansvarlig i din organisasjon.</p>
        </div>
      </details>
    </div>
  )
}
