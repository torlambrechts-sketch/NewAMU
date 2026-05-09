// Quick-create modal for oppgave / avvik / risikovurdering / tiltak / prosjekt.
//
// Step 1: Choose type via segmented control.
// Step 2a (task): form pre-filled with source_category law_refs, optional template.
// Step 2b (project): project name, pack, methodology, law_refs checkbox list.
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { TaskPack, TaskPdcaPhase, TaskSourceCategory } from '../../../src/types/task'
import { useTaskItems } from '../useTaskItems'
import { useTaskProjects } from '../useTaskProjects'
import { useTaskTemplates } from '../useTaskTemplates'

const CATEGORY_OPTIONS: Array<{ value: TaskSourceCategory; label: string; description: string; lawRefs: string[]; phase: TaskPdcaPhase }> = [
  {
    value: 'avvik',
    label: 'Avvik',
    description: 'Hendelse, nestenulykke eller regelbrudd',
    lawRefs: ['AML § 5-1', 'AML § 5-2', 'IK-f § 5 nr. 7'],
    phase: 'check',
  },
  {
    value: 'risikovurdering',
    label: 'Risikovurdering',
    description: 'Kartlegging og vurdering av fare',
    lawRefs: ['AML § 3-1', 'IK-f § 5 nr. 6'],
    phase: 'plan',
  },
  {
    value: 'tiltak',
    label: 'Tiltak',
    description: 'Forebyggende eller korrigerende tiltak',
    lawRefs: ['AML § 3-2', 'AML § 4-1', 'IK-f § 5 nr. 8'],
    phase: 'do',
  },
  {
    value: 'general',
    label: 'Generell',
    description: 'Generell oppgave uten spesifikk paragraf',
    lawRefs: [],
    phase: 'do',
  },
]

const ALL_AML_REFS = [
  'AML § 3-1', 'AML § 3-2', 'AML § 4-1', 'AML § 4-2', 'AML § 4-3',
  'AML § 5-1', 'AML § 5-2', 'AML § 5-3', 'IK-f § 5 nr. 6', 'IK-f § 5 nr. 7', 'IK-f § 5 nr. 8',
]

type Mode = 'task' | 'project'

type Props = {
  defaultPdcaPhase?: TaskPdcaPhase
  defaultSourceCategory?: TaskSourceCategory
  defaultPack?: TaskPack
  onClose: () => void
}

