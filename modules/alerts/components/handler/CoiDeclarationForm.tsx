// CoiDeclarationForm — conflict-of-interest declaration that a handler
// must complete before being added to a case roster. Five canonical
// questions reference Forvaltningsloven § 6 (a)-(e). Outcome 'cleared'
// requires all answers to be 'no'; otherwise 'requires_review'.

import { useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertCoiOutcome } from '../../types'

type Props = {
  supabase: SupabaseClient
  caseId: string
  onCleared: (declarationId: string) => void
  onBlocked?: () => void
  lang: 'nb' | 'en'
}

type Question = {
  key: string
  text: { nb: string; en: string }
  /** True = answer in this direction is a red flag (blocks). */
  redFlagValue: 'yes' | 'no'
  lawRef?: string
}

const COI_QUESTIONS: Question[] = [
  {
    key: 'personal_relationship',
    text: {
      nb: 'Har du et personlig forhold (familie, vennskap, fiendskap) til varsleren eller den anklagede?',
      en: 'Do you have a personal relationship (family, friendship, enmity) with the reporter or the accused?',
    },
    redFlagValue: 'yes',
    lawRef: 'fvl. § 6 (a)',
  },
  {
    key: 'subordinate_supervisor',
    text: {
      nb: 'Står du i et over-/underordnings­forhold til varsleren eller den anklagede?',
      en: 'Are you in a subordinate/supervisor relationship with the reporter or the accused?',
    },
    redFlagValue: 'yes',
    lawRef: 'fvl. § 6 (b)',
  },
  {
    key: 'financial_interest',
    text: {
      nb: 'Har du økonomiske interesser i utfallet av saken?',
      en: 'Do you have financial interests in the outcome of the case?',
    },
    redFlagValue: 'yes',
    lawRef: 'fvl. § 6 (c)',
  },
  {
    key: 'previous_involvement',
    text: {
      nb: 'Har du vært involvert i samme forhold tidligere (representert en part, gitt råd, vurdert forholdet)?',
      en: 'Have you been involved in the same matter before (representing a party, advising, assessing)?',
    },
    redFlagValue: 'yes',
    lawRef: 'fvl. § 6 (d)',
  },
  {
    key: 'other_special_circumstance',
    text: {
      nb: 'Foreligger det andre særlige forhold som kan svekke tilliten til at du er upartisk?',
      en: 'Are there other special circumstances that could impair confidence in your impartiality?',
    },
    redFlagValue: 'yes',
    lawRef: 'fvl. § 6 (e)',
  },
]

export function CoiDeclarationForm({ supabase, caseId, onCleared, onBlocked, lang }: Props) {
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no' | null>>({})
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAnswered = useMemo(
    () => COI_QUESTIONS.every((q) => answers[q.key] === 'yes' || answers[q.key] === 'no'),
    [answers],
  )

  const computedOutcome: AlertCoiOutcome = useMemo(() => {
    if (!allAnswered) return 'requires_review'
    const anyRed = COI_QUESTIONS.some((q) => answers[q.key] === q.redFlagValue)
    return anyRed ? 'requires_review' : 'cleared'
  }, [answers, allAnswered])

  async function submit() {
    setSubmitting(true)
    setError(null)
    const { data: userRow } = await supabase.auth.getUser()
    const userId = userRow.user?.id
    if (!userId) {
      setError(lang === 'nb' ? 'Du må være innlogget.' : 'You must be signed in.')
      setSubmitting(false)
      return
    }
    const { data: caseRow } = await supabase
      .from('alert_cases')
      .select('organization_id')
      .eq('id', caseId)
      .single()
    const orgId = (caseRow as { organization_id?: string } | null)?.organization_id
    if (!orgId) {
      setError(lang === 'nb' ? 'Fant ikke sak.' : 'Case not found.')
      setSubmitting(false)
      return
    }
    const { data: inserted, error: insertError } = await supabase
      .from('alert_coi_declaration')
      .insert({
        case_id: caseId,
        organization_id: orgId,
        handler_user_id: userId,
        questions: COI_QUESTIONS.map((q) => ({ key: q.key, text: q.text[lang], lawRef: q.lawRef })),
        answers,
        outcome: computedOutcome,
        outcome_reason: computedOutcome === 'requires_review' ? reason || null : null,
      })
      .select('id, outcome')
      .single()
    setSubmitting(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    const row = inserted as { id: string; outcome: AlertCoiOutcome }
    if (row.outcome === 'cleared') {
      onCleared(row.id)
    } else if (row.outcome === 'blocked') {
      onBlocked?.()
    } else {
      onCleared(row.id) // requires_review — caller decides whether to proceed
    }
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-900">
        {lang === 'nb' ? 'Habilitetserklæring (fvl. § 6)' : 'Conflict-of-interest declaration (fvl. § 6)'}
      </h3>
      <p className="mt-1 text-xs text-amber-900">
        {lang === 'nb'
          ? 'Du må svare på følgende spørsmål før du kan behandle denne saken.'
          : 'Answer these questions before handling this case.'}
      </p>
      <div className="mt-4 space-y-3">
        {COI_QUESTIONS.map((q) => (
          <div key={q.key} className="rounded border border-amber-200 bg-white p-3">
            <p className="text-sm text-neutral-900">{q.text[lang]}</p>
            {q.lawRef && <p className="mt-0.5 text-[10px] uppercase text-neutral-500">{q.lawRef}</p>}
            <div className="mt-2 flex gap-3">
              {(['no', 'yes'] as const).map((v) => (
                <label key={v} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={q.key}
                    checked={answers[q.key] === v}
                    onChange={() => setAnswers({ ...answers, [q.key]: v })}
                  />
                  {v === 'yes'
                    ? lang === 'nb' ? 'Ja' : 'Yes'
                    : lang === 'nb' ? 'Nei' : 'No'}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {allAnswered && computedOutcome === 'requires_review' && (
        <div className="mt-3">
          <label className="text-xs font-semibold">
            {lang === 'nb'
              ? 'Forklar (vurderes av komitéleder)'
              : 'Explain (reviewed by committee chair)'}
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-amber-300 px-2 py-1 text-sm"
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting || !allAnswered}
        className="mt-3 rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {submitting
          ? lang === 'nb' ? 'Lagrer…' : 'Saving…'
          : lang === 'nb' ? 'Send erklæring' : 'Submit declaration'}
      </button>
    </div>
  )
}
