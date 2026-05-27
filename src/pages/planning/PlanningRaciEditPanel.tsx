// PlanningRaciEditPanel — slide-over to edit the RACI matrix.

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SlidePanel } from '../../components/layout/SlidePanel'
import type { OkrPlanFull, OkrRaciEntry } from '../../types/planning'
import type { UsePlanningOkrReturn } from '../../hooks/usePlanningOkr'

type Props = {
  open: boolean
  onClose: () => void
  plan: OkrPlanFull
  ctrl: UsePlanningOkrReturn
}

export function PlanningRaciEditPanel({ open, onClose, plan, ctrl }: Props) {
  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="planning-raci-edit-title"
      title="Rediger RACI-matrise"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => ctrl.addRaci()}
            icon={<Plus className="h-3 w-3" />}
          >
            Ny rad
          </Button>
          <Button variant="primary" onClick={onClose}>
            Ferdig
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-neutral-600">
        Roller og ansvar i strategi-arbeidet. R = utfører · A = eier · C = konsultert · I = informert.
        Minst én rolle (R/A/C/I) må velges per rad.
      </p>

      {plan.raci.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-[12.5px] italic text-neutral-500">
          Ingen RACI-rader. Klikk «Ny rad» nederst for å legge til den første.
        </p>
      ) : (
        <ul className="space-y-2">
          {plan.raci.map((row) => (
            <RaciEditRow key={row.id} row={row} ctrl={ctrl} />
          ))}
        </ul>
      )}
    </SlidePanel>
  )
}

function RaciEditRow({ row, ctrl }: { row: OkrRaciEntry; ctrl: UsePlanningOkrReturn }) {
  return (
    <li className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Rolle</label>
          <StandardInput
            value={row.roleLabel}
            onChange={(e) => ctrl.updateRaci(row.id, { roleLabel: e.target.value })}
            className="mt-0.5 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Person / antall</label>
          <StandardInput
            value={row.personLabel ?? ''}
            onChange={(e) => ctrl.updateRaci(row.id, { personLabel: e.target.value })}
            placeholder="—"
            className="mt-0.5 px-2 py-1.5 text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => ctrl.removeRaci(row.id)}
          title="Slett rad"
          aria-label="Slett rad"
          className="self-end text-neutral-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <RaciToggle
          k="R"
          label="Responsible"
          color="#1a3d32"
          on={row.isResponsible}
          onChange={(v) => ctrl.updateRaci(row.id, { isResponsible: v })}
        />
        <RaciToggle
          k="A"
          label="Accountable"
          color="#c98a2b"
          on={row.isAccountable}
          onChange={(v) => ctrl.updateRaci(row.id, { isAccountable: v })}
        />
        <RaciToggle
          k="C"
          label="Consulted"
          color="#6366F1"
          on={row.isConsulted}
          onChange={(v) => ctrl.updateRaci(row.id, { isConsulted: v })}
        />
        <RaciToggle
          k="I"
          label="Informed"
          color="#737373"
          on={row.isInformed}
          onChange={(v) => ctrl.updateRaci(row.id, { isInformed: v })}
        />
      </div>
    </li>
  )
}

function RaciToggle({
  k,
  label,
  color,
  on,
  onChange,
}: {
  k: string
  label: string
  color: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => onChange(!on)}
      className={[
        'flex h-auto flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-center font-normal normal-case transition-colors',
        on ? 'text-white hover:opacity-90' : 'border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50',
      ].join(' ')}
      style={on ? { background: color, borderColor: color } : undefined}
      aria-pressed={on}
    >
      <span className="text-[12px] font-bold">{k}</span>
      <span className="text-[9px]">{label}</span>
    </Button>
  )
}
