/**
 * Module Registry — Phase 2: Dynamic Component Registry.
 *
 * Maps every `modules.slug` value (from Supabase) to:
 *   • A lazy-loaded React page component (code-split per module)
 *   • A Zod schema validating the `modules.config` JSONB column
 *   • A fallback `displayName` when the DB row has no `display_name`
 *
 * ## How to add a new module
 * 1. Insert a row into the `modules` table (Phase 1 DDL).
 * 2. Add an entry below with `lazy(() => import(...))`.
 * 3. Define a Zod schema — at minimum `baseConfig` so unknown keys
 *    survive future DB migrations without breaking the loader.
 *
 * ## Routing
 * `ModuleSlugPage` (React Router `/modules/:module_slug`) resolves the slug
 * here, checks `is_active` + `required_permissions` from the DB, then renders
 * the component. Existing hardcoded routes in App.tsx are unaffected.
 */

import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { z } from 'zod'

// ── Types ──────────────────────────────────────────────────────────────────

export type ModuleRegistryEntry = {
  slug: string
  displayName: string
  /**
   * Lazy-loaded page component.
   * Existing pages load their own data and take no required props.
   * New modules can read `config` from the rendered `ModuleSlugPage`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: LazyExoticComponent<ComponentType<any>>
  /**
   * Zod schema for the `modules.config` JSONB column.
   * `safeParse` is used in the loader — validation failures fall back
   * to the raw value so a bad config never blocks access.
   */
  configSchema: z.ZodTypeAny
}

// ── Base schema ────────────────────────────────────────────────────────────

/**
 * All module schemas extend this. `.passthrough()` preserves unknown keys
 * so configs written by a newer schema version stay intact when running
 * older frontend code.
 */
const baseConfig = z.object({}).passthrough()

// ── Per-module config schemas ──────────────────────────────────────────────

const hseConfig = baseConfig.extend({
  /** Hub tab active on first render, e.g. "inspeksjoner" */
  defaultTab: z.string().optional(),
  /** Restrict visible hub tabs — omit to show all */
  enabledTabs: z.array(z.string()).optional(),
})

const learningConfig = baseConfig.extend({
  defaultSection: z
    .enum(['dashboard', 'courses', 'paths', 'certifications', 'external'])
    .optional(),
  /** Hide course builder for orgs without authoring rights */
  hideBuilder: z.boolean().optional(),
})

const documentsConfig = baseConfig.extend({
  defaultSpaceId: z.string().optional(),
  hideComplianceTab: z.boolean().optional(),
})

const workflowConfig = baseConfig.extend({
  /** Show only rules matching these trigger event types */
  visibleTriggers: z.array(z.string()).optional(),
})

const surveyConfig = baseConfig.extend({
  defaultPillar: z.enum(['psychosocial', 'physical', 'organization', 'safety_culture', 'custom']).optional(),
  anonymityThreshold: z.number().int().min(1).optional(),
  actionThreshold: z.number().int().min(0).max(100).optional(),
  recurrenceMonths: z.number().int().optional(),
})

// ── Registry ──────────────────────────────────────────────────────────────

const REGISTRY: Record<string, ModuleRegistryEntry> = {
  hse: {
    slug: 'hse',
    displayName: 'HSE / HMS',
    component: lazy(() =>
      import('../pages/HseModule').then((m) => ({ default: m.HseModule })),
    ),
    configSchema: hseConfig,
  },

  council: {
    slug: 'council',
    displayName: 'Styremøter',
    component: lazy(() =>
      import('../pages/CouncilModule').then((m) => ({ default: m.CouncilModule })),
    ),
    configSchema: baseConfig,
  },

  members: {
    slug: 'members',
    displayName: 'Medlemmer',
    component: lazy(() =>
      import('../pages/MembersModule').then((m) => ({ default: m.MembersModule })),
    ),
    configSchema: baseConfig,
  },

  'org-health': {
    slug: 'org-health',
    displayName: 'Org-helse',
    component: lazy(() =>
      import('../pages/OrgHealthModule').then((m) => ({
        default: m.OrgHealthModule,
      })),
    ),
    configSchema: baseConfig,
  },

  'internal-control': {
    slug: 'internal-control',
    displayName: 'Internkontroll',
    component: lazy(() =>
      import('../pages/InternalControlModule').then((m) => ({
        default: m.InternalControlModule,
      })),
    ),
    configSchema: baseConfig,
  },

  tasks: {
    slug: 'tasks',
    displayName: 'Oppgaver',
    component: lazy(() =>
      import('../pages/TasksPage').then((m) => ({ default: m.TasksPage })),
    ),
    configSchema: baseConfig,
  },

  workflow: {
    slug: 'workflow',
    displayName: 'Arbeidsflyt',
    component: lazy(() =>
      import('../pages/WorkflowModulePage').then((m) => ({
        default: m.WorkflowModulePage,
      })),
    ),
    configSchema: workflowConfig,
  },

  learning: {
    slug: 'learning',
    displayName: 'E-learning',
    component: lazy(() =>
      import('../pages/learning/LearningDashboard').then((m) => ({
        default: m.LearningDashboard,
      })),
    ),
    configSchema: learningConfig,
  },

  documents: {
    slug: 'documents',
    displayName: 'Dokumenter & wiki',
    component: lazy(() =>
      import('../pages/documents/DocumentsHome').then((m) => ({
        default: m.DocumentsHome,
      })),
    ),
    configSchema: documentsConfig,
  },

  hr: {
    slug: 'hr',
    displayName: 'HR & rettssikkerhet',
    component: lazy(() =>
      import('../pages/hr/HrComplianceHub').then((m) => ({
        default: m.HrComplianceHub,
      })),
    ),
    configSchema: baseConfig,
  },

  'inspection-module': {
    slug: 'inspection-module',
    displayName: 'Inspeksjonsmodul',
    component: lazy(() =>
      import('../pages/InspectionModulePage').then((m) => ({
        default: m.InspectionModulePage,
      })),
    ),
    configSchema: baseConfig.extend({
      enablePhotos: z.boolean().optional(),
      defaultCronExpression: z.string().optional(),
    }),
  },

  ros: {
    slug: 'ros',
    displayName: 'ROS-analyser',
    component: lazy(() =>
      import('../pages/RosModulePage').then((m) => ({ default: m.RosModulePage })),
    ),
    configSchema: baseConfig,
  },

  survey: {
    slug: 'survey',
    displayName: 'Organisasjonsundersøkelse',
    component: lazy(() =>
      import('../pages/SurveyModulePage').then((m) => ({ default: m.SurveyModulePage })),
    ),
    configSchema: surveyConfig,
  },

  'ik-annual-review': {
    slug: 'ik-annual-review',
    displayName: 'Årlig gjennomgang (IK § 5.8)',
    component: lazy(() =>
      import('../pages/IkAnnualReviewPage').then((m) => ({ default: m.IkAnnualReviewPage })),
    ),
    configSchema: baseConfig,
  },
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a registry entry by module slug.
 * Returns `undefined` when the slug has no registered component — the dynamic
 * route renders a 404 in that case.
 */
export function resolveModule(slug: string): ModuleRegistryEntry | undefined {
  return REGISTRY[slug]
}

/** All registered slugs — useful for dev tools and static analysis. */
export function listRegisteredSlugs(): string[] {
  return Object.keys(REGISTRY)
}
