import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import dayjs from "dayjs"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { getStoredAuthUser, type AuthRole } from "../../lib/auth"

type RequestItem = {
  requestItemId: number
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

type AdminRequestRecord = {
  id: number
  requestNumber: string
  issuanceSlipNo: string | null
  requestedByName: string
  requestedByIdNumber: string
  requestedByEmail: string
  requestedByProfileImageUrl: string | null
  reviewedByName: string
  fulfilledByName: string
  status: "Pending" | "Approved" | "Rejected" | "Fulfilled" | "Cancelled"
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

  useEffect(() => {
    void loadData()
  }, [authUser?.id, authUser?.role, role])

  useEffect(() => {
    if (!message) {
      return
    }

    const timer = window.setTimeout(() => {
      setMessage("")
      setIsSuccess(false)
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [message])

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (!query) {
      return requests
    }

    return requests.filter((request) => {
      const haystack = [
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

      return haystack.includes(query)
    })
  }, [requests, searchTerm])

  const issuanceHistory = useMemo(
    () => requests.filter((request) => request.status === "Fulfilled"),
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
  }, [searchTerm, requests])

  useEffect(() => {
    setIssuancePage(1)
  }, [issuanceSearchTerm, requests])

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
      const response = await fetch(`/api/admin-request-issuance.php?${params.toString()}`)
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
      const response = await fetch("/api/admin-request-issuance.php", {
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

  function printReport() {
    const doc = createPdfDocument("Request and Issuance Report", "Administrative report of supply requests and issuance records")

    const rows = filteredRequests.flatMap((request) =>
      request.items.map((item, index) => [
        index === 0 ? request.requestNumber : "",
        index === 0 ? request.requestedByName : "",
        item.itemCode,
        item.name,
        request.status,
        String(item.quantityRequested),
        String(item.quantityApproved ?? 0),
        String(item.quantityFulfilled),
        index === 0 ? formatDateTime(request.createdAt) : "",
      ]),
    )

    autoTable(doc, {
      startY: 42,
      head: [["Request No", "Requester", "Item Code", "Supply", "Status", "Requested", "Approved", "Issued", "Created"]],
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: "middle",
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 23 },
        1: { cellWidth: 28 },
        2: { cellWidth: 23 },
        3: { cellWidth: 34 },
        4: { cellWidth: 18 },
        5: { cellWidth: 15, halign: "center" },
        6: { cellWidth: 15, halign: "center" },
        7: { cellWidth: 15, halign: "center" },
        8: { cellWidth: 28 },
      },
      margin: { left: 10, right: 10 },
      didDrawPage: () => {
        drawPdfFooter(doc)
      },
    })

    openPdfInBrowser(doc)
  }

  function printIssuanceSlip(request: AdminRequestRecord) {
    const doc = createPdfDocument("Issuance Slip", "Official supply issuance document")

    doc.setDrawColor(203, 213, 225)
    doc.roundedRect(14, 42, 182, 34, 4, 4)
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text(`Slip No: ${request.issuanceSlipNo ?? "Not assigned"}`, 18, 50)
    doc.text(`Request No: ${request.requestNumber}`, 18, 57)
    doc.text(`Issued To: ${request.requestedByName}`, 18, 64)
    doc.text(`ID Number: ${request.requestedByIdNumber || "Not available"}`, 18, 71)
    doc.text(`Issued By: ${request.fulfilledByName || role}`, 112, 50)
    doc.text(`Issued At: ${request.fulfilledAt ? formatDateTime(request.fulfilledAt) : "Not issued yet"}`, 112, 57)
    doc.text(`Status: ${request.status}`, 112, 64)
    doc.text(`Total Quantity: ${request.totalQuantity}`, 112, 71)

    autoTable(doc, {
      startY: 84,
      head: [["Item Code", "Supply", "Category", "Requested", "Approved", "Issued"]],
      body: request.items.map((item) => [
        item.itemCode,
        item.name,
        item.categoryName,
        String(item.quantityRequested),
        String(item.quantityApproved ?? 0),
        String(item.quantityFulfilled),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 62 },
        2: { cellWidth: 34 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        drawPdfFooter(doc)
      },
    })

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 130
    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    doc.text("Received by:", 18, finalY + 20)
    doc.line(18, finalY + 34, 82, finalY + 34)
    doc.text("Signature over printed name", 24, finalY + 40)
    doc.text("Issued by:", 118, finalY + 20)
    doc.line(118, finalY + 34, 182, finalY + 34)
    doc.text(role === "Administrator" ? "Supply administrator" : "Property custodian", 132, finalY + 40)

    openPdfInBrowser(doc)
  }

  return (
    <AppShell role={role}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Admin Request & Issuance</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Request and Issuance</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Review all faculty supply requests.
            </p>
          </div>
          <button
            type="button"
            onClick={printReport}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <PrinterIcon className="mr-2 h-4 w-4" />
            Print Reports
          </button>
        </div>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total Requests" value={summary.totalRequests} tone="slate" />
          <SummaryCard label="Pending" value={summary.pendingRequests} tone="amber" />
          <SummaryCard label="Approved" value={summary.approvedRequests} tone="blue" />
          <SummaryCard label="Rejected" value={summary.rejectedRequests} tone="rose" />
          <SummaryCard label="Issued" value={summary.fulfilledRequests} tone="emerald" />
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Search</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">All Supply Requests</h2>
            </div>
            <div className="relative w-full max-w-lg">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search request no, requester, ID, email, slip no, or item"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                <article key={request.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <RequesterAvatar request={request} sizeClassName="h-14 w-14" textClassName="text-lg" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                            {request.requestNumber}
                          </span>
                          <StatusBadge status={request.status} />
                          {request.issuanceSlipNo ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                              {request.issuanceSlipNo}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-xl font-black tracking-tight text-slate-900">{request.requestedByName}</h3>
                        <p className="mt-2 text-sm text-slate-500">
                          ID Number: {request.requestedByIdNumber || "Not available"} • {request.requestedByEmail || "No email"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
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
                      {request.status === "Approved" ? (
                        <ActionButton label="Issue Supplies" onClick={() => openActionModal(request, "fulfill_request")} icon={<TruckIcon className="h-4 w-4" />} tone="blue" />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {request.items.map((item) => (
                      <div key={item.requestItemId} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-4">
                          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <img
                              src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop"}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {item.itemCode} • {item.categoryName}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Requested: {item.quantityRequested}</span>
                              {item.quantityApproved !== null ? (
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Approved: {item.quantityApproved}</span>
                              ) : null}
                              {item.quantityFulfilled > 0 ? (
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Issued: {item.quantityFulfilled}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Issuance</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Issuance History</h2>
            </div>
            <div className="w-full max-w-lg">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={issuanceSearchTerm}
                  onChange={(event) => setIssuanceSearchTerm(event.target.value)}
                  placeholder="Search slip no, request no, requester, issuer, or item"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <RequesterAvatar request={request} sizeClassName="h-12 w-12" textClassName="text-base" />
                      <div>
                        <p className="font-semibold text-slate-900">{request.requestedByName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {request.issuanceSlipNo ?? request.requestNumber} • Issued {request.fulfilledAt ? formatDateTime(request.fulfilledAt) : "Not recorded"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
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
      </div>

      {selectedRequest ? (
        <ModalShell onClose={() => setSelectedRequest(null)} title="Request Details">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-4">
                <RequesterAvatar request={selectedRequest} sizeClassName="h-16 w-16" textClassName="text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {selectedRequest.requestNumber}
                    </span>
                    <StatusBadge status={selectedRequest.status} />
                    {selectedRequest.issuanceSlipNo ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                        {selectedRequest.issuanceSlipNo}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-lg font-black text-slate-900">{selectedRequest.requestedByName}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    ID Number: {selectedRequest.requestedByIdNumber || "Not available"} • {selectedRequest.requestedByEmail || "No email"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Submitted {formatDateTime(selectedRequest.createdAt)}
                    {selectedRequest.reviewedAt ? ` • Reviewed ${formatDateTime(selectedRequest.reviewedAt)}` : ""}
                    {selectedRequest.fulfilledAt ? ` • Issued ${formatDateTime(selectedRequest.fulfilledAt)}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {selectedRequest.items.map((item) => (
                <div key={item.requestItemId} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img
                        src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=240&h=240&fit=crop"}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {item.itemCode} • {item.categoryName}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Requested: {item.quantityRequested}</span>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Approved: {item.quantityApproved ?? 0}</span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Issued: {item.quantityFulfilled}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedRequest.notes ? (
              <InfoBlock label="Request Notes" value={selectedRequest.notes} />
            ) : null}
            {selectedRequest.reviewNotes ? (
              <InfoBlock label="Review / Issuance Notes" value={selectedRequest.reviewNotes} />
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              {selectedRequest.status === "Fulfilled" ? (
                <ActionButton label="Print Issuance Slip" onClick={() => printIssuanceSlip(selectedRequest)} icon={<PrinterIcon className="h-4 w-4" />} tone="blue" />
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {actionRequest && actionType ? (
        <ModalShell onClose={closeActionModal} title={getActionTitle(actionType)}>
          <div className="space-y-5">
            <p className="text-sm leading-6 text-slate-500">
              {getActionDescription(actionType)} <span className="font-semibold text-slate-900">{actionRequest.requestNumber}</span> for{" "}
              <span className="font-semibold text-slate-900">{actionRequest.requestedByName}</span>.
            </p>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notes</label>
              <textarea
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Add approval, rejection, or issuance notes"
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={busyAction !== null}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAction()}
                disabled={busyAction !== null}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === actionType ? "Saving..." : getActionButtonLabel(actionType)}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </AppShell>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "amber" | "blue" | "rose" | "emerald" }) {
  const classes = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes[tone]}`}>{value.toLocaleString()}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: AdminRequestRecord["status"] }) {
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
    slate: "border-slate-200 text-slate-700 hover:bg-slate-50",
    emerald: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    rose: "border-rose-200 text-rose-700 hover:bg-rose-50",
    blue: "border-blue-200 text-blue-700 hover:bg-blue-50",
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
        <div key={index} className="h-36 animate-pulse rounded-[1.75rem] bg-slate-100" />
      ))}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <ClipboardDocumentListIcon className="mx-auto h-10 w-10 text-slate-300" />
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
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
    <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  )
}

function RequesterAvatar({
  request,
  sizeClassName,
  textClassName,
}: {
  request: Pick<AdminRequestRecord, "requestedByName" | "requestedByProfileImageUrl">
  sizeClassName: string
  textClassName: string
}) {
  const initial = (request.requestedByName.trim().charAt(0) || "F").toUpperCase()

  if (request.requestedByProfileImageUrl) {
    return (
      <img
        src={request.requestedByProfileImageUrl}
        alt={request.requestedByName}
        className={`${sizeClassName} flex-shrink-0 rounded-full border border-slate-200 object-cover`}
      />
    )
  }

  return (
    <div
      className={`${sizeClassName} ${textClassName} flex flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-200 font-bold uppercase text-slate-600`}
    >
      {initial}
    </div>
  )
}

function formatDateTime(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format("MMMM D, YYYY h:mm A") : value
}

function getActionTitle(action: ActionKind) {
  if (action === "approve_request") return "Approve Request"
  if (action === "reject_request") return "Reject Request"
  return "Issue Supplies"
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

function createPdfDocument(title: string, subtitle: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 210, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text("SFC-G Supply Management", 14, 12)
  doc.setFontSize(14)
  doc.text(title, 14, 21)

  doc.setTextColor(71, 85, 105)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(subtitle, 14, 34)
  doc.text(`Generated ${dayjs().format("MMMM D, YYYY h:mm A")}`, 196, 34, { align: "right" })

  return doc
}

function drawPdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  const currentPage = doc.getCurrentPageInfo().pageNumber

  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("WEB-BASED STOCKS & SUPPLY MANAGEMENT", 14, 290)
  doc.text(`Page ${currentPage} of ${pageCount}`, 196, 290, { align: "right" })
}

function openPdfInBrowser(doc: jsPDF) {
  const pdfBlob = doc.output("blob")
  const pdfUrl = URL.createObjectURL(pdfBlob)
  const openedWindow = window.open(pdfUrl, "_blank", "noopener,noreferrer")

  if (!openedWindow) {
    const fallbackLink = document.createElement("a")
    fallbackLink.href = pdfUrl
    fallbackLink.target = "_blank"
    fallbackLink.rel = "noopener noreferrer"
    fallbackLink.click()
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(pdfUrl)
  }, 60_000)
}
