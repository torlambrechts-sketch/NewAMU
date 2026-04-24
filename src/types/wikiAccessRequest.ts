export type WikiAccessResourceType = 'folder' | 'document'

export type WikiAccessRequestScope = 'read' | 'edit'

export type WikiAccessRequestDuration = 'session' | '7d' | '30d' | 'permanent'

export type WikiAccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type WikiDocumentAccessRequest = {
  id: string
  organizationId: string
  resourceType: WikiAccessResourceType
  spaceId: string
  pageId: string | null
  title: string
  requesterId: string
  requesterName: string
  justification: string
  accessScope: WikiAccessRequestScope
  duration: WikiAccessRequestDuration
  status: WikiAccessRequestStatus
  reviewerId: string | null
  reviewedAt: string | null
  adminNote: string | null
  createdAt: string
}
