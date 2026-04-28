import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { permissionForPath, type PermissionKey } from '../lib/permissionKeys'

/** Enforces module.view.* from roles when Supabase + user session exist. */
export function PermissionGate() {
  const { supabaseConfigured, user, profile, can, permissionsLoading, permissionKeys } = useOrgSetupContext()
  const location = useLocation()

  if (!supabaseConfigured || !user) {
    return <Outlet />
  }

  /* DB migration ikke kjørt: ingen nøkler — ikke lås brukeren ute */
  if (!permissionsLoading && permissionKeys.size === 0) {
    return <Outlet />
  }

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-neutral-600">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        Laster tilganger…
      </div>
    )
  }

  const path = location.pathname
  const isWorkflowPath = path === '/workflow' || path.startsWith('/workflow/')
  /** Matches RLS: org admins may manage rules without module.view.workflow on their role. */
  if (isWorkflowPath) {
    const allowedWorkflow =
      can('module.view.workflow') ||
      can('workflows.manage') ||
      profile?.is_org_admin === true
    if (!allowedWorkflow) {
      return <Navigate to="/home" replace state={{ accessDenied: 'module.view.workflow' }} />
    }
    return <Outlet />
  }

  const isDocumentsPath = path === '/documents' || path.startsWith('/documents/')
  const isDocumentsEditorPath =
    /\/reference-edit$/.test(path) ||
    path.includes('/wiki-edit') ||
    (path.includes('/documents/templates/org/') && path.includes('/edit'))

  const isSurveyTemplateEditorPath = path.startsWith('/survey/templates/org/')

  if (isSurveyTemplateEditorPath) {
    const canEditTemplate = profile?.is_org_admin === true || can('survey.manage')
    if (!canEditTemplate) {
      return <Navigate to="/survey" replace state={{ accessDenied: 'survey.manage' }} />
    }
    const canEnterModule = can('module.view.survey')
    if (!canEnterModule) {
      return <Navigate to="/home" replace state={{ accessDenied: 'module.view.survey' }} />
    }
    return <Outlet />
  }

  if (isDocumentsPath && isDocumentsEditorPath) {
    const canOpenEditor =
      profile?.is_org_admin === true || can('documents.manage') || can('documents.edit')
    if (!canOpenEditor) {
      return <Navigate to="/documents" replace state={{ accessDenied: ['documents.edit', 'documents.manage'] }} />
    }
    const canEnterModule =
      can('module.view.dashboard') || can('documents.view') || can('documents.edit') || can('documents.manage')
    if (!canEnterModule) {
      return <Navigate to="/home" replace state={{ accessDenied: 'documents' }} />
    }
    return <Outlet />
  }

  let required: PermissionKey | PermissionKey[] = permissionForPath(path)
  if (isDocumentsPath) {
    required = ['module.view.dashboard', 'documents.view', 'documents.edit', 'documents.manage']
  }
  const allowed = Array.isArray(required) ? required.some((k) => can(k)) : can(required)
  if (!allowed) {
    return <Navigate to="/home" replace state={{ accessDenied: required }} />
  }

  return <Outlet />
}
