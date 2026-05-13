// LibraryPanel — browseable catalog of audit-ready workflow templates.
//
// Reads workflow_rule_catalog (Phase A migration _20260905120200) and
// surfaces the system library. Install button calls
// provision_workflows_baseline_for_org (RPC from _20260905121000) for a
// single pack or all packs; the per-scope details (events, actions, law-
// refs) come from the registry SDK so the user sees what they're getting.

import { useMemo, useState } from 'react'
import { Check, Download, ExternalLink, Plus, Shield, ShieldAlert } from 'lucide-react'
import { useWorkflowCatalog } from '../../../hooks/useWorkflowCatalog'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { getWorkflowScope, listWorkflowScopes } from '../../../lib/workflows/workflowRegistry'

export function LibraryPanel({ onInstalled }: { onInstalled?: (ruleId: string) => void } = {}) {
  const { catalog, loading, error, refresh } = useWorkflowCatalog()
  const { rules, seedWorkflowBaseline, seedWorkflowFromCatalog, canCompose } = useWorkflows()
  const [installing, setInstalling] = useState<string | null>(null)
  const [installResult, setInstallResult] = useState<{ pack: string; outcome: string } | null>(null)
  const [rowResult, setRowResult] = useState<{ slug: string; action: 'inserted' | 'exists' } | null>(null)
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [packFilter, setPackFilter] = useState<string>('all')

  // Map catalog_slug → installed rule_id for "Installert" / "Bruk malen" state.
  const installedBySlug = useMemo(() => {
    const m = new Map<string, string>()
    rules.forEach((r) => {
      if (r.catalog_slug) m.set(r.catalog_slug, r.id)
      else m.set(r.slug, r.id)
    })
    return m
  }, [rules])

  const installRow = async (slug: string) => {
    setInstalling(slug)
    setRowResult(null)
    const result = await seedWorkflowFromCatalog(slug)
    setInstalling(null)
    if (result.ok) {
      setRowResult({ slug, action: result.action })
      if (result.action === 'inserted' && onInstalled) {
        // Defer slightly so the user sees the success row badge before nav.
        setTimeout(() => onInstalled(result.ruleId), 400)
      }
      void refresh()
    }
  }

  const filtered = useMemo(() => {
    return catalog.filter((row) => {
      if (scopeFilter !== 'all' && row.scope_id !== scopeFilter) return false
      if (packFilter !== 'all' && (row.pack ?? '') !== packFilter) return false
      return true
    })
  }, [catalog, scopeFilter, packFilter])

  const scopes = listWorkflowScopes()
  const packs = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach((row) => row.pack && set.add(row.pack))
    return [...set].sort()
  }, [catalog])

  const installPack = async (pack: string | null) => {
    setInstalling(pack ?? '*')
    setInstallResult(null)
    const result = await seedWorkflowBaseline({ pack: pack ?? undefined })
    setInstalling(null)
    if (result.ok) {
      const outcome = result.installed
        .reduce(
          (acc, r) => {
            acc[r.installed_action] = (acc[r.installed_action] ?? 0) + 1
            return acc
          },
          { inserted: 0, updated: 0, skipped: 0 } as Record<string, number>,
        )
      setInstallResult({
        pack: pack ?? 'alle pakker',
        outcome: `${outcome.inserted} nye · ${outcome.updated} oppdaterte · ${outcome.skipped} uendrede`,
      })
      void refresh()
    }
  }

  if (loading && catalog.length === 0) {
    return <div className="p-6 text-sm text-neutral-500">Laster mal-bibliotek …</div>
  }
  if (error) {
    return <div className="p-6 text-sm text-red-700">Kunne ikke laste maler: {error}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Mal-bibliotek</h2>
        <span className="text-xs text-neutral-500">
          {catalog.length} systemmaler · {filtered.length} viser nå
        </span>
        <span className="flex-1" />
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="all">Alle scopes</option>
          {scopes.map((s) => (
            <option key={s.scopeId} value={s.scopeId}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={packFilter}
          onChange={(e) => setPackFilter(e.target.value)}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="all">Alle pakker</option>
          {packs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {canCompose && (
          <button
            type="button"
            disabled={installing !== null}
            onClick={() => installPack(packFilter === 'all' ? null : packFilter)}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {installing ? 'Installerer …' : `Installer ${packFilter === 'all' ? 'alle' : packFilter}`}
          </button>
        )}
      </div>
      {installResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Pakke «{installResult.pack}» installert: {installResult.outcome}
        </div>
      )}
      {rowResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {rowResult.action === 'inserted' ? 'Mal installert som inaktiv arbeidsflyt. Åpner Bygg-fanen …' : 'Malen er allerede installert — bytter til Bygg-fanen …'}
          {' '}<code className="ml-1 text-[10px] text-emerald-700">{rowResult.slug}</code>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Navn</th>
              <th className="px-3 py-2 text-left">Scope</th>
              <th className="px-3 py-2 text-left">Pakke</th>
              <th className="px-3 py-2 text-left">Law refs</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Versjon</th>
              <th className="px-3 py-2 text-right">Handling</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((row) => {
              const scope = getWorkflowScope(row.scope_id)
              const installedId = installedBySlug.get(row.slug)
              const isInstalling = installing === row.slug
              return (
                <tr key={row.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-900">{row.name_i18n?.nb ?? row.slug}</div>
                    {row.description_i18n && 'nb' in row.description_i18n && (
                      <div className="mt-0.5 text-xs text-neutral-500">
                        {(row.description_i18n as { nb: string }).nb}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                      style={{ borderColor: scope?.accent ?? '#d4d4d4', color: scope?.accent ?? '#525252' }}
                    >
                      {scope?.label ?? row.scope_id}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-700">{row.pack ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-neutral-700">
                    {row.law_refs.length === 0 ? '—' : row.law_refs.join(' · ')}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.contains_gov_action ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                        <ShieldAlert className="h-3 w-3" />
                        Statlig melding
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-neutral-500">
                        <Shield className="h-3 w-3" />
                        Internt
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">v{row.catalog_version}</td>
                  <td className="px-3 py-2 text-right">
                    {installedId ? (
                      <button
                        type="button"
                        onClick={() => onInstalled?.(installedId)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                        title="Allerede installert — gå til rediger"
                      >
                        <Check className="h-3 w-3" /> Installert
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canCompose || isInstalling}
                        onClick={() => installRow(row.slug)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Plus className="h-3 w-3" />
                        {isInstalling ? 'Installerer …' : 'Bruk malen'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-neutral-500">
                  Ingen maler matcher filtrene. Når feltet er tomt og du nettopp har lagt på Phase A
                  migrasjonene betyr det at katalogen ikke er seedet enda — bruk
                  workflow_seed_compliance_templates for den legacy-pakken, eller vent på Phase B-seeden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        <ExternalLink className="mr-1 inline h-3 w-3" />
        Installasjonen kjører <code className="rounded bg-neutral-100 px-1">provision_workflows_baseline_for_org()</code>
        . Org-tilpasninger blir aldri overskrevet — kun katalog-versjon, law_refs, frameworks og lokaliserte navn oppdateres.
      </p>
    </div>
  )
}
