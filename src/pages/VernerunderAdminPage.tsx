import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  GitBranch,
  Loader2,
  Plus,
  Save,
  SlidersHorizontal,
  Tags,
  Trash2,
} from 'lucide-react'
import { ModuleAdminShell } from '../components/layout/ModuleAdminShell'
import { ModulePageShell } from '../components/module/ModulePageShell'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../components/layout/layoutTable1PostingsKit'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { VERNERUNDER_WORKFLOW_TRIGGER_EVENTS } from '../components/workflow/workflowTriggerRegistry'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useVernerunde } from '../../modules/vernerunder/useVernerunde'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { StandardTextarea } from '../components/ui/Textarea'
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect'
import { Tabs } from '../components/ui/Tabs'
import { WarningBox, InfoBox } from '../components/ui/AlertBox'
import type { VernerundeTemplateItemRow, VernerundeTemplateRow } from '../../modules/vernerunder/types'

const CARD = 'rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

type AdminTab = 'generelt' | 'maler' | 'kategorier' | 'arbeidsflyt'

const TAB_ICONS: Record<AdminTab, ElementType> = {
  generelt: SlidersHorizontal,
  maler: ClipboardList,
  kategorier: Tags,
  arbeidsflyt: GitBranch,
}

export function VernerunderAdminPage() {
  const navigate = useNavigate()
  const { supabase, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('vernerunder.manage')
  const v = useVernerunde({ skipInitialLoad: true })
  const [tab, setTab] = useState<AdminTab>('generelt')

  useEffect(() => {
    if (canManage) void v.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.load, canManage])

  const shellTabs = useMemo(
    () => [
      { key: 'generelt', label: 'Generelt', icon: <SlidersHorizontal className="h-4 w-4" /> },
      { key: 'maler', label: 'Maler', icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'kategorier', label: 'Kategorier', icon: <Tags className="h-4 w-4" /> },
      { key: 'arbeidsflyt', label: 'Arbeidsflyt', icon: <GitBranch className="h-4 w-4" /> },
    ],
    [],
  )

  const tabsUiItems = useMemo(
    () =>
      shellTabs.map((t) => ({
        id: t.key,
        label: t.label,
        icon: TAB_ICONS[t.key as AdminTab],
      })),
    [shellTabs],
  )

  if (!canManage) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Vernerunder', to: '/vernerunder' }, { label: 'Administrasjon' }]}
        title="Vernerunder — administrasjon"
      >
        <WarningBox>
          Du har ikke tilgang til vernerunder-innstillinger. Krever rettigheten «vernerunder.manage» eller administrator.
        </WarningBox>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Vernerunder', to: '/vernerunder' }, { label: 'Administrasjon' }]}
      title="Vernerunder — administrasjon"
      description="Kategorier, maler og arbeidsflyt. Lister er fullt dynamiske (Supabase) — ingen forhåndsdefinerte rader i denne filen."
      headerActions={
        <Button
          type="button"
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/vernerunder')}
        >
          Tilbake til runder
        </Button>
      }
    >
      {v.error ? <WarningBox>{v.error}</WarningBox> : null}

      <ModuleAdminShell
        title="Vernerunder"
        description="Innhold og regler gjelder kun valgt organisasjon."
        tabs={shellTabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as AdminTab)}
        layout="tabsTop"
        tabStrip={<Tabs items={tabsUiItems} activeId={tab} onChange={(id) => setTab(id as AdminTab)} />}
      >
        {tab === 'generelt' && <GenereltTab />}
        {tab === 'maler' && <MalerTab v={v} />}
        {tab === 'kategorier' && <KategorierTab v={v} />}
        {tab === 'arbeidsflyt' && (
          <WorkflowRulesTab
            supabase={supabase}
            module="vernerunder"
            triggerEvents={[...VERNERUNDER_WORKFLOW_TRIGGER_EVENTS]}
          />
        )}
      </ModuleAdminShell>
    </ModulePageShell>
  )
}

function GenereltTab() {
  return (
    <div className={`${CARD} p-5 md:p-6`} style={CARD_SHADOW}>
      <h3 className="text-sm font-semibold text-neutral-900">Generelt</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Bruk Kategorier for funn-klassifisering og Maler for sjekklistemaler. Når en vernerunde opprettes med valgt mal, kan
        sjekkliste-punkter importeres fra malen.
      </p>
      <div className="mt-4">
        <InfoBox>
          Arbeidsflyt reagerer på hendelser som `ON_VERNERUNDE_PLANNED`, `ON_VERNERUNDE_COMPLETED` og `ON_FINDING_REGISTERED`
          når de er aktivert i databasen (se migrasjon) — i tillegg til hendelser som utløses fra app (f.eks. manuell
          arbeidsflyt-dispatch for funn).
        </InfoBox>
      </div>
    </div>
  )
}

