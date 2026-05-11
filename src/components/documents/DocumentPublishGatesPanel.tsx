// Per-page gates that block publication until certain criteria are met.
//
//  - Krever godkjenner (reviewRequired + reviewerId): publication routes
//    through wiki_review_requests. The reviewer is picked here; the
//    request flow lives in DocumentReviewRequestPanel.
//  - Krever uttalelse fra verneombud (requiresVerneombudReview): a DB
//    trigger hard-blocks status='published' until a comment from a
//    profile with learning_metadata.is_safety_rep=true exists on the
//    page. AML § 6-2.

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Button } from '../ui/Button'
import { ToggleSwitch } from '../ui/FormToggles'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { WarningBox } from '../ui/AlertBox'
import type { WikiPage } from '../../types/documents'

type Props = {
  page: WikiPage
}

export function DocumentPublishGatesPanel({ page }: Props) {
  const docs = useDocuments()
  const { orgProfiles, user, supabase, organization } = useOrgSetupContext()

  const [reviewRequired, setReviewRequired] = useState<boolean>(Boolean(page.reviewRequired))
  const [reviewerId, setReviewerId] = useState<string>(page.reviewerId ?? '')
  const [verneombudRequired, setVerneombudRequired] = useState<boolean>(
    Boolean(page.requiresVerneombudReview),
  )
  const [hasVerneombudComment, setHasVerneombudComment] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Sync local toggles when the page object changes underneath us
  // (e.g. another tab updated it).
  useEffect(() => {
    setReviewRequired(Boolean(page.reviewRequired))
    setReviewerId(page.reviewerId ?? '')
    setVerneombudRequired(Boolean(page.requiresVerneombudReview))
  }, [page.reviewRequired, page.reviewerId, page.requiresVerneombudReview])

  // Probe whether any verneombud has commented on this page, so we can
  // tell the author whether the gate is currently satisfied.
  useEffect(() => {
    if (!verneombudRequired || !supabase || !organization?.id) {
      setHasVerneombudComment(false)
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('wiki_page_comments')
        .select('id, author_id, profiles:author_id(learning_metadata)')
        .eq('organization_id', organization.id)
        .eq('page_id', page.id)
        .is('deleted_at', null)
      if (cancelled) return
      // PostgREST returns the joined relation as an array even on a single-
      // row FK. Take the first element if present.
      type Row = {
        profiles?: { learning_metadata?: Record<string, unknown> | null }[] | null
      }
      const any = ((data ?? []) as Row[]).some((r) => {
        const meta = r.profiles?.[0]?.learning_metadata
        return Boolean(meta) && meta?.is_safety_rep === true
      })
      setHasVerneombudComment(any)
    })()
    return () => {
      cancelled = true
    }
  }, [verneombudRequired, supabase, organization?.id, page.id])

  const dirty =
    reviewRequired !== Boolean(page.reviewRequired) ||
    (reviewerId || null) !== (page.reviewerId ?? null) ||
    verneombudRequired !== Boolean(page.requiresVerneombudReview)

  const reviewerOptions: SelectOption[] = [
    { value: '', label: 'Velg en godkjenner…' },
    ...orgProfiles
      .filter((p) => p.id !== user?.id)
      .map((p) => ({ value: p.id, label: p.display_name })),
  ]

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await docs.updatePage(page.id, {
        reviewRequired,
        reviewerId: reviewRequired ? reviewerId || null : null,
        requiresVerneombudReview: verneombudRequired,
      })
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre.')
    } finally {
      setSaving(false)
    }
  }

  const reviewSatisfied = !reviewRequired || Boolean(reviewerId)

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded border border-neutral-200 bg-white p-3">
        <div className="flex items-start gap-3">
          <ToggleSwitch checked={reviewRequired} onChange={setReviewRequired} label="Krever godkjenner" />
          <div className="flex-1">
            <p className="font-medium text-neutral-900">Krever godkjenner før publisering</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Når aktivert, må forfatter sende dokumentet til en valgt kollega som godkjenner det før det går live.
            </p>
            {reviewRequired ? (
              <div className="mt-2">
                <label className="mb-1 block text-[11px] font-medium text-neutral-500">Godkjenner</label>
                <SearchableSelect value={reviewerId} options={reviewerOptions} onChange={setReviewerId} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded border border-neutral-200 bg-white p-3">
        <div className="flex items-start gap-3">
          <ToggleSwitch
            checked={verneombudRequired}
            onChange={setVerneombudRequired}
            label="Krever uttalelse fra verneombud"
          />
          <div className="flex-1">
            <p className="flex items-center gap-1 font-medium text-neutral-900">
              <ShieldCheck className="size-4 text-[#1a3d32]" aria-hidden />
              Krever uttalelse fra verneombud (AML § 6-2)
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Når aktivert blokkerer databasen publisering inntil minst én kollega med rollen verneombud har
              kommentert på dokumentet.
            </p>
            {verneombudRequired ? (
              <p
                className={`mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                  hasVerneombudComment
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'bg-amber-50 text-amber-900'
                }`}
              >
                {hasVerneombudComment
                  ? '✓ Verneombud har kommentert — kan publiseres'
                  : 'Ingen kommentar fra verneombud ennå — publisering vil bli blokkert'}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <WarningBox>{error}</WarningBox> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="sm" disabled={!dirty || saving || !reviewSatisfied} onClick={() => void save()}>
          {saving ? 'Lagrer…' : 'Lagre publiseringskrav'}
        </Button>
        {!reviewSatisfied ? (
          <span className="text-[11px] text-amber-700">Velg en godkjenner før du lagrer.</span>
        ) : savedAt && Date.now() - savedAt < 4000 ? (
          <span className="text-[11px] text-emerald-700">Lagret.</span>
        ) : null}
      </div>
    </div>
  )
}
