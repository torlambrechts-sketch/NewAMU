// PlanningPlanEditPanel — slide-over to edit the Ambisjon (plan) fields.

import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SlidePanel } from '../../components/layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../components/layout/WorkplaceStandardFormPanel'
import type { OkrPlanFull } from '../../types/planning'
import type { UsePlanningOkrReturn } from '../../hooks/usePlanningOkr'

type Props = {
  open: boolean
  onClose: () => void
  plan: OkrPlanFull
  ctrl: UsePlanningOkrReturn
  personOptions: Array<{ id: string; name: string }>
  horizonOptions: string[]
}

export function PlanningPlanEditPanel({ open, onClose, plan, ctrl, personOptions, horizonOptions }: Props) {
  const [title, setTitle] = useState(plan.title)
  const [description, setDescription] = useState(plan.description)
  const [legalBasis, setLegalBasis] = useState(plan.legalBasis ?? '')
  const [horizon, setHorizon] = useState(plan.horizon ?? '')
  const [sponsorChoice, setSponsorChoice] = useState(
    plan.sponsorUserId ?? (plan.sponsorName ? `__name__${plan.sponsorName}` : ''),
  )
  const [facilitatorChoice, setFacilitatorChoice] = useState(
    plan.facilitatorUserId ?? (plan.facilitatorName ? `__name__${plan.facilitatorName}` : ''),
  )
  const [saving, setSaving] = useState(false)

  // Reset form to the latest plan values whenever the panel reopens
  // (avoids leaking stale state between edits).
  useEffect(() => {
    if (!open) return
    setTitle(plan.title)
    setDescription(plan.description)
    setLegalBasis(plan.legalBasis ?? '')
    setHorizon(plan.horizon ?? '')
    setSponsorChoice(plan.sponsorUserId ?? (plan.sponsorName ? `__name__${plan.sponsorName}` : ''))
    setFacilitatorChoice(
      plan.facilitatorUserId ?? (plan.facilitatorName ? `__name__${plan.facilitatorName}` : ''),
    )
  }, [open, plan])

  const resolvePerson = (value: string): { userId?: string; name?: string } => {
    if (!value) return { userId: undefined, name: undefined }
    if (value.startsWith('__name__')) return { userId: undefined, name: value.slice('__name__'.length) }
    const opt = personOptions.find((p) => p.id === value)
    if (opt) return { userId: opt.id, name: opt.name }
    return { userId: undefined, name: undefined }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const sponsor = resolvePerson(sponsorChoice)
      const facilitator = resolvePerson(facilitatorChoice)
      await ctrl.updatePlan({
        title: title.trim() || plan.title,
        description: description.trim(),
        legalBasis: legalBasis.trim() || undefined,
        horizon: horizon.trim() || undefined,
        sponsorUserId: sponsor.userId,
        sponsorName: sponsor.name,
        facilitatorUserId: facilitator.userId,
        facilitatorName: facilitator.name,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="planning-plan-edit-title"
      title="Rediger ambisjon"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Lagrer …' : 'Lagre'}
          </Button>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hva er ambisjonen for HMS-arbeidet?</p>
          <div className="space-y-3">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Tittel</p>
              <StandardInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Et arbeidsmiljø som er fullt forsvarlig …"
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
              <StandardTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Vi skal etterleve … og samtidig løfte arbeidsmiljøet …"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvilket lovgrunnlag er ambisjonen forankret i?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Lovgrunnlag</p>
            <StandardInput
              value={legalBasis}
              onChange={(e) => setLegalBasis(e.target.value)}
              placeholder="AML § 1-1, § 3-1, § 4-1 til § 4-3"
              className="mt-1.5 font-mono text-xs"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvem er sponsor og fasilitator?</p>
          <div className="space-y-3">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Sponsor</p>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={sponsorChoice}
                onChange={(e) => setSponsorChoice(e.target.value)}
                className="mt-1.5 w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32]"
              >
                <option value="">— Velg —</option>
                {personOptions.map((p) => (
                  <option key={p.id} value={p.id.startsWith('__') ? `__name__${p.name}` : p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Fasilitator</p>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <select
                value={facilitatorChoice}
                onChange={(e) => setFacilitatorChoice(e.target.value)}
                className="mt-1.5 w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32]"
              >
                <option value="">— Velg —</option>
                {personOptions.map((p) => (
                  <option key={p.id} value={p.id.startsWith('__') ? `__name__${p.name}` : p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>For hvilken periode skal denne planen gjelde?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Horisont</p>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              className="mt-1.5 w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1a3d32]"
            >
              <option value="">— Velg —</option>
              {horizonOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </SlidePanel>
  )
}
