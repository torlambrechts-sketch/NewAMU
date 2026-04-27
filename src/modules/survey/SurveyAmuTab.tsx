import { useState, useEffect } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import type { SurveyModuleState } from './useSurveyLegacy'
import type { SurveyCampaignRow } from '../../data/survey'

const BTN_PRIMARY =
  'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14312a] transition-colors disabled:opacity-40'
const INPUT =
  'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30'
const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

type Props = { survey: SurveyModuleState; campaign: SurveyCampaignRow }

export function SurveyAmuTab({ survey, campaign }: Props) {
  const review = survey.amuReview
  const [chairName, setChairName] = useState('')
  const [voName, setVoName] = useState('')
  const [meetingDate, setMeetingDate] = useState(review?.meeting_date ?? '')
  const [agendaItem, setAgendaItem] = useState(review?.agenda_item ?? '')
  const [protocol, setProtocol] = useState(review?.protocol_text ?? '')
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState<'chair' | 'vo' | null>(null)

  useEffect(() => {
    setMeetingDate(review?.meeting_date ?? '')
    setAgendaItem(review?.agenda_item ?? '')
    setProtocol(review?.protocol_text ?? '')
  }, [review?.id, review?.meeting_date, review?.agenda_item, review?.protocol_text])

  const handleSaveMeta = async () => {
    setSaving(true)
    await survey.upsertAmuReview(campaign.id, {
      meeting_date: meetingDate || null,
      agenda_item: agendaItem || null,
      protocol_text: protocol || null,
    })
    setSaving(false)
  }

  const handleSignChair = async () => {
    if (!review || !chairName.trim()) return
    setSigning('chair')
    await survey.signAmuChair(review.id, chairName)
    setSigning(null)
  }

  const handleSignVo = async () => {
    if (!review || !voName.trim()) return
    setSigning('vo')
    await survey.signVo(review.id, voName)
    setSigning(null)
  }

  const bothSigned = review?.amu_chair_signed_at && review?.vo_signed_at

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] px-4 py-3 text-sm text-[#1a3d32]">
        <strong>AML § 7-2:</strong> Resultater fra organisasjonsundersøkelser skal presenteres for Arbeidsmiljøutvalget
        (AMU) og vernombud. Protokoll fra gjennomgangen skal undertegnes av AMU-leder og vernombud og arkiveres
        (IK-forskriften § 5).
      </div>

      {bothSigned ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>AMU-gjennomgang fullført og signert av begge parter.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-5 w-5 shrink-0" />
          <span>
            Venter på signering fra{' '}
            {!review?.amu_chair_signed_at && !review?.vo_signed_at
              ? 'AMU-leder og vernombud'
              : !review?.amu_chair_signed_at
                ? 'AMU-leder'
                : 'vernombud'}
            .
          </span>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-[#1a3d32]">Møtedetaljer</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={FIELD_LABEL}>Møtedato</label>
            <input type="date" className={INPUT} value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Agendapunkt</label>
            <input
              className={INPUT}
              value={agendaItem}
              onChange={(e) => setAgendaItem(e.target.value)}
              placeholder="f.eks. Sak 3 – Arbeidsmiljøundersøkelse 2026"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={FIELD_LABEL}>Protokolltekst / referat</label>
            <textarea
              className={INPUT}
              rows={4}
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              placeholder="Oppsummering av gjennomgang, vedtak og tiltak…"
            />
          </div>
        </div>
        <button type="button" onClick={handleSaveMeta} disabled={saving} className={BTN_PRIMARY}>
          {saving ? 'Lagrer…' : review ? 'Oppdater' : 'Opprett protokoll'}
        </button>
      </div>

      {review && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className={`rounded-xl border-2 p-5 shadow-sm ${review.amu_chair_signed_at ? 'border-emerald-400 bg-emerald-50' : 'border-[#1a3d32]/30 bg-white'}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1a3d32]">AMU-leder</h4>
              {review.amu_chair_signed_at ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <Clock className="h-5 w-5 text-neutral-300" />
              )}
            </div>
            {review.amu_chair_signed_at ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-neutral-800">{review.amu_chair_name}</p>
                <p className="text-xs text-emerald-700">
                  Signert{' '}
                  {new Date(review.amu_chair_signed_at).toLocaleDateString('nb-NO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className={FIELD_LABEL}>Ditt fulle navn</label>
                  <input className={INPUT} value={chairName} onChange={(e) => setChairName(e.target.value)} placeholder="Navn Navnesen" />
                </div>
                <button
                  type="button"
                  onClick={handleSignChair}
                  disabled={signing === 'chair' || !chairName.trim()}
                  className={BTN_PRIMARY + ' w-full'}
                >
                  {signing === 'chair' ? 'Signerer…' : 'Signer som AMU-leder'}
                </button>
              </div>
            )}
          </div>

          <div
            className={`rounded-xl border-2 p-5 shadow-sm ${review.vo_signed_at ? 'border-emerald-400 bg-emerald-50' : 'border-[#1a3d32]/30 bg-white'}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#1a3d32]">Vernombud (VO)</h4>
              {review.vo_signed_at ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <Clock className="h-5 w-5 text-neutral-300" />}
            </div>
            {review.vo_signed_at ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-neutral-800">{review.vo_name}</p>
                <p className="text-xs text-emerald-700">
                  Signert{' '}
                  {new Date(review.vo_signed_at).toLocaleDateString('nb-NO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className={FIELD_LABEL}>Ditt fulle navn</label>
                  <input className={INPUT} value={voName} onChange={(e) => setVoName(e.target.value)} placeholder="Navn Navnesen" />
                </div>
                <button
                  type="button"
                  onClick={handleSignVo}
                  disabled={signing === 'vo' || !voName.trim()}
                  className={BTN_PRIMARY + ' w-full'}
                >
                  {signing === 'vo' ? 'Signerer…' : 'Signer som vernombud'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!review && <p className="text-center text-xs text-neutral-400">Opprett protokollen ovenfor for å aktivere signering.</p>}
    </div>
  )
}
