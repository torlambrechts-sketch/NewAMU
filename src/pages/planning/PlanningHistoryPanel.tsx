// PlanningHistoryPanel — slide-over listing okr_plan_snapshots for the
// active plan with a read-only OKRDashboard render of the selected one
// (H3.1). «Ta øyeblikksbilde» appends a manual snapshot; the list itself is
// append-only (no delete — the history IS the audit value).

import { useState } from 'react'
import { Camera, History, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { OKRDashboard } from '../../components/okr/OKRDashboard'
import type { Confidence, Objective as DashObjective } from '../../components/okr/OKRDashboard'
import { useOkrSnapshots, type OkrSnapshotTree } from '../../hooks/useOkrSnapshots'
import { fmtNum } from './planningConstants'

const REASON_LABEL: Record<string, string> = {
  manual: 'Manuelt',
  status_change: 'Statusendring',
}

function tierOf(confidence: number | undefined): Confidence {
  const c = confidence ?? 0.5
  if (c >= 0.7) return 'on_track'
  if (c >= 0.4) return 'at_risk'
  return 'off_track'
}

function fmtDateTimeNb(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function treeToDash(tree: OkrSnapshotTree): DashObjective[] {
  return tree.objectives.map((o, oi) => ({
    id: `snap-obj-${oi}`,
    title: o.objective ?? '—',
    description: o.why || undefined,
    owner: { name: o.owner_name || '—' },
    keyResults: o.keyResults.map((k, ki) => {
      const target = Number(k.target ?? 0)
      const current = Number(k.current_value ?? 0)
      const ratio = k.invert
        ? Math.max(0, Math.min(1, target / Math.max(current, 0.01)))
        : Math.min(1, Math.max(0, current) / Math.max(target, 0.01))
      return {
        id: `snap-kr-${oi}-${ki}`,
        title: k.kr ?? '—',
        progress: Math.round(ratio * 100),
        confidence: tierOf(k.confidence),
        current: `${fmtNum(current)}${k.unit ? ` ${k.unit}` : ''}`,
        target: `${fmtNum(target)}${k.unit ? ` ${k.unit}` : ''}`,
      }
    }),
  }))
}

export function PlanningHistoryPanel({
  open,
  onClose,
  planId,
}: {
  open: boolean
  onClose: () => void
  planId: string | null
}) {
  const snapshots = useOkrSnapshots(open ? planId : null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tree, setTree] = useState<OkrSnapshotTree | null>(null)
  const [busy, setBusy] = useState(false)

  const openSnapshot = (id: string) => {
    setSelectedId(id)
    setTree(null)
    void snapshots.fetchSnapshot(id).then((t) => setTree(t))
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="planning-history-title"
      title="Historikk — øyeblikksbilder"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            Append-only logg. Tas automatisk ved statusendring.
          </p>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !planId}
            icon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            onClick={() => {
              void (async () => {
                setBusy(true)
                try {
                  await snapshots.takeSnapshot('manual')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            Ta øyeblikksbilde nå
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4 md:p-5">
        {snapshots.error ? <p className="text-sm text-red-600">{snapshots.error}</p> : null}

        {snapshots.list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            <History className="mx-auto mb-2 size-5 text-neutral-400" aria-hidden />
            Ingen øyeblikksbilder ennå. Ta ett manuelt, eller endre planens status —
            da lagres et automatisk.
          </div>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {snapshots.list.map((s) => (
              <li key={s.id}>
                <Button
                  size="sm"
                  variant={selectedId === s.id ? 'primary' : 'secondary'}
                  onClick={() => openSnapshot(s.id)}
                >
                  {fmtDateTimeNb(s.createdAt)} · {REASON_LABEL[s.reason] ?? s.reason}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {selectedId && !tree ? (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Henter øyeblikksbilde…
          </p>
        ) : null}

        {tree ? (
          <div>
            <div className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-900">{tree.plan.title ?? '—'}</span>
              {tree.plan.horizon ? ` · ${tree.plan.horizon}` : ''}
              {tree.plan.status ? ` · status: ${tree.plan.status}` : ''}
            </div>
            <OKRDashboard objectives={treeToDash(tree)} defaultView="matrix" />
          </div>
        ) : null}
      </div>
    </SlidePanel>
  )
}
