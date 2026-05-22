// ChecklistExecutionPage — standalone full-page view for a checklist execution.
// Wraps ExecutionDetailContent in ModulePageShell with sign/archive actions in the header.
// Also reachable via the "Åpne frittstående side" link from the library detail panel.

import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { useActivePack } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { ExecutionDetailContent } from './components/ExecutionDetailContent'

export function ChecklistExecutionPage() {
  const params = useParams<{ executionId: string }>()
  const executionId = params.executionId ?? ''
  const navigate = useNavigate()
  const pack = useActivePack()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const cl = useChecklistModule({ supabase })
  const { load, loadDetail } = cl

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (executionId) void loadDetail(executionId)
  }, [executionId, loadDetail])

  const execution = useMemo(
    () => cl.executions.find((e) => e.id === executionId) ?? null,
    [cl.executions, executionId],
  )
  const template = useMemo(
    () => cl.templates.find((t) => t.id === execution?.template_id) ?? null,
    [cl.templates, execution?.template_id],
  )

  const readOnly = execution?.status === 'signed'

  const requiredCount = useMemo(() => {
    // Approximate until definition loads — ExecutionDetailContent computes accurately
    return 0
  }, [])

  const templateBackUrl = useMemo(() => {
    if (template) {
      return `/compliance/checklists?template=${encodeURIComponent(template.slug)}&pack=${encodeURIComponent(template.pack)}`
    }
    if (execution) {
      return `/compliance/checklists?pack=${encodeURIComponent(execution.pack)}`
    }
    return '/compliance/checklists/bibliotek'
  }, [template, execution])

  const onSign = async () => {
    if (!executionId) return
    await cl.signExecution(executionId)
    navigate(templateBackUrl)
  }

  if (!execution) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Sjekklister', to: '/compliance/checklists/bibliotek' },
          { label: '…' },
        ]}
        title="Laster …"
      >
        <div className="space-y-6">
          {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}
        </div>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Sjekklister', to: '/compliance/checklists/bibliotek' },
        ...(template
          ? [{ label: template.name, to: templateBackUrl }]
          : [{ label: pack.pluralLabel, to: templateBackUrl }]),
        { label: execution.title },
      ]}
      title={execution.title}
      description={template?.name ?? ''}
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            to={templateBackUrl}
            className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
          {readOnly ? (
            <>
              {execution.archived_at ? (
                <Badge variant="neutral">
                  <span className="inline-flex items-center gap-1">
                    <Archive className="h-3 w-3" />
                    Arkivert
                  </span>
                </Badge>
              ) : (
                <Badge variant="signed">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Signert
                  </span>
                </Badge>
              )}
              {execution.status === 'signed' && !execution.archived_at ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Archive className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (window.confirm('Arkivere denne signerte sjekklisten? Handlingen kan ikke angres.')) {
                      void cl.archiveExecution(executionId)
                    }
                  }}
                >
                  Arkiver
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              variant="primary"
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={onSign}
            >
              Signer
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}
        <ExecutionDetailContent
          executionId={executionId}
          cl={cl}
          orgSetup={orgSetup}
          pack={pack}
        />
      </div>
    </ModulePageShell>
  )
}
