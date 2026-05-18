// Learning embedder — Studio Builder Phase 2a Task 2a.1.
//
// Wraps the existing LearningCoursesList inline. The list is the
// authoring entry point: clicking a course opens LearningCourseBuilder
// on its own route. The studio shell keeps the list surface; deep edit
// of a course body happens in the dedicated builder UI.

import { LearningCoursesList } from '../../../src/pages/learning/LearningCoursesList'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function LearningEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode}>
      <LearningCoursesList />
    </div>
  )
}
