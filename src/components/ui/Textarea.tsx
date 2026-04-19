import type { TextareaHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

import { standardFieldClassName } from './Input'

export function StandardTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={twMerge(standardFieldClassName, className)} {...props} />
}
