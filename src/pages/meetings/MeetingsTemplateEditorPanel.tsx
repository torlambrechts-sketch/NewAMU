// Møter — org-custom meeting template editor.
//
// Wraps the upsertOrgTemplate / deleteOrgTemplate hook mutations in the
// canonical FormModal slide-over. Same structural shape as
// modules/compliance/admin/TemplateEditorPanel.tsx — no new primitives
// introduced; only a new page-level composition for the meeting-template
// data shape. System templates remain read-only; this editor only
// handles org-custom rows in meeting_org_templates.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { FormModal } from '../../template'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { WarningBox } from '../../components/ui/AlertBox'
import { useMeetings } from '../../../modules/meetings'
import {
  MEETING_ATTENDEE_ROLE_LABEL,
  MEETING_CADENCE_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_FRAMEWORK_LABEL,
} from '../../../modules/meetings/meetingsLabels'
import {
  MEETING_ATTENDEE_ROLE_VALUES,
  MEETING_CADENCE_VALUES,
  MEETING_CONFIDENTIALITY_VALUES,
  MEETING_FRAMEWORK_VALUES,
} from '../../../modules/meetings/types'
import type {
  MeetingAttendeeRole,
  MeetingCadence,
  MeetingConfidentialityLevel,
  MeetingFramework,
  MeetingOrgTemplateRow,
  MeetingTemplateAgendaItem,
  MeetingTemplateDefinition,
} from '../../../modules/meetings/types'

type AgendaDraft = MeetingTemplateAgendaItem & { _localId: string }

