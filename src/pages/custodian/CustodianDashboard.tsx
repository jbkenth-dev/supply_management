import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline"
import { motion } from "framer-motion"
import AppShell from "../../layout/AppShell"
import { ToastContainer, type ToastProps } from "../../components/ui/Toast"
import { StaggerContainer, StaggerItem } from "../../components/ui/animations"

type DashboardStats = {
  categories: number
  supplies: number
  totalQuantity: number
  outOfStock: number
  lowStock: number
  pendingRequests: number
  approvedRequests: number
  fulfilledToday: number
  recentStockEntries: number
}

type DashboardRequest = {
  id: number
  requestNumber: string
  requestedByName: string
  status: "Pending" | "Approved" | "Rejected" | "Fulfilled" | "Cancelled"
  totalItems: number
  totalQuantity: number
  issuanceSlipNo: string | null
  createdAt: string
  reviewedAt: string | null
  fulfilledAt: string | null
}

type StockEntry = {
  id: number
  supplyId: number
  supplyItemCode: string
  supplyName: string
  categoryName: string
  quantity: number
  referenceNo: string | null
  remarks: string | null
  createdByName: string
  createdAt: string
}

type DashboardResponse = {
  success: boolean
  stats: DashboardStats
  recentRequests: DashboardRequest[]
  recentEntries: StockEntry[]
  message?: string
}

const emptyStats: DashboardStats = {
  categories: 0,
  supplies: 0,
  totalQuantity: 0,
  outOfStock: 0,
  lowStock: 0,
  pendingRequests: 0,
  approvedRequests: 0,
  fulfilledToday: 0,
  recentStockEntries: 0,
}

const REQUESTS_PER_PAGE = 3
const ENTRIES_PER_PAGE = 3

