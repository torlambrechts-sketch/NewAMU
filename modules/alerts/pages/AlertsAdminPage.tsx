// Alerts admin — categories + template toggle/override + retention policy.
// Three tabs to keep the page lean. Mirrors compliance/meetings admin shape.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_CONFIDENTIALITY_LABEL } from '../alertsLabels'

type Tab = 'maler' | 'kategorier' | 'retention'

export function AlertsAdminPage() {
  const alerts = useAlerts()
  const [tab, setTab] = useState<Tab>('maler')

  const sortedCats = useMemo(() => [...alerts.categories].sort((a, b) => a.position - b.position), [alerts.categories])

  if (!alerts.canManage) {
    return (
      <ModulePageShell breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: 'Innstillinger' }]} title="Innstillinger">
        <div className="rounded-none border border-red-200 bg-red-50 p-6 text-sm text-red-700">
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
        {(['maler', 'kategorier', 'retention'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-[#b91c1c] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
          >
            {t === 'maler' ? 'Maler' : t === 'kategorier' ? 'Kategorier' : 'Oppbevaring'}
          </button>
        ))}
      </div>

      {tab === 'maler' ? <TemplatesTab alerts={alerts} /> : null}
      {tab === 'kategorier' ? <CategoriesTab alerts={alerts} sortedCats={sortedCats} /> : null}
      {tab === 'retention' ? <RetentionTab alerts={alerts} /> : null}
    </ModulePageShell>
  )
}

function TemplatesTab({ alerts }: { alerts: ReturnType<typeof useAlerts> }) {
  return (
    <section className="rounded-none border border-neutral-200 bg-white">
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
    </section>
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
      <section className="rounded-none border border-neutral-200 bg-white">
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
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(`Slette kategorien «${c.name}»?`)) void alerts.softDeleteCategory(c.id) }}
                      className="text-red-700 hover:text-red-900"
                    >
                      <Trash2 className="inline size-4" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-none border border-neutral-200 bg-white p-6">
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
      </section>
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
    <section className="rounded-none border border-neutral-200 bg-white">
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
    </section>
  )
}
