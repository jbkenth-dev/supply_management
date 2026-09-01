import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  EyeIcon,
} from "@heroicons/react/24/outline"
import ApprovalPersonnelShell from "../layout/ApprovalPersonnelShell"
import { MessageModal } from "../components/ui/MessageModal"
import { StaggerContainer, StaggerItem } from "../components/ui/animations"
import { api } from "../lib/api"
import { formatDateTime, formatDateLong, formatDateTimeShort } from "../lib/date"
import { getStoredAuthUser } from "../lib/auth"
import type { RequestStatus } from "../types/requests"

type ApprovalRequestItem = {
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
}

type ApprovalLog = {
  id: number
  approverUserId: number
  approverRole: string
  action: string
  remarks: string
  approverName: string
  createdAt: string
}

type ApprovalRequest = {
  id: number
  requestNumber: string
  purpose: string
  department: string
  dateNeeded: string | null
  grandTotal: number
  status: RequestStatus
  totalItems: number
  totalQuantity: number
  notes: string
  createdAt: string
  updatedAt: string
  requestedByName: string
  requestedByIdNumber: string
  requestedByEmail: string
  items: ApprovalRequestItem[]
  approvalLogs: ApprovalLog[]
}

type ApprovalApiResponse = {
  success: boolean
  requests: ApprovalRequest[]
  approvalHistory: ApprovalLog[]
  message?: string
}

const REQUESTS_PER_PAGE = 8

