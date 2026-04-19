import { AlertCircle, Info } from 'lucide-react'

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{children}</span>
    </div>
  )
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{children}</span>
    </div>
  )
}
