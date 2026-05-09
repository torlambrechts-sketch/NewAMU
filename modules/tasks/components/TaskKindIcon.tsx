// TaskKindIcon — per-template-kind icon used in hub tiles and detail panels.

import type { ComponentType } from 'react'
import {
  AlertTriangle,
  CheckSquare,
  Lightbulb,
  Shield,
  TrendingDown,
  UserMinus,
  Zap,
} from 'lucide-react'
import type { TaskTemplateKind } from '../../../src/types/task'

const KIND_ICON: Record<TaskTemplateKind, ComponentType<{ className?: string }>> = {
  oppgave: CheckSquare,
  avvik: AlertTriangle,
  nestenulykke: Zap,
  tiltak: Shield,
  risiko: TrendingDown,
  forslag: Lightbulb,
  sykefravær: UserMinus,
}

export function TaskKindIcon({
  kind,
  className = 'h-5 w-5',
}: {
  kind: TaskTemplateKind
  className?: string
}) {
  const Icon = KIND_ICON[kind] ?? CheckSquare
  return <Icon className={className} aria-hidden />
}
