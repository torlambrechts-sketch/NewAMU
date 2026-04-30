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

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
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
  const { supabaseConfigured, organization, can, user, orgProfiles } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const {
    resetDemo,
    exportJson,
    importFromJson,
    courses,
    certificates,
    certificationRenewals,
    exportCourseJson,
    exportProgressSliceJson,
    exportCertificatesSliceJson,
    importPartialJson,
    systemCourseSettings,
    setSystemCourseEnabled,
    forkSystemCourse,
    flowSettings,
    saveFlowSettings,
    deleteUserLearningData,
  } = useLearning()
  const fileRefFull = useRef<HTMLInputElement>(null)
  const fileRefPartial = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [teamsUrl, setTeamsUrl] = useState<string | null>(null)
  const [slackUrl, setSlackUrl] = useState<string | null>(null)
  const [genericUrl, setGenericUrl] = useState<string | null>(null)
  const [flowMsg, setFlowMsg] = useState<string | null>(null)
  const [gdprTarget, setGdprTarget] = useState('')
  const [gdprMsg, setGdprMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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

  function exportInspectionCsv() {
    const rows: string[][] = [['employee', 'course', 'completed_at', 'course_version', 'expires_at', 'status']]
    for (const cert of certificates) {
      const r = certificationRenewals.find(
        (x) =>
          (x.certificateId && x.certificateId === cert.id) ||
          (!x.certificateId && x.courseId === cert.courseId && x.userId === cert.userId),
      )
      let expiresAt = 'Ingen utløpsdato'
      let status = 'Gyldig'
      if (r) {
        expiresAt = r.expiresAt
        if (r.status === 'expired') status = 'Utløpt / fornyelse'
        else if (r.status === 'expiring_soon') status = 'Utløper snart'
        else if (r.status === 'compliant') status = 'Gyldig'
        else if (r.status === 'renewed') status = 'Fornyet'
      }
      rows.push([
        cert.learnerName,
        cert.courseTitle,
        cert.issuedAt,
        String(cert.courseVersion ?? ''),
        expiresAt,
        status,
      ])
    }
    const csv = rows.map((line) => line.map((c) => csvEscapeCell(String(c))).join(',')).join('\r\n')
    downloadCsv(`klarert-tilsynseksport-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  function resolveGdprUserId(input: string): string | null {
    const t = input.trim()
    if (!t) return null
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (uuidRe.test(t)) return t
    const low = t.toLowerCase()
    const hit = orgProfiles.find(
      (p) =>
        p.email?.toLowerCase() === low ||
        p.display_name?.toLowerCase().includes(low) ||
        p.email?.toLowerCase().includes(low),
    )
    return hit?.id ?? null
  }

  async function runGdprDelete(targetUserId: string) {
    setGdprMsg(null)
    const r = await deleteUserLearningData(targetUserId)
    if (r.ok) setGdprMsg({ type: 'ok', text: 'Opplæringsdata er slettet.' })
    else setGdprMsg({ type: 'err', text: r.error })
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
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Settings</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {supabaseConfigured && organization
            ? 'Kurs, fremdrift og sertifikater lagres i databasen for organisasjonen din.'
            : 'Uten innlogget organisasjon lagres e-læringsdata lokalt i nettleseren (demo).'}
        </p>
      </div>

      {supabaseConfigured && organization && canManage && systemCourseSettings.length > 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Systemkurs for organisasjonen</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Slå av kurs du ikke vil tilby. «Kopier som mal» lager et eget utkast du kan redigere og publisere.
          </p>
          <ul className="mt-4 space-y-3">
            {systemCourseSettings.map((s) => (
              <li
                key={s.systemCourseId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-[#FCF8F0]/80 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#2D403A]">{s.title}</p>
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
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#2D403A] hover:bg-neutral-50"
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
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Flow-of-work & kanaler</h2>
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
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Slack (incoming webhook)</label>
              <input
                value={slackDisplay}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/..."
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Generisk HTTPS-endpoint</label>
              <input
                value={genericDisplay}
                onChange={(e) => setGenericUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-xs"
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

      {supabaseConfigured && organization && canManage ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Arbeidstilsynet — tilsynseksport</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Inneholder alle gjennomførte kurs, sertifikatversjon og utløpsstatus. Klar for Arbeidstilsynet-inspeksjon.
          </p>
          <button
            type="button"
            onClick={() => exportInspectionCsv()}
            className="mt-4 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-neutral-50"
          >
            Last ned tilsynseksport (CSV)
          </button>
        </div>
      ) : null}

      {supabaseConfigured && organization && canManage ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Slett brukerdata (GDPR)</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Sletter for valgt bruker i denne organisasjonen: fremdrift, sertifikater, quiz-gjentakelser, ILT-RSVPer og
            tilknyttede fornyelsesrader. Krever rettigheten «E-learning — administrere».
          </p>
          <label className="mt-3 block text-xs font-medium text-neutral-500">Bruker-ID eller e-post</label>
          <input
            value={gdprTarget}
            onChange={(e) => setGdprTarget(e.target.value)}
            placeholder="uuid eller e-post"
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100"
            onClick={() => {
              const uid = resolveGdprUserId(gdprTarget)
              if (!uid) {
                setGdprMsg({ type: 'err', text: 'Fant ikke bruker. Kontroller ID eller e-post.' })
                return
              }
              if (
                !confirm(
                  `Slett alle opplæringsdata for denne brukeren?\n\nDette fjerner fremdrift, sertifikater, quiz-gjentakelser og ILT-RSVPer for bruker ${uid}.`,
                )
              ) {
                return
              }
              void runGdprDelete(uid)
            }}
          >
            Slett alle opplæringsdata for denne brukeren
          </button>
          {gdprMsg ? (
            <p className={`mt-2 text-sm ${gdprMsg.type === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}>
              {gdprMsg.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {supabaseConfigured && organization && !canManage && user?.id ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-[#2D403A]">Mine opplæringsdata</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Du kan be om sletting av dine egne opplæringsdata (fremdrift, sertifikater, quiz-gjentakelser, ILT-påmeldinger)
            i denne organisasjonen.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-neutral-50"
            onClick={() => {
              if (
                !confirm(
                  'Slette alle dine opplæringsdata i denne organisasjonen? Dette kan ikke angres.',
                )
              ) {
                return
              }
              void (async () => {
                setGdprMsg(null)
                const r = await deleteUserLearningData(user.id)
                if (r.ok) setGdprMsg({ type: 'ok', text: 'Dine opplæringsdata er slettet.' })
                else setGdprMsg({ type: 'err', text: r.error })
              })()
            }}
          >
            Be om sletting av mine opplæringsdata
          </button>
          {gdprMsg ? (
            <p className={`mt-2 text-sm ${gdprMsg.type === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}>
              {gdprMsg.text}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Export / import (JSON)</h2>
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
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-neutral-50"
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

        <details className="group mt-6 rounded-lg border border-neutral-200 bg-[#FCF8F0]/80">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[#2D403A] marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Per kurs og andre deler</span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-6 border-t border-neutral-200 px-4 pb-4 pt-2">
            <p className="text-xs text-neutral-500">
              Delvise filer flettes inn: eksisterende kurs med samme ID erstattes; fremdrift og sertifikater merges på
              ID.
            </p>

            <div>
              <h3 className="text-sm font-semibold text-[#2D403A]">Kurs</h3>
              <ul className="mt-2 space-y-2">
                {courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-white px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 font-medium text-neutral-800">{c.title}</span>
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
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-[#2D403A] hover:bg-neutral-50"
                      >
                        <Download className="size-3.5" />
                        Export
                      </button>
                      <button
                        type="button"
                        onClick={() => fileRefPartial.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-[#2D403A] hover:bg-neutral-50"
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

            <div className="rounded-lg border border-neutral-100 bg-white p-3">
              <h3 className="text-sm font-semibold text-[#2D403A]">Fremdrift (alle kurs)</h3>
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
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#2D403A] hover:bg-neutral-50"
                >
                  <Upload className="size-3.5" />
                  Import fremdrift
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-100 bg-white p-3">
              <h3 className="text-sm font-semibold text-[#2D403A]">Sertifikater</h3>
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
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#2D403A] hover:bg-neutral-50"
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

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Reset demo data</h2>
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
          Reset learning data
        </button>
      </div>
    </div>
  )
}
