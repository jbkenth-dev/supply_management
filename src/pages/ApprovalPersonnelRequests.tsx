import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
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
import { formatDateTime, formatDateLong } from "../lib/date"
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

async function readApprovalResponse(response: Response): Promise<ApprovalApiResponse> {
  const responseText = await response.text()
  let result: ApprovalApiResponse | null = null

  try {
    result = JSON.parse(responseText) as ApprovalApiResponse
  } catch {
    const plainText = new DOMParser().parseFromString(responseText, "text/html").body.textContent?.trim()
    const serverMessage = plainText || responseText.trim() || "The server returned an empty response."
    const statusLabel = response.statusText ? `${response.status} ${response.statusText}` : String(response.status)
    throw new Error(`Approval API returned invalid JSON (HTTP ${statusLabel}). Cause: ${serverMessage}`)
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message ?? `Approval API request failed (HTTP ${response.status} ${response.statusText}).`)
  }

  return result
}

export default function ApprovalPersonnelRequests() {
  const authUser = getStoredAuthUser()
  const navigate = useNavigate()
  const location = useLocation()
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
  const [isExpanded, setIsExpanded] = useState(false)
  const [approvalPersonnel, setApprovalPersonnel] = useState<Record<string, string>>({})
  const [showApprovalConfirmation, setShowApprovalConfirmation] = useState(false)

  const getAllowedRolesForStatus = (status: RequestStatus): string[] => {
    switch (status) {
      case "Pending Immediate Head":
        return ["Immediate Head"];
      case "Pending Budget Officer":
        return ["Resource Planning Officer"];
      case "Pending VP Finance":
        return ["Vice President for Finance"];
      case "Pending College President":
        return ["College President"];
      default:
        return [];
    }
  };

  const handleApprovalConfirm = async () => {
    if (!authUser?.id) {
      pushMessage("Approval Failed", "User not authenticated", "error")
      return
    }
    setSubmitting(true)
    try {
      if (!selectedRequest) throw new Error("No request selected")
      const response = await api("/api/approval-workflow.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.id,
          requestId: selectedRequest.id,
          action: "approve",
          remarks: "",
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Approval failed")
      }
      void loadRequests()
    } catch (err) {
      pushMessage("Approval Failed", err instanceof Error ? err.message : "An error occurred", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const requestApprovalConfirmation = (request: ApprovalRequest) => {
    setSelectedRequest(request)
    setShowApprovalConfirmation(true)
  }

  useEffect(() => {
    setIsExpanded(false)
  }, [selectedRequest?.id])

  useEffect(() => {
    let cancelled = false
    const loadApprovalPersonnel = async () => {
      const roles = "Immediate Head,Resource Planning Officer,Vice President for Finance,College President"
      const response = await api(`/api/approval-personnel-info.php?roles=${encodeURIComponent(roles)}`)
      const result = await response.json()
      if (!response.ok || !result.success || cancelled) return

      const map: Record<string, string> = {}
      for (const personnel of result.personnel ?? []) {
        map[personnel.role] = personnel.fullName
      }
      setApprovalPersonnel(map)
    }

    void loadApprovalPersonnel()
    return () => {
      cancelled = true
    }
  }, [])

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
      if (location.pathname === "/approval-personnel/all-request") {
        params.set("showAll", "true")
      }
      const res = await api(`/api/approval-workflow.php?${params.toString()}`)
      const result = await readApprovalResponse(res)
      setRequests(result.requests ?? [])
      setPage(1)
    } catch (error) {
      pushMessage("Load Failed", error instanceof Error ? error.message : "Unable to load requests.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [authUser?.id, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleClose = () => {
    if (!submitting) {
      setSelectedRequest(null)
      setActionType(null)
      setActionRemarks("")
    }
  }

  const selectedItems = selectedRequest?.items ?? []
  const steps = [
    { label: "Pending Immediate Head", value: "Pending Immediate Head" },
    { label: "Pending Budget Officer", value: "Pending Budget Officer" },
    { label: "Pending VP Finance", value: "Pending VP Finance" },
    { label: "Pending College President", value: "Pending College President" },
    { label: "Approved", value: "Approved" },
    { label: "Waiting Purchase", value: "Waiting Purchase" },
    { label: "Purchased", value: "Purchased" },
    { label: "Ready for Release", value: "Ready for Release" },
    { label: "Released", value: "Released" },
    { label: "Received", value: "Received" },
    { label: "Completed", value: "Completed" },
  ]
  const currentIndex = steps.findIndex((step) => step.value === selectedRequest?.status)
  const currentStatusLabel = (() => {
    switch (selectedRequest?.status) {
      case "Pending Immediate Head":
        return "Pending — Immediate Head"
      case "Pending Budget Officer":
        return "Pending — Budget Officer"
      case "Pending VP Finance":
        return "Pending — VP Finance"
      case "Pending College President":
        return "Pending — College President"
      case "Waiting Purchase":
        return "Waiting — Purchase"
      case "Ready for Release":
        return "Ready — Release"
      default:
        return selectedRequest?.status ?? ""
    }
  })()
  const grandTotal = selectedRequest?.grandTotal ?? 0
  const totalItems = selectedRequest?.totalItems ?? 0
  const totalQuantity = selectedRequest?.totalQuantity ?? 0

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
              {location.pathname === "/approval-personnel/all-request" ? (
                <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">All Pending Requests</h1>
              ) : (
                <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">All Requests</h1>
              )}
              <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
                {location.pathname === "/approval-personnel/all-request"
                  ? "Review and process all supply requests pending approval."
                  : "Review and process all supply requests pending your approval."}
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">
                {location.pathname === "/approval-personnel/all-request" ? "Pending Approval" : "Pending Approval"}
              </p>
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
                        {(() => {
                          const allowedRoles = getAllowedRolesForStatus(request.status);
                          if (!authUser?.role || !allowedRoles.includes(authUser.role)) {
                            return null;
                          }
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => requestApprovalConfirmation(request)}
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
                            </>
                          );
                        })()}
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

        {/* Detail / Action Modal */}
        {selectedRequest && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm"
            onClick={handleClose}
          >
            <div
              className="relative w-full max-w-[210mm] max-h-[calc(100vh_-_3rem)] overflow-y-auto rounded-[1.75rem] border border-brown-200 bg-white shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }} className="absolute top-2 right-2 rounded-xl p-2 text-brown-700 hover:text-brown-900 hover:bg-brown-50 transition" aria-label="Close">
                <XCircleIcon className="h-5 w-5" />
              </button>
              <div className="border-b border-brown-200 bg-gradient-to-b from-brown-50 to-white px-6 pb-5 pt-6 text-center sm:px-10">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary-600">
                  Saint Francis College, Guihulngan, Negros Oriental, Incorporated
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brown-500">
                  Bateria, Poblacion, Guihulngan City, Negros Oriental
                </p>
                <h1 className="mt-2 text-lg font-black uppercase tracking-wide text-brown-900 sm:text-xl">
                  OFFICE OF THE VICE PRESIDENT FOR FINANCE
                </h1>
                <div className="mx-auto my-4 h-0.5 w-24 rounded-full bg-primary-500" />
                <h2 className="text-base font-black uppercase tracking-[0.15em] text-brown-900 sm:text-lg">
                  REQUEST FORM
                </h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brown-500">
                  (<span className="font-semibold text-brown-800">
                    {selectedRequest.requestedByName}
                  </span>)
                </p>
              </div>

              <div className="border-b border-brown-200 px-6 py-4 sm:px-10">
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                      Purpose
                    </label>
                    <p className="mt-1 text-sm leading-5 text-brown-700 line-clamp-2">{selectedRequest.purpose}</p>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                      Department
                    </label>
                    <p className="mt-1 text-sm font-semibold text-brown-700">{selectedRequest.department}</p>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                      Date
                    </label>
                    <p className="mt-1 text-sm font-semibold text-brown-700">
                      {selectedRequest.dateNeeded ? formatDateLong(selectedRequest.dateNeeded) : "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-b border-brown-200 bg-brown-50/60 px-6 py-4 sm:px-10">
                {!isExpanded ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="status-orbit-shell shrink-0">
                        <span className="status-orbit-ring" />
                        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-base font-black text-white shadow-sm ring-4 ring-white">
                          {Math.max(currentIndex + 1, 1)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brown-500">Current status</p>
                        <p className="mt-1 text-base font-bold tracking-tight text-brown-900 sm:text-lg">
                          {currentStatusLabel}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setIsExpanded(true)}
                      className="inline-flex items-center justify-center rounded-full border border-primary-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary-700 transition hover:border-primary-300 hover:bg-primary-50"
                    >
                      View More
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="status-orbit-shell shrink-0">
                          <span className="status-orbit-ring" />
                          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-base font-black text-white shadow-sm ring-4 ring-white">
                            {Math.max(currentIndex + 1, 1)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brown-500">Current status</p>
                          <p className="mt-1 text-base font-bold tracking-tight text-brown-900 sm:text-lg">
                            {currentStatusLabel}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setIsExpanded(false)}
                        className="inline-flex items-center justify-center rounded-full border border-primary-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary-700 transition hover:border-primary-300 hover:bg-primary-50"
                      >
                        View Less
                      </button>
                    </div>

                    <div className="relative ml-2 pt-2">
                      <div className="absolute left-[17px] top-2 h-[calc(100%-0.75rem)] w-px bg-brown-200" aria-hidden="true" />
                      <div className="space-y-4">
                        {steps.map((step, idx) => {
                          const isCurrent = idx === currentIndex;
                          const isCompleted = idx < currentIndex;
                          const isUpcoming = idx > currentIndex;

                          return (
                            <div key={step.value} className="relative flex items-start gap-3">
                              <div className="relative z-10 mt-0.5 flex h-8 w-8 items-center justify-center shrink-0 rounded-full border bg-white shadow-sm">
                                {isCurrent ? (
                                  <div className="status-orbit-shell h-8 w-8">
                                    <span className="status-orbit-ring ring-1 ring-primary-200" />
                                    <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                                      {idx + 1}
                                    </span>
                                  </div>
                                ) : (
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                      isCompleted
                                        ? "bg-brown-200 text-brown-600"
                                        : isUpcoming
                                          ? "bg-brown-100 text-brown-400"
                                          : "bg-primary-100 text-primary-700"
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 pt-0.5">
                                <p
                                  className={`text-sm font-semibold ${
                                    isCurrent
                                      ? "text-brown-900"
                                      : isCompleted
                                        ? "text-brown-500"
                                        : "text-brown-400"
                                  }`}
                                >
                                  {step.label}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 sm:px-10">
                <div className="overflow-x-auto rounded-2xl border border-brown-200">
                  <table className="w-full border-collapse table-fixed text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-brown-200 bg-brown-100">
                        <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[40px]">
                          Qty
                        </th>
                        <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600">
                          Item / Description
                        </th>
                        <th className="border-r border-brown-200 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[110px]">
                          Unit Cost
                        </th>
                        <th className="border-r-0 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[120px]">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.length === 0 ? (
                        <tr className="border-b border-brown-200">
                          <td colSpan={4} className="px-4 py-8 text-center text-sm italic text-brown-400">
                            No items in this request.
                          </td>
                        </tr>
                      ) : null}

                      {selectedItems.map((item, index) => (
                        <tr key={`${item.itemCode}-${index}`} className="border-b border-brown-200 align-top">
                          <td className="border-r border-brown-200 px-2 py-3 text-right align-top sm:w-[40px]">
                            <span className="block text-xs font-bold text-brown-900">{item.quantityRequested}</span>
                          </td>
                          <td className="border-r border-brown-200 px-2 py-3 align-top">
                            <div className="flex min-w-0 items-start gap-2">
                              <img
                                src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop"}
                                alt={item.name}
                                className="mt-0.5 h-7 w-7 flex-shrink-0 rounded object-cover"
                              />
                              <div className="min-w-0">
                                <p className="break-words text-xs font-semibold leading-5 text-brown-900 sm:text-sm">{item.name}</p>
                                {item.supplyId === null ? (
                                  <span className="mt-1 inline-block rounded-full bg-accent-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-600">
                                    Custom
                                  </span>
                                ) : (
                                  <span className="mt-1 block text-[10px] font-medium text-brown-400">{item.itemCode}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="border-r border-brown-200 px-2 py-3 text-right align-top">
                            <span className="text-[10px] font-bold text-brown-900 sm:text-xs">₱{item.unitCost.toFixed(2)}</span>
                          </td>
                          <td className="px-2 py-3 text-right align-top">
                            <span className="text-sm font-black text-brown-900 sm:text-sm">₱{item.totalAmount.toFixed(2)}</span>
                          </td>
                        </tr>
                      ))}

                      <tfoot>
                        <tr className="bg-white font-bold">
                          <td colSpan={2} className="border-r border-brown-200 px-3 py-2">
                            <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-brown-600">
                              SOF:
                              <span className="inline-block min-w-[120px] border-b border-brown-300">&nbsp;</span>
                            </span>
                          </td>
                          <td className="border-r border-brown-200 px-3 py-2 text-right text-[11px] uppercase tracking-wider text-brown-600">
                            Grand Total
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-black text-brown-900 sm:text-base">
                            ₱{grandTotal.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </tbody>
                  </table>
                </div>

                <p className="mt-3 text-[10px] uppercase tracking-wider text-brown-400">
                  Total Items: {totalItems} | Total Quantity: {totalQuantity}
                </p>
              </div>

              <div className="border-t border-brown-200 px-6 py-4 sm:px-10">
                <div className="overflow-x-auto rounded-2xl border border-brown-200">
                  <table className="w-full border-collapse text-[10px] sm:text-xs">
                    <thead>
                      <tr className="border-b border-brown-200 bg-brown-100">
                        {["Requested By", "Recommended By", "Checked By", "Noted By", "Approved By"].map((label) => (
                          <th key={label} className="border-r border-brown-200 px-2 py-2 text-center font-bold uppercase tracking-wider text-brown-600 last:border-r-0">
                            {label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {["Requested", "Recommended", "Checked", "Noted", "Approved"].map((label) => {
                        let printedName = "";
                        if (label === "Requested") {
                          printedName = selectedRequest.requestedByName;
                        } else if (label === "Recommended") {
                          printedName = approvalPersonnel["Immediate Head"] ?? "";
                        } else if (label === "Checked") {
                          printedName = approvalPersonnel["Resource Planning Officer"] ?? "";
                        } else if (label === "Noted") {
                          printedName = approvalPersonnel["Vice President for Finance"] ?? "";
                        } else if (label === "Approved") {
                          printedName = approvalPersonnel["College President"] ?? "";
                        }
                        const position = label === "Recommended"
                          ? "Immediate Head"
                          : label === "Checked"
                            ? "Resource Planning Officer"
                            : label === "Noted"
                              ? "Vice President for Finance"
                              : label === "Approved"
                                ? "College President"
                                : "";
                        return (
                          <td key={label} className="border-r border-brown-200 px-2 py-4 text-center last:border-r-0">
                            <div className="mx-auto mb-2 h-px w-3/4 border-t border-brown-300" />
                            <p className="text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Signature</p>
                            <p className="mt-3 text-[10px] sm:text-xs">{printedName}</p>
                            <div className="mx-auto mt-1 h-px w-full border-t border-brown-300" />
                            <p className="mt-1 text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Printed Name</p>
                          <p className="mt-2 text-[10px] sm:text-xs">{position}</p>
                          <div className="mx-auto mt-1 h-px w-full border-t border-brown-300" />
                            <p className="mt-1 text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Position / Designation</p>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              </div>

              <div className="border-t border-brown-200 px-6 py-4 sm:px-10">
                <div className="mb-4">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">Notes / Remarks</label>
                  <p className="mt-1 text-sm leading-6 text-brown-600">{selectedRequest.notes}</p>
                </div>
              </div>

              {/* Action Section */}
              {!actionType ? (
                <>
                </>
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
      </StaggerContainer>
      {showApprovalConfirmation && selectedRequest ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" role="presentation">
              <div
                className="w-full max-w-md rounded-2xl border border-brown-200 bg-white p-6 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="approval-confirmation-title"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 id="approval-confirmation-title" className="text-lg font-black text-brown-900">
                  Confirm Approval
                </h3>
                <p className="mt-3 text-sm leading-6 text-brown-600">
                  Are you sure you want to approve <span className="font-bold text-brown-900">{selectedRequest.requestNumber}</span>?
                </p>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowApprovalConfirmation(false)}
                    className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-5 py-2.5 text-sm font-semibold text-brown-700 transition hover:bg-brown-50"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowApprovalConfirmation(false)
                      void handleApprovalConfirm()
                    }}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    Yes, Approve
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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