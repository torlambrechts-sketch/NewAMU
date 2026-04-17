import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const WikiPageEditor = lazy(() => import('./WikiPageEditor').then((m) => ({ default: m.WikiPageEditor })))

export function WikiPageEditorLazy() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-neutral-600">
          <Loader2 className="size-8 animate-spin text-[#1a3d32]" aria-hidden />
          <p className="text-sm">Laster redigeringsverktøy…</p>
        </div>
      }
    >
      <WikiPageEditor />
    </Suspense>
  )
}
