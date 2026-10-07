import { useEffect, useMemo, useState, useRef } from "react"
import type { ReactNode } from "react"
import { formatDateTime } from "../../lib/date"
import { jsPDF } from "jspdf"
import {
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { api } from "../../lib/api"
import { MessageModal } from "../ui/MessageModal"
import RequestViewModal from "../../components/RequestViewModal"
import RequestViewContent from "../../components/RequestViewContent"
import type { RequestStatus } from "../../types/requests"
import { getStoredAuthUser, type AuthRole } from "../../lib/auth"

type RequestItem = {
  requestItemId: number
  supplyId: number | null
  itemCode: string
  name: string
  categoryName: string
  description: string
  imagePath: string
  quantityRequested: number
  quantityApproved: number | null
  quantityFulfilled: number
  quantityOnHand: number
  unitCost: number
  totalAmount: number
}

type AdminRequestRecord = {
  id: number
  requestNumber: string
  issuanceSlipNo: string | null
  requestedByName: string
  requestedByIdNumber: string
  requestedByEmail: string
  requestedByProfileImageUrl: string | null
  purpose: string
  department: string
  dateNeeded: string | null
  grandTotal: number
  reviewedByName: string
  reviewedByRole: string
  rejectionReason?: string
  fulfilledByName: string
  status: RequestStatus
  notes: string
  reviewNotes: string
  totalItems: number
  totalQuantity: number
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  fulfilledAt: string | null
  items: RequestItem[]
}

type AdminRequestSummary = {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
  fulfilledRequests: number
}

type RequestIssuanceResponse = {
  success: boolean
  requests: AdminRequestRecord[]
  summary: AdminRequestSummary
  message?: string
}

type ActionKind = "approve_request" | "reject_request" | "fulfill_request"

const emptySummary: AdminRequestSummary = {
  totalRequests: 0,
  pendingRequests: 0,
  approvedRequests: 0,
  rejectedRequests: 0,
  fulfilledRequests: 0,
}

const REQUESTS_PER_PAGE = 5
const ISSUANCE_HISTORY_PER_PAGE = 5

export default function RequestIssuancePage({ role }: { role: Extract<AuthRole, "Administrator" | "Property Custodian"> }) {
  const authUser = getStoredAuthUser()
  const [requests, setRequests] = useState<AdminRequestRecord[]>([])
  const [summary, setSummary] = useState<AdminRequestSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [issuanceSearchTerm, setIssuanceSearchTerm] = useState("")
  const [message, setMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AdminRequestRecord | null>(null)
  const [actionRequest, setActionRequest] = useState<AdminRequestRecord | null>(null)
  const [actionType, setActionType] = useState<ActionKind | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [busyAction, setBusyAction] = useState<ActionKind | null>(null)
  const [requestPage, setRequestPage] = useState(1)
  const [issuancePage, setIssuancePage] = useState(1)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [statusUpdateRequest, setStatusUpdateRequest] = useState<AdminRequestRecord | null>(null)
  const [statusUpdateSelection, setStatusUpdateSelection] = useState<RequestStatus | null>(null)
  const [statusUpdateSaving, setStatusUpdateSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<null | string>(null) // null means "All"
  const [printRequest, setPrintRequest] = useState<AdminRequestRecord | null>(null)
  const printContentRef = useRef<HTMLDivElement>(null)
  const printWindowRef = useRef<Window | null>(null)

  const allStatuses = [
    "Pending",
    "Pending Immediate Head",
    "Pending Resource Planning Officer",
    "Pending VP Finance",
    "Pending College President",
    "Approved",
    "Purchased",
    "Ready for Release",
    "Released",
    "Received",
    "Completed",
    "Rejected",
    "Fulfilled",
    "Cancelled",
  ] as const

  useEffect(() => {
    void loadData()
  }, [authUser?.id, authUser?.role, role])

  useEffect(() => {
    if (!message) {
      return
    }

    setShowMessageModal(true)

    const timer = window.setTimeout(() => {
      setMessage("")
      setIsSuccess(false)
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [message])

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const filterStatus = statusFilter ?? null // null means no status filter

    if (!query && !filterStatus) {
      return requests
    }

    return requests.filter((request) => {
      const matchesSearch = !query || [
        request.requestNumber,
        request.issuanceSlipNo ?? "",
        request.requestedByName,
        request.requestedByIdNumber,
        request.requestedByEmail,
        request.status,
        request.notes,
        request.reviewNotes,
        ...request.items.flatMap((item) => [item.name, item.itemCode, item.categoryName]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)

      const matchesStatus = !filterStatus || request.status === filterStatus

      return matchesSearch && matchesStatus
    })
  }, [requests, searchTerm, statusFilter])

  const issuanceHistory = useMemo(
    () => requests.filter((request) =>
      ['Fulfilled', 'Completed', 'Received'].includes(request.status)
    ),
    [requests],
  )
  const filteredIssuanceHistory = useMemo(() => {
    const query = issuanceSearchTerm.trim().toLowerCase()

    if (!query) {
      return issuanceHistory
    }

    return issuanceHistory.filter((request) => {
      const haystack = [
        request.requestNumber,
        request.issuanceSlipNo ?? "",
        request.requestedByName,
        request.requestedByIdNumber,
        request.requestedByEmail,
        request.fulfilledByName,
        request.reviewNotes,
        request.notes,
        ...request.items.flatMap((item) => [item.name, item.itemCode, item.categoryName]),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [issuanceHistory, issuanceSearchTerm])

  const requestTotalPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PER_PAGE))
  const issuanceTotalPages = Math.max(1, Math.ceil(filteredIssuanceHistory.length / ISSUANCE_HISTORY_PER_PAGE))
  const paginatedRequests = useMemo(
    () => filteredRequests.slice((requestPage - 1) * REQUESTS_PER_PAGE, requestPage * REQUESTS_PER_PAGE),
    [filteredRequests, requestPage],
  )
  const paginatedIssuanceHistory = useMemo(
    () => filteredIssuanceHistory.slice((issuancePage - 1) * ISSUANCE_HISTORY_PER_PAGE, issuancePage * ISSUANCE_HISTORY_PER_PAGE),
    [filteredIssuanceHistory, issuancePage],
  )

  useEffect(() => {
    setRequestPage(1)
  }, [searchTerm, requests, statusFilter])

  useEffect(() => {
    setIssuancePage(1)
  }, [issuanceSearchTerm, requests, statusFilter])

  useEffect(() => {
    if (requestPage > requestTotalPages) {
      setRequestPage(requestTotalPages)
    }
  }, [requestPage, requestTotalPages])

  useEffect(() => {
    if (issuancePage > issuanceTotalPages) {
      setIssuancePage(issuanceTotalPages)
    }
  }, [issuancePage, issuanceTotalPages])

  async function loadData() {
    if (!authUser?.id || authUser.role !== role) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const params = new URLSearchParams({
        userId: String(authUser.id),
        role: authUser.role,
      })
      const response = await api(`/api/admin-request-issuance.php?${params.toString()}`)
      const result = (await response.json()) as RequestIssuanceResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load request and issuance records.")
      }

      setRequests(result.requests ?? [])
      setSummary(result.summary ?? emptySummary)
      setRequestPage(1)
      setIssuancePage(1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load request and issuance records.")
      setIsSuccess(false)
    } finally {
      setLoading(false)
    }
  }

  function openActionModal(request: AdminRequestRecord, action: ActionKind) {
    setActionRequest(request)
    setActionType(action)
    setReviewNotes(request.reviewNotes ?? "")
  }

  function closeActionModal() {
    if (busyAction) {
      return
    }

    setActionRequest(null)
    setActionType(null)
    setReviewNotes("")
  }

  async function submitAction() {
    if (!authUser?.id || authUser.role !== role || !actionRequest || !actionType) {
      return
    }

    setBusyAction(actionType)

    try {
      const response = await api("/api/admin-request-issuance.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: actionType,
          requestId: actionRequest.id,
          userId: authUser.id,
          role: authUser.role,
          reviewNotes,
        }),
      })

      const result = (await response.json()) as RequestIssuanceResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update the request.")
      }

      setRequests(result.requests ?? [])
      setSummary(result.summary ?? emptySummary)
      setMessage(result.message ?? "Request updated successfully.")
      setIsSuccess(true)
      closeActionModal()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the request.")
      setIsSuccess(false)
    } finally {
      setBusyAction(null)
    }
  }

  async function submitStatusUpdate() {
    if (!authUser?.id || authUser.role !== role || !statusUpdateRequest || !statusUpdateSelection) {
      return
    }

    setStatusUpdateSaving(true)

    try {
      const response = await api("/api/admin-request-issuance.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_status",
          requestId: statusUpdateRequest.id,
          userId: authUser.id,
          role: authUser.role,
          status: statusUpdateSelection,
          reviewNotes: "",
        }),
      })

      const result = (await response.json()) as RequestIssuanceResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update the request status.")
      }

      setRequests(result.requests ?? [])
      setSummary(result.summary ?? emptySummary)
      setMessage(result.message ?? "Request status updated successfully.")
      setIsSuccess(true)
      setStatusUpdateSelection(null)
      setStatusUpdateRequest(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the request status.")
      setIsSuccess(false)
    } finally {
      setStatusUpdateSaving(false)
    }
  }

  function printIssuanceSlip(request: AdminRequestRecord) {
    // Open the tab during the click event so browser popup blockers do not
    // prevent the asynchronously generated PDF from being shown.
    printWindowRef.current = window.open("about:blank", "_blank")
    setPrintRequest(request)
  }

  useEffect(() => {
    if (!printRequest || !printContentRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      if (printContentRef.current) {
        generateIssuanceSlipPdf(
          printContentRef.current,
          printWindowRef.current,
          () => setPrintRequest(null),
        )
      }
    }, 600)

    return () => window.clearTimeout(timer)
  }, [printRequest])

  return (
    <AppShell role={role}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Admin Request & Issuance</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">Request and Issuance</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
              Review all faculty supply requests.
            </p>
          </div>
            <div className="relative w-full lg:w-auto max-w-lg">
              <div className="flex items-center space-x-2">
                <ClipboardDocumentListIcon className="pointer-events-none h-5 w-5 text-brown-400" />
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Filter</p>
              </div>
              <div className="relative mt-2 w-full">
                <select
                  value={statusFilter ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStatusFilter(value === "" ? null : value);
                  }}
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3 pl-4 pr-10 text-sm text-brown-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 appearance-none"
                  aria-label="Status filter"
                >
                  <option value="">All Statuses</option>
                  {allStatuses.map((status) => (
                    <option key={status} value={status}>
                      {getDisplayStatusLabel(status, undefined)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <MessageModal
            open={showMessageModal}
            title={isSuccess ? "Success" : "Error"}
            message={message}
            type={isSuccess ? "success" : "error"}
            onClose={() => setShowMessageModal(false)}
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Total Requests" value={summary.totalRequests} tone="slate" />
            <SummaryCard label="Pending" value={summary.pendingRequests} tone="amber" />
            <SummaryCard label="Approved" value={summary.approvedRequests} tone="blue" />
            <SummaryCard label="Rejected" value={summary.rejectedRequests} tone="rose" />
            <SummaryCard label="Issued" value={summary.fulfilledRequests} tone="emerald" />
          </div>

          <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">All Supply Requests</h2>
              </div>
              <div className="relative w-full max-w-lg">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search request no, requester, ID, email, slip no, or item"
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3 pl-11 pr-4 text-sm text-brown-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
                      </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <LoadingCards count={4} />
              ) : filteredRequests.length === 0 ? (
                <EmptyState title="No request records found" description="Requests submitted by faculty will appear here." />
              ) : (
                paginatedRequests.map((request) => (
                  <article key={request.id} className="rounded-[1.75rem] border border-brown-200 bg-brown-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <RequesterAvatar request={request} sizeClassName="h-14 w-14" textClassName="text-lg" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brown-500">
                              {request.requestNumber}
                            </span>
                            <StatusBadge status={request.status} reviewedByRole={request.reviewedByRole} />
                            {request.status === "Approved" && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 whitespace-nowrap">
                                Please purchase or update the status. Please view details for more info.
                              </span>
                            )}
                            {request.issuanceSlipNo ? (
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                                {request.issuanceSlipNo}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-3 text-xl font-black tracking-tight text-brown-900">{request.requestedByName}</h3>
                          <p className="mt-2 text-sm text-brown-500">
                            ID Number: {request.requestedByIdNumber || "Not available"} • {request.requestedByEmail || "No email"}
                          </p>
                          <p className="mt-1 text-sm text-brown-500">
                            Submitted {formatDateTime(request.createdAt)} • {request.totalItems} item{request.totalItems === 1 ? "" : "s"} • Quantity: {request.totalQuantity}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton label="View Details" onClick={() => setSelectedRequest(request)} icon={<ClipboardDocumentListIcon className="h-4 w-4" />} />
                        {request.status === "Pending" ? (
                          <>
                            <ActionButton label="Approve" onClick={() => openActionModal(request, "approve_request")} icon={<CheckCircleIcon className="h-4 w-4" />} tone="emerald" />
                            <ActionButton label="Reject" onClick={() => openActionModal(request, "reject_request")} icon={<XCircleIcon className="h-4 w-4" />} tone="rose" />
                          </>
                        ) : null}
                        {request.status === "Completed" ? (
                          <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                            <CheckCircleIcon className="h-4 w-4" />
                            Completed
                          </span>
                        ) : null}
                        {canUpdateRequestStatus(request.status) ? (
                          <ActionButton label="Update Status" onClick={() => setStatusUpdateRequest(request)} icon={<TruckIcon className="h-4 w-4" />} tone="blue" />
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            {filteredRequests.length > 0 ? (
              <PaginationControls
                currentPage={requestPage}
                totalPages={requestTotalPages}
                totalItems={filteredRequests.length}
                pageSize={REQUESTS_PER_PAGE}
                itemLabel="requests"
                onPageChange={setRequestPage}
              />
            ) : null}
          </section>

          <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Issuance</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Issuance History</h2>
              </div>
              <div className="w-full max-w-lg">
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                  <input
                    type="search"
                    value={issuanceSearchTerm}
                    onChange={(event) => setIssuanceSearchTerm(event.target.value)}
                    placeholder="Search slip no, request no, requester, issuer, or item"
                    className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3 pl-11 pr-4 text-sm text-brown-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <LoadingCards count={3} />
              ) : filteredIssuanceHistory.length === 0 ? (
                <EmptyState
                  title={issuanceSearchTerm.trim() ? "No issuance records match your search" : "No issuance history yet"}
                  description={
                    issuanceSearchTerm.trim()
                      ? "Try a request number, slip number, requester name, issuer, or item keyword."
                      : "Approved requests that are issued from this page will appear here."
                  }
                />
              ) : (
                paginatedIssuanceHistory.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <RequesterAvatar request={request} sizeClassName="h-12 w-12" textClassName="text-base" />
                        <div>
                          <p className="font-semibold text-brown-900">{request.requestedByName}</p>
                          <p className="mt-1 text-sm text-brown-500">
                            {request.issuanceSlipNo ?? request.requestNumber} • Issued {request.fulfilledAt ? formatDateTime(request.fulfilledAt) : "Not recorded"}
                          </p>
                          <p className="mt-1 text-sm text-brown-500">
                            Issued by {request.fulfilledByName || role} • Total quantity: {request.totalQuantity}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton label="View Issuance Details" onClick={() => setSelectedRequest(request)} icon={<ClipboardDocumentListIcon className="h-4 w-4" />} />
                        <ActionButton label="Print Issuance Slip" onClick={() => printIssuanceSlip(request)} icon={<PrinterIcon className="h-4 w-4" />} tone="blue" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredIssuanceHistory.length > 0 ? (
              <PaginationControls
                currentPage={issuancePage}
                totalPages={issuanceTotalPages}
                totalItems={filteredIssuanceHistory.length}
                pageSize={ISSUANCE_HISTORY_PER_PAGE}
                itemLabel="issuance records"
                onPageChange={setIssuancePage}
              />
            ) : null}
          </section>
        {selectedRequest ? (
          <>
            {(() => {
              const facultyRequest = {
                id: selectedRequest.id,
                requestNumber: selectedRequest.requestNumber,
                purpose: selectedRequest.purpose ?? "",
                department: selectedRequest.department ?? "",
                dateNeeded: selectedRequest.dateNeeded ?? null,
                grandTotal: Number(selectedRequest.grandTotal) || 0,
                status: selectedRequest.status,
                totalItems: Number(selectedRequest.totalItems) || 0,
                totalQuantity: Number(selectedRequest.totalQuantity) || 0,
                notes: selectedRequest.notes ?? "",
                createdAt: selectedRequest.createdAt,
                updatedAt: selectedRequest.updatedAt,
                requestedByName: selectedRequest.requestedByName,
                requestedByIdNumber: selectedRequest.requestedByIdNumber ?? "",
                requestedByEmail: selectedRequest.requestedByEmail ?? "",
                reviewNotes: selectedRequest.rejectionReason ?? selectedRequest.reviewNotes ?? "",
                rejectionReason: selectedRequest.rejectionReason ?? undefined,
                reviewedAt: selectedRequest.reviewedAt ?? null,
                reviewedByRole: selectedRequest.reviewedByRole ?? undefined,
                items: selectedRequest.items.map(item => ({
                  supplyId: item.supplyId,
                  customItemName: null,
                  unitCost: item.unitCost,
                  totalAmount: item.totalAmount,
                  itemCode: item.itemCode,
                  name: item.name,
                  categoryName: item.categoryName,
                  description: item.description,
                  imagePath: item.imagePath,
                  quantityRequested: item.quantityRequested,
                  quantityApproved: item.quantityApproved,
                  quantityFulfilled: item.quantityFulfilled,
                  quantityOnHand: item.quantityOnHand,
                })),
                approvalLogs: []
              };
              return <RequestViewModal request={facultyRequest} open={true} onClose={() => setSelectedRequest(null)} />;
            })()}
          </>
        ) : null}

        {actionRequest && actionType ? (
          <ModalShell onClose={closeActionModal} title={getActionTitle(actionType)}>
            <div className="space-y-5">
              <p className="text-sm leading-6 text-brown-500">
                {getActionDescription(actionType)} <span className="font-semibold text-brown-900">{actionRequest.requestNumber}</span> for{" "}
                <span className="font-semibold text-brown-900">{actionRequest.requestedByName}</span>.
              </p>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-brown-400">Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3 text-sm text-brown-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Add approval, rejection, or issuance notes"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeActionModal}
                  disabled={busyAction !== null}
                  className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitAction()}
                  disabled={busyAction !== null}
                  className="inline-flex items-center justify-center rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === actionType ? "Saving..." : getActionButtonLabel(actionType)}
                </button>
              </div>
            </div>
          </ModalShell>
        ) : null}

        {statusUpdateRequest ? (
          <ModalShell onClose={() => setStatusUpdateRequest(null)} title="Update Status">
            <div className="space-y-5">
              <div className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brown-400">Current Status</p>
                <p className="mt-2 text-lg font-black text-brown-900">
                  {getDisplayStatusLabel(statusUpdateRequest.status, statusUpdateRequest.reviewedByRole)}
                </p>
              </div>

              <div className="space-y-2">
                {getStatusUpdateOptions(statusUpdateRequest.status).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (!option.enabled) return
                      setStatusUpdateSelection(option.value)
                    }}
                    disabled={!option.enabled}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      option.current
                        ? "border-brown-900 bg-brown-900 text-white"
                        : option.enabled
                          ? "border-primary-200 bg-primary-50 text-primary-700 hover:border-primary-300 hover:bg-primary-100"
                          : "cursor-not-allowed border-brown-200 bg-brown-50 text-brown-400"
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em]">
                      {option.current ? "Current" : option.enabled ? "Available" : "Disabled"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStatusUpdateRequest(null)}
                  className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 transition hover:bg-brown-50"
                >
                  Close
                </button>
              </div>
            </div>
          </ModalShell>
        ) : null}

        {statusUpdateRequest && statusUpdateSelection ? (
          <ModalShell onClose={() => {
            if (!statusUpdateSaving) {
              setStatusUpdateSelection(null)
            }
          }} title="Update Status">
            <div className="space-y-5">
              <p className="text-base leading-7 text-brown-600">
                Are you sure you want to update this request status to <span className="font-extrabold text-brown-900">{getDisplayStatusLabel(statusUpdateSelection)}</span>?
              </p>

              <div className="rounded-2xl border border-brown-200 bg-brown-50 p-4 text-sm text-brown-600">
                <span className="font-bold uppercase tracking-[0.18em] text-brown-400">Current Status</span>
                <p className="mt-2 font-semibold text-brown-900">
                  {getDisplayStatusLabel(statusUpdateRequest.status, statusUpdateRequest.reviewedByRole)}
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStatusUpdateSelection(null)}
                  disabled={statusUpdateSaving}
                  className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => void submitStatusUpdate()}
                  disabled={statusUpdateSaving}
                  className="inline-flex items-center justify-center rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800 disabled:currency-not-allowed disabled:opacity-60"
                >
                  {statusUpdateSaving ? "Updating..." : "Yes, Update Status"}
                </button>
              </div>
            </div>
          </ModalShell>
        ) : null}

        {printRequest ? (
          <div
            ref={printContentRef}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 -z-10 w-[794px] bg-white text-left"
          >
            <RequestViewContent request={{
              ...printRequest,
              items: printRequest.items.map((item) => ({ ...item, customItemName: null })),
            }} />
          </div>
        ) : null}

      </div>
    </AppShell>
  );
}

