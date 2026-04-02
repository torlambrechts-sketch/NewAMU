import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DocumentSettings() {
  const { exportJson, importJson, resetDemo } = useDocumentCenter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <nav className="text-sm">
        <Link to="/documents" className="inline-flex items-center gap-1 text-emerald-800 hover:underline">
          <ArrowLeft className="size-4" /> Tilbake til bibliotek
        </Link>
      </nav>

      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Dokumentsenter — innstillinger</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Data lagres i nettleseren (demo). Eksport/import for sikkerhetskopi og mellom miljøer.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Eksport / import</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              downloadJson(`atics-documents-${new Date().toISOString().slice(0, 10)}.json`, exportJson())
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#2D403A] px-4 py-2 text-sm font-medium text-white"
          >
            <Download className="size-4" />
            Last ned JSON
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A]"
          >
            <Upload className="size-4" />
            Importer JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              setMsg(null)
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                const text = typeof reader.result === 'string' ? reader.result : ''
                const r = importJson(text)
                setMsg(r.ok ? { type: 'ok', text: 'Importert.' } : { type: 'err', text: r.error })
              }
              reader.readAsText(file)
              e.target.value = ''
            }}
          />
        </div>
        {msg ? (
          <p className={`mt-3 text-sm ${msg.type === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}>{msg.text}</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Tilbakestill til eksempeldata? Egen data slettes i denne nettleseren.')) {
              resetDemo()
              setMsg({ type: 'ok', text: 'Tilbakestilt.' })
            }
          }}
          className="mt-4 text-sm text-red-700 underline"
        >
          Tilbakestill demo
        </button>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
        <h2 className="font-semibold text-[#2D403A]">Fase 2 (levert i appen)</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-neutral-800">
          <li>
            Wiki-lenker <code className="rounded bg-white/80 px-1">[[Dokumenttittel]]</code>, variabler <code className="rounded bg-white/80 px-1">{'{{nøkkel}}'}</code>, sjekkliste før publisering
          </li>
          <li>Flertrinns godkjenning (demo) og attestert publisering</li>
          <li>Fulltekstsøk, kravmatrise, lesebekreftelse, modullenker, kommentarer</li>
        </ul>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-6">
        <h2 className="font-semibold text-[#2D403A]">Veikart fase 3 (neste)</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-neutral-800">
          <li>
            <strong>BankID / avansert e-signatur</strong> og juridisk sporing utover demo-attestering
          </li>
          <li>
            <strong>Automatiske påminnelser</strong> (e-post/push) for revisjonsfrist og lesebekreftelse
          </li>
          <li>
            <strong>Dyp integrasjon</strong>: opprett dokument fra ROS/varsling med forhåndsutfylt kobling og tidsstempling i tredjeparts logg
          </li>
          <li>
            <strong>Kobling til læringsmodulen</strong>: obligatorisk kurs basert på dokumentversjon
          </li>
          <li>
            <strong>Granulære rettigheter</strong> (RBAC), tenant og SSO
          </li>
        </ul>
      </section>
    </div>
  )
}
