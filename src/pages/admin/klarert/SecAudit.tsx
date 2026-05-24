// Audit-logg-seksjonen.
// Henter hse_audit_log filtrert til admin-relevante tabeller med
// cursor-pagination. 10 års retensjon. Eksport til CSV bygger på den
// allerede-lastede listen.

import { ChevronDown, Download, History, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import {
  ADMIN_TABLE_TH,
  ADMIN_TABLE_TR_BODY,
  AdminCard,
  AdminError,
  AdminLoading,
  Initials,
} from './AdminShared'
import { useAdminAudit } from './useAdminAudit'
import type { AdminSectionProps } from './types'

export function SecAudit({ easy }: AdminSectionProps) {
  const { entries, loading, loadingMore, error, hasMore, refresh, loadMore } = useAdminAudit(50)

  if (loading) return <AdminLoading />

  function exportCsv() {
    // RFC 4180 escape: wrap every field in quotes and double-up any
    // embedded quotes. Strip CR/LF defensively so a forged display
    // name can't break out of its row in the exported file.
    const esc = (v: string) => `"${String(v).replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`
    // Prevent CSV-injection / formula-injection: cells starting with
    // =, +, -, @ are prefixed with a single quote so Excel/Sheets
    // doesn't evaluate them. AML § 5-1 dokumentasjon må ikke kunne
    // misbrukes til å trigge formler.
    const safeCell = (v: string) => {
      const s = String(v)
      return /^[=+\-@\t]/.test(s) ? `'${s}` : s
    }
    const headers = ['Tidspunkt', 'Bruker', 'Handling', 'Detalj', 'Tabell']
    const rows = entries.map((e) =>
      [e.when, e.who, e.action, e.detail, e.table].map((c) => esc(safeCell(c))).join(','),
    )
    const blob = new Blob([[headers.map(esc).join(','), ...rows].join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `klarert-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <AdminCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fbf9f3] text-[#1a3d32]">
              <History className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">System-audit</h3>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Alle endringer i admin-modulen. 10 års retensjon. Eksporterbar til Arbeidstilsynet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="h-3 w-3" />}
              onClick={() => void refresh()}
            >
              Oppdater
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-3 w-3" />}
              onClick={exportCsv}
              disabled={entries.length === 0}
            >
              Eksporter CSV ({entries.length})
            </Button>
          </div>
        </div>
      </AdminCard>

      {error ? <AdminError message={error} /> : null}

      <AdminCard>
        {entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-neutral-500">
            Ingen audit-hendelser registrert enda.
          </div>
        ) : easy ? (
          <ol className="divide-y divide-neutral-100">
            {entries.slice(0, 12).map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                <Initials name={e.who} size={24} />
                <div className="flex-1 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="font-semibold text-neutral-900">{e.who}</span>{' '}
                      <span className="text-neutral-500">{e.action}</span>
                    </div>
                    <span className="tabular-nums text-[10px] text-neutral-400">{e.when}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-neutral-50/60">
                <tr>
                  <th className={ADMIN_TABLE_TH}>Tidspunkt</th>
                  <th className={ADMIN_TABLE_TH}>Bruker</th>
                  <th className={ADMIN_TABLE_TH}>Handling</th>
                  <th className={ADMIN_TABLE_TH}>Detalj</th>
                  <th className={ADMIN_TABLE_TH}>Tabell</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className={ADMIN_TABLE_TR_BODY}>
                    <td className="px-5 py-2.5 tabular-nums text-[11px] text-neutral-600">
                      {e.when}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Initials name={e.who} size={22} />
                        <span className="text-xs font-medium text-neutral-900">{e.who}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-neutral-700">{e.action}</td>
                    <td className="px-5 py-2.5 text-xs text-neutral-900">{e.detail}</td>
                    <td className="px-5 py-2.5">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {e.table}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && !easy ? (
          <div className="flex items-center justify-center border-t border-neutral-100 px-5 py-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={loadingMore}
              icon={
                loadingMore ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )
              }
              onClick={() => void loadMore()}
            >
              {loadingMore ? 'Laster …' : 'Last flere'}
            </Button>
          </div>
        ) : null}
      </AdminCard>
    </div>
  )
}
