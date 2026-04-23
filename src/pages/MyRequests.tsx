import { useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  FunnelIcon,
  InboxIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { ToastContainer, type ToastProps } from "../components/ui/Toast"
import { getStoredAuthUser } from "../lib/auth"
import type { FacultyRequest, FacultyRequestSummary } from "../types/requests"

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
  const [statusFilter, setStatusFilter] = useState<"All" | FacultyRequest["status"]>("All")
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const [page, setPage] = useState(1)
  const [requestToCancel, setRequestToCancel] = useState<FacultyRequest | null>(null)
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null)
  const authUser = getStoredAuthUser()

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  const pushToast = (title: string, message: string, type: ToastProps["type"]) => {
    setToasts((current) => [
      ...current,
      {
        id: `requests-toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        message,
        type,
        onDismiss: removeToast,
      },
    ])
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
        const response = await fetch(`/api/faculty-requests.php?${params.toString()}`)
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
          pushToast("Request Sync Failed", error instanceof Error ? error.message : "Unable to load your supply requests.", "error")
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
      const response = await fetch("/api/faculty-requests.php", {
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
      pushToast("Request Cancelled", result.message ?? "Your request has been cancelled and office staff were notified.", "success")
    } catch (error) {
      pushToast("Cancellation Failed", error instanceof Error ? error.message : "Unable to cancel your request.", "error")
    } finally {
      setBusyRequestId(null)
    }
  }

  return (
    <AppShell role="Faculty Staff">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="space-y-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Faculty Request</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">My Requests</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Track every request you submitted from the database, including requested items, quantities, dates, and review status.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <FunnelIcon className="h-5 w-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "All" | FacultyRequest["status"])}
              className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Fulfilled">Fulfilled</option>
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

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="h-4 w-24 rounded-full bg-slate-200" />
                  <div className="mt-3 h-8 w-64 rounded-2xl bg-slate-200" />
                  <div className="mt-4 h-4 w-full rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
              <InboxIcon className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-4 text-sm font-semibold text-slate-900">No requests found</p>
              <p className="mt-2 text-sm text-slate-500">Requests you submit from the new request page will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {paginatedRequests.map((request) => (
                <article key={request.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          {request.requestNumber}
                        </span>
                        <StatusBadge status={request.status} />
                      </div>
                      <h2 className="mt-3 text-xl font-black tracking-tight text-slate-900">
                        {request.totalItems} item{request.totalItems === 1 ? "" : "s"} requested
                      </h2>
                      <p className="mt-2 text-sm text-slate-500">
                        Submitted {dayjs(request.createdAt).format("MMMM D, YYYY h:mm A")} with {request.totalQuantity} total {request.totalQuantity === 1 ? "quantity" : "quantities"}.
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <div className="text-sm text-slate-500">
                        Last updated {dayjs(request.updatedAt).format("MMM D, YYYY h:mm A")}
                      </div>
                      {request.status === "Pending" ? (
                        <button
                          type="button"
                          onClick={() => setRequestToCancel(request)}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          <XCircleIcon className="mr-2 h-4 w-4" />
                          Cancel Request
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {request.notes ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Request Notes</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{request.notes}</p>
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {request.items.map((item) => (
                      <div key={`${request.id}-${item.supplyId}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-4">
                          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <img
                              src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop"}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-900">{item.name}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {item.itemCode} • {item.categoryName}
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-900">
                            x{item.quantityRequested}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                            Requested: {item.quantityRequested}
                          </span>
                          {item.quantityApproved !== null ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                              Approved: {item.quantityApproved}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                            In stock now: {item.quantityOnHand}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {request.reviewNotes ? (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Review Notes</p>
                      <p className="mt-2 text-sm leading-6 text-blue-900">{request.reviewNotes}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

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
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${classes[tone]}`}>{icon}</div>
      </div>
      <p className="mt-4 text-3xl font-black tracking-tight text-slate-900">{value.toLocaleString()}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: FacultyRequest["status"] }) {
  const className =
    status === "Pending"
      ? "bg-amber-100 text-amber-700"
      : status === "Approved"
        ? "bg-blue-100 text-blue-700"
        : status === "Fulfilled"
          ? "bg-emerald-100 text-emerald-700"
          : status === "Rejected"
            ? "bg-rose-100 text-rose-700"
            : "bg-slate-200 text-slate-700"

  return <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${className}`}>{status}</span>
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
      <p className="text-sm text-slate-500">
        Showing {startItem}-{endItem} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="min-w-20 text-center text-sm font-semibold text-slate-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ExclamationTriangleIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Cancel Request</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{request.requestNumber}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              This will cancel your pending request and notify administrator and property custodian by notification and email.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">
            {request.totalItems} item{request.totalItems === 1 ? "" : "s"} requested with {request.totalQuantity} total{" "}
            {request.totalQuantity === 1 ? "quantity" : "quantities"}.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
