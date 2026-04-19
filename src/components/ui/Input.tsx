import type { InputHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export const standardFieldClassName =
  'w-full border border-neutral-300 rounded-md bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25 disabled:bg-neutral-50 disabled:text-neutral-500'

export function StandardInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={twMerge(standardFieldClassName, className)} {...props} />
}
