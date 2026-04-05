import { useRef, useState } from 'react'
import { ChevronDown, Download, Upload } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
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
  const {
    resetDemo,
    exportJson,
    importFromJson,
    courses,
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
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Settings</h1>
        <p className="mt-2 text-sm text-neutral-600">Learning data is stored in localStorage for this demo.</p>
      </div>

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
          Clears courses, progress, and certificates and restores the innebygde demo-kursene (bl.a. «Safety 101» og
          «Sikkerhet for ledere»).
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
