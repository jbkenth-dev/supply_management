import dayjs from "dayjs"
import { useEffect, useState } from "react"
import {
  ShoppingCartIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  TruckIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { ToastContainer, type ToastProps } from "../../components/ui/Toast"
import { api } from "../../lib/api"
import { getStoredAuthUser } from "../../lib/auth"

type PurchaseItem = {
  supplyId: number | null
  customItemName: string | null
  unitCost: number
  totalAmount: number
  itemCode: string
  name: string
  categoryName: string
  quantityRequested: number
  quantityApproved: number | null
}

type PurchaseRequest = {
  id: number
  requestNumber: string
  purpose: string
  department: string
  dateNeeded: string | null
  grandTotal: number
  status: string
  totalItems: number
  totalQuantity: number
  notes: string
  receiptPath: string | null
  liquidationPath: string | null
  purchaseDate: string | null
  releaseDate: string | null
  completionDate: string | null
  confirmedReceived: boolean
  createdAt: string
  updatedAt: string
  requestedByName: string
  requestedByEmail: string
  items: PurchaseItem[]
}

type CustodianResponse = {
  success: boolean
  queued: PurchaseRequest[]
  history: PurchaseRequest[]
  message?: string
}

const REQUESTS_PER_PAGE = 5

export default function CustodianPurchasePage() {
  const authUser = getStoredAuthUser()
  const [queued, setQueued] = useState<PurchaseRequest[]>([])
  const [history, setHistory] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null)
  const [actionMode, setActionMode] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [liquidationFile, setLiquidationFile] = useState<File | null>(null)
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const [page, setPage] = useState(1)

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const pushToast = (title: string, message: string, type: ToastProps["type"]) => {
    setToasts((prev) => [...prev, { id: `cust-${Date.now()}`, title, message, type, onDismiss: removeToast }])
  }

  const loadData = async () => {
    if (!authUser?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ userId: String(authUser.id), role: authUser.role })
      const res = await api(`/api/custodian-purchase.php?${params.toString()}`)
      const result = (await res.json()) as CustodianResponse
      if (result.success) {
        setQueued(result.queued ?? [])
        setHistory(result.history ?? [])
      }
    } catch {
      pushToast("Load Failed", "Unable to load purchase data.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [authUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (action: string) => {
    if (!authUser?.id || !selectedRequest) return
    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("userId", String(authUser.id))
      formData.append("requestId", String(selectedRequest.id))
      formData.append("action", action)

      if (receiptFile) formData.append("receipt", receiptFile)
      if (liquidationFile) formData.append("liquidation", liquidationFile)

      const res = await fetch("/api/custodian-purchase.php", {
        method: "POST",
        body: formData,
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.message ?? "Action failed.")

      pushToast("Success", result.message ?? "Action completed.", "success")
      setSelectedRequest(null)
      setActionMode(null)
      setReceiptFile(null)
      setLiquidationFile(null)
      void loadData()
    } catch (error) {
      pushToast("Error", error instanceof Error ? error.message : "Action failed.", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const allQueued = [...queued]
  const totalPages = Math.max(1, Math.ceil(allQueued.length / REQUESTS_PER_PAGE))
  const paginatedQueued = allQueued.slice((page - 1) * REQUESTS_PER_PAGE, page * REQUESTS_PER_PAGE)

  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const pendingCount = queued.filter((r) => r.status === "Approved" || r.status === "Waiting Purchase").length

  return (
    <AppShell role="Property Custodian">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Property Custodian</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">Purchase & Release</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
            Manage approved requests: purchase items, upload receipts, and release to requesters.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="To Purchase" value={queued.filter((r) => r.status === "Approved" || r.status === "Waiting Purchase").length} />
          <SummaryCard label="Purchased" value={queued.filter((r) => r.status === "Purchased").length} />
          <SummaryCard label="Ready to Release" value={queued.filter((r) => r.status === "Ready for Release").length} />
          <SummaryCard label="Released" value={queued.filter((r) => r.status === "Released").length} />
        </div>

        {/* Active Queue */}
        <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Active Queue</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">
                Requests to Process
                {pendingCount > 0 ? (
                  <span className="ml-3 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">{pendingCount}</span>
                ) : null}
              </h2>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-[1.5rem] border border-brown-200 bg-brown-50 p-5">
                    <div className="h-4 w-24 rounded-full bg-brown-200" />
                    <div className="mt-3 h-6 w-64 rounded-2xl bg-brown-200" />
                  </div>
                ))}
              </div>
            ) : paginatedQueued.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-brown-200 bg-brown-50 px-6 py-14 text-center">
                <TruckIcon className="mx-auto h-10 w-10 text-brown-300" />
                <p className="mt-4 text-sm font-semibold text-brown-900">No requests to process</p>
                <p className="mt-2 text-sm text-brown-500">Approved requests will appear here for purchasing and release.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedQueued.map((request) => (
                  <div
                    key={request.id}
                    className="cursor-pointer rounded-[1.75rem] border border-brown-200 bg-brown-50 p-5 transition hover:shadow-md"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brown-500">
                            {request.requestNumber}
                          </span>
                          <CustodianStatusBadge status={request.status} />
                        </div>
                        <p className="mt-1 text-sm text-brown-500">
                          {request.requestedByName} • {request.department}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-primary-700">₱{(request.grandTotal ?? 0).toFixed(2)}</p>
                        <p className="text-xs text-brown-400">{request.totalItems} item(s)</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!loading && allQueued.length > 0 ? (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-brown-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-brown-50 disabled:opacity-50">
                  <ChevronLeftIcon className="inline h-4 w-4" /> Prev
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-sm font-semibold text-brown-700 hover:bg-brown-50 disabled:opacity-50">
                  Next <ChevronRightIcon className="inline h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* History */}
        {history.length > 0 ? (
          <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">History</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Completed Requests</h2>
            <div className="mt-6 space-y-3">
              {history.slice(0, 10).map((r) => (
                <div key={r.id} className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-brown-900">{r.requestNumber}</p>
                      <p className="text-sm text-brown-500">{r.requestedByName} • {r.department}</p>
                    </div>
                    <CustodianStatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" onClick={() => { if (!submitting) { setSelectedRequest(null); setActionMode(null); setReceiptFile(null) } }}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-brown-200 bg-white p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Request Details</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">{selectedRequest.requestNumber}</h2>
                <p className="mt-1 text-sm text-brown-500">{selectedRequest.requestedByName} • {selectedRequest.department}</p>
              </div>
              <CustodianStatusBadge status={selectedRequest.status} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {selectedRequest.purpose ? (
                <div className="col-span-2 rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Purpose</p>
                  <p className="mt-1.5 text-sm text-brown-700">{selectedRequest.purpose}</p>
                </div>
              ) : null}
              {selectedRequest.dateNeeded ? (
                <div className="rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Date Needed</p>
                  <p className="mt-1.5 text-sm font-semibold text-brown-700">{dayjs(selectedRequest.dateNeeded).format("MMM D, YYYY")}</p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">Grand Total</p>
                <p className="mt-1.5 text-lg font-black text-primary-800">₱{(selectedRequest.grandTotal ?? 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brown-400">Items</p>
              <div className="mt-3 space-y-2">
                {selectedRequest.items.map((item, i) => (
                  <div key={i} className="rounded-2xl border border-brown-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-brown-900">{item.name} <span className="text-xs text-brown-400">x{item.quantityRequested}</span></p>
                      {item.unitCost > 0 ? <p className="text-sm font-semibold text-primary-700">₱{(item.unitCost * item.quantityRequested).toFixed(2)}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Receipt & Liquidation Display */}
            {(selectedRequest.receiptPath || selectedRequest.liquidationPath) ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {selectedRequest.receiptPath ? (
                  <div className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Receipt</p>
                    <a href={selectedRequest.receiptPath} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700">
                      <DocumentTextIcon className="h-4 w-4" /> View Receipt
                    </a>
                  </div>
                ) : null}
                {selectedRequest.liquidationPath ? (
                  <div className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Liquidation</p>
                    <a href={selectedRequest.liquidationPath} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700">
                      <DocumentTextIcon className="h-4 w-4" /> View Liquidation
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Time Stamps */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-brown-400">
              {selectedRequest.purchaseDate ? <div>Purchased: {dayjs(selectedRequest.purchaseDate).format("MMM D, YYYY h:mm A")}</div> : null}
              {selectedRequest.releaseDate ? <div>Released: {dayjs(selectedRequest.releaseDate).format("MMM D, YYYY h:mm A")}</div> : null}
              {selectedRequest.completionDate ? <div>Completed: {dayjs(selectedRequest.completionDate).format("MMM D, YYYY h:mm A")}</div> : null}
            </div>

            {/* Action Area */}
            {!actionMode ? (
              <div className="mt-8 flex flex-wrap gap-3 border-t border-brown-200 pt-6">
                {(selectedRequest.status === "Approved" || selectedRequest.status === "Waiting Purchase") ? (
                  <button onClick={() => setActionMode("purchase")}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700">
                    <ShoppingCartIcon className="h-5 w-5" /> Mark as Purchased
                  </button>
                ) : null}
                {selectedRequest.status === "Purchased" ? (
                  <>
                    <button onClick={() => setActionMode("receipt")}
                      className="inline-flex items-center gap-2 rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-bold text-brown-700 hover:bg-brown-50">
                      <DocumentArrowUpIcon className="h-5 w-5" /> Upload Receipt
                    </button>
                    <button onClick={() => setActionMode("liquidation")}
                      className="inline-flex items-center gap-2 rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-bold text-brown-700 hover:bg-brown-50">
                      <DocumentArrowUpIcon className="h-5 w-5" /> Upload Liquidation
                    </button>
                    <button onClick={() => void handleAction("mark_ready")}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700">
                      <CheckCircleIcon className="h-5 w-5" /> Mark Ready for Release
                    </button>
                  </>
                ) : null}
                {selectedRequest.status === "Ready for Release" ? (
                  <button onClick={() => void handleAction("mark_released")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                    <TruckIcon className="h-5 w-5" /> Mark Released
                  </button>
                ) : null}
                <button onClick={() => { setSelectedRequest(null); setActionMode(null) }}
                  className="rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 hover:bg-brown-50">
                  Close
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4 border-t border-brown-200 pt-6">
                {(actionMode === "purchase" || actionMode === "receipt" || actionMode === "liquidation") ? (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-brown-400">
                      {actionMode === "purchase" ? "Upload Receipt (PDF, JPG, PNG)" :
                       actionMode === "receipt" ? "Upload Receipt File" : "Upload Liquidation File"}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (actionMode === "liquidation") setLiquidationFile(file)
                          else setReceiptFile(file)
                        }
                      }}
                      className="mt-2 block w-full text-sm text-brown-500 file:mr-4 file:rounded-xl file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100"
                    />
                  </div>
                ) : null}
                <div className="flex gap-3">
                  {actionMode === "purchase" ? (
                    <button onClick={() => void handleAction("mark_purchased")} disabled={submitting}
                      className="rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
                      {submitting ? "Processing..." : "Confirm Purchase"}
                    </button>
                  ) : actionMode === "receipt" ? (
                    <button onClick={() => void handleAction("upload_receipt")} disabled={submitting || !receiptFile}
                      className="rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
                      {submitting ? "Uploading..." : "Upload Receipt"}
                    </button>
                  ) : actionMode === "liquidation" ? (
                    <button onClick={() => void handleAction("upload_liquidation")} disabled={submitting || !liquidationFile}
                      className="rounded-xl bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
                      {submitting ? "Uploading..." : "Upload Liquidation"}
                    </button>
                  ) : null}
                  <button onClick={() => setActionMode(null)} disabled={submitting}
                    className="rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-700 hover:bg-brown-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brown-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-brown-900">{value}</p>
    </div>
  )
}

function CustodianStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "Approved": "bg-emerald-100 text-emerald-700",
    "Waiting Purchase": "bg-blue-100 text-blue-700",
    "Purchased": "bg-indigo-100 text-indigo-700",
    "Ready for Release": "bg-teal-100 text-teal-700",
    "Released": "bg-cyan-100 text-cyan-700",
    "Received": "bg-emerald-100 text-emerald-700",
    "Completed": "bg-emerald-100 text-emerald-700",
  }
  return <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${colors[status] ?? "bg-brown-200 text-brown-700"}`}>{status}</span>
}
