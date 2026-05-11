import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

import { standardFieldClassName } from './Input'

export const StandardTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function StandardTextarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={twMerge(standardFieldClassName, className)} {...props} />
  },
)
