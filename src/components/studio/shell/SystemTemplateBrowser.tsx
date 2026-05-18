// SystemTemplateBrowser — the actual user job: pick a system template,
// klon it, open the new copy for editing.
//
// Closes the gap the prior reviews missed: Simple-mode wizards were
// running `provision_*_baseline_for_org` (bulk-seed) instead of "clone
// this one template and let me edit it." This component does the latter.
//
// Per-scope query of the system_templates table + Klon button per row.
// Klon calls the clone_studio_template RPC server-side; on success,
// navigates to the new row's editor.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Loader2, Search } from 'lucide-react'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type SystemRow = {
  id: string
  name: string
  description: string | null
  meta_label: string | null
}

const SCOPE_TO_QUERY: Record<
  string,
  { table: string; idCol: string; nameCol: string; descCol: string; metaCol: string | null; filter: Record<string, unknown> }
> = {
  compliance: {
    table: 'compliance_checklist_templates',
    idCol: 'id', nameCol: 'name', descCol: 'description', metaCol: 'pack',
    filter: { is_system: true, is_active: true },
  },
  documents: {
    table: 'document_system_templates',
    idCol: 'id', nameCol: 'label', descCol: 'description', metaCol: 'category',
    filter: {},
  },
  meetings: {
    table: 'meeting_system_templates',
    idCol: 'id', nameCol: 'label', descCol: 'description', metaCol: 'framework',
    filter: { is_active: true },
  },
  survey: {
    table: 'survey_template_catalog',
    idCol: 'id', nameCol: 'name', descCol: 'description', metaCol: 'pack',
    filter: { is_active: true },
  },
}

// After clone, redirect back into the studio Advanced view for the
// scope, with ?template=<id> so the scope's embedder can deep-link the
// editor open. Keeps the user inside the studio shell context.
const SCOPE_REDIRECT: Record<string, (newId: string) => string> = {
  compliance: (id) => `/studio?scope=compliance&mode=advanced&template=${encodeURIComponent(id)}`,
  documents: (id) => `/studio?scope=documents&mode=advanced&template=${encodeURIComponent(id)}`,
  meetings: (id) => `/studio?scope=meetings&mode=advanced&template=${encodeURIComponent(id)}`,
  survey: (id) => `/studio?scope=survey&mode=advanced&template=${encodeURIComponent(id)}`,
}

export type SystemTemplateBrowserProps = {
  scopeId: string
}

export function SystemTemplateBrowser({ scopeId }: SystemTemplateBrowserProps) {
  const { supabase } = useOrgSetupContext()
  const navigate = useNavigate()
  const [rows, setRows] = useState<SystemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const config = SCOPE_TO_QUERY[scopeId]

  const reload = useCallback(async () => {
    if (!supabase || !config) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    let q = supabase
      .from(config.table)
      .select(
        [config.idCol, config.nameCol, config.descCol, config.metaCol]
          .filter(Boolean)
          .join(', '),
      )
      .order(config.nameCol, { ascending: true })
      .limit(200)
    for (const [k, v] of Object.entries(config.filter)) {
      q = q.eq(k, v as never)
    }
    const { data, error: e } = await q
    if (e) {
      setError(e.message)
      setLoading(false)
      return
    }
    const mapped: SystemRow[] = (data ?? []).map((r) => {
      const row = r as unknown as Record<string, unknown>
      return {
        id: String(row[config.idCol] ?? ''),
        name: String(row[config.nameCol] ?? ''),
        description: row[config.descCol] != null ? String(row[config.descCol]) : null,
        meta_label: config.metaCol && row[config.metaCol] != null ? String(row[config.metaCol]) : null,
      }
    })
    setRows(mapped)
    setLoading(false)
  }, [supabase, config])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical fetch-on-mount
    void reload()
  }, [reload])

  async function handleClone(row: SystemRow) {
    if (!supabase) return
    setBusyId(row.id)
    setError(null)
    const { data, error: e } = await supabase.rpc('clone_studio_template', {
      p_scope_id: scopeId,
      p_system_id: row.id,
    })
    setBusyId(null)
    if (e) {
      setError(e.message)
      return
    }
    const newId = data as string | null
    if (!newId) {
      setError('Klone-RPCen returnerte ingen id.')
      return
    }
    const redirect = SCOPE_REDIRECT[scopeId]?.(newId) ?? `/studio?scope=${scopeId}`
    navigate(redirect)
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows
    const q = filter.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.meta_label ?? '').toLowerCase().includes(q),
    )
  }, [rows, filter])

  if (!config) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
        Ingen system-maler eksponert for scope <code>{scopeId}</code> enda.
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900 font-serif">Klon fra system-mal</h4>
          <p className="text-xs text-neutral-500">
            Velg en system-mal under for å klone den til din organisasjon. Du blir tatt direkte til redigering.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <StandardInput
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Søk maler…"
            className="w-56 pl-7 text-xs"
            aria-label="Søk system-maler"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster maler…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          {rows.length === 0 ? 'Ingen system-maler er tilgjengelige for denne scopen enda.' : `Ingen treff for «${filter}».`}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900">{r.name}</p>
                {r.description ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">{r.description}</p>
                ) : null}
                {r.meta_label ? (
                  <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-600">
                    {r.meta_label}
                  </span>
                ) : null}
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId === r.id}
                onClick={() => void handleClone(r)}
              >
                {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                Klon til min org
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
