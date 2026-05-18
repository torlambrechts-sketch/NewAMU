// ComplianceBuilder — full builder canvas for compliance checklists.
//
// Replaces the slide-panel TemplateEditorPanel approach inside the
// studio shell with a real 3-column StudioCanvas:
//   - Left:   ordered checklist items, dnd-kit reorder, + Ny item
//   - Center: per-item editor (prompt, type, severity, law_ref, help)
//   - Right:  template-level properties (name, slug, pack, review status)
//
// Saves write back to compliance_checklist_templates via
// useChecklistModule. Designed as the canonical pattern for the other
// scopes' builders.

import { useCallback, useMemo, useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader2, Save, Trash2 } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StudioCanvas, type StudioCanvasAdapter } from '../../../src/components/studio/shell/StudioCanvas'
import { PublishBar } from '../../../src/components/studio/shell/PublishBar'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from '../useChecklistModule'
import { parseChecklistDefinition } from '../schema'
import type {
  ChecklistItem,
  ChecklistItemType,
  ComplianceSeverity,
  ComplianceTemplateRow,
} from '../types'

const ITEM_TYPE_OPTIONS = [
  { value: 'yes_no_na', label: 'Ja / Nei / N/A' },
  { value: 'text', label: 'Tekst' },
  { value: 'number', label: 'Tall' },
  { value: 'photo', label: 'Bilde' },
  { value: 'signature', label: 'Signatur' },
]

const SEVERITY_OPTIONS = [
  { value: '', label: '(Ingen)' },
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

export type ComplianceBuilderProps = {
  templateId: string
}

function nextKey(items: ChecklistItem[]): string {
  let n = items.length + 1
  while (items.some((it) => it.key === `item-${n}`)) n += 1
  return `item-${n}`
}

export function ComplianceBuilder({ templateId }: ComplianceBuilderProps) {
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const template: ComplianceTemplateRow | null = useMemo(
    () => cl.templates.find((t) => t.id === templateId) ?? null,
    [cl.templates, templateId],
  )

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedFromId, setLoadedFromId] = useState<string | null>(null)

  // Sync local state once when the template id changes — derived-state
  // pattern (no effect) so the lint rule stays happy.
  if (template && template.id !== loadedFromId) {
    setLoadedFromId(template.id)
    setName(template.name)
    setDescription(template.description ?? '')
    const parsed = parseChecklistDefinition(template.definition).items
    setItems(parsed)
    setSelectedKey(parsed[0]?.key ?? null)
    setDirty(false)
  }

  const selectedIndex = items.findIndex((it) => it.key === selectedKey)

  const updateSelected = useCallback(
    (patch: Partial<ChecklistItem>) => {
      if (selectedIndex < 0) return
      setItems((prev) => prev.map((it, idx) => (idx === selectedIndex ? { ...it, ...patch } : it)))
      setDirty(true)
    },
    [selectedIndex],
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const oldIndex = prev.findIndex((it) => it.key === active.id)
      const newIndex = prev.findIndex((it) => it.key === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
    setDirty(true)
  }, [])

  const addItem = useCallback(() => {
    setItems((prev) => {
      const k = nextKey(prev)
      const item: ChecklistItem = { key: k, prompt: 'Nytt sjekkpunkt', type: 'yes_no_na' }
      setSelectedKey(k)
      return [...prev, item]
    })
    setDirty(true)
  }, [])

  const removeSelected = useCallback(() => {
    if (selectedIndex < 0) return
    setItems((prev) => prev.filter((_, idx) => idx !== selectedIndex))
    setSelectedKey(null)
    setDirty(true)
  }, [selectedIndex])

  const save = useCallback(async () => {
    if (!supabase || !template) return
    setSaving(true)
    setError(null)
    const { error: e } = await supabase
      .from('compliance_checklist_templates')
      .update({ name, description, definition: { items } })
      .eq('id', template.id)
    if (e) setError(e.message)
    else setDirty(false)
    setSaving(false)
  }, [supabase, template, name, description, items])

  const adapter: StudioCanvasAdapter<ChecklistItem> = useMemo(
    () => ({
      items,
      getItemId: (it) => it.key,
      selectedId: selectedKey,
      onSelect: (id) => setSelectedKey(id),
      onAddItem: addItem,
      addLabel: 'Nytt sjekkpunkt',
      emptyState: 'Ingen sjekkpunkter. Legg til ett for å komme i gang.',
      renderItemLabel: (it) => (
        <SortableItemHandle id={it.key}>
          <div className="flex w-full items-center gap-2">
            <GripVertical className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
            <span className="truncate text-[12px]">{it.prompt || '(uten tekst)'}</span>
          </div>
        </SortableItemHandle>
      ),
      renderEditor: (sel) => (sel ? <ItemEditor item={sel} onChange={updateSelected} onRemove={removeSelected} /> : <EmptyEditor />),
      renderProperties: (sel) => (
        sel
          ? <ItemProperties item={sel} onChange={updateSelected} />
          : <TemplateProperties name={name} setName={(v) => { setName(v); setDirty(true) }} description={description} setDescription={(v) => { setDescription(v); setDirty(true) }} />
      ),
    }),
    [items, selectedKey, addItem, updateSelected, removeSelected, name, description],
  )

  if (cl.loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster mal…
      </div>
    )
  }
  if (!template) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Fant ikke malen <code>{templateId}</code>. Er det riktig org?
      </div>
    )
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.key)} strategy={verticalListSortingStrategy}>
        <StudioCanvas
          title={`Sjekkliste · ${name}`}
          subtitle={`${items.length} sjekkpunkter · ${template.pack}`}
          headerActions={
            <>
              <PublishBar
                rowTable="compliance_checklist_templates"
                rowId={template.id}
                scopeId="compliance"
                kindId="baseline"
                currentStatus={template.review_status}
              />
              <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {dirty ? 'Lagre' : 'Lagret'}
              </Button>
            </>
          }
          adapter={adapter}
        />
      </SortableContext>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
    </DndContext>
  )
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function SortableItemHandle({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <span ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex w-full items-center">
      {children}
    </span>
  )
}

