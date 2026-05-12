// RevisionLog — viser versjons­historikk fra wiki_revisions.
//
// Compliance-formål: dokumenter må kunne vise sin egen revisjons­logg
// ved tilsyn for å bevise vedlikehold (IK-f § 5 nr. 7, 8).

import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type Props = {
  pageId: string
  maxEntries?: number
}

type RevisionRow = {
  version: number
  created_at: string
  author_name: string | null
  change_summary: string | null
}

export function RevisionLog({ pageId, maxEntries = 5 }: Props) {
  const { supabase } = useOrgSetupContext()
  const [rows, setRows] = useState<RevisionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !pageId) return
    void supabase
      .from('wiki_revisions')
      .select('version, created_at, author_name, change_summary')
      .eq('page_id', pageId)
      .order('version', { ascending: false })
      .limit(maxEntries)
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        else setRows((data ?? []) as RevisionRow[])
      })
  }, [supabase, pageId, maxEntries])

  return (
    <div className="not-prose my-4 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-800">
        <History className="h-4 w-4" />
        Versjons­historikk
      </div>
      {rows === null ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Henter…
        </div>
      ) : error ? (
        <div className="text-xs text-red-700">Kunne ikke laste: {error}</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-neutral-500">Ingen tidligere versjoner.</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-neutral-600">
            <tr>
              <th className="py-1 text-left font-medium">Versjon</th>
              <th className="py-1 text-left font-medium">Dato</th>
              <th className="py-1 text-left font-medium">Forfatter</th>
              <th className="py-1 text-left font-medium">Endring</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.version} className="border-t border-neutral-100">
                <td className="py-1.5">v{r.version}</td>
                <td className="py-1.5 text-neutral-700">{new Date(r.created_at).toLocaleDateString('nb-NO')}</td>
                <td className="py-1.5 text-neutral-700">{r.author_name ?? '—'}</td>
                <td className="py-1.5 text-neutral-700">{r.change_summary ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