export default function ApprovalPersonnelRequests() {
  const authUser = getStoredAuthUser()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [actionRemarks, setActionRemarks] = useState("")
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"success" | "error">("error")

  useEffect(() => {
    if (!authUser?.id || !authUser.role) {
      navigate("/auth/login", { replace: true })
    }
  }, [authUser, navigate])

  const pushMessage = (title: string, message: string, type: "success" | "error") => {
    setModalTitle(title)
    setModalMessage(message)
    setModalType(type)
    setShowModal(true)
  }

  const loadRequests = async () => {
    if (!authUser?.id) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId: String(authUser.id),
        role: authUser.role,
      })
      const res = await api(`/api/approval-workflow.php?${params.toString()}`)
      const result = (await res.json()) as ApprovalApiResponse
      if (result.success) {
        setRequests(result.requests ?? [])
        setPage(1)
      } else {
        throw new Error(result.message ?? 'Unknown error')
      }
    } catch (error) {
      pushMessage("Load Failed", error instanceof Error ? error.message : "Unable to load requests.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [authUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [requests])

  const totalPages = Math.max(1, Math.ceil(sortedRequests.length / REQUESTS_PER_PAGE))
  const paginatedRequests = useMemo(
    () => sortedRequests.slice((page - 1) * REQUESTS_PER_PAGE, page * REQUESTS_PER_PAGE),
    [sortedRequests, page],
  )

  useEffect(() => { setPage(1) }, [sortedRequests.length])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const handleAction = async () => {
    if (!authUser?.id || !selectedRequest || !actionType) return

    setSubmitting(true)
    try {
      const res = await api("/api/approval-workflow.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.id,
          requestId: selectedRequest.id,
          action: actionType,
          remarks: actionRemarks,
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.message ?? "Action failed.")
      }

      pushMessage("Success", result.message ?? "Action completed.", "success")
      setSelectedRequest(null)
      setActionType(null)
      setActionRemarks("")

      // Reload
      void loadRequests()
    } catch (error) {
      pushMessage("Action Failed", error instanceof Error ? error.message : "Unable to process action.", "error")
    } finally {
      setSubmitting(false)
    }
  }

  if (!authUser) return null

  return (
    <ApprovalPersonnelShell>
      <MessageModal
        open={showModal}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />

      <StaggerContainer className="space-y-8">
        {/* Header */}
        <StaggerItem>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Approval Personnel</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">All Requests</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
                Review and process all supply requests pending your approval.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm font-semibold text-brown-700 transition hover:border-brown-300 hover:bg-brown-50"
            >
              <ArrowPathIcon className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </StaggerItem>

        {/* Request Count */}
        <StaggerItem>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <ClipboardDocumentCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Pending Approval</p>
              <p className="text-2xl font-black tracking-tight text-brown-900">
                {sortedRequests.length} {sortedRequests.length === 1 ? "request" : "requests"}
              </p>
            </div>
          </div>
        </StaggerItem>

        {/* Requests List */}
        <StaggerItem>
          <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mt-2">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-[1.5rem] border border-brown-200 bg-brown-50 p-5">
                      <div className="h-4 w-24 rounded-full bg-brown-200" />
                      <div className="mt-3 h-6 w-64 rounded-2xl bg-brown-200" />
                      <div className="mt-3 h-4 w-full rounded-full bg-brown-100" />
                    </div>
                  ))}
                </div>
              ) : paginatedRequests.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-brown-200 bg-brown-50 px-6 py-14 text-center">
                  <CheckCircleIcon className="mx-auto h-10 w-10 text-brown-300" />
                  <p className="mt-4 text-sm font-semibold text-brown-900">All caught up!</p>
                  <p className="mt-2 text-sm text-brown-500">No requests are pending your approval at this time.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-[1.75rem] border border-brown-200 bg-brown-50 p-5 transition hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brown-500">
                              {request.requestNumber}
                            </span>
                            <StatusBadge status={request.status} />
                          </div>
                          <p className="mt-2 text-sm text-brown-500">
                            Submitted {formatDateTime(request.createdAt)} by{" "}
                            <span className="font-semibold text-brown-700">{request.requestedByName}</span>
                          </p>
                          {request.department ? (
                            <p className="mt-1 text-xs text-brown-400">
                              Department: <span className="font-semibold text-brown-600">{request.department}</span>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Items</p>
                            <p className="text-lg font-black text-brown-900">{request.totalItems}</p>
                          </div>
                          <div className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Total</p>
                            <p className="text-lg font-black text-primary-700">₱{(request.grandTotal ?? 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Purpose */}
                      {request.purpose ? (
                        <p className="mt-3 text-sm text-brown-600">
                          <span className="font-semibold text-brown-700">Purpose:</span> {request.purpose}
                        </p>
                      ) : null}

                      {/* Action Buttons */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(request)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-brown-200 bg-white px-4 py-2 text-xs font-bold text-brown-700 transition hover:bg-brown-50"
                        >
                          <EyeIcon className="h-4 w-4" />
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedRequest(request); setActionType("approve") }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedRequest(request); setActionType("reject") }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {!loading && sortedRequests.length > 0 ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-brown-500">
                  Showing {Math.min(1, sortedRequests.length)}–{Math.min(page * REQUESTS_PER_PAGE, sortedRequests.length)} of {sortedRequests.length} requests
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeftIcon className="inline h-4 w-4" /> Previous
                  </button>
                  <span className="min-w-20 text-center text-sm font-semibold text-brown-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next <ChevronRightIcon className="inline h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </StaggerItem>
      </StaggerContainer>

      {/* Detail / Action Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!submitting) {
              setSelectedRequest(null)
              setActionType(null)
              setActionRemarks("")
            }
          }}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-brown-200 bg-white p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Request Review</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">{selectedRequest.requestNumber}</h2>
                <p className="mt-1 text-sm text-brown-500">
                  Submitted by <span className="font-semibold">{selectedRequest.requestedByName}</span>
                </p>
              </div>
              <StatusBadge status={selectedRequest.status} />
            </div>

            {/* Request Details */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {selectedRequest.purpose ? (
                <div className="rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Purpose</p>
                  <p className="mt-1.5 text-sm text-brown-700">{selectedRequest.purpose}</p>
                </div>
              ) : null}
              {selectedRequest.department ? (
                <div className="rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Department</p>
                  <p className="mt-1.5 text-sm font-semibold text-brown-700">{selectedRequest.department}</p>
                </div>
              ) : null}
              {selectedRequest.dateNeeded ? (
                <div className="rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Date Needed</p>
                  <p className="mt-1.5 text-sm font-semibold text-brown-700">{formatDateLong(selectedRequest.dateNeeded)}</p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">Grand Total</p>
                <p className="mt-1.5 text-lg font-black text-primary-800">₱{(selectedRequest.grandTotal ?? 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brown-400">Requested Items</p>
              <div className="mt-3 space-y-3">
                {selectedRequest.items.map((item, i) => (
                  <div key={i} className="rounded-2xl border border-brown-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-brown-900">{item.name}</p>
                        <p className="text-xs text-brown-400">{item.itemCode} · {item.categoryName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-brown-900">×{item.quantityRequested}</p>
                        {item.unitCost > 0 ? (
                          <p className="text-xs text-primary-600">₱{item.unitCost.toFixed(2)}/ea</p>
                        ) : null}
                      </div>
                    </div>
                    {item.totalAmount > 0 ? (
                      <div className="mt-2 text-right">
                        <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                          Subtotal: ₱{item.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Approval Trail */}
            {selectedRequest.approvalLogs.length > 0 ? (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brown-400">Approval Trail</p>
                <div className="mt-3 space-y-2">
                  {selectedRequest.approvalLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
                      {log.action === "approved" ? (
                        <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                      ) : (
                        <XCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-brown-900">
                          {log.approverName} ({log.approverRole}) —{" "}
                          <span className={log.action === "approved" ? "text-emerald-600" : "text-rose-600"}>
                            {log.action}
                          </span>
                        </p>
                        {log.remarks ? (
                          <p className="mt-0.5 text-sm text-brown-500">"{log.remarks}"</p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-brown-400">{formatDateTimeShort(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            {!actionType ? (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setActionType("approve")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  Approve Request
                </button>
                <button
                  type="button"
                  onClick={() => setActionType("reject")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-6 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  <XCircleIcon className="h-5 w-5" />
                  Reject Request
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedRequest(null); setActionType(null); setActionRemarks("") }}
                  className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 hover:bg-brown-50"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4 border-t border-brown-200 pt-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brown-500">
                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    Remarks {actionType === "reject" ? <span className="text-rose-500">* (required for rejection)</span> : null}
                  </label>
                  <textarea
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    rows={3}
                    placeholder={actionType === "reject" ? "Provide a reason for rejection..." : "Optional remarks..."}
                    className="mt-3 w-full rounded-xl border border-brown-200 bg-white px-4 py-3 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void handleAction()}
                    disabled={submitting || (actionType === "reject" && !actionRemarks.trim())}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {submitting ? (
                      <>Processing...</>
                    ) : (
                      <>
                        {actionType === "approve" ? <CheckCircleIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
                        Confirm {actionType === "approve" ? "Approval" : "Rejection"}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ApprovalPersonnelShell>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "Pending Immediate Head": "bg-amber-100 text-amber-700",
    "Pending Budget Officer": "bg-amber-200 text-amber-800",
    "Pending VP Finance": "bg-amber-200 text-amber-800",
    "Pending College President": "bg-amber-300 text-amber-900",
    "Approved": "bg-emerald-100 text-emerald-700",
    "Rejected": "bg-rose-100 text-rose-700",
  }
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${colorMap[status] ?? "bg-brown-200 text-brown-700"}`}>
      {status}
    </span>
  )
}
