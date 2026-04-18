import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function IkRosView() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/internal-control?tab=ros', { replace: true })
  }, [navigate])
  return (
    <div className="flex items-center justify-center py-20 text-sm text-neutral-400">
      Videresender til ROS-analyse…
    </div>
  )
}
