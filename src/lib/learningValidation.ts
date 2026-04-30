import { z } from 'zod'
import type { ModuleContent } from '../types/learning'

const flashcardSlideSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  imageUrl: z.string().optional(),
})

const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
})

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
})

const onJobTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
})

/** Validates JSONB module payloads from DB / catalog; aligns with src/types/learning ModuleContent. */
export const moduleContentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flashcard'), slides: z.array(flashcardSlideSchema) }),
  z.object({ kind: z.literal('quiz'), questions: z.array(quizQuestionSchema) }),
  z.object({ kind: z.literal('text'), body: z.string() }),
  z.object({ kind: z.literal('image'), caption: z.string(), imageUrl: z.string() }),
  z.object({ kind: z.literal('video'), url: z.string(), caption: z.string() }),
  z.object({ kind: z.literal('checklist'), items: z.array(checklistItemSchema) }),
  z.object({ kind: z.literal('tips'), items: z.array(z.string()) }),
  z.object({ kind: z.literal('on_job'), tasks: z.array(onJobTaskSchema) }),
  z.object({ kind: z.literal('event'), instructions: z.string() }),
  z.object({ kind: z.literal('other'), title: z.string(), body: z.string() }),
])

export function parseDbModuleContent(raw: unknown, moduleId: string): ModuleContent {
  const result = moduleContentSchema.safeParse(raw)
  if (!result.success) {
    console.warn('Invalid module content for module', moduleId, result.error)
    return { kind: 'other', title: '—', body: '' }
  }
  return result.data
}
