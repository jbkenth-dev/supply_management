export type FacultyRequestItem = {
  supplyId: number
  itemCode: string
  name: string
  categoryName: string
  description: string
  imagePath: string
  quantityRequested: number
  quantityApproved: number | null
  quantityFulfilled: number
  quantityOnHand: number
}

export type FacultyRequest = {
  id: number
  requestNumber: string
  requestedByName: string
  status: "Pending" | "Approved" | "Rejected" | "Fulfilled" | "Cancelled"
  notes: string
  reviewNotes: string
  totalItems: number
  totalQuantity: number
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  items: FacultyRequestItem[]
}

export type FacultyRequestSummary = {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  fulfilledRequests: number
  rejectedRequests: number
}