export type MeetingsTemplateEditorPanelProps = {
  open: boolean
  onClose: () => void
  /** When set, opens in edit mode with the row's data pre-filled. */
  editTarget: MeetingOrgTemplateRow | null
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

let localCounter = 0
function nextLocalId(): string {
  localCounter += 1
  return `agenda-${localCounter}-${Date.now()}`
}

const EMPTY_AGENDA: AgendaDraft = {
  _localId: '',
  key: '',
  title: '',
  description: '',
  lawRef: '',
  isMandatory: false,
  defaultPosition: 10,
}

export function MeetingsTemplateEditorPanel({
  open,
  onClose,
  editTarget,
}: MeetingsTemplateEditorPanelProps) {
  const meetings = useMeetings()
  const isEditing = !!editTarget

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [framework, setFramework] = useState<MeetingFramework>('INTERNAL')
  const [cadenceHint, setCadenceHint] = useState<MeetingCadence | ''>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState<string>('60')
  const [defaultConfidentialityLevel, setDefaultConfidentialityLevel] =
    useState<MeetingConfidentialityLevel>('standard')
  const [minimumEmployeeCount, setMinimumEmployeeCount] = useState<string>('')
  const [invitationLeadDays, setInvitationLeadDays] = useState<string>('')
  const [lawRefsCsv, setLawRefsCsv] = useState<string>('')
  const [requiredAttendees, setRequiredAttendees] = useState<MeetingAttendeeRole[]>(['chair'])
  const [agendaItems, setAgendaItems] = useState<AgendaDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFormError(null)
    if (editTarget) {
      setName(editTarget.name)
      setSlug(editTarget.slug)
      setDescription(editTarget.description ?? '')
      setFramework(editTarget.framework)
      setCadenceHint(editTarget.cadence_hint ?? '')
      setCategoryId(editTarget.category_id ?? '')
      setDefaultDurationMinutes(String(editTarget.default_duration_minutes ?? 60))
      setDefaultConfidentialityLevel(editTarget.default_confidentiality_level ?? 'standard')
      setMinimumEmployeeCount(
        editTarget.minimum_employee_count != null
          ? String(editTarget.minimum_employee_count)
          : '',
      )
      setInvitationLeadDays(
        editTarget.definition.invitationLeadDays != null
          ? String(editTarget.definition.invitationLeadDays)
          : '',
      )
      setLawRefsCsv(editTarget.law_refs.join(', '))
      setRequiredAttendees(
        editTarget.definition.requiredAttendees
          .map((r) => r.role)
          .filter((r): r is MeetingAttendeeRole =>
            (MEETING_ATTENDEE_ROLE_VALUES as readonly string[]).includes(r),
          ),
      )
      setAgendaItems(
        editTarget.definition.agendaItems.map((item, idx) => ({
          ...item,
          _localId: `editload-${idx}-${item.key}`,
        })),
      )
    } else {
      setName('')
      setSlug('')
      setDescription('')
      setFramework('INTERNAL')
      setCadenceHint('')
      setCategoryId('')
      setDefaultDurationMinutes('60')
      setDefaultConfidentialityLevel('standard')
      setMinimumEmployeeCount('')
      setInvitationLeadDays('')
      setLawRefsCsv('')
      setRequiredAttendees(['chair'])
      setAgendaItems([])
    }
  }, [open, editTarget])

  // Auto-slug from name when creating new.
  useEffect(() => {
    if (isEditing) return
    if (!slug && name) setSlug(slugify(name))
  }, [name, slug, isEditing])

  const frameworkOptions = useMemo(
    () =>
      MEETING_FRAMEWORK_VALUES.map((v) => ({
        value: v,
        label: MEETING_FRAMEWORK_LABEL[v],
      })),
    [],
  )
  const cadenceOptions = useMemo(
    () => [
      { value: '', label: '— Ingen kadens —' },
      ...MEETING_CADENCE_VALUES.map((v) => ({
        value: v,
        label: MEETING_CADENCE_LABEL[v],
      })),
    ],
    [],
  )
  const categoryOptions = useMemo(
    () => [
      { value: '', label: '— Uten kategori —' },
      ...meetings.categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [meetings.categories],
  )
  const attendeeOptions = useMemo(
    () =>
      MEETING_ATTENDEE_ROLE_VALUES.map((v) => ({
        value: v,
        label: MEETING_ATTENDEE_ROLE_LABEL[v],
      })),
    [],
  )

  function updateAgenda(localId: string, patch: Partial<AgendaDraft>) {
    setAgendaItems((prev) => prev.map((a) => (a._localId === localId ? { ...a, ...patch } : a)))
  }
  function addAgenda() {
    const nextPos = agendaItems.length === 0 ? 10 : (agendaItems[agendaItems.length - 1].defaultPosition || 0) + 10
    setAgendaItems((prev) => [
      ...prev,
      { ...EMPTY_AGENDA, _localId: nextLocalId(), defaultPosition: nextPos },
    ])
  }
  function removeAgenda(localId: string) {
    setAgendaItems((prev) => prev.filter((a) => a._localId !== localId))
  }
  function toggleAttendee(role: MeetingAttendeeRole) {
    setRequiredAttendees((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  function validate(): string | null {
    if (!name.trim()) return 'Navn er påkrevd.'
    if (!slug.trim()) return 'Slug er påkrevd.'
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug kan kun inneholde a–z, 0–9 og bindestrek.'
    if (agendaItems.length === 0) return 'Malen må ha minst én agendapunkt.'
    for (const item of agendaItems) {
      if (!item.title.trim()) return 'Alle agendapunkter må ha en tittel.'
      if (!item.key.trim()) return 'Alle agendapunkter må ha en nøkkel (key).'
      if (!/^[a-z0-9_]+$/.test(item.key))
        return `Agendapunkt-nøkkelen "${item.key}" kan kun inneholde a–z, 0–9 og understrek.`
    }
    const seenKeys = new Set<string>()
    for (const item of agendaItems) {
      if (seenKeys.has(item.key)) return `Duplikat agendapunkt-nøkkel: ${item.key}`
      seenKeys.add(item.key)
    }
    return null
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    setBusy(true)
    try {
      const lawRefs = lawRefsCsv
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const durationNum = parseInt(defaultDurationMinutes, 10)
      const leadDaysNum = invitationLeadDays.trim() ? parseInt(invitationLeadDays, 10) : null
      const minEmpNum = minimumEmployeeCount.trim() ? parseInt(minimumEmployeeCount, 10) : null
      const definition: MeetingTemplateDefinition = {
        preparationChecklist: editTarget?.definition.preparationChecklist ?? [],
        agendaItems: agendaItems
          .slice()
          .sort((a, b) => a.defaultPosition - b.defaultPosition)
          .map(({ _localId: _unused, ...item }) => ({
            ...item,
            description: item.description?.trim() || undefined,
            lawRef: item.lawRef?.trim() || undefined,
          })),
        requiredAttendees: requiredAttendees.map((r) => ({ role: r })),
        invitationLeadDays: leadDaysNum != null && Number.isFinite(leadDaysNum) ? leadDaysNum : undefined,
        protocolRoles: editTarget?.definition.protocolRoles ?? ['chair'],
      }
      const ok = await meetings.upsertOrgTemplate({
        id: editTarget?.id,
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim() || null,
        categoryId: categoryId || null,
        framework,
        frameworks: [framework],
        lawRefs,
        cadenceHint: cadenceHint || null,
        defaultDurationMinutes: Number.isFinite(durationNum) ? durationNum : null,
        defaultConfidentialityLevel,
        minimumEmployeeCount: minEmpNum != null && Number.isFinite(minEmpNum) ? minEmpNum : null,
        definition,
        navPinned: editTarget?.nav_pinned ?? false,
        isActive: editTarget?.is_active ?? true,
      })
      if (ok) onClose()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!editTarget || busy) return
    if (!window.confirm(`Slette malen «${editTarget.name}»? Eksisterende møter beholdes.`)) return
    setBusy(true)
    try {
      const ok = await meetings.deleteOrgTemplate(editTarget.id)
      if (ok) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      titleId="meetings-template-editor-title"
      title={isEditing ? 'Rediger mal' : 'Ny mal'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            {isEditing ? (
              <Button
                variant="ghost"
                type="button"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={handleDelete}
                disabled={busy}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Slett mal
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              type="button"
              icon={<Save className="h-4 w-4" />}
              onClick={(e) => void handleSave(e as unknown as FormEvent)}
              disabled={busy || !name.trim()}
            >
              Lagre
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-5">
        {formError ? <WarningBox>{formError}</WarningBox> : null}
        {meetings.error ? <WarningBox>{meetings.error}</WarningBox> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-name">Navn</label>
            <StandardInput
              id="mte-name"
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-slug">Slug (URL-vennlig)</label>
            <StandardInput
              id="mte-slug"
              className="mt-1.5"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="autogenerert fra navn"
            />
          </div>
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-desc">Beskrivelse</label>
          <StandardTextarea
            id="mte-desc"
            className="mt-1.5"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-framework">Rammeverk</label>
            <SearchableSelect
              value={framework}
              options={frameworkOptions}
              onChange={(v) => setFramework(v as MeetingFramework)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-cadence">Kadens</label>
            <SearchableSelect
              value={cadenceHint}
              options={cadenceOptions}
              onChange={(v) => setCadenceHint(v as MeetingCadence | '')}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-category">Kategori</label>
            <SearchableSelect
              value={categoryId}
              options={categoryOptions}
              onChange={(v) => setCategoryId(v)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-duration">Standardvarighet (minutter)</label>
            <StandardInput
              id="mte-duration"
              className="mt-1.5"
              type="number"
              min={5}
              value={defaultDurationMinutes}
              onChange={(e) => setDefaultDurationMinutes(e.target.value)}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-lead">Innkallingsfrist (dager før)</label>
            <StandardInput
              id="mte-lead"
              className="mt-1.5"
              type="number"
              min={0}
              value={invitationLeadDays}
              onChange={(e) => setInvitationLeadDays(e.target.value)}
              placeholder="valgfritt"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-confidentiality">
              Standard konfidensialitet
            </label>
            <SearchableSelect
              value={defaultConfidentialityLevel}
              options={MEETING_CONFIDENTIALITY_VALUES.map((v) => ({
                value: v,
                label: MEETING_CONFIDENTIALITY_LABEL[v],
              }))}
              onChange={(v) => setDefaultConfidentialityLevel(v as MeetingConfidentialityLevel)}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Drøftings-, varslings- og personalmøter bør stå som «Begrenset» eller
              strengere som standard.
            </p>
          </div>
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-minemp">
            Minste antall ansatte (terskel)
          </label>
          <StandardInput
            id="mte-minemp"
            className="mt-1.5"
            type="number"
            min={0}
            value={minimumEmployeeCount}
            onChange={(e) => setMinimumEmployeeCount(e.target.value)}
            placeholder="ingen terskel"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Hvis satt, vises malen med advarsel-merke i hovedsiden for organisasjoner under
            terskelen. Eksempler: AMU = 30 (AML § 7-1), bedriftsutvalg = 100 (Hovedavtalen § 9-3),
            lønnskartlegging = 50 (Likestillingsloven § 26).
          </p>
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="mte-lawrefs">
            Lovreferanser (kommaseparert)
          </label>
          <StandardInput
            id="mte-lawrefs"
            className="mt-1.5"
            value={lawRefsCsv}
            onChange={(e) => setLawRefsCsv(e.target.value)}
            placeholder="AML § 7-2 (6), IK-f § 5 nr. 7"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Brukes i dashbord-drilldown og compliance-planlegger. Eksempel:
            «AML § 7-2 (6), IK-f § 5 nr. 7».
          </p>
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Påkrevde roller</label>
          <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3">
            {attendeeOptions.map((opt) => {
              const role = opt.value as MeetingAttendeeRole
              const checked = requiredAttendees.includes(role)
              return (
                <li
                  key={opt.value}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-neutral-50"
                >
                  <span className="text-sm text-neutral-800">{opt.label}</span>
                  <ToggleSwitch
                    checked={checked}
                    onChange={() => toggleAttendee(role)}
                    label={opt.label}
                  />
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label className={WPSTD_FORM_FIELD_LABEL}>Agendapunkter</label>
            <Button
              variant="primary"
              type="button"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={addAgenda}
            >
              Nytt punkt
            </Button>
          </div>
          {agendaItems.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              Legg til minst ett agendapunkt — punktene blir kopiert til hvert møte som
              opprettes fra malen.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {agendaItems.map((item, idx) => (
                <li
                  key={item._localId}
                  className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL}>
                        Tittel <span className="text-neutral-400">({idx + 1})</span>
                      </label>
                      <StandardInput
                        className="mt-1.5"
                        value={item.title}
                        onChange={(e) => updateAgenda(item._localId, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL}>Posisjon</label>
                      <StandardInput
                        className="mt-1.5"
                        type="number"
                        min={0}
                        value={String(item.defaultPosition)}
                        onChange={(e) =>
                          updateAgenda(item._localId, {
                            defaultPosition: parseInt(e.target.value || '0', 10) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL}>Nøkkel (key)</label>
                      <StandardInput
                        className="mt-1.5"
                        value={item.key}
                        onChange={(e) => updateAgenda(item._localId, { key: e.target.value })}
                        placeholder="for_eksempel_sykefravar"
                      />
                    </div>
                    <div>
                      <label className={WPSTD_FORM_FIELD_LABEL}>Lovreferanse</label>
                      <StandardInput
                        className="mt-1.5"
                        value={item.lawRef ?? ''}
                        onChange={(e) => updateAgenda(item._localId, { lawRef: e.target.value })}
                        placeholder="AML § 7-2 (2) bokstav b"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</label>
                    <StandardTextarea
                      className="mt-1.5"
                      rows={2}
                      value={item.description ?? ''}
                      onChange={(e) => updateAgenda(item._localId, { description: e.target.value })}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-200/80 pt-3">
                    <div className="inline-flex items-center gap-2 text-xs text-neutral-700">
                      <ToggleSwitch
                        checked={item.isMandatory}
                        onChange={(v) => updateAgenda(item._localId, { isMandatory: v })}
                        label="Obligatorisk (lov-grunnet)"
                      />
                      <span>Obligatorisk (lov-grunnet)</span>
                    </div>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => removeAgenda(item._localId)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      Fjern
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </FormModal>
  )
}
