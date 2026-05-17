// Alerts admin — categories + template toggle/override + retention policy.
// Three tabs to keep the page lean. Mirrors compliance/meetings admin shape.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Plus, Trash2, Users } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_CONFIDENTIALITY_LABEL } from '../alertsLabels'

type Tab = 'maler' | 'kategorier' | 'roster' | 'retention'

const COMMITTEE_PERMS: { key: string; label: string; description: string }[] = [
  { key: 'alerts.committee', label: 'Varslingsutvalg (mottak)', description: 'Mottar og behandler standard + begrensede saker. Pliktig for alle organisasjoner med 5+ ansatte (AML § 2A-7).' },
  { key: 'alerts.committee_confidential', label: 'Konfidensielt utvalg', description: 'Tilgang til sensitive saker (seksuell trakassering, gjengjeldelse). Strikt undermengde av komiteen — kun rollebærere med høyeste tillit.' },
  { key: 'alerts.committee_escalated', label: 'Eskalert utvalg (mot leder)', description: 'Eget utvalg for varsler som angår den normale mottakeren (daglig leder, styreleder). AML § 2A-2 (3).' },
  { key: 'alerts.dpo', label: 'Personvernombud (DPO)', description: 'Pålagt for GDPR-brudd-behandling (Art. 33–34) og Art. 17 sletteforespørsler.' },
]

export function AlertsAdminPage() {
  const alerts = useAlerts()
  const [tab, setTab] = useState<Tab>('maler')

  const sortedCats = useMemo(() => [...alerts.categories].sort((a, b) => a.position - b.position), [alerts.categories])

  if (!alerts.canManage) {
    return (
      <ModulePageShell breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: 'Innstillinger' }]} title="Innstillinger">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Du har ikke tilgang til å redigere varslings-innstillinger.
        </div>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: 'Innstillinger' }]}
      title="Innstillinger"
      description="Maler, kategorier og oppbevaringsfrister for varslinger."
      headerActions={<Link to="/alerts"><Button variant="ghost" icon={<ArrowLeft className="size-4" />}>Tilbake</Button></Link>}
      loading={alerts.loading}
    >
      <div className="flex gap-2 border-b border-neutral-200">
        {(['maler', 'kategorier', 'roster', 'retention'] as Tab[]).map((t) => (
          <Button
            key={t}
            variant="ghost"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-none border-b-2 px-3 py-2 text-sm font-medium hover:bg-transparent ${tab === t ? 'border-[#b91c1c] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
          >
            {t === 'maler' ? 'Maler' : t === 'kategorier' ? 'Kategorier' : t === 'roster' ? 'Utvalg' : 'Oppbevaring'}
          </Button>
        ))}
      </div>

      {tab === 'maler' ? <TemplatesTab alerts={alerts} /> : null}
      {tab === 'kategorier' ? <CategoriesTab alerts={alerts} sortedCats={sortedCats} /> : null}
      {tab === 'roster' ? <CommitteeRosterTab /> : null}
      {tab === 'retention' ? <RetentionTab alerts={alerts} /> : null}
    </ModulePageShell>
  )
}