function KategorierTab({ v }: { v: ReturnType<typeof useVernerunde> }) {
  const [newName, setNewName] = useState('')

  return (
    <div className="space-y-4">
      <div className={`${CARD} p-4`} style={CARD_SHADOW}>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Ny kategori</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <span className={WPSTD_FORM_FIELD_LABEL}>Navn</span>
            <StandardInput className="mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              if (!newName.trim()) {
                v.setError('Skriv inn et navn.')
                return
              }
              const row = await v.addCategory(newName)
              if (row) setNewName('')
            }}
            icon={<Plus className="h-4 w-4" aria-hidden />}
          >
            Legg til
          </Button>
        </div>
      </div>

      {v.loading && v.categories.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Laster kategorier…
        </p>
      ) : v.categories.length === 0 ? (
        <p className="text-center text-sm text-neutral-500">Ingen kategorier. Opprett den første over.</p>
      ) : (
        <div className={`${CARD} overflow-hidden`} style={CARD_SHADOW}>
          <table className="w-full min-w-0 text-left text-sm text-neutral-800">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Navn</th>
                <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-32 text-right`} />
              </tr>
            </thead>
            <tbody>
              {v.categories.map((c) => (
                <KategoriRow
                  key={`${c.id}-${c.name}`}
                  v={v}
                  c={c}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KategoriRow({ v, c }: { v: ReturnType<typeof useVernerunde>; c: { id: string; name: string } }) {
  const [name, setName] = useState(c.name)
  const dirty = name !== c.name
  return (
    <tr className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
      <td className="px-5 py-2">
        <StandardInput className="w-full max-w-md" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="px-5 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!dirty}
            onClick={async () => {
              await v.updateCategory(c.id, name)
            }}
            icon={<Save className="h-3.5 w-3.5" aria-hidden />}
          >
            Lagre
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Slett"
            onClick={() => void v.deleteCategory(c.id)}
            icon={<Trash2 className="h-4 w-4" />}
          />
        </div>
      </td>
    </tr>
  )
}

function MalerTab({ v }: { v: ReturnType<typeof useVernerunde> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const firstTemplateId = v.templates[0]?.id ?? null
  const effectiveId = selectedId ?? firstTemplateId
  const template = effectiveId ? (v.templates.find((t) => t.id === effectiveId) ?? null) : null
  const items = effectiveId ? (v.templateItemsByTemplateId[effectiveId] ?? []) : []

  useEffect(() => {
    if (effectiveId) {
      void v.loadTemplateItems(effectiveId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId, v.loadTemplateItems])

  const categoryOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Ingen kategori' }, ...v.categories.map((c) => ({ value: c.id, label: c.name }))],
    [v.categories],
  )

  return (
    <div className="space-y-4">
      {v.templates.length === 0 && !v.loading ? (
        <p className="text-sm text-neutral-600">Ingen maler. Opprett en under.</p>
      ) : null}

      <div className={`${CARD} p-4`} style={CARD_SHADOW}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-neutral-500">Ny mal</p>
            <MalerOpprettForm v={v} onCreated={(t) => setSelectedId(t.id)} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-2">
          <p className="text-xs font-semibold uppercase text-neutral-500">Maler</p>
          <ul className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
            {v.templates.map((t) => (
              <li key={t.id}>
                <Button
                  type="button"
                  variant={effectiveId === t.id ? 'primary' : 'secondary'}
                  size="sm"
                  className="w-full justify-start font-normal"
                  onClick={() => setSelectedId(t.id)}
                >
                  {t.name}
                </Button>
              </li>
            ))}
          </ul>
        </aside>
        {template && effectiveId ? (
          <Maldetalj v={v} template={template} items={items} categoryOptions={categoryOptions} templateId={effectiveId} />
        ) : v.loading ? (
          <p className="text-sm text-neutral-500">Laster…</p>
        ) : null}
      </div>
    </div>
  )
}

function MalerOpprettForm({ v, onCreated }: { v: ReturnType<typeof useVernerunde>; onCreated: (t: VernerundeTemplateRow) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className="mt-2 space-y-3">
      <div className={WPSTD_FORM_ROW_GRID}>
        <span className={WPSTD_FORM_FIELD_LABEL}>Navn</span>
        <StandardInput value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className={WPSTD_FORM_ROW_GRID}>
        <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse (valgfritt)</span>
        <StandardTextarea className="min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={async () => {
          if (!name.trim()) {
            v.setError('Malnavn er påkrevd.')
            return
          }
          const t = await v.addTemplate({ name, description: description || null })
          if (t) onCreated(t)
        }}
        icon={<Plus className="h-4 w-4" aria-hidden />}
      >
        Opprett mal
      </Button>
    </div>
  )
}

function Maldetalj({
  v,
  template,
  items,
  categoryOptions,
  templateId,
}: {
  v: ReturnType<typeof useVernerunde>
  template: VernerundeTemplateRow
  items: VernerundeTemplateItemRow[]
  categoryOptions: SelectOption[]
  templateId: string
}) {
  return (
    <MaldetaljBody
      key={`${templateId}-${template.name}-${template.description ?? ''}`}
      v={v}
      template={template}
      items={items}
      categoryOptions={categoryOptions}
      templateId={templateId}
    />
  )
}

function MaldetaljBody({
  v,
  template,
  items,
  categoryOptions,
  templateId,
}: {
  v: ReturnType<typeof useVernerunde>
  template: VernerundeTemplateRow
  items: VernerundeTemplateItemRow[]
  categoryOptions: SelectOption[]
  templateId: string
}) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')

  const metaDirty = name !== template.name || (description || '') !== (template.description || '')

  const onSaveMeta = useCallback(async () => {
    await v.updateTemplate(templateId, { name, description: description || null })
  }, [v, templateId, name, description])

  return (
    <div className={`min-w-0 space-y-4`}>
      <div className={`${CARD} p-4`} style={CARD_SHADOW}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Mal</h3>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!metaDirty} onClick={() => void onSaveMeta()}>
              <Save className="h-4 w-4" aria-hidden />
              Lagre mal
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (window.confirm('Slette hele malen og tilhørende punkter?')) {
                  void v.deleteTemplate(templateId)
                }
              }}
            >
              Slett mal
            </Button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Navn</span>
            <StandardInput value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</span>
            <StandardTextarea className="min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`} style={CARD_SHADOW}>
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
          <span className="text-xs font-semibold uppercase text-neutral-600">Sjekkliste (malpunkter)</span>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={async () => {
              const pos = items.length > 0 ? Math.max(...items.map((i) => i.position)) + 1 : 0
              await v.addTemplateItem({
                templateId,
                question_text: 'Nytt sjekkspørsmål',
                position: pos,
              })
            }}
            icon={<Plus className="h-4 w-4" aria-hidden />}
          >
            Legg til punkt
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen punkter. Legg til sjekkspørsmål for denne malen.</p>
        ) : (
          <table className="w-full min-w-0 text-left text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>#</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Spørsmål</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori (funn)</th>
                <th className={`${LAYOUT_TABLE1_POSTINGS_TH} w-20 text-right`} />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <MalpunktRad
                  key={`${it.id}-${it.question_text}-${it.position}-${it.category_id ?? ''}`}
                  v={v}
                  templateId={templateId}
                  item={it}
                  categoryOptions={categoryOptions}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function MalpunktRad({
  v,
  templateId,
  item,
  categoryOptions,
}: {
  v: ReturnType<typeof useVernerunde>
  templateId: string
  item: VernerundeTemplateItemRow
  categoryOptions: SelectOption[]
}) {
  const [q, setQ] = useState(item.question_text)
  const [pos, setPos] = useState(String(item.position))
  const [cat, setCat] = useState(item.category_id ?? '')
  const qDirty = q !== item.question_text
  const posDirty = String(item.position) !== pos
  const catDirty = (item.category_id ?? '') !== cat

  return (
    <tr className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
      <td className="w-20 px-5 py-2">
        <StandardInput
          className="w-16"
          value={pos}
          onChange={(e) => setPos(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          aria-label="Rekkefølge"
        />
      </td>
      <td className="px-5 py-2">
        <StandardTextarea className="min-h-[60px] w-full max-w-2xl" value={q} onChange={(e) => setQ(e.target.value)} />
      </td>
      <td className="min-w-[10rem] px-5 py-2">
        <SearchableSelect value={cat} options={categoryOptions} onChange={setCat} />
      </td>
      <td className="px-5 py-2 text-right">
        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!qDirty && !posDirty && !catDirty}
            onClick={async () => {
              const p = parseInt(pos, 10)
              await v.updateTemplateItem(templateId, item.id, {
                question_text: q,
                category_id: cat || null,
                position: Number.isNaN(p) ? item.position : p,
              })
            }}
            icon={<Save className="h-3.5 w-3.5" aria-hidden />}
          >
            Lagre
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Slett"
            onClick={() => {
              if (window.confirm('Fjerne dette punktet fra malen?')) {
                void v.deleteTemplateItem(templateId, item.id)
              }
            }}
            icon={<Trash2 className="h-4 w-4" />}
          />
        </div>
      </td>
    </tr>
  )
}
