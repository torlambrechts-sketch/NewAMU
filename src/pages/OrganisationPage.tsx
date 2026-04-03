import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  Layers,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useOrganisation } from '../hooks/useOrganisation'
import { employees } from '../data/employees'
import type { OrgUnitKind, UserGroup } from '../types/organisation'

const KIND_LABELS: Record<OrgUnitKind, string> = {
  division: 'Divisjon',
  department: 'Avdeling',
  team: 'Team',
  location: 'Lokasjon',
}

const KIND_ICONS: Record<OrgUnitKind, React.ReactNode> = {
  division: <Building2 className="size-4 text-[#1a3d32]" />,
  department: <Layers className="size-4 text-sky-600" />,
  team: <Users className="size-4 text-emerald-600" />,
  location: <Building2 className="size-4 text-neutral-400" />,
}

type Tab = 'units' | 'groups'

export function OrganisationPage() {
  const org = useOrganisation()
  const [tab, setTab] = useState<Tab>('units')

  // Unit form
  const [unitForm, setUnitForm] = useState({
    name: '', kind: 'department' as OrgUnitKind, parentId: '', managerName: '', memberCount: '',
  })

  // Group form
  const [groupForm, setGroupForm] = useState({
    name: '', description: '', scopeKind: 'all' as UserGroup['scope']['kind'],
    unitIds: [] as string[], employeeIds: [] as string[],
  })

  const topLevelUnits = org.units.filter((u) => !u.parentId)
  const childrenOf = (id: string) => org.units.filter((u) => u.parentId === id)

  function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitForm.name.trim()) return
    org.createUnit(unitForm.name, unitForm.kind, unitForm.parentId || undefined, {
      managerName: unitForm.managerName || undefined,
      memberCount: unitForm.memberCount ? Number(unitForm.memberCount) : undefined,
    })
    setUnitForm((f) => ({ ...f, name: '', managerName: '', memberCount: '' }))
  }

  function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!groupForm.name.trim()) return
    let scope: UserGroup['scope']
    if (groupForm.scopeKind === 'all') scope = { kind: 'all' }
    else if (groupForm.scopeKind === 'units') scope = { kind: 'units', unitIds: groupForm.unitIds }
    else if (groupForm.scopeKind === 'employees') scope = { kind: 'employees', employeeIds: groupForm.employeeIds }
    else scope = { kind: 'mixed', unitIds: groupForm.unitIds, employeeIds: groupForm.employeeIds }
    org.createGroup(groupForm.name, groupForm.description, scope)
    setGroupForm((f) => ({ ...f, name: '', description: '', unitIds: [], employeeIds: [] }))
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link to="/" className="hover:text-[#1a3d32]">Prosjekter</Link>
        <ChevronRight className="mx-1 inline size-3.5" />
        <span className="font-medium text-neutral-800">Organisasjon</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Organisasjon
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Definer organisasjonens struktur (divisjoner, avdelinger, team) og opprett brukergrupper for målretting av
            undersøkelser, opplæring og rapporter.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mt-4 flex gap-1 border-b border-neutral-200">
        {([
          { id: 'units' as const, label: 'Enheter', icon: Building2 },
          { id: 'groups' as const, label: 'Brukergrupper', icon: Users },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id ? 'border-b-2 border-[#1a3d32] text-[#1a3d32]' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Units ─────────────────────────────────────────────────────────────── */}
      {tab === 'units' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Tree */}
          <div>
            <h2 className="mb-4 text-base font-semibold text-neutral-800">Organisasjonsstruktur</h2>
            <div className="space-y-2">
              {topLevelUnits.map((unit) => (
                <UnitRow key={unit.id} unit={unit} childrenOf={childrenOf} onDelete={org.deleteUnit} depth={0} />
              ))}
              {org.units.length === 0 && (
                <p className="text-sm text-neutral-500">Ingen enheter ennå.</p>
              )}
            </div>
          </div>

          {/* Add form */}
          <div className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">Ny enhet</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreateUnit}>
              <div>
                <label className="text-xs font-medium text-neutral-500">Navn *</label>
                <input value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} required className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Type</label>
                <select value={unitForm.kind} onChange={(e) => setUnitForm((f) => ({ ...f, kind: e.target.value as OrgUnitKind }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Overordnet enhet</label>
                <select value={unitForm.parentId} onChange={(e) => setUnitForm((f) => ({ ...f, parentId: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="">— Ingen (toppnivå)</option>
                  {org.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Leder (navn)</label>
                <input value={unitForm.managerName} onChange={(e) => setUnitForm((f) => ({ ...f, managerName: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Antall ansatte (ca.)</label>
                <input type="number" min={0} value={unitForm.memberCount} onChange={(e) => setUnitForm((f) => ({ ...f, memberCount: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]">
                <Plus className="size-4" />
                Opprett enhet
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── User groups ───────────────────────────────────────────────────────── */}
      {tab === 'groups' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Group list */}
          <div>
            <h2 className="mb-4 text-base font-semibold text-neutral-800">Brukergrupper</h2>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              {org.groups.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen grupper ennå.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {org.groups.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="size-4 text-[#1a3d32]" />
                          <span className="font-medium text-neutral-900">{g.name}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">{org.getGroupLabel(g)}</p>
                        {g.description && <p className="text-xs text-neutral-400">{g.description}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`Slett gruppe «${g.name}»?`)) org.deleteGroup(g.id) }}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Add group form */}
          <div className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">Ny brukergruppe</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreateGroup}>
              <div>
                <label className="text-xs font-medium text-neutral-500">Gruppenavn *</label>
                <input value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} required className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Beskrivelse</label>
                <input value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Omfang</label>
                <select value={groupForm.scopeKind} onChange={(e) => setGroupForm((f) => ({ ...f, scopeKind: e.target.value as typeof groupForm.scopeKind }))} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="all">Alle ansatte</option>
                  <option value="units">Bestemte enheter</option>
                  <option value="employees">Bestemte ansatte</option>
                  <option value="mixed">Enheter + ansatte</option>
                </select>
              </div>

              {(groupForm.scopeKind === 'units' || groupForm.scopeKind === 'mixed') && (
                <div>
                  <label className="text-xs font-medium text-neutral-500">Velg enheter</label>
                  <div className="mt-1 max-h-36 overflow-y-auto space-y-1 rounded-xl border border-neutral-200 p-2">
                    {org.units.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={groupForm.unitIds.includes(u.id)}
                          onChange={(e) => setGroupForm((f) => ({
                            ...f,
                            unitIds: e.target.checked
                              ? [...f.unitIds, u.id]
                              : f.unitIds.filter((id) => id !== u.id),
                          }))}
                          className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                        />
                        <span className="text-neutral-700">{u.name}</span>
                        <span className="text-xs text-neutral-400">{KIND_LABELS[u.kind]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {(groupForm.scopeKind === 'employees' || groupForm.scopeKind === 'mixed') && (
                <div>
                  <label className="text-xs font-medium text-neutral-500">Velg ansatte</label>
                  <div className="mt-1 max-h-36 overflow-y-auto space-y-1 rounded-xl border border-neutral-200 p-2">
                    {employees.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={groupForm.employeeIds.includes(emp.id)}
                          onChange={(e) => setGroupForm((f) => ({
                            ...f,
                            employeeIds: e.target.checked
                              ? [...f.employeeIds, emp.id]
                              : f.employeeIds.filter((id) => id !== emp.id),
                          }))}
                          className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]"
                        />
                        <span className="text-neutral-700">{emp.name}</span>
                        <span className="text-xs text-neutral-400">{emp.department}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]">
                <Plus className="size-4" />
                Opprett gruppe
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Unit tree row ─────────────────────────────────────────────────────────────

function UnitRow({
  unit,
  childrenOf,
  onDelete,
  depth,
}: {
  unit: ReturnType<typeof useOrganisation>['units'][0]
  childrenOf: (id: string) => ReturnType<typeof useOrganisation>['units']
  onDelete: (id: string) => void
  depth: number
}) {
  const children = childrenOf(unit.id)
  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm ${depth > 0 ? 'ml-6 border-l-2 border-l-neutral-100' : ''}`}
      >
        <span className="shrink-0">{KIND_ICONS[unit.kind]}</span>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-neutral-900">{unit.name}</span>
          <span className="ml-2 text-xs text-neutral-400">{KIND_LABELS[unit.kind]}</span>
          {unit.managerName && <span className="ml-2 text-xs text-neutral-500">· {unit.managerName}</span>}
          {unit.memberCount != null && <span className="ml-2 text-xs text-neutral-400">· {unit.memberCount} ansatte</span>}
        </div>
        <button
          type="button"
          onClick={() => { if (confirm(`Slett «${unit.name}» og alle undereenheter?`)) onDelete(unit.id) }}
          className="rounded-lg p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {children.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {children.map((child) => (
            <UnitRow key={child.id} unit={child} childrenOf={childrenOf} onDelete={onDelete} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
