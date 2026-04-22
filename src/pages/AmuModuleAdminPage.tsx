import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ClipboardList, GitBranch, Loader2, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { ModulePageShell } from '../components/module/ModulePageShell'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../components/layout/WorkplaceStandardFormPanel'
import { LayoutTable1PostingsShell } from '../components/layout/LayoutTable1PostingsShell'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { AMU_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'
import { useAmu } from '../../modules/amu/useAmu'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { StandardTextarea } from '../components/ui/Textarea'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Tabs, type TabItem } from '../components/ui/Tabs'
import { WarningBox } from '../components/ui/AlertBox'
import { InfoBox } from '../components/ui/AlertBox'
import type { AmuDefaultAgendaItem } from '../../modules/amu/types'

const AMU_PATH = '/council/amu'

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Ingen kilde' },
  { value: 'avvik', label: 'Avvik' },
  { value: 'sick_leave', label: 'Sykefravær' },
  { value: 'whistleblowing', label: 'Varsling' },
]

type AdminTab = 'generelt' | 'standard_saksliste' | 'arbeidsflyt'

const shellTabs = [
  { key: 'generelt' as const, label: 'Generelt', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { key: 'standard_saksliste' as const, label: 'Standard saksliste', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'arbeidsflyt' as const, label: 'Arbeidsflyt', icon: <GitBranch className="h-4 w-4" /> },
]

type AmuModuleAdminPageProps = { embedded?: boolean }

export function AmuModuleAdminPage({
  embedded = false,
}: AmuModuleAdminPageProps = {}) {
  const navigate = useNavigate()
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('amu.manage')
  const amu = useAmu()

  const [tab, setTab] = useState<AdminTab>('generelt')
  const [rows, setRows] = useState<AmuDefaultAgendaItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newOrder, setNewOrder] = useState('0')
  const [newSource, setNewSource] = useState('')
  const [newSourceId, setNewSourceId] = useState('')

  const loadRows = useCallback(async () => {
    if (!canManage) return
    setLoadingList(true)
    const data = await amu.loadDefaultAgendaTemplate()
    setRows(data)
    setLoadingList(false)
  }, [amu, canManage])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadRows()
    }, 0)
    return () => window.clearTimeout(t)
  }, [loadRows])

  const tabStripItems = useMemo<TabItem[]>(
    () =>
      shellTabs.map((t) => ({
        id: t.key,
        label: t.label,
        icon: t.key === 'generelt' ? SlidersHorizontal : t.key === 'standard_saksliste' ? ClipboardList : GitBranch,
      })),
    [],
  )

  const saveRow = useCallback(
    async (r: AmuDefaultAgendaItem) => {
      setSavingId(r.id)
      const sm = (r.source_module && String(r.source_module).trim()) || null
      const idRaw = (r.source_id && String(r.source_id).trim()) || ''
      let source_id: string | null = null
      if (idRaw) {
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRe.test(idRaw)) {
          amu.setError('Kilde-ID må være en gyldig UUID.')
          setSavingId(null)
          return
        }
        source_id = idRaw
      }
      const updated = await amu.updateDefaultAgendaTemplateRow(r.id, {
        title: r.title.trim() || 'Uten tittel',
        description: r.description,
        order_index: r.order_index,
        source_module: sm,
        source_id,
      })
      if (updated) {
        setRows((list) => list.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.order_index - b.order_index))
      }
      setSavingId(null)
    },
    [amu],
  )

  const addRow = useCallback(async () => {
    if (!newTitle.trim()) {
      amu.setError('Tittel for nytt punkt kan ikke være tom.')
      return
    }
    const oi = Number.parseInt(newOrder, 10)
    const order_index = Number.isFinite(oi) ? oi : 0
    const sm = newSource.trim()
    const idTrim = newSourceId.trim()
    let source_id: string | null = null
    if (idTrim) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRe.test(idTrim)) {
        amu.setError('Kilde-ID må være en gyldig UUID.')
        return
      }
      source_id = idTrim
    }
    const created = await amu.createDefaultAgendaTemplateRow({
      title: newTitle.trim(),
      description: newDescription,
      order_index,
      source_module: sm ? sm : null,
      source_id,
    })
    if (created) {
      setRows((list) => [...list, created].sort((a, b) => a.order_index - b.order_index))
      setNewTitle('')
      setNewDescription('')
      setNewOrder('0')
      setNewSource('')
      setNewSourceId('')
    }
  }, [amu, newTitle, newDescription, newOrder, newSource, newSourceId])

  const removeRow = useCallback(
    async (id: string) => {
      const ok = await amu.deleteDefaultAgendaTemplateRow(id)
      if (ok) setRows((list) => list.filter((x) => x.id !== id))
    },
    [amu],
  )

  if (!canManage) {
    const accessBody = (
      <WarningBox>
        Du har ikke tilgang til AMU-innstillinger. Krever rollen <strong>amu.manage</strong> eller administrator.
      </WarningBox>
    )
    if (embedded) return accessBody
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Council' }, { label: 'AMU', to: AMU_PATH }, { label: 'Administrasjon' }]}
        title="AMU — administrasjon"
        headerActions={
          <Button
            type="button"
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(AMU_PATH)}
          >
            Tilbake til AMU
          </Button>
        }
      >
        {accessBody}
      </ModulePageShell>
    )
  }

  const tabsNode = (
    <Tabs
      items={tabStripItems}
      activeId={tab}
      onChange={(id) => setTab(id as AdminTab)}
      overflow="scroll"
    />
  )

  const body = (
    <>
      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      {tab === 'generelt' && (
          <div className="space-y-4">
            <InfoBox>
              Under «Standard saksliste» definerer du hvilke punkter som fylles inn når bruker klikker «Generer standard
              saksliste» i et møte. Uten rader i tabellen får brukeren beskjed om å konfigurere listen her først.
            </InfoBox>
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-900">Rettigheter</h3>
              <p className="mt-1 text-sm text-neutral-600">
                Kun brukere med <strong>amu.manage</strong> (eller org-administrator) kan endre disse innstillingene.
              </p>
            </div>
          </div>
        )}

        {tab === 'standard_saksliste' && (
          <div className="space-y-6">
            {loadingList ? (
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Laster…
              </p>
            ) : null}

            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-neutral-900">Legg til punkt</h3>
              <p className="mt-1 text-xs text-neutral-500">Nye rader lagres når du klikker «Legg til».</p>
              <div className="mt-4 space-y-4">
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <div className={WPSTD_FORM_FIELD_LABEL}>Sakstittel</div>
                    <p className="text-sm text-neutral-600">Kort navn som vises i sakslisten.</p>
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-def-title">Tittel</label>
                    <StandardInput id="amu-def-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  </div>
                </div>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <div className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</div>
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-def-desc">Beskrivelse</label>
                    <StandardTextarea id="amu-def-desc" className="min-h-[80px] w-full" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                  </div>
                </div>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <div className={WPSTD_FORM_FIELD_LABEL}>Sekvens</div>
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-def-ord">Rekkefølge (0 = først)</label>
                    <StandardInput id="amu-def-ord" type="number" value={newOrder} onChange={(e) => setNewOrder(e.target.value)} />
                  </div>
                </div>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <div className={WPSTD_FORM_FIELD_LABEL}>Kildepunkt (valgfritt)</div>
                    <p className="text-sm text-neutral-600">Polymorf kobling til f.eks. avvik- eller fraværsmodulen.</p>
                  </div>
                  <div>
                    <SearchableSelect value={newSource} options={SOURCE_OPTIONS} onChange={setNewSource} />
                  </div>
                </div>
                <div className={WPSTD_FORM_ROW_GRID}>
                  <div>
                    <div className={WPSTD_FORM_FIELD_LABEL}>Kilde-ID (valgfri)</div>
                    <p className="text-sm text-neutral-600">UUID til konkret post når saken skal peke på et bestemt avvik el.l.</p>
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-def-sid">UUID</label>
                    <StandardInput
                      id="amu-def-sid"
                      value={newSourceId}
                      onChange={(e) => setNewSourceId(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="primary" onClick={() => void addRow()} icon={<Plus className="h-4 w-4" />}>
                  Legg til
                </Button>
              </div>
            </div>

            <LayoutTable1PostingsShell
              wrap
              title="Definert standard saksliste"
              description="Endre rader under og klikk «Lagre» per rad. Dette brukes når møtet genererer sakslisten."
              toolbar={
                <span className="text-xs text-neutral-500">
                  {rows.length === 0
                    ? 'Ingen rader — legg inn minst én for å bruke generering i møtevisningen.'
                    : `${rows.length} punkt${rows.length === 1 ? '' : 'er'}.`}
                </span>
              }
            >
              {rows.length === 0 && !loadingList ? (
                <p className="px-5 py-10 text-center text-sm text-neutral-600">Ingen punkt. Legg inn standard saker over.</p>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-20">#</th>
                      <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sak</th>
                      <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-32">Kilde</th>
                      <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-40">Kilde-ID</th>
                      <th className="bg-neutral-50 px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <DefaultAgendaEditRow
                        key={r.id}
                        row={r}
                        saving={savingId === r.id}
                        onChange={(path, val) => {
                          setRows((list) => list.map((x) => (x.id === r.id ? { ...x, [path]: val } : x)))
                        }}
                        onSave={() => void saveRow(r)}
                        onDelete={() => void removeRow(r.id)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </LayoutTable1PostingsShell>
          </div>
        )}

      {tab === 'arbeidsflyt' && (
        <div className="max-w-4xl space-y-3">
          <p className="text-sm text-neutral-600">
            <strong>ON_AMU_MEETING_SCHEDULED</strong> utløses når møtet har status planlagt (f.eks. e-post/Teams til deltakere).{' '}
            <strong>ON_AMU_MEETING_SIGNED</strong> utløses når referat er signert (f.eks. distribuere minutter).
          </p>
          <WorkflowRulesTab
            supabase={supabase}
            module="amu"
            triggerEvents={AMU_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
          />
        </div>
      )}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-6">
        {tabsNode}
        {body}
      </div>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Council' }, { label: 'AMU', to: AMU_PATH }, { label: 'Administrasjon' }]}
      title="AMU — administrasjon"
      description="Standard saksliste gjelder hele virksomheten når brukere genererer agenda for nye møter. Arbeidsflyt utløses når møtet settes som planlagt (innkalling) og når referat signeres."
      headerActions={
        <Button
          type="button"
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(AMU_PATH)}
        >
          Tilbake til møter
        </Button>
      }
      tabs={tabsNode}
    >
      {body}
    </ModulePageShell>
  )
}

function DefaultAgendaEditRow({
  row,
  saving,
  onChange,
  onSave,
  onDelete,
}: {
  row: AmuDefaultAgendaItem
  saving: boolean
  onChange: (path: keyof AmuDefaultAgendaItem, val: string | number | null) => void
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <tr className="border-b border-neutral-100">
      <td className="align-top px-5 py-3">
        <StandardInput
          className="w-16"
          type="number"
          value={String(row.order_index)}
          onChange={(e) => onChange('order_index', Number(e.target.value))}
        />
      </td>
      <td className="align-top px-5 py-3">
        <div className="min-w-0 max-w-md space-y-2">
          <StandardInput value={row.title} onChange={(e) => onChange('title', e.target.value)} />
          <StandardTextarea className="min-h-[72px] w-full" value={row.description} onChange={(e) => onChange('description', e.target.value)} />
        </div>
      </td>
      <td className="align-top px-5 py-3">
        <SearchableSelect
          value={row.source_module ?? ''}
          options={SOURCE_OPTIONS}
          onChange={(v) => onChange('source_module', v || null)}
        />
      </td>
      <td className="align-top px-5 py-3">
        <StandardInput
          className="max-w-[11rem] font-mono text-xs"
          value={row.source_id ?? ''}
          onChange={(e) => onChange('source_id', e.target.value || null)}
          placeholder="Valgfri UUID"
        />
      </td>
      <td className="align-top px-5 py-3 text-right">
        <div className="inline-flex items-center justify-end gap-0.5">
          <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onSave} icon={<Save className="h-3.5 w-3.5" />}>
            {saving ? 'Lagrer' : 'Lagre'}
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onDelete} icon={<Trash2 className="h-4 w-4" />} aria-label="Slett" />
        </div>
      </td>
    </tr>
  )
}
