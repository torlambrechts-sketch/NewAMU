// Roller-widget: RACI matrise.

import { useMemo } from 'react'
import { Scale } from 'lucide-react'
import { useDashboardData } from '../useDashboardData'
import { Chip, EmptyState, LawRef, WidgetCard } from './widgetShared'

// Synthetic RACI: bygges fra cadence_plan_modules × cadence_plan_roles.
// Hver modul tildeles A til role_key 'daglig_leder' eller 'hms_ansvarlig',
// R til verneombud, C til BHT, I til AMU. Dette er en pragmatisk default
// — i en senere fase legges en RACI-matriks-tabell til DB-en.

type RaciCell = 'R' | 'A' | 'C' | 'I' | null

function deriveRaci(
  _moduleId: string,
  roleKey: string,
  lawRefs: string[],
): RaciCell {
  const isAMU = lawRefs.some((r) => r.startsWith('AML § 7') || r.startsWith('AML § 8'))
  const isBHT = lawRefs.some((r) => r.startsWith('AML § 3-3') || r.startsWith('BHT'))
  const isPsy = lawRefs.includes('AML § 4-3')
  const isPhys = lawRefs.some((r) => r.startsWith('AML § 4-1') || r.startsWith('AML § 4-4') || r.startsWith('AML § 4-5'))
  const isSjuk = lawRefs.some((r) => r.startsWith('AML § 4-6'))

  switch (roleKey) {
    case 'daglig_leder':
      return isAMU || isPsy ? 'A' : isSjuk ? 'A' : isPhys ? 'I' : 'I'
    case 'hms_ansvarlig':
      return 'R'
    case 'verneombud_produksjon':
      return isPhys ? 'R' : isAMU ? 'C' : isBHT ? 'C' : 'C'
    case 'hovedverneombud':
      return isAMU ? 'A' : 'C'
    case 'amu_leder':
      return isAMU ? 'R' : 'I'
    case 'bht':
      return isBHT || isPsy ? 'R' : null
    case 'tillitsvalgt':
      return lawRefs.some((r) => r.startsWith('AML § 8')) ? 'R' : 'C'
    default:
      return null
  }
}

function raciCellClass(c: RaciCell): string {
  switch (c) {
    case 'R': return 'bg-[#BA0C2F] text-white'
    case 'A': return 'bg-[#0A1628] text-white'
    case 'C': return 'bg-[#F4E8D2] text-[#B8761F] border border-[#D9A968]'
    case 'I': return 'bg-neutral-100 text-neutral-700 border border-neutral-200'
    default: return 'bg-neutral-50 text-neutral-300 border border-dashed border-neutral-300'
  }
}

export function RaciMatrixWidget() {
  const data = useDashboardData()

  const matrix = useMemo(() => {
    if (data.modules.length === 0 || data.roles.length === 0) return null
    const roles = data.roles.filter((r) => r.is_mandatory).slice(0, 8)
    return data.modules.slice(0, 14).map((m) => ({
      module_id: m.module_id,
      name: m.name,
      law_refs: m.law_refs,
      tier: m.tier,
      frequency: m.frequency,
      cells: roles.map((r) => ({
        role: r,
        value: deriveRaci(m.module_id, r.role_key, m.law_refs),
      })),
    }))
  }, [data.modules, data.roles])

  if (!matrix) {
    return (
      <WidgetCard title="Rollematrise (RACI)" subtitle="Hvem gjør hva på tvers av maler">
        <EmptyState
          Icon={Scale}
          title="Mangler cadence-data"
          body="RACI-matrisen krever både cadence_plan_modules og cadence_plan_roles. Iverksett en plan via /cadence-veiviseren."
        />
      </WidgetCard>
    )
  }

  const roles = data.roles.filter((r) => r.is_mandatory).slice(0, 8)

  return (
    <div className="space-y-3">
      <WidgetCard title="Rollematrise (RACI)" subtitle={`${matrix.length} maler × ${roles.length} roller`}>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11.5px]">
          <span className="inline-flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[10.5px] font-bold ${raciCellClass('R')}`}>R</span><strong>Responsible</strong> — utfører</span>
          <span className="inline-flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[10.5px] font-bold ${raciCellClass('A')}`}>A</span><strong>Accountable</strong> — godkjenner</span>
          <span className="inline-flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[10.5px] font-bold ${raciCellClass('C')}`}>C</span><strong>Consulted</strong></span>
          <span className="inline-flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[10.5px] font-bold ${raciCellClass('I')}`}>I</span><strong>Informed</strong></span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-neutral-200 bg-neutral-50 px-3.5 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                  Oppgavemal
                </th>
                {roles.map((r) => (
                  <th key={r.role_key} className="min-w-[96px] border-b border-l border-neutral-200 bg-neutral-50 px-3.5 py-3 text-center text-[10.5px] font-semibold uppercase tracking-wider text-neutral-700">
                    {r.role_label}
                    {r.person_name ? <div className="mt-0.5 font-sans text-[10.5px] font-normal text-neutral-500">{r.person_name}</div> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.module_id} className="hover:bg-neutral-50">
                  <td className="border-b border-neutral-100 px-3.5 py-3">
                    <div className="text-[12.5px] font-medium text-neutral-900">{row.name}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {row.module_id} · {row.frequency ?? '—'}
                      {row.law_refs[0] ? <> · <LawRef code={row.law_refs[0]} /></> : null}
                    </div>
                  </td>
                  {row.cells.map((c, idx) => (
                    <td key={idx} className="border-b border-l border-neutral-100 px-3.5 py-3 text-center">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] font-semibold ${raciCellClass(c.value)}`}>
                        {c.value ?? '·'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11.5px] text-neutral-500">
          <Chip tone="paper">Auto-fordeling foreslår tildeling basert på rolledefinisjon</Chip>
          <span>Synthetic RACI · justeres når en eksplisitt RACI-tabell legges til</span>
        </div>
      </WidgetCard>
    </div>
  )
}