export default function CustodianDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [recentRequests, setRecentRequests] = useState<DashboardRequest[]>([])
  const [recentEntries, setRecentEntries] = useState<StockEntry[]>([])
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const [requestPage, setRequestPage] = useState(1)
  const [entryPage, setEntryPage] = useState(1)

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  async function loadDashboard() {
    setLoading(true)

    try {
      const response = await fetch("/api/custodian-dashboard.php")
      const result = (await response.json()) as DashboardResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load dashboard data.")
      }

      setStats(result.stats ?? emptyStats)
      setRecentRequests(result.recentRequests ?? [])
      setRecentEntries(result.recentEntries ?? [])
      setRequestPage(1)
      setEntryPage(1)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load dashboard data."

      setToasts((current) => [
        ...current,
        {
          id: `custodian-dashboard-error-${Date.now()}`,
          title: "Dashboard Sync Failed",
          message,
          type: "error",
          onDismiss: removeToast,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const requestTotalPages = Math.max(1, Math.ceil(recentRequests.length / REQUESTS_PER_PAGE))
  const entryTotalPages = Math.max(1, Math.ceil(recentEntries.length / ENTRIES_PER_PAGE))
  const paginatedRequests = recentRequests.slice((requestPage - 1) * REQUESTS_PER_PAGE, requestPage * REQUESTS_PER_PAGE)
  const paginatedEntries = recentEntries.slice((entryPage - 1) * ENTRIES_PER_PAGE, entryPage * ENTRIES_PER_PAGE)

  if (loading) {
    return (
      <AppShell role="Property Custodian">
        <DashboardSkeleton />
      </AppShell>
    )
  }

  return (
    <AppShell role="Property Custodian">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <StaggerContainer className="space-y-8">
        <StaggerItem>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Custodian Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Dashboard and Analytics</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Monitor real-time inventory balances, stock entries, and request issuance activity.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ArrowPathIcon className="mr-2 h-4 w-4" />
                Refresh Data
              </button>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Categories" value={stats.categories} icon={<Squares2X2Icon className="h-5 w-5" />} tone="blue" />
            <MetricCard title="Supplies" value={stats.supplies} icon={<CubeIcon className="h-5 w-5" />} tone="slate" />
            <MetricCard title="Total Stock" value={stats.totalQuantity} icon={<ArchiveBoxIcon className="h-5 w-5" />} tone="emerald" />
            <MetricCard title="Pending Requests" value={stats.pendingRequests} icon={<ClipboardDocumentListIcon className="h-5 w-5" />} tone="amber" />
            <MetricCard title="Issued Today" value={stats.fulfilledToday} icon={<CheckBadgeIcon className="h-5 w-5" />} tone="indigo" />
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Requests</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Issuance Pipeline</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <ClipboardDocumentListIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SoftStat label="Pending Requests" value={stats.pendingRequests} helper="Requests waiting for review and action." />
                <SoftStat label="Approved to Issue" value={stats.approvedRequests} helper="Requests already approved and ready for release." />
                <SoftStat label="Issued Today" value={stats.fulfilledToday} helper="Requests completed today based on issuance records." />
                <SoftStat label="Recent Stock Entries" value={stats.recentStockEntries} helper="Latest stock-in logs currently stored in the system." />
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Stock Health</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Inventory Status</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ExclamationTriangleIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <ProgressRow
                  label="Available stock"
                  value={Math.max(stats.supplies - stats.outOfStock, 0)}
                  total={Math.max(stats.supplies, 1)}
                  tone="emerald"
                />
                <ProgressRow
                  label="Low stock items"
                  value={stats.lowStock}
                  total={Math.max(stats.supplies, 1)}
                  tone="amber"
                />
                <ProgressRow
                  label="Out of stock"
                  value={stats.outOfStock}
                  total={Math.max(stats.supplies, 1)}
                  tone="rose"
                />
              </div>
            </section>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Requests</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Recent Request Activity</h2>
                </div>
                <p className="text-sm text-slate-500">Latest supply requests and issuance updates.</p>
              </div>

              <div className="mt-6 space-y-3">
                {recentRequests.length === 0 ? (
                  <EmptyState
                    title="No request activity yet"
                    description="Once faculty requests are submitted or reviewed, the latest records will appear here."
                  />
                ) : (
                  paginatedRequests.map((request, index) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{request.requestNumber}</span>
                            <StatusBadge status={request.status} />
                            {request.issuanceSlipNo ? (
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                                {request.issuanceSlipNo}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            {request.requestedByName || "Faculty request"} - {request.totalItems} item{request.totalItems === 1 ? "" : "s"} - Quantity{" "}
                            {request.totalQuantity}
                          </p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                            {formatRequestDate(request)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {recentRequests.length > 0 ? (
                <PaginationControls
                  currentPage={requestPage}
                  totalPages={requestTotalPages}
                  totalItems={recentRequests.length}
                  pageSize={REQUESTS_PER_PAGE}
                  itemLabel="requests"
                  onPageChange={setRequestPage}
                />
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">History</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Recent Stock Entries</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {recentEntries.length === 0 ? (
                  <EmptyState
                    title="No stock entries yet"
                    description="Once stock is added from the stock page, the latest entries will appear here."
                  />
                ) : (
                  paginatedEntries.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{entry.supplyName}</span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                              {entry.supplyItemCode}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            {entry.categoryName} - Added by {entry.createdByName}
                          </p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                          +{entry.quantity.toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        {entry.referenceNo ? <span className="rounded-full bg-white px-3 py-1">Ref: {entry.referenceNo}</span> : null}
                        {entry.remarks ? <span className="rounded-full bg-white px-3 py-1">{entry.remarks}</span> : null}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {recentEntries.length > 0 ? (
                <PaginationControls
                  currentPage={entryPage}
                  totalPages={entryTotalPages}
                  totalItems={recentEntries.length}
                  pageSize={ENTRIES_PER_PAGE}
                  itemLabel="entries"
                  onPageChange={setEntryPage}
                />
              ) : null}
            </section>
          </div>
        </StaggerItem>

      </StaggerContainer>
    </AppShell>
  )
}

function MetricCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string
  value: number
  icon: ReactNode
  tone: "blue" | "slate" | "emerald" | "amber" | "indigo"
}) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{title}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneMap[tone]}`}>{icon}</div>
      </div>
      <p className="mt-4 text-3xl font-black tracking-tight text-slate-900">{value.toLocaleString()}</p>
    </div>
  )
}

function SoftStat({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value.toLocaleString()}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: "emerald" | "amber" | "rose"
}) {
  const percentage = Math.max(0, Math.min(100, Math.round((value / total) * 100)))
  const barClass = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-sm font-bold text-slate-900">
          {value.toLocaleString()} / {total.toLocaleString()}
        </p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${barClass[tone]}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: DashboardRequest["status"] }) {
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

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${className}`}>{status}</span>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
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

function formatDateTime(value: string) {
  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function formatRequestDate(request: DashboardRequest) {
  if (request.fulfilledAt) {
    return `Issued ${formatDateTime(request.fulfilledAt)}`
  }

  if (request.reviewedAt) {
    return `Reviewed ${formatDateTime(request.reviewedAt)}`
  }

  return `Submitted ${formatDateTime(request.createdAt)}`
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="h-3 w-40 rounded-full bg-slate-200" />
          <div className="mt-4 h-10 w-80 max-w-full rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-[34rem] max-w-full rounded-full bg-slate-100" />
          <div className="mt-2 h-4 w-[28rem] max-w-full rounded-full bg-slate-100" />
        </div>
        <div className="flex gap-3">
          <div className="h-11 w-36 rounded-xl bg-slate-200" />
          <div className="h-11 w-36 rounded-xl bg-slate-200" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="h-10 w-10 rounded-2xl bg-slate-100" />
            </div>
            <div className="mt-4 h-10 w-20 rounded-2xl bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-3 w-20 rounded-full bg-slate-200" />
                <div className="mt-4 h-8 w-56 rounded-2xl bg-slate-200" />
              </div>
              <div className="h-12 w-12 rounded-2xl bg-slate-100" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((__, statIndex) => (
                <div key={statIndex} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="h-3 w-24 rounded-full bg-slate-200" />
                  <div className="mt-4 h-10 w-16 rounded-2xl bg-slate-200" />
                  <div className="mt-3 h-4 w-full rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className="mt-4 h-8 w-60 rounded-2xl bg-slate-200" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 4 }).map((__, cardIndex) => (
                <div key={cardIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="h-4 w-40 rounded-full bg-slate-200" />
                  <div className="mt-3 h-4 w-56 rounded-full bg-slate-100" />
                  <div className="mt-3 h-3 w-32 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
