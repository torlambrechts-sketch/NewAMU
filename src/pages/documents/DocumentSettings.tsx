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

      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-6">
        <h2 className="font-semibold text-[#2D403A]">Fremtidig veikart (fase 2–3)</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Følgende er planlagt utover dagens fase 1 (bibliotek, maler, versjoner, arbeidsflyt, revisjonslogg):
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-neutral-800">
          <li>
            <strong>Wiki</strong>: interne lenker <code className="rounded bg-white/80 px-1">[[Side]]</code>, innholdsfortegnelse, kommentarer per avsnitt, fulltekstsøk i publisert innhold.
          </li>
          <li>
            <strong>Avanserte maler</strong>: variabler (f.eks. <code className="rounded bg-white/80 px-1">{'{{virksomhet}}'}</code>), obligatoriske sjekkpunkter før publisering, bransjepakker (HMS, AMU, GDPR).
          </li>
          <li>
            <strong>Godkjenning</strong>: flertrinns godkjenningsflyt, roller (HMS-leder, daglig leder), elektronisk signatur (BankID/Signicat) der påkrevd.
          </li>
          <li>
            <strong>Lesekvittering</strong>: «må lest innen» for roller, kobling til opplæringsmodulen.
          </li>
          <li>
            <strong>Integrasjon</strong>: stabile lenker fra internkontroll, ROS og AMU-møter til gjeldende dokumentversjon; varslingshendelser i logg.
          </li>
          <li>
            <strong>Etterlevelse</strong>: kravmatrise (dokument ↔ lovkrav), årlig påminnelse om revisjon og re-godkjenning.
          </li>
        </ul>
      </section>
    </div>
  )
}
