import { Link } from 'react-router-dom'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'
import { DOCUMENTATION_MASTER_CHECKLIST } from '../../data/documentationMasterChecklist'
import { slugifyTitle } from '../../lib/wikiSlug'

function priorityClass(p: string): string {
  if (p === 'påkrevd') return 'bg-red-100 text-red-900'
  if (p === 'anbefalt') return 'bg-amber-100 text-amber-900'
  return 'bg-neutral-100 text-neutral-700'
}

export function DocumentChecklist() {
  const { documents, masterChecklistProgress, setMasterChecklistItem } = useDocumentCenter()

  const categories = [...new Set(DOCUMENTATION_MASTER_CHECKLIST.map((x) => x.category))]

  return (
    <div className="space-y-8">
      <div>
        <Link to="/documents" className="text-sm text-emerald-800 hover:underline">
          ← Bibliotek
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-[#2D403A]">Dokumentasjonsplan</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Sjekkliste over typiske og påkrevde dokumenter i norsk arbeidsliv (illustrativ). Kryss av når dere har et
          dokument i biblioteket eller annet godkjent arkiv. Kobling til konkrete dokumenter gjør du manuelt ved å
          sammenligne tittel. Ikke juridisk rådgivning — verifiser mot{' '}
          <a href="https://lovdata.no" className="text-emerald-800 underline" target="_blank" rel="noreferrer">
            lovdata.no
          </a>
          .
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#2D403A]">Fremdrift</h2>
        <p className="mt-1 text-sm text-neutral-600">
          {
            DOCUMENTATION_MASTER_CHECKLIST.filter((i) => masterChecklistProgress[i.id]).length
          }{' '}
          av {DOCUMENTATION_MASTER_CHECKLIST.length} punkter markert som dekket.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{
              width: `${(DOCUMENTATION_MASTER_CHECKLIST.filter((i) => masterChecklistProgress[i.id]).length / DOCUMENTATION_MASTER_CHECKLIST.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {categories.map((cat) => (
        <section key={cat} className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
            <h2 className="font-serif text-lg font-semibold text-[#2D403A]">{cat}</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {DOCUMENTATION_MASTER_CHECKLIST.filter((i) => i.category === cat).map((item) => {
              const done = masterChecklistProgress[item.id] ?? false
              const matchDoc = documents.find(
                (d) =>
                  d.title.toLowerCase().includes(item.title.slice(0, 12).toLowerCase()) ||
                  item.title.toLowerCase().includes(d.title.toLowerCase().slice(0, 8)),
              )
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-4 px-4 py-4">
                  <label className="flex shrink-0 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => setMasterChecklistItem(item.id, e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-[#2D403A]">{item.title}</span>
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${priorityClass(item.priority)}`}>
                        {item.priority}
                      </span>
                      <p className="mt-1 text-sm text-neutral-600">{item.suggestion}</p>
                      {item.lawHint ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          <span className="font-medium">Hint:</span> {item.lawHint}
                        </p>
                      ) : null}
                    </span>
                  </label>
                  <div className="min-w-[200px] flex-1 text-sm">
                    <span className="text-xs font-medium text-neutral-500">Mulig treff i bibliotek</span>
                    {matchDoc ? (
                      <div className="mt-1">
                        <Link to={`/documents/${matchDoc.id}`} className="text-emerald-800 underline">
                          {matchDoc.title}
                        </Link>
                        <span className="ml-2 text-xs text-neutral-500">({matchDoc.workflowStatus})</span>
                      </div>
                    ) : (
                      <p className="mt-1 text-neutral-500">
                        Ingen automatisk treff —{' '}
                        <Link to="/documents/templates" className="text-emerald-800 underline">
                          opprett fra mal
                        </Link>{' '}
                        eller legg inn eksternt.
                      </p>
                    )}
                    <p className="mt-2 text-xs text-neutral-400">
                      Wiki: <code className="rounded bg-neutral-100 px-1">[[{item.title}]]</code> → slug{' '}
                      <code className="rounded bg-neutral-100 px-1">{slugifyTitle(item.title)}</code>
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