function EmptyEditor() {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-neutral-500">
      Velg et sjekkpunkt fra listen, eller opprett ett nytt.
    </div>
  )
}

function ItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: ChecklistItem
  onChange: (patch: Partial<ChecklistItem>) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
          Spørsmål
        </label>
        <StandardTextarea
          value={item.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          className="mt-1 min-h-[80px] w-full"
          placeholder="Hva skal kontrolleres?"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
          Hjelpetekst
        </label>
        <StandardTextarea
          value={item.help ?? ''}
          onChange={(e) => onChange({ help: e.target.value || undefined })}
          className="mt-1 min-h-[60px] w-full"
          placeholder="Forklaring eller veiledning til inspektøren (valgfritt)"
        />
      </div>
      <div className="flex justify-end">
        <Button variant="danger" size="sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" /> Fjern sjekkpunkt
        </Button>
      </div>
    </div>
  )
}

function ItemProperties({
  item,
  onChange,
}: {
  item: ChecklistItem
  onChange: (patch: Partial<ChecklistItem>) => void
}) {
  return (
    <div className="space-y-4 text-xs">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Nøkkel
        </label>
        <StandardInput
          value={item.key}
          onChange={(e) => onChange({ key: e.target.value })}
          className="mt-1 text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Svartype
        </label>
        <SearchableSelect
          value={item.type}
          onChange={(v) => onChange({ type: v as ChecklistItemType })}
          options={ITEM_TYPE_OPTIONS}
          className="mt-1 text-xs"
          triggerClassName="text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Standard alvorlighet
        </label>
        <SearchableSelect
          value={item.severity_default ?? ''}
          onChange={(v) => onChange({ severity_default: (v || undefined) as ComplianceSeverity | undefined })}
          options={SEVERITY_OPTIONS}
          className="mt-1 text-xs"
          triggerClassName="text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Lovreferanse
        </label>
        <StandardInput
          value={item.law_ref ?? ''}
          onChange={(e) => onChange({ law_ref: e.target.value || undefined })}
          placeholder="AML §4-1"
          className="mt-1 text-xs"
        />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <StandardInput
          type="checkbox"
          checked={!!item.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          id={`required-${item.key}`}
          className="h-4 w-4"
        />
        <label htmlFor={`required-${item.key}`} className="text-xs text-neutral-700">
          Påkrevd
        </label>
      </div>
    </div>
  )
}

function TemplateProperties({
  name,
  setName,
  description,
  setDescription,
}: {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
}) {
  return (
    <div className="space-y-4 text-xs">
      <p className="text-[10px] text-neutral-500">
        Velg et sjekkpunkt for å redigere det. Mal-nivå-egenskaper under.
      </p>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Mal-navn
        </label>
        <StandardInput value={name} onChange={(e) => setName(e.target.value)} className="mt-1 text-xs" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
          Beskrivelse
        </label>
        <StandardTextarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 min-h-[80px] w-full text-xs"
        />
      </div>
    </div>
  )
}