function TemplatesTab({ alerts }: { alerts: ReturnType<typeof useAlerts> }) {
  return (
    <ModuleSectionCard>
      <div className="border-b border-neutral-100 px-6 py-3"><h2 className="text-sm font-semibold">Aktive maler</h2></div>
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
          <tr>
            <th className="px-6 py-2 text-left">Mal</th>
            <th className="px-6 py-2 text-left">Type</th>
            <th className="px-6 py-2 text-left">Kategori</th>
            <th className="px-6 py-2 text-left">Konfidensialitet</th>
            <th className="px-6 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {alerts.resolvedTemplates.map((t) => {
            const settings = alerts.orgSettings.find((s) => s.system_template_id === t.id)
            return (
              <tr key={t.id}>
                <td className="px-6 py-3">
                  <p className="font-medium">{t.name}</p>
                  {t.description ? <p className="mt-0.5 text-xs text-neutral-500">{t.description}</p> : null}
                </td>
                <td className="px-6 py-3"><Badge variant="neutral">{ALERT_KIND_SHORT_LABEL[t.templateKind]}</Badge></td>
                <td className="px-6 py-3">
                  <SearchableSelect
                    value={t.categoryId ?? ''}
                    onChange={(v) => void alerts.upsertOrgTemplateSetting({ systemTemplateId: t.id, categoryId: v || null })}
                    options={[{ value: '', label: '— uten —' }, ...alerts.categories.map((c) => ({ value: c.id, label: c.name }))]}
                  />
                </td>
                <td className="px-6 py-3"><Badge variant={t.defaultConfidentialityLevel === 'confidential' ? 'critical' : t.defaultConfidentialityLevel === 'restricted' ? 'warning' : 'neutral'}>{ALERT_CONFIDENTIALITY_LABEL[t.defaultConfidentialityLevel]}</Badge></td>
                <td className="px-6 py-3">
                  <Button
                    size="sm"
                    variant={settings?.enabled === false ? 'secondary' : 'ghost'}
                    onClick={() => void alerts.upsertOrgTemplateSetting({ systemTemplateId: t.id, enabled: !(settings?.enabled !== false) })}
                  >
                    {settings?.enabled === false ? 'Skrudd av' : 'Aktiv'}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ModuleSectionCard>
  )
}

function CategoriesTab({ alerts, sortedCats }: { alerts: ReturnType<typeof useAlerts>; sortedCats: ReturnType<typeof useAlerts>['categories'] }) {
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [busy, setBusy] = useState(false)

  async function createCategory() {
    if (!newSlug.trim() || !newName.trim()) return
    setBusy(true)
    const ok = await alerts.upsertCategory({ slug: newSlug.trim(), name: newName.trim(), description: newDesc.trim() || null })
    setBusy(false)
    if (ok) { setNewSlug(''); setNewName(''); setNewDesc('') }
  }

  return (
    <div className="space-y-4">
      <ModuleSectionCard>
        <div className="border-b border-neutral-100 px-6 py-3"><h2 className="text-sm font-semibold">Kategorier</h2></div>
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr>
              <th className="px-6 py-2 text-left">Slug</th>
              <th className="px-6 py-2 text-left">Navn</th>
              <th className="px-6 py-2 text-left">Posisjon</th>
              <th className="px-6 py-2 text-left">System</th>
              <th className="px-6 py-2 text-right">Handlinger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedCats.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-3 font-mono text-xs">{c.slug}</td>
                <td className="px-6 py-3">{c.name}</td>
                <td className="px-6 py-3">{c.position}</td>
                <td className="px-6 py-3">{c.is_system ? <Badge variant="info">System</Badge> : null}</td>
                <td className="px-6 py-3 text-right">
                  {!c.is_system ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { if (window.confirm(`Slette kategorien «${c.name}»?`)) void alerts.softDeleteCategory(c.id) }}
                      className="h-auto w-auto p-0 text-red-700 hover:bg-transparent hover:text-red-900"
                      aria-label={`Slett ${c.name}`}
                    >
                      <Trash2 className="inline size-4" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-6">
        <h2 className="text-sm font-semibold">Ny kategori</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-600">Slug</label>
            <StandardInput value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="vendor" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-600">Navn</label>
            <StandardInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Leverandører" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-600">Beskrivelse</label>
            <StandardInput value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 text-right">
          <Button variant="primary" icon={<Plus className="size-4" />} disabled={busy || !newSlug.trim() || !newName.trim()} onClick={() => void createCategory()}>
            Legg til
          </Button>
        </div>
      </ModuleSectionCard>
    </div>
  )
}

type RosterRow = {
  permKey: string
  roleId: string | null
  roleName: string | null
  roleSlug: string | null
  memberCount: number | null
}

function CommitteeRosterTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [rows, setRows] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        // 1. Find all role rows that hold any alerts.* permission
        const permKeys = COMMITTEE_PERMS.map((p) => p.key)
        const rpRes = await supabase
          .from('role_permissions')
          .select('role_id, permission_key')
          .in('permission_key', permKeys)
        if (rpRes.error || !rpRes.data) {
          setRows([])
          return
        }

        // 2. Look up the role names for those role_ids
        const roleIds = Array.from(new Set(rpRes.data.map((r) => r.role_id as string)))
        const rolesRes = roleIds.length > 0
          ? await supabase
              .from('role_definitions')
              .select('id, name, slug, organization_id')
              .in('id', roleIds)
          : { data: [], error: null }
        const rolesById = new Map(
          ((rolesRes.data ?? []) as Array<{ id: string; name: string; slug: string; organization_id: string | null }>).map((r) => [r.id, r])
        )

        // 3. Build one row per (permission × role). Skip roles from other orgs.
        const out: RosterRow[] = []
        for (const perm of COMMITTEE_PERMS) {
          const holders = rpRes.data
            .filter((r) => r.permission_key === perm.key)
            .map((r) => rolesById.get(r.role_id as string))
            .filter((role): role is NonNullable<typeof role> => !!role)
            .filter((role) => role.organization_id == null || role.organization_id === orgId)
          if (holders.length === 0) {
            out.push({ permKey: perm.key, roleId: null, roleName: null, roleSlug: null, memberCount: null })
          } else {
            for (const role of holders) {
              out.push({ permKey: perm.key, roleId: role.id, roleName: role.name, roleSlug: role.slug, memberCount: null })
            }
          }
        }
        if (!cancelled) setRows(out)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supabase, orgId])

  const grouped = useMemo(() => {
    const map = new Map<string, RosterRow[]>()
    for (const r of rows) {
      const list = map.get(r.permKey) ?? []
      list.push(r)
      map.set(r.permKey, list)
    }
    return COMMITTEE_PERMS.map((perm) => ({
      perm,
      rows: map.get(perm.key) ?? [],
    }))
  }, [rows])

  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-5">
        <p className="text-sm text-neutral-700">
          Varslingsutvalget styres via plattformens rollesystem. Tildel <strong>alerts.*</strong>-rettigheter til en
          rolle, og alle medlemmer av rollen får utvalgs-tilgang. Under ser du hvilke roller som per nå
          har hvilken tilgang.
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          Faktisk redigering av rolletilganger skjer under{' '}
          <Link to="/organisation/admin/roles" className="font-medium text-[#b91c1c] underline">
            Organisasjon → Roller
          </Link>
          . Personlige medlemmer per rolle administreres samme sted.
        </p>
      </ModuleSectionCard>

      {grouped.map(({ perm, rows }) => (
        <ModuleSectionCard key={perm.key}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-6 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-neutral-400" aria-hidden />
                <h3 className="text-sm font-semibold text-neutral-900">{perm.label}</h3>
                <Badge variant="neutral">{perm.key}</Badge>
              </div>
              <p className="mt-1 text-xs text-neutral-600">{perm.description}</p>
            </div>
            <Link
              to="/organisation/admin/roles"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#b91c1c] hover:underline"
            >
              Rediger <ExternalLink className="size-3" />
            </Link>
          </div>
          {loading ? (
            <p className="px-6 py-4 text-sm text-neutral-500">Laster …</p>
          ) : rows.length === 0 || rows.every((r) => r.roleId == null) ? (
            <div className="px-6 py-4 text-sm text-amber-900">
              <strong>Ingen rolle har denne tilgangen.</strong>{' '}
              {perm.key === 'alerts.committee'
                ? 'AML § 2A-7 krever at 5+ ansatte har et mottak — opprett en «Varslingsutvalg»-rolle og gi den denne nøkkelen.'
                : perm.key === 'alerts.dpo'
                ? 'Du må peke ut et personvernombud før GDPR-brudd kan håndteres her.'
                : 'Tildel rollen før saker av denne typen mottas.'}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.filter((r) => r.roleId).map((r) => (
                <li key={`${perm.key}:${r.roleId}`} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">{r.roleName}</span>
                    <Badge variant="info">{r.roleSlug}</Badge>
                  </div>
                  <span className="text-xs text-neutral-500">
                    Tildelt
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ModuleSectionCard>
      ))}
    </div>
  )
}

function RetentionTab({ alerts }: { alerts: ReturnType<typeof useAlerts> }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  async function applyOverride(systemTemplateId: string) {
    const raw = overrides[systemTemplateId]
    const value = raw === '' || raw == null ? null : parseInt(raw, 10)
    if (raw !== '' && raw != null && (!Number.isFinite(value) || value! < 1)) return
    await alerts.upsertOrgTemplateSetting({ systemTemplateId, overrideRetentionYears: value })
    setOverrides({ ...overrides, [systemTemplateId]: '' })
  }

  return (
    <ModuleSectionCard>
      <div className="border-b border-neutral-100 px-6 py-3">
        <h2 className="text-sm font-semibold">Oppbevaring per mal</h2>
        <p className="mt-1 text-xs text-neutral-500">Du kan utvide oppbevaringsfristen (aldri kortere enn standardverdien). Eksempel: HMS-avvik knyttet til kjemikalie-eksponering → 30 år (Forskrift om utførelse av arbeid kap. 31).</p>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
          <tr>
            <th className="px-6 py-2 text-left">Mal</th>
            <th className="px-6 py-2 text-left">Standard (år)</th>
            <th className="px-6 py-2 text-left">Org-override</th>
            <th className="px-6 py-2 text-left">Ny verdi</th>
            <th className="px-6 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {alerts.resolvedTemplates.map((t) => {
            const settings = alerts.orgSettings.find((s) => s.system_template_id === t.id)
            const baseRow = alerts.systemTemplates.find((s) => s.id === t.id)
            return (
              <tr key={t.id}>
                <td className="px-6 py-3">{t.name}</td>
                <td className="px-6 py-3">{baseRow?.default_retention_years ?? '—'}</td>
                <td className="px-6 py-3">{settings?.override_retention_years ?? '—'}</td>
                <td className="px-6 py-3">
                  <StandardInput
                    type="number"
                    min={baseRow?.default_retention_years ?? 1}
                    value={overrides[t.id] ?? ''}
                    onChange={(e) => setOverrides({ ...overrides, [t.id]: e.target.value })}
                  />
                </td>
                <td className="px-6 py-3 text-right">
                  <Button size="sm" onClick={() => void applyOverride(t.id)} disabled={overrides[t.id] === undefined}>Lagre</Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ModuleSectionCard>
  )
}
