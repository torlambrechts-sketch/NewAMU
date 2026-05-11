// ReportingPeriodPicker — date range + quick-pick + free-text label.
//
// Used in two places:
//   1. CreateMeetingSlidePanel (MeetingsHubView) — when starting a new
//      meeting from a template, pre-filled via suggestPeriodForTemplate.
//   2. DatapakkeTab "Endre periode" modal — when the chair wants to
//      re-resolve all bindings against a different window.
//
// Period is what the meeting REVIEWS (e.g. AMU Q1 2026 reviews Q4 2025).
// Both bounds are inclusive date-only (no time), matching the DB column
// types (`reporting_period_start/end date`).

import { useMemo } from 'react'
import { CalendarRange } from 'lucide-react'
import { StandardInput } from '../../../src/components/ui/Input'
import { Button } from '../../../src/components/ui/Button'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { PERIOD_PRESETS } from '../lib/suggestPeriodForTemplate'

export type PeriodValue = {
  start: string | null
  end: string | null
  label: string | null
}

export type ReportingPeriodPickerProps = {
  value: PeriodValue
  onChange: (v: PeriodValue) => void
  /** Anchor for the relative quick-pick buttons (defaults to today). */
  anchor?: string | null
  /** Optional short hint shown under the heading. */
  hint?: string
}

export function ReportingPeriodPicker({
  value,
  onChange,
  anchor,
  hint,
}: ReportingPeriodPickerProps) {
  const anchorDate = useMemo(() => {
    if (anchor) {
      const d = new Date(anchor)
      if (!Number.isNaN(d.getTime())) return d
    }
    return new Date()
  }, [anchor])

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200/80 bg-neutral-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-[#0891b2]" />
          <p className="text-sm font-semibold text-neutral-900">Rapporteringsperiode</p>
        </div>
        {value.start || value.end || value.label ? (
          <button
            type="button"
            className="text-[11px] text-neutral-500 underline hover:text-neutral-700"
            onClick={() => onChange({ start: null, end: null, label: null })}
          >
            Nullstill
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-neutral-600">{hint}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {PERIOD_PRESETS.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange(preset.compute(anchorDate))}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="period-start">
            Fra
          </label>
          <StandardInput
            id="period-start"
            type="date"
            className="mt-1.5"
            value={value.start ?? ''}
            onChange={(e) =>
              onChange({ ...value, start: e.target.value || null })
            }
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="period-end">
            Til
          </label>
          <StandardInput
            id="period-end"
            type="date"
            className="mt-1.5"
            value={value.end ?? ''}
            onChange={(e) =>
              onChange({ ...value, end: e.target.value || null })
            }
          />
        </div>
      </div>

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="period-label">
          Etikett (valgfri)
        </label>
        <StandardInput
          id="period-label"
          className="mt-1.5"
          placeholder="f.eks. Q4 2025, 2024, H1 2025"
          value={value.label ?? ''}
          onChange={(e) =>
            onChange({ ...value, label: e.target.value || null })
          }
        />
      </div>
    </div>
  )
}
