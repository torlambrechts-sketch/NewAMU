import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type { OrgSurveyQuestionRow, OrgSurveyResponseRow, SurveyRow } from './types'
import {
  parseOrgSurveyQuestionRow,
  parseOrgSurveyResponseRow,
  parseSurveyRow,
} from './types'
import {
  buildAnswersForPersistence,
  validateSurveyAnswersForSubmit,
} from './surveyRespondValidation'
import { parseDataUrlToBlob } from './surveyUploadDataUrl'
import { getOrCreateAnonymousSessionToken } from './surveyRespondSession'

type Supabase = SupabaseClient

function collect<T>(rows: unknown[] | null | undefined, parse: (r: unknown) => { success: true; data: T } | { success: false }): T[] {
  const out: T[] = []
  for (const raw of rows ?? []) {
    const p = parse(raw)
    if (p.success && p.data !== undefined) out.push(p.data)
  }
  return out
}

export type SubmitSurveyResponseArgs = {
  surveyId: string
  userId: string | null
  answers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>
  questions?: OrgSurveyQuestionRow[]
  invitationToken?: string | null
}

export type SubmitSurveyResponseContext = {
  supabase: Supabase
  orgId: string | null | undefined
}

export async function submitSurveyResponse(
  ctx: SubmitSurveyResponseContext,
  args: SubmitSurveyResponseArgs,
): Promise<{ ok: true; response: OrgSurveyResponseRow } | { ok: false; message: string }> {
  const { supabase, orgId } = ctx
  try {
    let surveyRow: SurveyRow
    let oid: string
    if (orgId) {
      const { data: s, error: se } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', args.surveyId)
        .eq('organization_id', orgId)
        .single()
      if (se) throw se
      const parsed = parseSurveyRow(s)
      if (!parsed.success) throw new Error('Ugyldig svar fra database')
      surveyRow = parsed.data
      oid = orgId
    } else {
      const { data: s, error: se } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', args.surveyId)
        .eq('status', 'active')
        .single()
      if (se) throw se
      const parsed = parseSurveyRow(s)
      if (!parsed.success) throw new Error('Ugyldig svar fra database')
      surveyRow = parsed.data
      oid = surveyRow.organization_id
    }

    if (surveyRow.status !== 'active') {
      return { ok: false, message: 'Undersøkelsen er ikke åpen for svar.' }
    }

    const { data: extRequires, error: extErr } = await supabase.rpc('survey_external_requires_personal_link', {
      p_survey_id: args.surveyId,
    })
    if (extErr) throw extErr
    const needsVendorLink = Boolean(extRequires)
    const inviteTok = args.invitationToken?.trim() ?? ''
    const hasInvite = inviteTok.length >= 16
    if (needsVendorLink && !hasInvite) {
      const allowWithoutInvite = !surveyRow.is_anonymous && Boolean(args.userId)
      if (!allowWithoutInvite) {
        return {
          ok: false,
          message:
            'Denne undersøkelsen krever den personlige lenken du fikk tilsendt. Åpne lenken fra e-post eller invitasjon.',
        }
      }
    }

    const effectiveUserId = surveyRow.is_anonymous ? null : args.userId

    let questionRows: OrgSurveyQuestionRow[]
    if (args.questions && args.questions.length > 0) {
      questionRows = args.questions.filter((q) => q.survey_id === args.surveyId && q.organization_id === oid)
    } else {
      const { data: qData, error: qe } = await supabase
        .from('org_survey_questions')
        .select('*')
        .eq('survey_id', args.surveyId)
        .eq('organization_id', oid)
      if (qe) throw qe
      questionRows = collect(qData, parseOrgSurveyQuestionRow)
    }

    const answerMap: Record<string, { value: number | null; text: string | null }> = {}
    for (const row of args.answers) {
      answerMap[row.questionId] = { value: row.answerValue, text: row.answerText }
    }

    const validation = validateSurveyAnswersForSubmit(questionRows, answerMap)
    if (!validation.ok) {
      return { ok: false, message: validation.errors[0] ?? 'Svarene kunne ikke valideres.' }
    }

    const sessionToken =
      surveyRow.is_anonymous && !orgId ? getOrCreateAnonymousSessionToken(args.surveyId) : null

    const { data: resp, error: re } = await supabase
      .from('org_survey_responses')
      .insert({
        survey_id: args.surveyId,
        organization_id: oid,
        user_id: effectiveUserId,
        respondent_session_token: sessionToken,
      })
      .select()
      .single()

    if (re) {
      const msg = getSupabaseErrorMessage(re)
      if (msg.toLowerCase().includes('unique') && msg.includes('respondent')) {
        return {
          ok: false,
          message: 'Du har allerede sendt inn svar fra denne nettleseren. Kontakt administrator ved behov.',
        }
      }
      throw re
    }

    const pr = parseOrgSurveyResponseRow(resp)
    if (!pr.success) throw new Error('Ugyldig svar fra database')

    if (inviteTok.length > 0) {
      const { data: ok, error: rpcErr } = await supabase.rpc('survey_complete_invitation_for_response', {
        p_response_id: pr.data.id,
        p_access_token: inviteTok,
      })
      if (rpcErr) throw rpcErr
      if (!ok) {
        await supabase.from('org_survey_responses').delete().eq('id', pr.data.id)
        return {
          ok: false,
          message:
            'Kunne ikke koble svaret til invitasjonen. Sjekk at lenken er riktig og ikke allerede brukt.',
        }
      }
    } else if (effectiveUserId) {
      const { error: ie } = await supabase
        .from('survey_invitations')
        .update({ status: 'completed', response_id: pr.data.id })
        .eq('survey_id', args.surveyId)
        .eq('organization_id', oid)
        .eq('profile_id', effectiveUserId)
        .eq('status', 'pending')
      if (ie) throw ie
    }

    const persistenceRows = buildAnswersForPersistence(args.surveyId, questionRows, answerMap)

    const qById = new Map(questionRows.map((q) => [q.id, q]))
    for (const row of persistenceRows) {
      const q = qById.get(row.questionId)
      const raw = row.answerText?.trim() ?? ''
      const uploadFor =
        raw.startsWith('data:') &&
        (q?.question_type === 'file_upload' || q?.question_type === 'signature')
      if (!uploadFor) continue
      const parsed = parseDataUrlToBlob(raw)
      if (!parsed) {
        await supabase.from('org_survey_responses').delete().eq('id', pr.data.id)
        return { ok: false, message: 'Kunne ikke lese vedleggsfilen. Prøv en annen fil eller mindre størrelse.' }
      }
      const path = `${oid}/${pr.data.id}/${row.questionId}/fil.${parsed.extension}`
      const { error: upErr } = await supabase.storage
        .from('survey_response_files')
        .upload(path, parsed.blob, { contentType: parsed.blob.type || undefined, upsert: true })
      if (upErr) {
        await supabase.from('org_survey_responses').delete().eq('id', pr.data.id)
        return { ok: false, message: getSupabaseErrorMessage(upErr) }
      }
      row.answerText = `fileRef:${path}`
    }

    const answerRows = persistenceRows.map((a) => ({
      response_id: pr.data.id,
      question_id: a.questionId,
      organization_id: oid,
      answer_value: a.answerValue,
      answer_text: a.answerText,
    }))

    const { error: ae } = await supabase.from('org_survey_answers').insert(answerRows)
    if (ae) {
      await supabase.from('org_survey_responses').delete().eq('id', pr.data.id)
      throw ae
    }

    return { ok: true, response: pr.data }
  } catch (err) {
    return { ok: false, message: getSupabaseErrorMessage(err) }
  }
}
