// TasksMalerTab — activate/deactivate and pin/unpin task templates for the org.
// System templates cannot be deleted but can be toggled and categorised.
// Custom templates (org-owned) can be created, edited, and deleted here.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckSquare, Pin, PinOff, Plus, Pencil, Trash2, GripVertical, X } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { Badge } from '../../../src/components/ui/Badge'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import {
  WPSTD_FORM_ROW_GRID,
  WPSTD_FORM_INSET,
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_INPUT,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { TaskKindIcon } from '../components/TaskKindIcon'
import type { TaskTemplateKind, TaskMetadataSchema } from '../../../src/types/task'

type OrgTemplateRow = {
  id: string         // task_org_templates.id
  catalogId: string
  slug: string
  name: string
  description: string
  templateKind: TaskTemplateKind
  lawRefs: string[]
  isSystem: boolean
  isActive: boolean
  navPinned: boolean
  categoryId: string | null
}

type CategoryRow = { id: string; name: string; position: number }

type FieldKind = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'date' | 'datetime' | 'person' | 'location'

type FieldDraft = {
  _key: string
  label: string
  kind: FieldKind
  required: boolean
  options: string   // comma-separated, only for kind=select
}

type TemplateDraft = {
  name: string
  description: string
  templateKind: TaskTemplateKind
  lawRefs: string   // comma-separated
  fields: FieldDraft[]
}

const EMPTY_DRAFT: TemplateDraft = {
  name: '',
  description: '',
  templateKind: 'oppgave',
  lawRefs: '',
  fields: [],
}

const KIND_LABELS: Record<TaskTemplateKind, string> = {
  oppgave: 'Generell oppgave',
  avvik: 'Avvik / Hendelse',
  nestenulykke: 'Nestenulykke',
  tiltak: 'Tiltak',
  risiko: 'Risikovurdering',
  forslag: 'Forslag',
  sykefravær: 'Sykefravær-oppfølging',
}

const FIELD_KIND_LABELS: Record<FieldKind, string> = {
  text: 'Tekst (én linje)',
  textarea: 'Fritekst (flerlinjet)',
  number: 'Tall',
  boolean: 'Avkrysningsboks (ja/nei)',
  select: 'Nedtrekksliste',
  date: 'Dato',
  datetime: 'Dato og tid',
  person: 'Person (velg fra ansatte)',
  location: 'Sted (velg fra lokasjoner)',
}

let _keySeq = 0
function nextKey() { return `f${++_keySeq}` }

