import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ComplianceBannerProps {
  title: ReactNode
  children: ReactNode
  className?: string
}

export function ComplianceBanner({ title, children, className }: ComplianceBannerProps) {
  return (
    <div className={twMerge('bg-[#1a3d32] px-4 py-4 md:px-5', className)}>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-1 text-sm leading-relaxed text-neutral-200">{children}</div>
    </div>
  )
}
