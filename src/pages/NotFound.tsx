import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 px-4">
      <p className="text-8xl font-bold text-neutral-200">404</p>
      <p className="mt-2 text-lg text-neutral-600">Ooops! Page not Found</p>
      <Link
        to="/"
        className="mt-8 rounded-lg bg-[#7ee081] px-6 py-3 text-sm font-semibold text-[#0d1f14] hover:bg-[#6bcf72]"
      >
        Back to home
      </Link>
    </div>
  )
}
