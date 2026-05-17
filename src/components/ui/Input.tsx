import { forwardRef, type InputHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export const standardFieldClassName =
  'w-full border border-neutral-300 rounded-md bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25 disabled:bg-neutral-50 disabled:text-neutral-500'

// Text-input padding/border would look broken on a 16-px checkbox or radio
// dot. For non-text inputs we ship only the accent + focus tokens and let
// the consumer's `size-*` / layout classes drive geometry.
const choiceFieldClassName =
  'accent-[#1a3d32] outline-none focus-visible:ring-2 focus-visible:ring-[#1a3d32]/30 disabled:opacity-50'

const NON_TEXT_TYPES = new Set(['checkbox', 'radio', 'file', 'range', 'color', 'hidden'])

export const StandardInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function StandardInput({ className, type, ...props }, ref) {
    const base = type && NON_TEXT_TYPES.has(type) ? choiceFieldClassName : standardFieldClassName
    return <input ref={ref} type={type} className={twMerge(base, className)} {...props} />
  },
)
