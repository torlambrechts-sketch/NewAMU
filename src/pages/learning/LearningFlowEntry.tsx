import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'

/**
 * Deep-link entry for HSE automation / QR: /learning/flow?course=...&module=...
 * Ensures progress row exists then redirects to the player with the same query.
 */
export function LearningFlowEntry() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const courseId = params.get('course') ?? ''
  const moduleId = params.get('module') ?? undefined
  const { ensureProgress, learningLoading, courses } = useLearning()

  useEffect(() => {
    if (!courseId) {
      navigate('/learning/courses', { replace: true })
      return
    }
    const c = courses.find((x) => x.id === courseId)
    if (!c && !learningLoading) {
      navigate('/learning/courses', { replace: true })
      return
    }
    if (!c) return
    void (async () => {
      await ensureProgress(courseId)
      const q = new URLSearchParams()
      if (moduleId) q.set('module', moduleId)
      navigate(`/learning/play/${courseId}${q.toString() ? `?${q}` : ''}`, { replace: true })
    })()
  }, [courseId, moduleId, courses, learningLoading, ensureProgress, navigate])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-neutral-600">
      <Loader2 className="size-8 animate-spin" aria-hidden />
      <p className="text-sm">Åpner kurs…</p>
    </div>
  )
}
