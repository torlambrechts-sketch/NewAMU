import { useContext } from 'react'
import {
  DocumentCenterContext,
  type DocumentCenterValue,
} from '../contexts/documentCenterContext'

export function useDocumentCenter(): DocumentCenterValue {
  const ctx = useContext(DocumentCenterContext)
  if (!ctx) {
    throw new Error('useDocumentCenter must be used within DocumentCenterProvider')
  }
  return ctx
}

export { DOCUMENT_TEMPLATES } from '../data/documentTemplates'
