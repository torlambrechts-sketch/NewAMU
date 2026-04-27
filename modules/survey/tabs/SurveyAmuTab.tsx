import { useEffect, useState } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import { ModuleSectionCard, ModulePreflightChecklist } from '../../../src/components/module'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { Badge } from '../../../src/components/ui/Badge'
import { ComplianceBanner } from '../../../src/components/ui/ComplianceBanner'
import { InfoBox, WarningBox } from '../../../src/components/ui/AlertBox'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { SurveyDetailTab } from './types'

export function SurveyAmuTab({ survey, s }: SurveyDetailTab) {
  const review = survey.amuReview
  const [meetingDate, setMeetingDate] = useState(review?.meeting_date ?? '')
  const [agendaItem, setAgendaItem] = useState(review?.agenda_item ?? '')
  const [protocol, setProtocol] = useState(review?.protocol_text ?? '')
  const [chairName, setChairName] = useState('')
  const [voName, setVoName] = useState('')
  const [saving, setSaving] = useState(false)
  const [signingChair, setSigningChair] = useState(false)
  const [signingVo, setSigningVo] = useState(false)

  useEffect(() => {
    setMeetingDate(review?.meeting_date ?? '')
    setAgendaItem(review?.agenda_item ?? '')
    setProtocol(review?.protocol_text ?? '')
  }, [review?.id, review?.meeting_date, review?.agenda_item, review?.protocol_text])

  const bothSigned = !!(review?.amu_chair_signed_at && review?.vo_signed_at)

  const missingSignHint = (() => {
    if (bothSigned || !review) return null
    const needChair = !review.amu_chair_signed_at
    const needVo = !review.vo_signed_at
    if (needChair && needVo) return 'Venter på signering fra AMU-leder og vernombud.'
    if (needChair) return 'Venter på signering fra AMU-leder.'
    if (needVo) return 'Venter på signering fra vernombud.'
    return null
  })()

  const handleSave = async () => {
    setSaving(true)
    try {
      await survey.upsertAmuReview(s.id, {
        meeting_date: meetingDate || null,
        agenda_item: agendaItem || null,
        protocol_text: protocol || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSignChair = async (name: string) => {
    if (!review?.id || !name.trim()) return
    setSigningChair(true)
    try {
      await survey.signAmuChair(review.id, name)
      setChairName('')
    } finally {
      setSigningChair(false)
    }
  }

  const handleSignVo = async (name: string) => {
    if (!review?.id || !name.trim()) return
    setSigningVo(true)
    try {
      await survey.signVo(review.id, name)
      setVoName('')
    } finally {
      setSigningVo(false)
    }
  }

  return (
    <div className="space-y-6">
      <ComplianceBanner title="AML § 7-2, IK-forskriften § 5 — AMU">
        Resultater fra organisasjonsundersøkelser skal presenteres for Arbeidsmiljøutvalget (AMU) og vernombud.
        Protokoll fra gjennomgangen undertegnes av AMU-leder og vernombud og arkiveres.
      </ComplianceBanner>

      {survey.error && <WarningBox>{survey.error}</WarningBox>}

      {bothSigned ? (
        <InfoBox>
          <span className="inline-flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden />
            AMU-gjennomgang fullført og signert av begge parter.
          </span>
        </InfoBox>
      ) : (
        <InfoBox>
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" aria-hidden />
            {missingSignHint ?? 'Fyll ut protokoll og signér når undersøkelsen er klar for AMU-gjennomgang.'}
          </span>
        </InfoBox>
      )}

      <ModuleSectionCard className="p-5 md:p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Møtedetaljer</h2>
        <div className={`${WPSTD_FORM_ROW_GRID} mt-4`}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Protokolldata</p>
            <p className="mt-1 text-sm text-neutral-600">
              Fyll inn møtedato, agendapunkt og referat fra AMU-gjennomgangen. Lagre før signering.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-meeting-date">
                Møtedato
              </label>
              <StandardInput
                id="amu-meeting-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                disabled={bothSigned}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agenda-item">
                Agendapunkt
              </label>
              <StandardInput
                id="amu-agenda-item"
                value={agendaItem}
                onChange={(e) => setAgendaItem(e.target.value)}
                placeholder="F.eks. Sak 3 – Arbeidsmiljøundersøkelse 2026"
                disabled={bothSigned}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-protocol">
                Protokolltekst / referat
              </label>
              <StandardTextarea
                id="amu-protocol"
                rows={5}
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                placeholder="Oppsummering av gjennomgang, vedtak og tiltak…"
                disabled={bothSigned}
              />
            </div>
            {!bothSigned && survey.canManage && (
              <Button type="button" variant="secondary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? 'Lagrer…' : review ? 'Oppdater protokoll' : 'Opprett protokoll'}
              </Button>
            )}
          </div>
        </div>
      </ModuleSectionCard>

      {review && !bothSigned && (
        <ModuleSectionCard className="p-5 md:p-6">
          <ModulePreflightChecklist
            items={[
              { label: 'Protokolltekst er skrevet', ok: Boolean(review.protocol_text?.trim()) },
              { label: 'Møtedato er registrert', ok: Boolean(review.meeting_date) },
              { label: 'Agendapunkt er angitt', ok: Boolean(review.agenda_item?.trim()) },
              { label: 'Undersøkelsen er lukket', ok: s.status === 'closed' },
            ]}
          />
        </ModuleSectionCard>
      )}

      {review && !bothSigned && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ModuleSectionCard className="p-5 md:p-6">
            <h3 className="text-base font-semibold text-neutral-900">AMU-leder</h3>
            {review.amu_chair_signed_at ? (
              <div className="mt-3 space-y-1">
                <p className="font-medium text-neutral-800">{review.amu_chair_name ?? '—'}</p>
                <p className="text-xs text-emerald-700">
                  Signert{' '}
                  {new Date(review.amu_chair_signed_at).toLocaleDateString('nb-NO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <Badge variant="success">Signert</Badge>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="chair-name">
                    Ditt fulle navn
                  </label>
                  <StandardInput
                    id="chair-name"
                    value={chairName}
                    onChange={(e) => setChairName(e.target.value)}
                    placeholder="Navn Navnesen"
                    disabled={!survey.canManage}
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!survey.canManage || signingChair || !chairName.trim()}
                  onClick={() => void handleSignChair(chairName)}
                >
                  {signingChair ? 'Signerer…' : 'Signer som AMU-leder'}
                </Button>
              </div>
            )}
          </ModuleSectionCard>

          <ModuleSectionCard className="p-5 md:p-6">
            <h3 className="text-base font-semibold text-neutral-900">Vernombud</h3>
            {review.vo_signed_at ? (
              <div className="mt-3 space-y-1">
                <p className="font-medium text-neutral-800">{review.vo_name ?? '—'}</p>
                <p className="text-xs text-emerald-700">
                  Signert{' '}
                  {new Date(review.vo_signed_at).toLocaleDateString('nb-NO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <Badge variant="success">Signert</Badge>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="vo-name">
                    Ditt fulle navn
                  </label>
                  <StandardInput
                    id="vo-name"
                    value={voName}
                    onChange={(e) => setVoName(e.target.value)}
                    placeholder="Navn Navnesen"
                    disabled={!survey.canManage}
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!survey.canManage || signingVo || !voName.trim()}
                  onClick={() => void handleSignVo(voName)}
                >
                  {signingVo ? 'Signerer…' : 'Signer som vernombud'}
                </Button>
              </div>
            )}
          </ModuleSectionCard>
        </div>
      )}

      {!review && (
        <p className="text-center text-xs text-neutral-400">Opprett protokollen ovenfor for å aktivere signering.</p>
      )}
    </div>
  )
}