function draftToMetadataSchema(fields: FieldDraft[]): TaskMetadataSchema {
  return {
    fields: fields.map((f, i) => ({
      id: `f${i + 1}`,
      label: f.label,
      kind: f.kind,
      required: f.required,
      ...(f.kind === 'select' && f.options.trim()
        ? { options: f.options.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}),
    })),
  }
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function TasksMalerTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [templates, setTemplates] = useState<OrgTemplateRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)   // catalogId of custom template being edited
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    const [tplRes, catRes] = await Promise.all([
      supabase
        .from('task_org_templates')
        .select(
          'id, catalog_id, category_id, nav_pinned, is_active, task_template_catalog(id, slug, name, description, template_kind, law_refs, is_system)',
        )
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      supabase
        .from('task_template_categories')
        .select('id, name, position')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position'),
    ])
    setLoading(false)
    if (tplRes.error) { setError(tplRes.error.message); return }

    setTemplates(
      (tplRes.data ?? []).map((r) => {
        const raw = r as Record<string, unknown>
        const cat = raw.task_template_catalog as Record<string, unknown> | null
        return {
          id: String(raw.id),
          catalogId: String(raw.catalog_id ?? ''),
          slug: cat ? String(cat.slug ?? '') : '',
          name: cat ? String(cat.name ?? '') : '(ukjent)',
          description: cat ? String(cat.description ?? '') : '',
          templateKind: (cat?.template_kind ?? 'oppgave') as TaskTemplateKind,
          lawRefs: (cat?.law_refs as string[]) ?? [],
          isSystem: Boolean(cat?.is_system),
          isActive: Boolean(raw.is_active),
          navPinned: Boolean(raw.nav_pinned),
          categoryId: raw.category_id ? String(raw.category_id) : null,
        }
      }),
    )

    if (!catRes.error) {
      setCategories(
        (catRes.data ?? []).map((c) => ({
          id: String(c.id),
          name: String(c.name),
          position: Number(c.position),
        })),
      )
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  const toggle = async (id: string, field: 'is_active' | 'nav_pinned', current: boolean) => {
    if (!supabase) return
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, isActive: field === 'is_active' ? !current : t.isActive, navPinned: field === 'nav_pinned' ? !current : t.navPinned }
          : t,
      ),
    )
    await supabase.from('task_org_templates').update({ [field]: !current }).eq('id', id)
  }

  const updateCategory = async (id: string, categoryId: string | null) => {
    if (!supabase) return
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, categoryId } : t)))
    await supabase.from('task_org_templates').update({ category_id: categoryId }).eq('id', id)
  }

  const openNew = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setFormError(null)
    setPanelOpen(true)
  }

  const openEdit = (t: OrgTemplateRow) => {
    setEditingId(t.catalogId)
    setDraft({
      name: t.name,
      description: t.description,
      templateKind: t.templateKind,
      lawRefs: t.lawRefs.join(', '),
      fields: [],   // field editing not loaded for existing templates (future enhancement)
    })
    setFormError(null)
    setPanelOpen(true)
  }

  const closePanel = () => { setPanelOpen(false); setEditingId(null) }

  const handleSave = async () => {
    if (!supabase || !orgId) return
    if (!draft.name.trim()) { setFormError('Malnavn er påkrevd.'); return }
    setSaving(true)
    setFormError(null)

    const lawRefsArr = draft.lawRefs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const metadataSchema = draftToMetadataSchema(draft.fields)

    if (editingId) {
      // Update existing custom template catalog row
      const { error: catErr } = await supabase
        .from('task_template_catalog')
        .update({
          name: draft.name.trim(),
          description: draft.description.trim(),
          template_kind: draft.templateKind,
          law_refs: lawRefsArr,
          metadata_schema: metadataSchema,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .eq('organization_id', orgId)   // only own templates

      if (catErr) { setSaving(false); setFormError(catErr.message); return }
    } else {
      // Create new custom template
      const slug = slugify(draft.name.trim()) || `custom-${Date.now()}`

      const { data: catData, error: catErr } = await supabase
        .from('task_template_catalog')
        .insert({
          organization_id: orgId,
          slug,
          name: draft.name.trim(),
          description: draft.description.trim(),
          template_kind: draft.templateKind,
          pack: 'aml-amu',
          law_refs: lawRefsArr,
          metadata_schema: metadataSchema,
          is_system: false,
          is_active: true,
          version: 1,
        })
        .select('id')
        .single()

      if (catErr || !catData) { setSaving(false); setFormError(catErr?.message ?? 'Kunne ikke opprette mal.'); return }

      const { error: orgTplErr } = await supabase
        .from('task_org_templates')
        .insert({
          organization_id: orgId,
          catalog_id: catData.id,
          is_active: true,
          nav_pinned: false,
          category_id: null,
        })

      if (orgTplErr) { setSaving(false); setFormError(orgTplErr.message); return }
    }

    setSaving(false)
    closePanel()
    void load()
  }

  const handleDelete = async (t: OrgTemplateRow) => {
    if (!supabase || !orgId) return
    if (!window.confirm(`Slette malen «${t.name}»? Dette kan ikke angres.`)) return

    // Soft-delete org_template row; cascade will hide from lists
    await supabase
      .from('task_org_templates')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', t.id)

    // Soft-delete catalog row (only for org-owned templates)
    await supabase
      .from('task_template_catalog')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', t.catalogId)
      .eq('organization_id', orgId)

    void load()
  }

  // Field builder helpers
  const addField = () => {
    setDraft((d) => ({
      ...d,
      fields: [
        ...d.fields,
        { _key: nextKey(), label: '', kind: 'text', required: false, options: '' },
      ],
    }))
  }

  const updateField = (key: string, patch: Partial<FieldDraft>) => {
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f) => (f._key === key ? { ...f, ...patch } : f)),
    }))
  }

  const removeField = (key: string) => {
    setDraft((d) => ({ ...d, fields: d.fields.filter((f) => f._key !== key) }))
  }

  const moveField = (key: string, dir: -1 | 1) => {
    setDraft((d) => {
      const idx = d.fields.findIndex((f) => f._key === key)
      if (idx < 0) return d
      const next = idx + dir
      if (next < 0 || next >= d.fields.length) return d
      const arr = [...d.fields]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return { ...d, fields: arr }
    })
  }

  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [templates],
  )

  if (loading) return <p className="py-8 text-sm text-neutral-500">Laster maler…</p>

  return (
    <div className="space-y-4">
      {error && <WarningBox>{error}</WarningBox>}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <CheckSquare className="h-5 w-5 text-[#c2410c]" aria-hidden />
          <h2 className="text-base font-semibold text-neutral-900">Oppgavemaler</h2>
          <span className="ml-1 text-sm text-neutral-500">
            {templates.filter((t) => t.isActive).length} aktive
          </span>
          <button
            type="button"
            onClick={openNew}
            className="ml-auto inline-flex items-center gap-1.5 rounded border border-[#c2410c] bg-[#c2410c] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Ny mal
          </button>
        </div>

        <div className="overflow-x-auto -mx-5 md:-mx-6">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-neutral-200 bg-neutral-50 text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Mal
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Kategori
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Aktiv
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Vis i meny
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-neutral-200/60 hover:bg-neutral-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <TaskKindIcon kind={t.templateKind} className="h-4 w-4 text-[#c2410c]/60 shrink-0" />
                      <div>
                        <p className="font-medium text-neutral-900">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-neutral-500 line-clamp-1">{t.description}</p>
                        )}
                      </div>
                      {t.isSystem && (
                        <Badge variant="neutral" className="ml-1">System</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={t.categoryId ?? ''}
                      onChange={(e) => void updateCategory(t.id, e.target.value || null)}
                      className="w-40 rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-[#c2410c] focus:outline-none"
                    >
                      <option value="">Uten kategori</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ToggleSwitch
                        checked={t.isActive}
                        onChange={() => void toggle(t.id, 'is_active', t.isActive)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => void toggle(t.id, 'nav_pinned', t.navPinned)}
                      disabled={!t.isActive}
                      className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        t.navPinned
                          ? 'border-[#c2410c]/30 bg-orange-50 text-[#c2410c]'
                          : 'border-neutral-200 bg-white text-neutral-400 hover:border-neutral-300'
                      }`}
                      aria-label={t.navPinned ? 'Skjul fra meny' : 'Vis i meny'}
                    >
                      {t.navPinned
                        ? <><Pin className="h-3.5 w-3.5" /> Vises</>
                        : <><PinOff className="h-3.5 w-3.5" /> Skjult</>
                      }
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {!t.isSystem && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                          aria-label={`Rediger ${t.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(t)}
                          className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Slett ${t.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModuleSectionCard>

      {/* Template create / edit panel */}
      <SlidePanel
        open={panelOpen}
        onClose={closePanel}
        titleId="task-template-panel-title"
        title={editingId ? 'Rediger mal' : 'Ny oppgavemal'}
        footer={
          <div className="flex items-center justify-end gap-3 px-5 py-4">
            <button
              type="button"
              onClick={closePanel}
              className="rounded border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded bg-[#c2410c] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Lagrer…' : 'Lagre mal'}
            </button>
          </div>
        }
      >
        {formError && <div className="mx-5 mt-4"><WarningBox>{formError}</WarningBox></div>}

        {/* Name */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Navn *</p>
            <p className="mt-1 text-xs text-neutral-500">Vises i meny og oppgaveliste.</p>
          </div>
          <div className={WPSTD_FORM_INSET}>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="F.eks. Internkontroll – HMS"
              className={WPSTD_FORM_INPUT}
            />
          </div>
        </div>

        {/* Description */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
            <p className="mt-1 text-xs text-neutral-500">Kort forklaring til brukeren.</p>
          </div>
          <div className={WPSTD_FORM_INSET}>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={3}
              className={WPSTD_FORM_INPUT}
            />
          </div>
        </div>

        {/* Template kind */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Maltype *</p>
            <p className="mt-1 text-xs text-neutral-500">Bestemmer livssyklus og ikoner.</p>
          </div>
          <div className={WPSTD_FORM_INSET}>
            <select
              value={draft.templateKind}
              onChange={(e) => setDraft((d) => ({ ...d, templateKind: e.target.value as TaskTemplateKind }))}
              className={WPSTD_FORM_INPUT}
            >
              {(Object.entries(KIND_LABELS) as [TaskTemplateKind, string][]).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Law refs */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Lovhjemler</p>
            <p className="mt-1 text-xs text-neutral-500">Kommaseparert, f.eks. «AML § 4-1, IK-f § 5 nr. 7»</p>
          </div>
          <div className={WPSTD_FORM_INSET}>
            <input
              type="text"
              value={draft.lawRefs}
              onChange={(e) => setDraft((d) => ({ ...d, lawRefs: e.target.value }))}
              placeholder="AML § 4-1, IK-f § 5 nr. 7"
              className={WPSTD_FORM_INPUT}
            />
          </div>
        </div>

        {/* Field builder */}
        <div className="border-b border-neutral-200 px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Egendefinerte felter</p>
              <p className="mt-0.5 text-xs text-neutral-500">Legg til felter som fylles ut ved opprettelse av oppgaven.</p>
            </div>
            <button
              type="button"
              onClick={addField}
              className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Legg til felt
            </button>
          </div>

          {draft.fields.length === 0 && (
            <p className="text-xs text-neutral-400 italic">Ingen egendefinerte felter ennå.</p>
          )}

          <div className="space-y-2">
            {draft.fields.map((f, idx) => (
              <div key={f._key} className="rounded border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveField(f._key, -1)}
                      disabled={idx === 0}
                      className="text-neutral-400 hover:text-neutral-600 disabled:opacity-30"
                      aria-label="Flytt opp"
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) => updateField(f._key, { label: e.target.value })}
                      placeholder="Feltnavn…"
                      className="rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:border-neutral-500 focus:outline-none"
                    />
                    <select
                      value={f.kind}
                      onChange={(e) => updateField(f._key, { kind: e.target.value as FieldKind })}
                      className="rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:outline-none"
                    >
                      {(Object.entries(FIELD_KIND_LABELS) as [FieldKind, string][]).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(f._key, { required: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-neutral-300 accent-[#c2410c]"
                      />
                      Påkrevd
                    </label>
                    <button
                      type="button"
                      onClick={() => removeField(f._key)}
                      className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Fjern felt"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {f.kind === 'select' && (
                  <div className="mt-2 pl-6">
                    <input
                      type="text"
                      value={f.options}
                      onChange={(e) => updateField(f._key, { options: e.target.value })}
                      placeholder="Alternativ 1, Alternativ 2, Alternativ 3"
                      className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:border-neutral-500 focus:outline-none"
                    />
                    <p className="mt-0.5 text-[10px] text-neutral-400">Kommaseparerte valg</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SlidePanel>
    </div>
  )
}
