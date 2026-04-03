import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Layers,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { useOrganisation } from '../hooks/useOrganisation'
import type { EmploymentType, OrgUnitKind, UserGroup } from '../types/organisation'

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

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  permanent: 'Fast ansatt',
  temporary: 'Midlertidig',
  intern: 'Intern/lærling',
  contractor: 'Konsulent/innleid',
}

type Tab = 'units' | 'employees' | 'groups' | 'settings'

const BASE_INPUT = 'mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'

export function OrganisationPage() {
  const org = useOrganisation()
  const [tab, setTab] = useState<Tab>('employees')

  // Unit form
  const [unitForm, setUnitForm] = useState({
    name: '', kind: 'department' as OrgUnitKind, parentId: '', managerName: '', memberCount: '',
  })

  // Employee form
  const [empForm, setEmpForm] = useState({
    name: '', email: '', jobTitle: '', unitId: '', employmentType: 'permanent' as EmploymentType, startDate: '',
  })
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null)

  // Group form
  const [groupForm, setGroupForm] = useState({
    name: '', description: '', scopeKind: 'all' as UserGroup['scope']['kind'],
    unitIds: [] as string[], employeeIds: [] as string[],
  })

  const topLevelUnits = org.units.filter((u) => !u.parentId)
  const childrenOf = (id: string) => org.units.filter((u) => u.parentId === id)
  const { complianceThresholds: ct } = org

  type OrgEmp = (typeof org.employees)[0]

  function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitForm.name.trim()) return
    org.createUnit(unitForm.name, unitForm.kind, unitForm.parentId || undefined, {
      managerName: unitForm.managerName || undefined,
      memberCount: unitForm.memberCount ? Number(unitForm.memberCount) : undefined,
    })
    setUnitForm((f) => ({ ...f, name: '', managerName: '', memberCount: '' }))
  }

  function handleEmpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!empForm.name.trim()) return
    if (editingEmpId) {
      org.updateEmployee(editingEmpId, {
        name: empForm.name.trim(), email: empForm.email || undefined, jobTitle: empForm.jobTitle || undefined,
        unitId: empForm.unitId || undefined, employmentType: empForm.employmentType, startDate: empForm.startDate || undefined,
      })
      setEditingEmpId(null)
    } else {
      org.createEmployee({
        name: empForm.name.trim(), email: empForm.email || undefined, jobTitle: empForm.jobTitle || undefined,
        unitId: empForm.unitId || undefined, employmentType: empForm.employmentType, startDate: empForm.startDate || undefined,
        active: true,
      })
    }
    setEmpForm({ name: '', email: '', jobTitle: '', unitId: '', employmentType: 'permanent', startDate: '' })
  }

  function startEdit(emp: OrgEmp) {
    setEditingEmpId(emp.id)
    setEmpForm({
      name: emp.name, email: emp.email ?? '', jobTitle: emp.jobTitle ?? '',
      unitId: emp.unitId ?? '', employmentType: emp.employmentType, startDate: emp.startDate ?? '',
    })
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

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'employees', label: 'Ansatte', icon: Users },
    { id: 'units',     label: 'Enheter',  icon: Building2 },
    { id: 'groups',    label: 'Brukergrupper', icon: UserCheck },
    { id: 'settings',  label: 'Innstillinger', icon: Settings2 },
  ]

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 flex items-center gap-1 text-sm text-neutral-500">
        <Link to="/" className="hover:text-[#1a3d32]">Prosjekter</Link>
        <ChevronRight className="mx-1 inline size-3.5" />
        <span className="font-medium text-neutral-800">Organisasjon</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 md:text-3xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            {org.settings.orgName || 'Organisasjon'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Ansatte, enheter, brukergrupper og virksomhetsinnstillinger. Brukes som kilde av AMU-terskler, undersøkelser og oppfølging.
          </p>
        </div>
        {/* Threshold badges */}
        <div className="flex flex-wrap gap-2">
          <ThresholdBadge label={`${ct.totalEmployeeCount} ansatte`} kind="info" />
          {ct.requiresVerneombud
            ? <ThresholdBadge label="Verneombud lovpålagt (≥5)" kind="ok" />
            : <ThresholdBadge label="< 5 ansatte" kind="info" />}
          {ct.requiresAmu
            ? <ThresholdBadge label="AMU lovpålagt (≥30)" kind="ok" />
            : ct.mayRequestAmu
              ? <ThresholdBadge label="AMU kan kreves (10–29)" kind="warn" />
              : <ThresholdBadge label="< 10 ansatte" kind="info" />}
        </div>
      </div>

      {/* Tab bar */}
      <div className="mt-4 flex gap-1 border-b border-neutral-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? 'border-b-2 border-[#1a3d32] text-[#1a3d32]' : 'text-neutral-500 hover:text-neutral-800'}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Employees ─────────────────────────────────────────────────────── */}
      {tab === 'employees' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-neutral-800">
                Ansatte ({org.activeEmployees.length} aktive{org.employees.filter(e => !e.active).length > 0 ? `, ${org.employees.filter(e => !e.active).length} inaktive` : ''})
              </h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              {org.employees.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen ansatte ennå — legg til i skjemaet til høyre.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <th className="px-4 py-3">Navn</th>
                      <th className="px-4 py-3">Stilling</th>
                      <th className="px-4 py-3">Enhet</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Handlinger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {org.employees.map((emp) => (
                      <tr key={emp.id} className={`hover:bg-neutral-50 ${!emp.active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-neutral-900">{emp.name}</div>
                          {emp.email && <div className="text-xs text-neutral-400">{emp.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 text-xs">{emp.jobTitle ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">
                          {emp.unitId ? org.unitById.get(emp.unitId)?.name : emp.department ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                            {EMPLOYMENT_LABELS[emp.employmentType]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {emp.active
                            ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Aktiv</span>
                            : <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">Inaktiv</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => startEdit(emp)} title="Rediger" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
                              <Pencil className="size-3.5" />
                            </button>
                            {emp.active && (
                              <button type="button" onClick={() => { if (confirm(`Deaktiver ${emp.name}?`)) org.deactivateEmployee(emp.id) }} title="Deaktiver" className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-50">
                                <UserMinus className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">{editingEmpId ? 'Rediger ansatt' : 'Legg til ansatt'}</h2>
            <form className="mt-4 space-y-3" onSubmit={handleEmpSubmit}>
              <div>
                <label className="text-xs font-medium text-neutral-500">Fullt navn *</label>
                <input value={empForm.name} onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))} required className={BASE_INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">E-post</label>
                <input type="email" value={empForm.email} onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))} className={BASE_INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Stilling / tittel</label>
                <input value={empForm.jobTitle} onChange={(e) => setEmpForm((f) => ({ ...f, jobTitle: e.target.value }))} className={BASE_INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Enhet</label>
                <select value={empForm.unitId} onChange={(e) => setEmpForm((f) => ({ ...f, unitId: e.target.value }))} className={BASE_INPUT}>
                  <option value="">— Ingen —</option>
                  {org.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Ansettelsestype</label>
                <select value={empForm.employmentType} onChange={(e) => setEmpForm((f) => ({ ...f, employmentType: e.target.value as EmploymentType }))} className={BASE_INPUT}>
                  {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Startdato</label>
                <input type="date" value={empForm.startDate} onChange={(e) => setEmpForm((f) => ({ ...f, startDate: e.target.value }))} className={BASE_INPUT} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]">
                  <Plus className="size-4" />
                  {editingEmpId ? 'Lagre endringer' : 'Legg til'}
                </button>
                {editingEmpId && (
                  <button type="button" onClick={() => { setEditingEmpId(null); setEmpForm({ name: '', email: '', jobTitle: '', unitId: '', employmentType: 'permanent', startDate: '' }) }}
                    className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50">
                    Avbryt
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Units ─────────────────────────────────────────────────────────── */}
      {tab === 'units' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <h2 className="mb-4 text-base font-semibold text-neutral-800">Organisasjonsstruktur</h2>
            <div className="space-y-2">
              {topLevelUnits.map((unit) => (
                <UnitRow key={unit.id} unit={unit} childrenOf={childrenOf} onDelete={org.deleteUnit} depth={0} />
              ))}
              {org.units.length === 0 && <p className="text-sm text-neutral-500">Ingen enheter ennå.</p>}
            </div>
          </div>
          <div className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">Ny enhet</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreateUnit}>
              <div>
                <label className="text-xs font-medium text-neutral-500">Navn *</label>
                <input value={unitForm.name} onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))} required className={BASE_INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Type</label>
                <select value={unitForm.kind} onChange={(e) => setUnitForm((f) => ({ ...f, kind: e.target.value as OrgUnitKind }))} className={BASE_INPUT}>
                  {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Overordnet enhet</label>
                <select value={unitForm.parentId} onChange={(e) => setUnitForm((f) => ({ ...f, parentId: e.target.value }))} className={BASE_INPUT}>
                  <option value="">— Ingen —</option>
                  {org.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Leder</label>
                <input value={unitForm.managerName} onChange={(e) => setUnitForm((f) => ({ ...f, managerName: e.target.value }))} className={BASE_INPUT} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Antall ansatte</label>
                <input type="number" min={0} value={unitForm.memberCount} onChange={(e) => setUnitForm((f) => ({ ...f, memberCount: e.target.value }))} className={BASE_INPUT} />
              </div>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]">
                <Plus className="size-4" />Opprett enhet
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Groups ────────────────────────────────────────────────────────── */}
      {tab === 'groups' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <h2 className="mb-4 text-base font-semibold text-neutral-800">Brukergrupper</h2>
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              {org.groups.length === 0 ? <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen grupper ennå.</p> : (
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
                      <button type="button" onClick={() => { if (confirm(`Slett «${g.name}»?`)) org.deleteGroup(g.id) }} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"><Trash2 className="size-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">Ny brukergruppe</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreateGroup}>
              <div><label className="text-xs font-medium text-neutral-500">Gruppenavn *</label><input value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} required className={BASE_INPUT} /></div>
              <div><label className="text-xs font-medium text-neutral-500">Beskrivelse</label><input value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} className={BASE_INPUT} /></div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Omfang</label>
                <select value={groupForm.scopeKind} onChange={(e) => setGroupForm((f) => ({ ...f, scopeKind: e.target.value as typeof groupForm.scopeKind }))} className={BASE_INPUT}>
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
                        <input type="checkbox" checked={groupForm.unitIds.includes(u.id)} onChange={(e) => setGroupForm((f) => ({ ...f, unitIds: e.target.checked ? [...f.unitIds, u.id] : f.unitIds.filter((id) => id !== u.id) }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                        <span>{u.name}</span><span className="text-xs text-neutral-400">{KIND_LABELS[u.kind]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {(groupForm.scopeKind === 'employees' || groupForm.scopeKind === 'mixed') && (
                <div>
                  <label className="text-xs font-medium text-neutral-500">Velg ansatte</label>
                  <div className="mt-1 max-h-36 overflow-y-auto space-y-1 rounded-xl border border-neutral-200 p-2">
                    {org.activeEmployees.map((emp) => (
                      <label key={emp.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={groupForm.employeeIds.includes(emp.id)} onChange={(e) => setGroupForm((f) => ({ ...f, employeeIds: e.target.checked ? [...f.employeeIds, emp.id] : f.employeeIds.filter((id) => id !== emp.id) }))} className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
                        <span>{emp.name}</span><span className="text-xs text-neutral-400">{emp.jobTitle}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]">
                <Plus className="size-4" />Opprett gruppe
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Settings ──────────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="mt-8 max-w-xl space-y-6">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">Virksomhetsinnstillinger</h2>
            <p className="text-xs text-neutral-500">
              Disse verdiene brukes til å beregne lovpålagte terskler (AML §6-1 og §7-1) og vises i AMU-modulen.
            </p>
            <div>
              <label className="text-xs font-medium text-neutral-500">Virksomhetsnavn</label>
              <input value={org.settings.orgName} onChange={(e) => org.updateSettings({ orgName: e.target.value })} className={BASE_INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Organisasjonsnummer</label>
              <input value={org.settings.orgNumber ?? ''} onChange={(e) => org.updateSettings({ orgNumber: e.target.value || undefined })} placeholder="9 siffer" className={BASE_INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                Antall ansatte (brukes for terskler når ansattliste ikke er fylt ut)
              </label>
              <input type="number" min={0} max={99999} value={org.settings.employeeCount} onChange={(e) => org.updateSettings({ employeeCount: Number(e.target.value) || 0 })} className={BASE_INPUT} />
              <p className="mt-1 text-xs text-neutral-400">
                Dersom ansattlisten er fylt ut, beregnes antallet automatisk ({org.activeEmployees.length} aktive).
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Bransje / sektor</label>
              <input value={org.settings.industrySector ?? ''} onChange={(e) => org.updateSettings({ industrySector: e.target.value || undefined })} placeholder="f.eks. Helse og omsorg, Skole, Produksjon" className={BASE_INPUT} />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3.5">
              <input type="checkbox" checked={org.settings.hasCollectiveAgreement} onChange={(e) => org.updateSettings({ hasCollectiveAgreement: e.target.checked })} className="mt-0.5 size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]" />
              <div>
                <span className="text-sm font-medium text-neutral-900">Tariffavtale gjelder</span>
                <p className="text-xs text-neutral-500">Tariffavtale kan fravike noen regler i AML.</p>
              </div>
            </label>
            {org.settings.hasCollectiveAgreement && (
              <div>
                <label className="text-xs font-medium text-neutral-500">Tariffavtalens navn</label>
                <input value={org.settings.collectiveAgreementName ?? ''} onChange={(e) => org.updateSettings({ collectiveAgreementName: e.target.value || undefined })} placeholder="f.eks. Hovedavtalen LO-NHO" className={BASE_INPUT} />
              </div>
            )}
          </div>

          {/* Computed thresholds read-only */}
          <div className="rounded-2xl border border-neutral-200/90 bg-[#faf8f4] p-5">
            <h3 className="text-sm font-semibold text-neutral-800 mb-3">Beregnede terskler (AML 2024)</h3>
            <div className="space-y-2">
              <ThresholdRow label="Antall ansatte (beregnet)" value={`${org.totalEmployeeCount}`} />
              <ThresholdRow label="Verneombud lovpålagt (AML §6-1)" value={ct.requiresVerneombud ? 'Ja (≥5 ansatte)' : 'Nei (< 5 ansatte)'} ok={ct.requiresVerneombud} />
              <ThresholdRow label="AMU kan kreves (10–29 ansatte)" value={ct.mayRequestAmu ? 'Ja — kan kreves av partene' : 'Nei'} ok={ct.mayRequestAmu} neutral={!ct.requiresAmu && !ct.mayRequestAmu} />
              <ThresholdRow label="AMU lovpålagt (AML §7-1)" value={ct.requiresAmu ? 'Ja (≥30 ansatte)' : 'Nei (< 30 ansatte)'} ok={ct.requiresAmu} />
              <ThresholdRow label="Tariffavtale" value={org.settings.hasCollectiveAgreement ? (org.settings.collectiveAgreementName ?? 'Ja') : 'Nei'} neutral />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function ThresholdBadge({ label, kind }: { label: string; kind: 'ok' | 'warn' | 'info' }) {
  const cls = kind === 'ok' ? 'bg-emerald-100 text-emerald-800' : kind === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'
  const Icon = kind === 'ok' ? CheckCircle2 : kind === 'warn' ? AlertTriangle : null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {Icon && <Icon className="size-3.5" />}{label}
    </span>
  )
}

function ThresholdRow({ label, value, ok, warn, neutral }: { label: string; value: string; ok?: boolean; warn?: boolean; neutral?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className={`font-medium ${ok ? 'text-emerald-700' : warn ? 'text-amber-700' : neutral ? 'text-neutral-500' : 'text-neutral-400'}`}>{value}</span>
    </div>
  )
}

function UnitRow({
  unit, childrenOf, onDelete, depth,
}: {
  unit: ReturnType<typeof useOrganisation>['units'][0]
  childrenOf: (id: string) => ReturnType<typeof useOrganisation>['units']
  onDelete: (id: string) => void
  depth: number
}) {
  const children = childrenOf(unit.id)
  return (
    <div>
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm ${depth > 0 ? 'ml-6 border-l-2 border-l-neutral-100' : ''}`}>
        <span className="shrink-0">{KIND_ICONS[unit.kind]}</span>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-neutral-900">{unit.name}</span>
          <span className="ml-2 text-xs text-neutral-400">{KIND_LABELS[unit.kind]}</span>
          {unit.managerName && <span className="ml-2 text-xs text-neutral-500">· {unit.managerName}</span>}
          {unit.memberCount != null && <span className="ml-2 text-xs text-neutral-400">· {unit.memberCount} ansatte</span>}
        </div>
        <button type="button" onClick={() => { if (confirm(`Slett «${unit.name}»?`)) onDelete(unit.id) }} className="rounded-lg p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="size-3.5" /></button>
      </div>
      {children.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {children.map((child) => <UnitRow key={child.id} unit={child} childrenOf={childrenOf} onDelete={onDelete} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}
