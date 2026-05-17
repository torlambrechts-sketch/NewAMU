// LibraryPackInstallModal — confirmation modal for "Installer hele pakken".
//
// Shows a structured diff of what will happen when the user calls
// provision_workflows_baseline_for_org for a single pack: new rules vs.
// rules that will get a version bump vs. rules already at the current
// catalog version. We compute the diff client-side from the catalog rows
// + the org's installed rules — the RPC is the source of truth, but
// previewing this lets users confirm scope before committing.
//
// Uses AticsModalFrame (the existing project-wide modal shell).

import { useMemo } from 'react'
import { Loader2, Package } from 'lucide-react'
import { AticsModalFrame } from '../../ui/aticsPrimitives'
import { Button } from '../../ui/Button'
import type { WorkflowRuleCatalogRow } from '../../../types/workflow'

const PACK_LABELS: Record<string, string> = {
  'aml-amu': 'AML-AMU starter',
  'iso-45001': 'ISO 45001',
  gdpr: 'GDPR personvern',
  apenhetsloven: 'Åpenhetsloven',
}

type PackInfo = {
  total: number
  installed: number
  sample: WorkflowRuleCatalogRow[]
}

type LibraryPackInstallModalProps = {
  open: boolean
  pack: string | null
  info: PackInfo | undefined
  rows: WorkflowRuleCatalogRow[]
  installedBySlug: Map<string, string>
  installing: boolean
  onClose: () => void
  onConfirm: (pack: string) => void
}

export function LibraryPackInstallModal({
  open,
  pack,
  info: _info,
  rows,
  installedBySlug,
  installing,
  onClose,
  onConfirm,
}: LibraryPackInstallModalProps) {
  // installed `info` is held by the caller but we re-compute the diff
  // here to expose the exact rule names — useful for the bullet lists.
  const diff = useMemo(() => {
    if (!pack) return { fresh: [], updated: [], unchanged: [] }
    const inPack = rows.filter((r) => r.pack === pack)
    const fresh: WorkflowRuleCatalogRow[] = []
    const updated: WorkflowRuleCatalogRow[] = []
    const unchanged: WorkflowRuleCatalogRow[] = []
    inPack.forEach((row) => {
      if (!installedBySlug.has(row.slug)) fresh.push(row)
      // We don't have the installed catalog_version cheaply — treat
      // every already-installed row as "updated" (the RPC itself decides
      // skipped vs updated based on the catalog_version comparison).
      else updated.push(row)
    })
    return { fresh, updated, unchanged }
  }, [pack, rows, installedBySlug])

  if (!pack) return null

  const label = PACK_LABELS[pack] ?? pack
  const total = diff.fresh.length + diff.updated.length + diff.unchanged.length

  return (
    <AticsModalFrame
      open={open}
      onClose={onClose}
      size="lg"
      title={`Installerer pakken ${label} — ${total} ${total === 1 ? 'regel' : 'regler'}`}
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutral-700">
          <Package className="mr-1 inline h-4 w-4 text-emerald-700" />
          Bekreft installasjon av {total} {total === 1 ? 'regel' : 'regler'} fra «{label}». Reglene
          installeres som inaktive — du må aktivere dem i Mine arbeidsflyter når de er klare.
          Egne tilpasninger overskrives aldri.
        </p>

        <DiffSection
          variant="fresh"
          title={`Nye regler (${diff.fresh.length})`}
          rows={diff.fresh}
          emptyHint="Ingen nye regler — pakken er allerede helt installert."
        />
        <DiffSection
          variant="updated"
          title={`Oppdaterte regler (${diff.updated.length})`}
          subtitle="Beholder dine endringer der det ikke er kollisjon."
          rows={diff.updated}
          emptyHint="Ingen eksisterende regler i pakken."
        />
        {diff.unchanged.length > 0 && (
          <DiffSection
            variant="unchanged"
            title={`Uendrede (${diff.unchanged.length})`}
            subtitle="Versjon allerede aktuell."
            rows={diff.unchanged}
          />
        )}

        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={installing}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={
              installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />
            }
            onClick={() => onConfirm(pack)}
            disabled={installing || total === 0}
          >
            {installing ? 'Installerer …' : 'Bekreft installasjon'}
          </Button>
        </div>
      </div>
    </AticsModalFrame>
  )
}

function DiffSection({
  variant,
  title,
  subtitle,
  rows,
  emptyHint,
}: {
  variant: 'fresh' | 'updated' | 'unchanged'
  title: string
  subtitle?: string
  rows: WorkflowRuleCatalogRow[]
  emptyHint?: string
}) {
  const tone =
    variant === 'fresh'
      ? 'border-emerald-200 bg-emerald-50/60'
      : variant === 'updated'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-neutral-200 bg-neutral-50'
  const dotTone =
    variant === 'fresh'
      ? 'bg-emerald-500'
      : variant === 'updated'
        ? 'bg-amber-500'
        : 'bg-neutral-400'

  return (
    <section className={`rounded-md border ${tone} p-3`}>
      <header className="mb-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-800">{title}</h4>
        {subtitle && <p className="mt-0.5 text-[11px] text-neutral-600">{subtitle}</p>}
      </header>
      {rows.length === 0 ? (
        <p className="text-[11px] italic text-neutral-500">{emptyHint ?? '—'}</p>
      ) : (
        <ul className="space-y-0.5 text-xs text-neutral-800">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2">
              <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${dotTone}`} />
              <span className="truncate">{row.name_i18n?.nb ?? row.slug}</span>
              <code className="ml-auto text-[10px] text-neutral-500">v{row.catalog_version}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
