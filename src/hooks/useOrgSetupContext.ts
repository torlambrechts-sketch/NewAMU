import { useContext } from 'react'
import { OrgSetupContext } from '../context/orgSetupContext'

export function useOrgSetupContext() {
  const ctx = useContext(OrgSetupContext)
  if (!ctx) {
    throw new Error('useOrgSetupContext must be used within OrgSetupProvider')
  }
  return ctx
}
