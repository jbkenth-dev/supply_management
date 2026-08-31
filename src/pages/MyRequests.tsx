import { useEffect, useMemo, useState } from "react"
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  FunnelIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { MessageModal } from "../components/ui/MessageModal"
import { api } from "../lib/api"
import { getStoredAuthUser } from "../lib/auth"
import type { FacultyRequest, FacultyRequestSummary, RequestStatus } from "../types/requests"
import RequestViewModal from "../components/RequestViewModal"

type RequestsResponse = {
  success: boolean
  requests: FacultyRequest[]
  summary: FacultyRequestSummary
  message?: string
}

type CancelResponse = RequestsResponse

const emptySummary: FacultyRequestSummary = {
  totalRequests: 0,
  pendingRequests: 0,
  approvedRequests: 0,
  fulfilledRequests: 0,
  rejectedRequests: 0,
}

const REQUESTS_PER_PAGE = 4

export default function MyRequests() {
  const [requests, setRequests] = useState<FacultyRequest[]>([])
  const [summary, setSummary] = useState<FacultyRequestSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"All" | RequestStatus>("All")
  const [page, setPage] = useState(1)
  const [requestToCancel, setRequestToCancel] = useState<FacultyRequest | null>(null)
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null)
  const authUser = getStoredAuthUser()
  const [showModal, setShowModal] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"success" | "error">("error")
  const [selectedRequest, setSelectedRequest] = useState<FacultyRequest | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)

  const pushMessage = (title: string, message: string, type: "success" | "error") => {
    setModalTitle(title)
    setModalMessage(message)
    setModalType(type)
    setShowModal(true)
  }

  useEffect(() => {
    let cancelled = false

    const loadRequests = async () => {
      if (!authUser?.id || authUser.role !== "Faculty Staff") {
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const params = new URLSearchParams({
          userId: String(authUser.id),
          role: authUser.role,
        })
        const response = await api(`/api/faculty-requests.php?${params.toString()}`)
        const result = (await response.json()) as RequestsResponse

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Unable to load your supply requests.")
        }

        if (!cancelled) {
          setRequests(result.requests ?? [])
          setSummary(result.summary ?? emptySummary)
          setPage(1)
        }
      } catch (error) {
        if (!cancelled) {
          setRequests([])
          setSummary(emptySummary)
          pushMessage("Request Sync Failed", error instanceof Error ? error.message : "Unable to load your supply requests.", "error")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRequests()

    return () => {
      cancelled = true
    }
  }, [authUser?.id, authUser?.role])

  const filteredRequests = useMemo(() => {
    if (statusFilter === "All") {
      return requests
    }

    return requests.filter((request) => request.status === statusFilter)
  }, [requests, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PER_PAGE))
  const paginatedRequests = useMemo(
    () => filteredRequests.slice((page - 1) * REQUESTS_PER_PAGE, page * REQUESTS_PER_PAGE),
    [filteredRequests, page],
  )

  useEffect(() => {
    setPage(1)
  }, [statusFilter, requests])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  async function cancelRequest(request: FacultyRequest) {
    if (!authUser?.id || authUser.role !== "Faculty Staff") {
      return
    }

    setBusyRequestId(request.id)

    try {
      const response = await api("/api/faculty-requests.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel_request",
          requestId: request.id,
          userId: authUser.id,
          role: authUser.role,
        }),
      })
      const result = (await response.json()) as CancelResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to cancel your request.")
      }

      setRequests(result.requests ?? [])
      setSummary(result.summary ?? emptySummary)
      setRequestToCancel(null)
      setPage(1)
      pushMessage("Request Cancelled", result.message ?? "Your request has been cancelled and office staff were notified.", "success")
    } catch (error) {
      pushMessage("Cancellation Failed", error instanceof Error ? error.message : "Unable to cancel your request.", "error")
    } finally {
      setBusyRequestId(null)
    }
  }

  return (
    <AppShell role="Faculty Staff">
      <MessageModal
        open={showModal}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />
      <div className="space-y-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Faculty Request</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">My Requests</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
              Track every request you submitted from the database, including requested items, quantities, dates, and review status.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-brown-200 bg-white px-4 py-3 shadow-sm">
            <FunnelIcon className="h-5 w-5 text-brown-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "All" | RequestStatus)}
              className="bg-transparent text-sm font-semibold text-brown-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Immediate Head">Pending Immediate Head</option>
              <option value="Pending Budget Officer">Pending Budget Officer</option>
              <option value="Pending VP Finance">Pending VP Finance</option>
              <option value="Pending College President">Pending College President</option>
              <option value="Waiting Purchase">Waiting Purchase</option>
              <option value="Purchased">Purchased</option>
              <option value="Ready for Release">Ready for Release</option>
              <option value="Released">Released</option>
              <option value="Received">Received</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total" value={summary.totalRequests} tone="slate" icon={<CubeIcon className="h-5 w-5" />} />
          <SummaryCard label="Pending" value={summary.pendingRequests} tone="amber" icon={<ClockIcon className="h-5 w-5" />} />
          <SummaryCard label="Approved" value={summary.approvedRequests} tone="blue" icon={<CheckCircleIcon className="h-5 w-5" />} />
          <SummaryCard label="Fulfilled" value={summary.fulfilledRequests} tone="emerald" icon={<CheckCircleIcon className="h-5 w-5" />} />
          <SummaryCard label="Rejected" value={summary.rejectedRequests} tone="rose" icon={<XCircleIcon className="h-5 w-5" />} />
        </div>

        <div className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brown-200 bg-brown-100">
                  <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[60px]">No.</th>
                  <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600">Request ID</th>
                  <th className="border-r border-brown-200 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-brown-600">Status</th>
                  <th className="border-r-0 px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-brown-600 sm:w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm italic text-brown-400">
                      Loading...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm italic text-brown-400">
                      No requests found
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedRequests.map((request, index) => (
                      <tr
                        key={request.id}
                        className="border-b border-brown-200 hover:bg-brown-50 cursor-pointer"
                        onClick={() => {
                          setSelectedRequest(request);
                          setViewModalOpen(true);
                        }}
                      >
                        <td className="border-r border-brown-200 px-2 py-2 text-center text-sm">
                          {(page - 1) * REQUESTS_PER_PAGE + index + 1}
                        </td>
                        <td className="border-r border-brown-200 px-2 py-2 text-left text-sm font-medium">
                          {request.requestNumber}
                        </td>
                        <td className="border-r border-brown-200 px-2 py-2 text-left text-sm">
                          {request.status}
                        </td>
                        <td className="border-r-0 px-2 py-2 text-right text-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequest(request);
                              setViewModalOpen(true);
                            }}
                            className="text-xs font-semibold text-primary-600 hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && filteredRequests.length > 0 ? (
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredRequests.length}
            pageSize={REQUESTS_PER_PAGE}
            itemLabel="requests"
            onPageChange={setPage}
          />
        ) : null}
      </div>

      {requestToCancel ? (
        <ConfirmCancelModal
          request={requestToCancel}
          busy={busyRequestId === requestToCancel.id}
          onClose={() => {
            if (busyRequestId !== requestToCancel.id) {
              setRequestToCancel(null)
            }
          }}
          onConfirm={() => void cancelRequest(requestToCancel)}
        />
      ) : null}

      {/* Request View Modal */}
      {selectedRequest && viewModalOpen ? (
        <RequestViewModal
          request={selectedRequest}
          open={viewModalOpen}
          onClose={() => {
            setSelectedRequest(null)
            setViewModalOpen(false)
          }}
        />
      ) : null}
    </AppShell>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: "slate" | "amber" | "blue" | "emerald" | "rose"
  icon: React.ReactNode
}) {
  const classes = {
    slate: "bg-brown-100 text-brown-600 border-brown-200",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    blue: "bg-primary-50 text-primary-600 border-primary-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  }

  return (
    <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brown-400">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${classes[tone]}`}>{icon}</div>
      </div>
      <p className="mt-4 text-3xl font-black tracking-tight text-brown-900">{value.toLocaleString()}</p>
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

function ConfirmCancelModal({
  request,
  busy,
  onClose,
  onConfirm,
}: {
  request: FacultyRequest
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-[2rem] border-border-brown-200 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ExclamationTriangleIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Cancel Request</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">{request.requestNumber}</h2>
            <p className="mt-3 text-sm leading-6 text-brown-500">
              This will cancel your pending request and notify administrator and property custodian by notification and email.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
          <p className="text-sm text-brown-600">
            {request.totalItems} item{request.totalItems === 1 ? "" : "s"} requested with {request.totalQuantity} total{" "}
            {request.totalQuantity === 1 ? "quantity" : "quantities"}.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircleIcon className="mr-2 h-4 w-4" />
                Confirm Cancel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}