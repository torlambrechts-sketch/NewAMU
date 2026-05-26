// Borderless search-row input. Designed for command palettes, global
// filters, and other "search inside a row that already has its own
// border" contexts — places where the default StandardInput's border
// + padding would create double-chrome.
//
// Use StandardInput for form fields; use SearchInput when the input is
// itself the content of a styled container (the container draws the
// rectangle, the input draws nothing).

import { forwardRef, type InputHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

const searchFieldClassName =
  'w-full border-0 bg-transparent p-0 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-0 focus:outline-none disabled:text-neutral-500'

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={twMerge(searchFieldClassName, className)}
        {...props}
      />
    )
  },
)