function RequesterAvatar({
  request,
  sizeClassName,
  textClassName,
}: {
  request: AdminRequestRecord
  sizeClassName: string
  textClassName: string
}) {
  const initials = request.requestedByName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"

  return request.requestedByProfileImageUrl ? (
    <img
      src={request.requestedByProfileImageUrl}
      alt={request.requestedByName}
      className={`${sizeClassName} shrink-0 rounded-2xl object-cover`}
    />
  ) : (
    <div className={`${sizeClassName} ${textClassName} flex shrink-0 items-center justify-center rounded-2xl bg-primary-100 font-black text-primary-700`}>
      {initials}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "amber" | "blue" | "rose" | "emerald" }) {
  const classes = {
    slate: "bg-brown-100 text-brown-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-primary-50 text-primary-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }

  return (
    <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brown-400">{label}</p>
      <div className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes[tone]}`}>{value.toLocaleString()}</div>
    </div>
  )
}

function StatusBadge({ status, reviewedByRole }: { status: string; reviewedByRole?: string }) {
  const label = status === "Rejected" && reviewedByRole?.trim()
    ? `Rejected by ${reviewedByRole.trim()}`
    : status

  const className =
    status === "Pending" || status === "Pending Immediate Head"
      ? "bg-amber-100 text-amber-700"
      : ["Pending Resource Planning Officer", "Pending VP Finance", "Pending College President"].includes(status)
        ? "bg-amber-200 text-amber-800"
        : status === "Approved" || status === "Completed"
          ? "bg-emerald-100 text-emerald-700"
          : ["Waiting Purchase", "Purchased", "Ready for Release", "Released", "Received"].includes(status)
            ? "bg-blue-100 text-blue-700"
          : status === "Fulfilled"
            ? "bg-emerald-100 text-emerald-700"
          : status === "Rejected"
            ? "bg-rose-100 text-rose-700"
            : "bg-brown-200 text-brown-700"

  return <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${className}`}>{label}</span>
}

