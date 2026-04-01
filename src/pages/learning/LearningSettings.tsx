import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'

export function LearningSettings() {
  const { resetDemo, exportJson, importFromJson } = useLearning()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function handleExport() {
    const json = exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atics-learning-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setImportMsg(null)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = importFromJson(text)
      if (result.ok) {
        setImportMsg({ type: 'ok', text: 'Data importert. Siden bruker nå den importerte tilstanden.' })
      } else {
        setImportMsg({ type: 'err', text: result.error })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Settings</h1>
        <p className="mt-2 text-sm text-neutral-600">Learning data is stored in localStorage for this demo.</p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Export / import (JSON)</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Last ned alle kurs, fremdrift og sertifikater som én JSON-fil, eller erstatt lokale data ved å importere en
          tidligere eksport.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: PIN_GREEN }}
          >
            <Download className="size-4" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A] hover:bg-neutral-50"
          >
            <Upload className="size-4" />
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFile}
          />
        </div>
        {importMsg ? (
          <p
            className={`mt-3 text-sm ${importMsg.type === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}
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
