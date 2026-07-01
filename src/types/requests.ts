export type FacultyRequestItem = {
  supplyId: number | null
  customItemName: string | null
  unitCost: number
  totalAmount: number
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

export type RequestStatus = "Pending" | "Pending Immediate Head" | "Pending Budget Officer" | "Pending VP Finance" | "Pending College President" | "Approved" | "Waiting Purchase" | "Purchased" | "Ready for Release" | "Released" | "Received" | "Completed" | "Rejected" | "Fulfilled" | "Cancelled"

export type FacultyRequest = {
  id: number
  requestNumber: string
  requestedByName: string
  purpose: string
  department: string
  dateNeeded: string | null
  grandTotal: number
  status: RequestStatus
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