export function NewTaskModal({
  defaultPdcaPhase = 'do',
  defaultSourceCategory = 'general',
  defaultPack = 'aml-amu',
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>('task')

  // Task form state
  const [category, setCategory] = useState<TaskSourceCategory>(defaultSourceCategory)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [lawRefs, setLawRefs] = useState<string[]>(
    CATEGORY_OPTIONS.find((o) => o.value === defaultSourceCategory)?.lawRefs ?? [],
  )
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [assigneeName, setAssigneeName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [pdcaPhase, setPdcaPhase] = useState<TaskPdcaPhase>(defaultPdcaPhase)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Project form state
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectMethodology, setProjectMethodology] = useState<'kanban' | 'pdca' | 'waterfall'>('pdca')
  const [projectLawRefs, setProjectLawRefs] = useState<string[]>(['AML § 3-1', 'AML § 3-2'])
  const [projectStartDate, setProjectStartDate] = useState('')
  const [projectEndDate, setProjectEndDate] = useState('')

  const { createItem } = useTaskItems()
  const { createProject } = useTaskProjects()
  const { pinnedTemplates } = useTaskTemplates({ pack: defaultPack })

  // Keep law_refs in sync when category changes
  useEffect(() => {
    const opt = CATEGORY_OPTIONS.find((o) => o.value === category)
    if (opt) {
      setLawRefs(opt.lawRefs)
      setPdcaPhase(opt.phase)
    }
  }, [category])

  // Pre-fill from selected template
  useEffect(() => {
    if (!selectedTemplateId) return
    const tpl = pinnedTemplates.find((t) => t.id === selectedTemplateId)
    if (!tpl) return
    if (tpl.lawRefs.length > 0) setLawRefs(tpl.lawRefs)
    if (tpl.defaultPdcaPhase) setPdcaPhase(tpl.defaultPdcaPhase)
    setCategory(tpl.sourceCategory)
  }, [selectedTemplateId, pinnedTemplates])

  const toggleProjectLawRef = (ref: string) => {
    setProjectLawRefs((prev) =>
      prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref],
    )
  }

  const handleSubmitTask = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    await createItem({
      pack: defaultPack,
      sourceCategory: category,
      pdcaPhase,
      title: title.trim(),
      description,
      status: 'todo',
      priority,
      lawRefs,
      assigneeName: assigneeName || undefined,
      dueDate: dueDate || undefined,
      requiresSignOff: false,
    })
    setSubmitting(false)
    onClose()
  }

  const handleSubmitProject = async () => {
    if (!projectTitle.trim()) return
    setSubmitting(true)
    await createProject({
      pack: defaultPack,
      title: projectTitle.trim(),
      description: projectDescription,
      methodology: projectMethodology,
      status: 'active',
      lawRefs: projectLawRefs,
      startDate: projectStartDate || undefined,
      endDate: projectEndDate || undefined,
    })
    setSubmitting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">
            Ny oppgave / prosjekt
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode switcher */}
        <div className="flex border-b border-neutral-200">
          {(['task', 'project'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                mode === m
                  ? 'border-b-2 border-[#c2410c] text-[#c2410c]'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {m === 'task' ? 'Oppgave / hendelse' : 'Nytt prosjekt'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {mode === 'task' ? (
            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCategory(opt.value)}
                      className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                        category === opt.value
                          ? 'border-[#c2410c] bg-orange-50 text-[#c2410c]'
                          : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-neutral-500">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template selection */}
              {pinnedTemplates.filter((t) => t.sourceCategory === category).length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                    Mal (valgfri)
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
                  >
                    <option value="">— Ingen mal —</option>
                    {pinnedTemplates
                      .filter((t) => t.sourceCategory === category)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Law refs */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                  Lovhenvisninger
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {lawRefs.map((ref) => (
                    <span key={ref} className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {ref}
                    </span>
                  ))}
                  {lawRefs.length === 0 && (
                    <span className="text-xs italic text-neutral-400">Ingen paragrafkrav</span>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                  Tittel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Beskriv oppgaven kort og konkret..."
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Beskrivelse</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>

              {/* Priority + Assignee + Due date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Prioritet</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
                  >
                    <option value="low">Lav</option>
                    <option value="medium">Medium</option>
                    <option value="high">Høy</option>
                    <option value="critical">Kritisk</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Frist</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Ansvarlig</label>
                <input
                  type="text"
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  placeholder="Navn på ansvarlig person..."
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                  Prosjektnavn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="F.eks. Risikovurdering 2026 — kontoret"
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Beskrivelse</label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Metodikk</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pdca', 'kanban', 'waterfall'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setProjectMethodology(m)}
                      className={`rounded border px-3 py-2 text-xs font-medium transition-colors ${
                        projectMethodology === m
                          ? 'border-[#c2410c] bg-orange-50 text-[#c2410c]'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                  Paragrafkrav prosjektet adresserer
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded border border-neutral-200 p-3">
                  {ALL_AML_REFS.map((ref) => (
                    <label key={ref} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={projectLawRefs.includes(ref)}
                        onChange={() => toggleProjectLawRef(ref)}
                        className="h-3.5 w-3.5 rounded accent-[#c2410c]"
                      />
                      <span className="text-xs text-neutral-700">{ref}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Startdato</label>
                  <input
                    type="date"
                    value={projectStartDate}
                    onChange={(e) => setProjectStartDate(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-neutral-700">Sluttdato</label>
                  <input
                    type="date"
                    value={projectEndDate}
                    onChange={(e) => setProjectEndDate(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={submitting || (mode === 'task' ? !title.trim() : !projectTitle.trim())}
            onClick={() => void (mode === 'task' ? handleSubmitTask() : handleSubmitProject())}
            className="rounded bg-[#c2410c] px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {submitting ? 'Lagrer...' : mode === 'task' ? 'Opprett oppgave' : 'Opprett prosjekt'}
          </button>
        </div>
      </div>
    </div>
  )
}
