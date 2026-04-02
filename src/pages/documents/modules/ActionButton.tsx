import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

type Props = {
  label?: string
  route?: string
  variant?: 'primary' | 'secondary' | 'danger'
}

const variantClass = {
  primary: 'bg-[#1a3d32] text-white hover:bg-[#142e26]',
  secondary: 'border border-neutral-300 bg-white text-[#1a3d32] hover:bg-neutral-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

export function ActionButton({ label = 'Gå til handling', route = '/', variant = 'primary' }: Props) {
  const navigate = useNavigate()
  return (
    <div className="not-prose my-4">
      <button
        type="button"
        onClick={() => navigate(route)}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${variantClass[variant]}`}
      >
        {label}
        <ArrowRight className="size-4" />
      </button>
    </div>
  )
}
