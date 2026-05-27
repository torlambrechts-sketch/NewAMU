// PlanningCreateProjectModal — creates a task_projects row from Planning.

import { useEffect, useState } from 'react'
import { FolderKanban, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import type { CreateProjectInput } from '../../../modules/tasks/useTaskProjects'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (input: CreateProjectInput) => Promise<void>
}

export function PlanningCreateProjectModal({ open, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [methodology, setMethodology] = useState<'pdca' | 'kanban'>('pdca')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setMethodology('pdca')
    setStartDate('')
    setEndDate('')
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const canSubmit = title.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        methodology,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        lawRefs: [],
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Nytt prosjekt"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-900">Nytt prosjekt</h3>
            <p className="text-[11px] text-neutral-500">
              Et prosjekt samler relaterte oppgaver under én paraply (eks. Ny HMS-onboarding,
              Sykefravær-program, Gap-lukking).
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Tittel
            </span>
            <StandardInput
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Eks. Ny HMS-onboarding"
              className="mt-1 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Beskrivelse
            </span>
            <StandardTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 py-2 text-[12.5px]"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Metodikk
              </span>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={methodology}
                onChange={(e) => setMethodology(e.target.value as 'pdca' | 'kanban')}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#1a3d32]"
              >
                <option value="pdca">PDCA</option>
                <option value="kanban">Kanban</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Start
              </span>
              <StandardInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Slutt
              </span>
              <StandardInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 py-1.5 text-sm"
              />
            </label>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/40 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              void handleSubmit()
            }}
            icon={<FolderKanban className="h-3.5 w-3.5" />}
          >
            {submitting ? 'Oppretter…' : 'Opprett prosjekt'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
