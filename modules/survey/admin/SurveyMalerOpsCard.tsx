// SurveyMalerOpsCard — operational table of all licensed templates for the
// org with quick controls for nav_pinned (sidebar promotion) and
// review_status (compliance review state).
//
// Slots into the existing "Maler" admin tab below the JSON import/export
// card so the JSON authoring flow stays untouched.

import { useMemo, useState } from 'react'
import { ChevronDown, FileCheck2, Pin, PinOff, Settings2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
  LAYOUT_TABLE1_POSTINGS_TD,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { SearchableSelect, type SelectOption } from '../../../src/components/ui/SearchableSelect'
import { useSurveyOrgTemplates, type ResolvedSurveyTemplate } from '../useSurveyOrgTemplates'
import { useSurveyCategories } from '../useSurveyCategories'
import { useSurveyPacks } from '../useSurveyPacks'
import type { SurveyPackSlug } from '../types'
import { SurveyTemplateMetadataEditorPanel } from './SurveyTemplateMetadataEditorPanel'

type Props = {
  supabase: SupabaseClient | null
}

type ReviewStatus = ResolvedSurveyTemplate['reviewStatus']

const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Utkast',
  reviewed: 'Gjennomgått',
  approved: 'Godkjent',
}

const REVIEW_STATUS_VARIANT: Record<ReviewStatus, 'neutral' | 'info' | 'success'> = {
  draft: 'neutral',
  reviewed: 'info',
  approved: 'success',
}

const REVIEW_STATUS_OPTIONS: SelectOption[] = (
  ['draft', 'reviewed', 'approved'] as ReviewStatus[]
).map((v) => ({ value: v, label: REVIEW_STATUS_LABEL[v] }))

type PackFilter = SurveyPackSlug | 'all'

export function SurveyMalerOpsCard({ supabase }: Props) {
  const { templates, error, setNavPinned, setReviewStatus, setCategoryId, setMetadataSchema } =
    useSurveyOrgTemplates({ supabase })
  const surveyCategories = useSurveyCategories({ supabase })
  const { packs } = useSurveyPacks({ supabase })
  const [editTarget, setEditTarget] = useState<ResolvedSurveyTemplate | null>(null)
  const [filter, setFilter] = useState<PackFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const packOptions: SelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'Alle pakker' },
      ...packs.map((p) => ({ value: p.slug, label: p.short_name })),
    ],
    [packs],
  )

  const packLabel = useMemo(() => {
    const map = new Map<SurveyPackSlug, string>()
    for (const p of packs) map.set(p.slug, p.short_name)
    return map
  }, [packs])

  const filtered = useMemo(() => {
    const list = filter === 'all' ? templates : templates.filter((t) => t.pack === filter)
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  }, [templates, filter])

  const handleTogglePin = async (t: ResolvedSurveyTemplate) => {
    if (!t.overrideId) return
    setBusyId(t.overrideId)
    try {
      await setNavPinned(t.overrideId, !t.navPinned)
    } finally {
      setBusyId(null)
    }
  }

  const handleSetStatus = async (t: ResolvedSurveyTemplate, next: ReviewStatus) => {
    if (!t.overrideId || next === t.reviewStatus) return
    setBusyId(t.overrideId)
    try {
      await setReviewStatus(t.overrideId, next)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ModuleSectionCard className="mt-6 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Promotering & gjennomgang</h2>
            <p className="mt-1.5 text-sm text-neutral-600">
              Styr om en mal vises i sidemenyen (Pin) og hvor den står i den
              interne gjennomgangsprosessen. Endringer trer i kraft umiddelbart
              for alle brukere i organisasjonen.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Pakke</span>
          <div className="min-w-[160px]">
            <SearchableSelect
              value={filter}
              options={packOptions}
              onChange={(v) => setFilter(v as PackFilter)}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <WarningBox>{error}</WarningBox>
        </div>
      ) : null}

      <div className="mt-4">
        <LayoutTable1PostingsShell
          wrap={false}
          title="Maler"
          description={`${filtered.length} ${filtered.length === 1 ? 'mal' : 'maler'}`}
          toolbar={null}
        >
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              {filter === 'all'
                ? 'Ingen maler tilgjengelig.'
                : 'Ingen maler i denne pakken.'}
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Navn</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Pakke</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Hoveddata</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Sidemeny</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Gjennomgang</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const isBusy = busyId === t.overrideId
                    return (
                      <tr key={t.overrideId ?? t.catalogId} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <span className="font-medium text-neutral-900">{t.name}</span>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <Badge variant="info">{packLabel.get(t.pack) ?? t.pack}</Badge>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <Badge variant={t.isSystem ? 'warning' : 'neutral'}>
                            {t.isSystem ? 'System' : 'Egen'}
                          </Badge>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <div className="inline-flex items-center gap-1.5">
                            <Badge variant="neutral">
                              {t.metadataSchema?.fields?.length ?? 0} felt
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon={<Settings2 className="h-3.5 w-3.5" />}
                              disabled={!t.overrideId}
                              onClick={() => setEditTarget(t)}
                            >
                              Rediger
                            </Button>
                          </div>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <Button
                            type="button"
                            variant={t.navPinned ? 'primary' : 'ghost'}
                            size="sm"
                            disabled={isBusy || !t.overrideId}
                            onClick={() => void handleTogglePin(t)}
                            icon={t.navPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                          >
                            {t.navPinned ? 'Pinnet' : 'Ikke pinnet'}
                          </Button>
                        </td>
                        <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                          <div className="inline-flex items-center gap-2">
                            <Badge variant={REVIEW_STATUS_VARIANT[t.reviewStatus]}>
                              {REVIEW_STATUS_LABEL[t.reviewStatus]}
                            </Badge>
                            <div className="min-w-[140px]">
                              <SearchableSelect
                                value={t.reviewStatus}
                                options={REVIEW_STATUS_OPTIONS}
                                onChange={(v) => void handleSetStatus(t, v as ReviewStatus)}
                                disabled={isBusy || !t.overrideId}
                              />
                            </div>
                            <ChevronDown className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </LayoutTable1PostingsShell>
      </div>

      <SurveyTemplateMetadataEditorPanel
        open={editTarget !== null}
        template={editTarget}
        categories={surveyCategories.categories}
        onClose={() => setEditTarget(null)}
        onSaveCategory={async (overrideId, categoryId) => {
          await setCategoryId(overrideId, categoryId)
        }}
        onSaveMetadataSchema={async (overrideId, fields) => {
          await setMetadataSchema(overrideId, { fields })
        }}
      />
    </ModuleSectionCard>
  )
}
