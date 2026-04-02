import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'

export function DocumentTemplates() {
  const navigate = useNavigate()
  const { templates, createFromTemplate } = useDocumentCenter()
  const [titleByTpl, setTitleByTpl] = useState<Record<string, string>>({})

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="text-sm">
        <Link to="/documents" className="inline-flex items-center gap-1 text-emerald-800 hover:underline">
          <ArrowLeft className="size-4" /> Tilbake til bibliotek
        </Link>
      </nav>
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Opprett fra mal</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Malene er utgangspunkt — tilpass innhold og verifiser mot gjeldende regelverk.
        </p>
      </div>
      <ul className="space-y-4">
        {templates.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold text-[#2D403A]">{t.title}</h2>
            <p className="mt-1 text-sm text-neutral-600">{t.description}</p>
            {t.lawRef ? (
              <p className="mt-2 text-xs text-neutral-500">
                <span className="font-medium">Henvisning:</span> {t.lawRef}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[200px] text-xs text-neutral-500">
                Tittel (valgfritt)
                <input
                  value={titleByTpl[t.id] ?? ''}
                  onChange={(e) => setTitleByTpl((s) => ({ ...s, [t.id]: e.target.value }))}
                  placeholder={t.title}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const doc = createFromTemplate(t.id, titleByTpl[t.id])
                  if (doc) navigate(`/documents/${doc.id}`)
                }}
                className="rounded-lg bg-[#2D403A] px-4 py-2 text-sm font-medium text-white"
              >
                Bruk mal
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
