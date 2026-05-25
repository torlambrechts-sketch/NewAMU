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
  // No auto-focus: stealing focus when the error fires mid-form (a
  // failed submit, with the user still on a field) drops keystrokes,
  // breaks IME composition, and confuses screen-reader users.
  // role="alert" + aria-live="polite" already announce the message
  // without yanking the cursor. If a caller wants explicit focus, it
  // can render its own focus-trap.
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Lukk feilmelding"
          className="shrink-0 rounded-sm p-0.5 text-red-700 hover:bg-red-100 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
