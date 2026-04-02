import { Link } from 'react-router-dom'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'
import { DEFAULT_COMPLIANCE_REQUIREMENTS } from '../../data/complianceRequirements'

export function DocumentCompliance() {
  const { documents, updateDocument } = useDocumentCenter()

  return (
    <div className="space-y-6">
      <Link to="/documents" className="text-sm text-emerald-800 hover:underline">
        ← Bibliotek
      </Link>
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Kravmatrise</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Kobling mellom illustrative krav og dokumenter. Ikke juridisk rådgivning — verifiser mot lovdata.no.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <th className="px-3 py-2 font-medium">Krav</th>
              <th className="px-3 py-2 font-medium">Henvisning</th>
              {documents.map((d) => (
                <th key={d.id} className="max-w-[140px] px-2 py-2 text-xs font-medium">
                  <Link to={`/documents/${d.id}`} className="line-clamp-2 text-emerald-800 hover:underline">
                    {d.title}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEFAULT_COMPLIANCE_REQUIREMENTS.map((req) => (
              <tr key={req.id} className="border-b border-neutral-50">
                <td className="px-3 py-2 align-top">{req.label}</td>
                <td className="px-3 py-2 align-top text-xs text-neutral-500">{req.lawRef ?? '—'}</td>
                {documents.map((d) => {
                  const link = d.complianceLinks.find((c) => c.requirementId === req.id)
                  return (
                    <td key={d.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={link?.satisfied ?? false}
                        onChange={(e) => {
                          const next = d.complianceLinks.filter((c) => c.requirementId !== req.id)
                          next.push({ requirementId: req.id, satisfied: e.target.checked })
                          updateDocument(d.id, { complianceLinks: next })
                        }}
                        aria-label={`${req.label} for ${d.title}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