function ActionButton({
  label,
  onClick,
  icon,
  tone = "slate",
}: {
  label: string
  onClick: () => void
  icon: ReactNode
  tone?: "slate" | "emerald" | "rose" | "blue"
}) {
  const classes = {
    slate: "border-brown-200 text-brown-700 hover:bg-brown-50",
    emerald: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    rose: "border-rose-200 text-rose-700 hover:bg-rose-50",
    blue: "border-primary-200 text-primary-700 hover:bg-primary-50",
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${classes[tone]}`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  )
}

function LoadingCards({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-36 animate-pulse rounded-[1.75rem] bg-brown-100" />
      ))}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-brown-200 bg-brown-50 px-6 py-12 text-center">
      <ClipboardDocumentListIcon className="mx-auto h-10 w-10 text-brown-300" />
      <p className="mt-4 text-sm font-semibold text-brown-900">{title}</p>
      <p className="mt-2 text-sm text-brown-500">{description}</p>
    </div>
  )
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  itemLabel: string
  onPageChange: (page: number) => void
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-brown-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-brown-500">
        Showing {startItem}-{endItem} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-sm font-semibold text-brown-700 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="min-w-20 text-center text-sm font-semibold text-brown-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-sm font-semibold text-brown-700 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-brown-200 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black tracking-tight text-brown-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brown-200 px-4 py-2 text-sm font-semibold text-brown-700 transition hover:bg-brown-50"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function getActionTitle(action: ActionKind) {
  if (action === "approve_request") return "Approve Request"
  if (action === "reject_request") return "Reject Request"
  return "Issue Supplies"
}

function generateIssuanceSlipPdf(
  content: HTMLDivElement,
  previewWindow: Window | null,
  onComplete: () => void,
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" })

  const worker = pdf.html(content, {
    x: 0,
    y: 0,
    width: 190,
    windowWidth: 794,
    autoPaging: "text",
    html2canvas: {
      scale: 2,
      useCORS: true,
      imageTimeout: 3000,
      backgroundColor: "#ffffff",
      onclone: (clonedDocument) => {
        // Prevent remote item images from blocking PDF generation because of
        // browser CORS restrictions. The item names, codes, quantities, and
        // all other issuance data remain in the PDF.
        clonedDocument.querySelectorAll("img").forEach((image) => image.remove())
      },
    },
  })

  worker.then(() => {
    pdf.autoPrint()
    const pdfUrl = String(pdf.output("bloburl"))

    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = pdfUrl
      previewWindow.focus()
    } else {
      window.open(pdfUrl, "_blank", "noopener,noreferrer")
    }
    onComplete()
  }).catch(() => {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.document.body.innerHTML = "<p style='font-family:Arial;padding:24px'>Unable to generate the issuance PDF. Please try again.</p>"
    }
    onComplete()
  })
}

function getActionDescription(action: ActionKind) {
  if (action === "approve_request") return "Approve"
  if (action === "reject_request") return "Reject"
  return "Issue approved supplies for"
}

function getActionButtonLabel(action: ActionKind) {
  if (action === "approve_request") return "Approve Request"
  if (action === "reject_request") return "Reject Request"
  return "Complete Issuance"
}

function canUpdateRequestStatus(status: string): boolean {
  const current = normalizeRequestStatus(status)
  return current !== "Completed" && current !== "Rejected" && current !== "Fulfilled" && current !== "Cancelled" && current !== "Pending" && current !== "Pending Immediate Head" && current !== "Pending Resource Planning Officer" && current !== "Pending VP Finance" && current !== "Pending College President"
}

function normalizeRequestStatus(status: string): string {
  if (status === "Waiting Purchase") {
    return "Purchased"
  }

  return status
}

function getRequestStatusProgression(): Array<{ value: RequestStatus; label: string }> {
  return [
    { value: "Approved", label: "Approved" },
    { value: "Purchased", label: "Purchased or In Stock" },
    { value: "Ready for Release", label: "Ready for Release" },
    { value: "Released", label: "Released" },
    { value: "Received", label: "Received" },
    { value: "Completed", label: "Completed" },
  ]
}

function getStatusUpdateOptions(status: string) {
  const progression = getRequestStatusProgression()
  const normalizedStatus = normalizeRequestStatus(status)
  const currentIndex = progression.findIndex((item) => item.value === normalizedStatus)

  if (currentIndex === -1) {
    return []
  }

  return progression.map((item, index) => ({
    value: item.value,
    label: item.label,
    current: index === currentIndex,
    enabled: index === currentIndex + 1,
  }))
}

function getDisplayStatusLabel(status: string, reviewedByRole?: string): string {
  const normalized = normalizeRequestStatus(status)

  if (normalized === "Rejected") {
    const role = reviewedByRole?.trim()
    return role ? `Rejected by ${role}` : "Rejected"
  }

  if (normalized === "Purchased") {
    return "Purchased or In Stock"
  }

  if (normalized === "Approved") {
    return "Approved"
  }

  return normalized
}
