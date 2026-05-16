// TemplateVersionDiffModal — renders the {added, removed, modified}
// diff between two compliance template versions. Calls the
// compliance_template_version_diff RPC and displays the result with
// per-section colour banding so an admin / reviewer can see at a
// glance what changed when the law was amended.

import { useEffect, useState } from 'react'
import { ArrowRight, Minus, Pencil, Plus } from 'lucide-react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import type { TemplateVersionDiff, TemplateVersionRow } from '../useTemplateVersions'

function itemSummary(item: Record<string, unknown>): { key: string; lawRef?: string; prompt?: string } {
  return {
    key: String(item.key ?? ''),
    lawRef: typeof item.law_ref === 'string' ? item.law_ref : undefined,
    prompt: typeof item.prompt === 'string' ? item.prompt : undefined,
  }
}

export function TemplateVersionDiffModal({
  fromVersion,
  toVersion,
  fetchDiff,
  onClose,
}: {
  fromVersion: TemplateVersionRow
  toVersion: TemplateVersionRow
  fetchDiff: (
    fromMajor: number,
    fromMinor: number,
    toMajor: number,
    toMinor: number,
  ) => Promise<TemplateVersionDiff | null>
  onClose: () => void
}) {
  const [diff, setDiff] = useState<TemplateVersionDiff | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchDiff(
      fromVersion.version_major,
      fromVersion.version_minor,
      toVersion.version_major,
      toVersion.version_minor,
    )
      .then((d) => {
        if (cancelled) return
        if (d === null) setError('Klarte ikke å hente endringer.')
        setDiff(d)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Ukjent feil')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchDiff, fromVersion, toVersion])

  return (
    <FormModal
      open
      onClose={onClose}
      titleId="template-version-diff"
      title={
        <span className="inline-flex items-center gap-2">
          Endringer
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">
            v{fromVersion.version_major}.{fromVersion.version_minor}
          </span>
          <ArrowRight className="h-4 w-4 text-neutral-400" />
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">
            v{toVersion.version_major}.{toVersion.version_minor}
          </span>
        </span>
      }
      footer={
        <div className="flex w-full justify-end">
          <Button variant="secondary" onClick={onClose}>
            Lukk
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-1 py-2">
        {error && <WarningBox>{error}</WarningBox>}
        {loading && !error && (
          <p className="text-sm text-neutral-600">Beregner forskjell…</p>
        )}

        {diff && !loading && (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-200">
                <Plus className="h-3 w-3" /> {diff.added.length} lagt til
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-800 ring-1 ring-red-200">
                <Minus className="h-3 w-3" /> {diff.removed.length} fjernet
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-900 ring-1 ring-amber-200">
                <Pencil className="h-3 w-3" /> {diff.modified.length} endret
              </span>
            </div>

            {/* Added */}
            {diff.added.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-emerald-900">Lagt til</h3>
                <ul className="space-y-1 text-sm">
                  {diff.added.map((it, i) => {
                    const s = itemSummary(it)
                    return (
                      <li key={`a-${i}`} className="rounded border border-emerald-200 bg-emerald-50/40 px-2 py-1">
                        {s.lawRef && <span className="mr-2 font-mono text-xs">{s.lawRef}</span>}
                        <span>{s.prompt ?? s.key}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* Removed */}
            {diff.removed.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-red-900">Fjernet</h3>
                <ul className="space-y-1 text-sm">
                  {diff.removed.map((it, i) => {
                    const s = itemSummary(it)
                    return (
                      <li key={`r-${i}`} className="rounded border border-red-200 bg-red-50/40 px-2 py-1">
                        {s.lawRef && <span className="mr-2 font-mono text-xs">{s.lawRef}</span>}
                        <span>{s.prompt ?? s.key}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* Modified — side-by-side old vs new */}
            {diff.modified.length > 0 && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-amber-900">Endret</h3>
                <ul className="space-y-2 text-sm">
                  {diff.modified.map((m) => {
                    const oldS = itemSummary(m.old)
                    const newS = itemSummary(m.new)
                    return (
                      <li
                        key={m.key}
                        className="rounded border border-amber-200 bg-amber-50/40 p-2"
                      >
                        <div className="mb-1 font-mono text-xs text-amber-900">{m.key}</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded border border-neutral-300 bg-white p-1.5 text-xs">
                            <div className="font-medium text-neutral-700">Før</div>
                            <div className="text-neutral-900">
                              {oldS.lawRef && <span className="mr-1 font-mono">{oldS.lawRef}</span>}
                              {oldS.prompt ?? '—'}
                            </div>
                          </div>
                          <div className="rounded border border-amber-300 bg-white p-1.5 text-xs">
                            <div className="font-medium text-amber-800">Etter</div>
                            <div className="text-neutral-900">
                              {newS.lawRef && <span className="mr-1 font-mono">{newS.lawRef}</span>}
                              {newS.prompt ?? '—'}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0 && (
              <p className="text-sm text-neutral-600">
                Ingen endringer mellom disse to versjonene.
              </p>
            )}
          </>
        )}
      </div>
    </FormModal>
  )
}
