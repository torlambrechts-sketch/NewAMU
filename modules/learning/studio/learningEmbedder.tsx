// Learning embedder — Studio Builder Phase 2a Task 2a.1.

import { LearningCoursesList } from '../../../src/pages/learning/LearningCoursesList'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function LearningEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="learning" />
      <ScopeListShell
        title="Læring og kurs"
        subtitle="Kurs-oversikt — klikk for å åpne i kurs-bygger"
        bare
      >
        <LearningCoursesList />
      </ScopeListShell>
    </div>
  )
}
