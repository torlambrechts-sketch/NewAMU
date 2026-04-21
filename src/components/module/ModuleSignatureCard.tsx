import type { ReactNode } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../ui/Button'

/**
 * Signature card used across HSE modules (ROS analyses, Inspeksjonsrunder, future SJA).
 *
 * Each module requires two roles to sign off on a document (e.g. Leder + Verneombud,
 * Ansvarlig + Verneombud). The visual language — large status circle, role label,
 * law reference, signed metadata and CTA button — is identical in every case.
 *
 * This component replaces the duplicated JSX that previously existed in
 * `modules/inspection/InspectionRoundPage.tsx` (SignaturesTab) and
 * `modules/ros/RosSignaturesTab.tsx`.
 */
export interface ModuleSignatureCardProps {
  title: string
  /** Short legal reference shown under the title, e.g. `AML § 2-1 — arbeidsgiveransvar`. */
  lawReference?: string
  /** When truthy, the card renders the «signed» state with metadata. */
  signed?: {
    at: string | null | undefined
    byName?: string | null
  } | null
  /** Additional context line rendered under the title when set (e.g. «Du er registrert som leder»). */
  contextLine?: ReactNode
  /** Label shown on the CTA button when not signed yet. */
  buttonLabel: string
  buttonLabelSigning?: string
  /**
   * Visual weight for the unsigned CTA. `primary` when the current user is authorised
   * (or no restriction exists), `secondary` when someone else should sign.
   */
  variant?: 'primary' | 'secondary'
  /** Disable CTA — e.g. pre-flight not satisfied, wrong role, other button is in flight. */
  disabled?: boolean
  /** Tooltip on the disabled CTA (e.g. «Ikke autorisert»). */
  disabledTitle?: string
  /** Set while the signature is being submitted to disable the button and flip its label. */
  busy?: boolean
  /** Hide the CTA entirely (e.g. record already closed). */
  hideButton?: boolean
  onSign: () => void | Promise<void>
}

function formatSignedDate(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return null
  }
}

export function ModuleSignatureCard({
  title,
  lawReference,
  signed,
  contextLine,
  buttonLabel,
  buttonLabelSigning = 'Signerer…',
  variant = 'primary',
  disabled = false,
  disabledTitle,
  busy = false,
  hideButton = false,
  onSign,
}: ModuleSignatureCardProps) {
  const isSigned = Boolean(signed?.at)
  const signedLabel = isSigned ? formatSignedDate(signed!.at) : null

  return (
    <div
      className={twMerge(
        'rounded-xl border-2 p-5 transition-all',
        isSigned
          ? 'border-green-300 bg-green-50'
          : variant === 'primary' && !disabled
            ? 'border-[#1a3d32]/40 bg-white shadow-sm'
            : 'border-neutral-200 bg-white',
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isSigned ? (
            <CheckCircle2 className="h-7 w-7 shrink-0 text-green-500" aria-hidden />
          ) : (
            <Circle className="h-7 w-7 shrink-0 text-neutral-300" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-base font-semibold text-neutral-900">{title}</p>
            {lawReference ? <p className="text-xs text-neutral-500">{lawReference}</p> : null}
            {contextLine ? <div className="mt-0.5">{contextLine}</div> : null}
            {isSigned ? (
              <p className="mt-0.5 text-xs font-medium text-green-700">
                ✓ Signert{signedLabel ? ` ${signedLabel}` : ''}
                {signed?.byName ? ` av ${signed.byName}` : ''}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-neutral-400">Venter på signatur</p>
            )}
          </div>
        </div>
        {!isSigned && !hideButton ? (
          <Button
            type="button"
            variant={variant === 'primary' ? 'primary' : 'secondary'}
            disabled={disabled || busy}
            title={disabledTitle}
            onClick={() => void onSign()}
            className="shrink-0 disabled:opacity-40"
          >
            {busy ? buttonLabelSigning : buttonLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
