// RequirementEditorPanel — create or edit one compliance requirement.
//
// System rows are visible in read-only mode (slug + code + title). Editing
// is permitted only for org-defined rows (the RLS policy denies writes to
// system rows from the application — the form mirrors that constraint to
// surface a clear UX rather than relying on a server error).

import { useState } from 'react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useActivePack } from '../../../src/context/packContextValue'
import { useRequirements } from '../useRequirements'
import type { ComplianceRequirementRow } from '../types'

type Props = {
  mode: 'create' | 'edit'
  requirement: ComplianceRequirementRow | null
  onClose: () => void
  onSaved: () => void
}

export function RequirementEditorPanel({
  mode,
  requirement,
  onClose,
  onSaved,
}: Props) {
  const { supabase } = useOrgSetupContext()
  const pack = useActivePack()
  const reqs = useRequirements({ supabase })

  const isSystem = Boolean(requirement?.is_system)

  const [code, setCode] = useState(requirement?.code ?? '')
  const [title, setTitle] = useState(requirement?.title ?? '')
  const [slug, setSlug] = useState(requirement?.slug ?? '')
  const [description, setDescription] = useState(requirement?.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const slugFromCode = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const canSubmit =
    !submitting &&
    !isSystem &&
    code.trim().length > 0 &&
    title.trim().length > 0 &&
    (mode === 'edit' || slug.trim().length > 0)

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setLocalError(null)
    try {
      if (mode === 'create') {
        const id = await reqs.createRequirement({
          pack: pack.slug,
          slug: slug.trim(),
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
        })
        if (!id) {
          setLocalError(reqs.error ?? 'Kunne ikke opprette kravet.')
          setSubmitting(false)
          return
        }
      } else if (requirement) {
        await reqs.updateRequirement({
          id: requirement.id,
          code: code.trim(),
          title: title.trim(),
          description: description.trim() || null,
        })
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  const titleText = isSystem
    ? `${requirement?.code} — systemkrav`
    : mode === 'create'
      ? 'Nytt krav'
      : `Rediger ${requirement?.code ?? 'krav'}`

  return (
    <FormModal
      open
      onClose={onClose}
      titleId="form-edit-requirement"
      title={titleText}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-neutral-500">
            {isSystem ? 'Systemkrav er skrivebeskyttet.' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {isSystem ? 'Lukk' : 'Avbryt'}
            </Button>
            {!isSystem ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={!canSubmit}
              >
                {mode === 'create' ? 'Opprett' : 'Lagre'}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        {(localError ?? reqs.error) ? (
          <div className="px-4 pt-4 md:px-5">
            <WarningBox>{localError ?? reqs.error}</WarningBox>
          </div>
        ) : null}

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Kort kode (vises som badge), f.eks. AML §3-1.
          </p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Kode</p>
            <StandardInput
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                if (mode === 'create' && slug === slugFromCode(code)) {
                  setSlug(slugFromCode(e.target.value))
                }
              }}
              disabled={isSystem}
              className="mt-1.5 font-mono text-sm"
              placeholder="AML §3-1"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Stabil identifikator brukt i tagging.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Slug</p>
            <StandardInput
              value={slug}
              onChange={(e) => setSlug(slugFromCode(e.target.value))}
              disabled={isSystem || mode === 'edit'}
              className="mt-1.5 font-mono text-sm"
              placeholder="aml-3-1"
            />
            <p className="mt-1 text-xs text-neutral-500">
              {mode === 'edit'
                ? 'Slug er låst etter opprettelse — endring ville bryte tagging.'
                : 'Auto-utledes fra koden, kan overstyres før du lagrer.'}
            </p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Kort tittel som beskriver kravet.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tittel</p>
            <StandardInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSystem}
              className="mt-1.5"
              placeholder="Krav til systematisk HMS-arbeid"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Utfyllende beskrivelse (valgfritt).</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
            <StandardTextarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSystem}
              rows={3}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>
    </FormModal>
  )
}
