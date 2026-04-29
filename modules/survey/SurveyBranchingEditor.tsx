import { useMemo } from 'react'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { StandardInput } from '../../src/components/ui/Input'
import { InfoBox } from '../../src/components/ui/AlertBox'
import type { ConditionQuestionOpt } from './SurveyQuestionConditionEditor'

function parseBranchHide(json: string): { equals: string; hideIds: string } {
  try {
    const o = JSON.parse(json || '{}') as Record<string, unknown>
    const lj = o.logic_jump as Record<string, unknown> | undefined
    const bh = lj?.branchHide as Record<string, unknown> | undefined
    const eq = typeof bh?.ifAnswerEquals === 'string' ? bh.ifAnswerEquals : ''
    const raw = bh?.hideQuestionIds
    const lines = Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string')
      : typeof raw === 'string'
        ? raw.split(/[\s,]+/).filter(Boolean)
        : []
    return { equals: eq, hideIds: lines.join('\n') }
  } catch {
    return { equals: '', hideIds: '' }
  }
}

function mergeBranchHide(
  configJson: string,
  equals: string,
  hideLines: string,
): string {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(configJson || '{}') as Record<string, unknown>
  } catch {
    parsed = {}
  }
  const lj = { ...(typeof parsed.logic_jump === 'object' && parsed.logic_jump !== null ? (parsed.logic_jump as object) : {}) } as Record<
    string,
    unknown
  >
  const ids = hideLines
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!equals.trim() || ids.length === 0) {
    delete lj.branchHide
    if (Object.keys(lj).length === 0) delete parsed.logic_jump
    else parsed.logic_jump = lj
  } else {
    lj.branchHide = { ifAnswerEquals: equals.trim(), hideQuestionIds: ids }
    parsed.logic_jump = lj
  }
  return JSON.stringify(parsed, null, 2)
}

type Props = {
  configJson: string
  onConfigJsonChange: (next: string) => void
  /** Andre spørsmål (for hjelpetekst — ID-er kopieres fra tabellen) */
  otherQuestions: ConditionQuestionOpt[]
  currentQuestionId: string | null
}

/**
 * Enkel forgreining: når dette spørsmålet får et bestemt svar, skjul utvalgte senere spørsmål for respondenten.
 */
export function SurveyBranchingEditor({ configJson, onConfigJsonChange, otherQuestions, currentQuestionId }: Props) {
  const { equals, hideIds: hideLines } = useMemo(() => parseBranchHide(configJson), [configJson])

  const idHints = otherQuestions.filter((q) => q.id !== currentQuestionId).slice(0, 12)

  return (
    <div className="rounded-xl border border-neutral-200/90 bg-white p-4">
      <p className="text-sm font-semibold text-neutral-900">Enkel forgreining (hopp over spørsmål)</p>
      <p className="mt-1 text-xs text-neutral-600">
        Brukes typisk etter et ja/nei eller valg: når svaret matcher teksten under, vises ikke de neste spørsmålene du
        lister (én spørsmål-ID per linje). Dette er utover «betinget visning» over — her styrer du hvilke spørsmål som
        utelates helt.
      </p>
      <div className="mt-2">
        <InfoBox>
        Kopier ID fra byggertabellen (første kolonne) eller fra teknisk JSON. Eksempel: svar «Nei» → hopp over tre
        oppfølgingsspørsmål.
        </InfoBox>
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="branch-eq">
            Når svaret er (eksakt tekst eller tall som tekst)
          </label>
          <StandardInput
            id="branch-eq"
            value={equals}
            onChange={(e) => {
              const v = e.target.value
              onConfigJsonChange(mergeBranchHide(configJson, v, hideLines))
            }}
            placeholder="Ja / Nei / 3 …"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="branch-hide">
            Skjul disse spørsmålene (ID, én per linje)
          </label>
          <textarea
            id="branch-hide"
            className="mt-1 min-h-[88px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-xs text-neutral-800"
            value={hideLines}
            onChange={(e) => {
              const v = e.target.value
              onConfigJsonChange(mergeBranchHide(configJson, equals, v))
            }}
            spellCheck={false}
          />
          {idHints.length > 0 ? (
            <p className="mt-1 text-[11px] text-neutral-500">
              Eksempler på ID-er i denne undersøkelsen:{' '}
              {idHints.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  className="mr-1 font-mono text-[#1a3d32] underline"
                  onClick={() => {
                    const next = hideLines.trim() ? `${hideLines.trim()}\n${q.id}` : q.id
                    onConfigJsonChange(mergeBranchHide(configJson, equals, next))
                  }}
                >
                  {q.id.slice(0, 8)}…
                </button>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
