import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

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

export function ErrorBox({
  children,
  onDismiss,
}: {
  children: React.ReactNode
  onDismiss?: () => void
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      <span className="min-w-0 flex-1">{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Lukk feilmelding"
          className="shrink-0 rounded-sm p-0.5 text-red-700 hover:bg-red-100 hover:text-red-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
