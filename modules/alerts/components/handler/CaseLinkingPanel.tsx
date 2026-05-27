// CaseLinkingPanel — link cases parent/child. Shows existing links + a
// search input to add a new link. Visibility toggle controls whether the
// reporter learns of the relationship.

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  supabase: SupabaseClient
  caseId: string
  orgId: string
  lang: 'nb' | 'en'
}

type LinkRow = {
  parent_id: string
  child_id: string
  visibility: 'committee' | 'reporter'
  reason: string | null
  created_at: string
}

type CaseSummary = {
  id: string
  status: string
  received_at: string
}

export function CaseLinkingPanel({ supabase, caseId, orgId, lang }: Props) {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [searchResults, setSearchResults] = useState<CaseSummary[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkAs, setLinkAs] = useState<'parent' | 'child'>('child')
  const [reason, setReason] = useState('')
  const [visibility, setVisibility] = useState<'committee' | 'reporter'>('committee')

  async function load() {
    const { data } = await supabase
      .from('alert_case_link')
      .select('*')
      .or(`parent_id.eq.${caseId},child_id.eq.${caseId}`)
    setLinks((data ?? []) as LinkRow[])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  async function search() {
    if (query.length < 8) {
      setSearchResults([])
      return
    }
    const { data } = await supabase
      .from('alert_cases')
      .select('id, status, received_at')
      .ilike('id', `%${query.slice(0, 8)}%`)
      .neq('id', caseId)
      .limit(10)
    setSearchResults((data ?? []) as CaseSummary[])
  }

  async function addLink(otherCaseId: string) {
    setBusy(true)
    const parent = linkAs === 'child' ? otherCaseId : caseId
    const child = linkAs === 'child' ? caseId : otherCaseId
    const { data: userRow } = await supabase.auth.getUser()
    const { error } = await supabase.from('alert_case_link').insert({
      parent_id: parent,
      child_id: child,
      organization_id: orgId,
      linked_by: userRow.user?.id ?? null,
      visibility,
      reason: reason || null,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setQuery('')
    setSearchResults([])
    setReason('')
    await load()
  }

  const parents = useMemo(() => links.filter((l) => l.child_id === caseId), [links, caseId])
  const children = useMemo(() => links.filter((l) => l.parent_id === caseId), [links, caseId])

  return (
    <section className="space-y-3 rounded border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Koblede saker' : 'Linked cases'}</h3>
      {parents.length > 0 && (
        <div className="text-xs">
          <div className="font-semibold">{lang === 'nb' ? 'Foreldresaker' : 'Parent cases'}</div>
          {parents.map((l) => (
            <div key={l.parent_id} className="font-mono">
              {l.parent_id.slice(0, 8)}… ({l.visibility})
            </div>
          ))}
        </div>
      )}
      {children.length > 0 && (
        <div className="text-xs">
          <div className="font-semibold">{lang === 'nb' ? 'Barnesaker' : 'Child cases'}</div>
          {children.map((l) => (
            <div key={l.child_id} className="font-mono">
              {l.child_id.slice(0, 8)}… ({l.visibility})
            </div>
          ))}
        </div>
      )}
      <div className="rounded border border-dashed border-neutral-300 p-3 space-y-2 text-xs">
        <div className="font-semibold">{lang === 'nb' ? 'Legg til kobling' : 'Add link'}</div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            void search()
          }}
          placeholder={lang === 'nb' ? 'Saks-ID (første 8 tegn)' : 'Case ID (first 8 chars)'}
          className="block w-full rounded border border-neutral-300 px-2 py-1"
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <input type="radio" checked={linkAs === 'child'} onChange={() => setLinkAs('child')} />
            {lang === 'nb' ? 'Denne er barnesak' : 'This is child'}
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={linkAs === 'parent'} onChange={() => setLinkAs('parent')} />
            {lang === 'nb' ? 'Denne er foreldresak' : 'This is parent'}
          </label>
        </div>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={visibility === 'reporter'}
            onChange={(e) => setVisibility(e.target.checked ? 'reporter' : 'committee')}
          />
          {lang === 'nb' ? 'Vis kobling for varsler' : 'Show link to reporter'}
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={lang === 'nb' ? 'Begrunnelse' : 'Reason'}
          className="block w-full rounded border border-neutral-300 px-2 py-1"
        />
        {searchResults.length > 0 && (
          <div className="space-y-1">
            {searchResults.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => void addLink(s.id)}
                disabled={busy}
                className="block w-full rounded border border-neutral-300 px-2 py-1 text-left hover:bg-neutral-50"
              >
                <span className="font-mono">{s.id.slice(0, 8)}…</span> · {s.status} · {new Date(s.received_at).toLocaleDateString()}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
