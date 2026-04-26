import DOMPurify from 'dompurify'

/** Safe HTML for learner-facing rich text (Quill output). */
export function sanitizeLearningHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'data-mention', 'data-user-id'],
  })
}
