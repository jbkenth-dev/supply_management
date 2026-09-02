import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline"
import ApprovalPersonnelShell from "../layout/ApprovalPersonnelShell"
import { MessageModal } from "../components/ui/MessageModal"
import { StaggerContainer, StaggerItem } from "../components/ui/animations"
import { api } from "../lib/api"
import { formatDateTimeShort, formatDateShort } from "../lib/date"
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
  requestNumber: string
  requesterName: string
  requestId: number
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
  approvalStats: {
    approved: number
    rejected: number
  }
  message?: string
}

export default function ApprovalPersonnelDashboard() {
  const authUser = getStoredAuthUser()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [approvalHistory, setApprovalHistory] = useState<ApprovalLog[]>([])
  const [approvalStats, setApprovalStats] = useState({ approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"success" | "error">("error")

  useEffect(() => {
    if (!authUser?.id || !authUser.role) {
      navigate("/auth/login", { replace: true })
    }
  }, [authUser, navigate])

  const loadData = async () => {
    if (!authUser?.id) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId: String(authUser.id),
        role: authUser.role,
      })
      const res = await api(`/api/approval-workflow.php?${params.toString()}`)
      const result = (await res.json()) as ApprovalApiResponse
      if (!res.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load dashboard data.")
      }
      setRequests(result.requests)
      setApprovalHistory(result.approvalHistory)
      setApprovalStats(result.approvalStats)
    } catch {
      setRequests([])
      setApprovalHistory([])
      setApprovalStats({ approved: 0, rejected: 0 })
      setModalTitle("Load Failed")
      setModalMessage("Unable to load dashboard data.")
      setModalType("error")
      setShowModal(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [authUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [requests])

  const stats = useMemo(() => {
    const totalAmount = requests.reduce((sum, r) => sum + (r.grandTotal ?? 0), 0)

    return {
      pendingCount: requests.length,
      approvedCount: approvalStats.approved,
      rejectedCount: approvalStats.rejected,
      totalProcessed: approvalStats.approved + approvalStats.rejected,
      totalAmount,
    }
  }, [requests, approvalStats])

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
              <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">Dashboard & Analytics</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
                Overview of your approval queue, processed requests, and activity history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm font-semibold text-brown-700 transition hover:border-brown-300 hover:bg-brown-50"
            >
              <ArrowPathIcon className="mr-2 h-4 w-4" />
              Refresh Data
            </button>
          </div>
        </StaggerItem>

        {/* Metric Cards */}
        <StaggerItem>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Pending Requests"
              value={stats.pendingCount}
              icon={<ClockIcon className="h-5 w-5" />}
              tone="amber"
            />
            <MetricCard
              title="Approved"
              value={stats.approvedCount}
              icon={<CheckCircleIcon className="h-5 w-5" />}
              tone="emerald"
            />
            <MetricCard
              title="Rejected"
              value={stats.rejectedCount}
              icon={<XCircleIcon className="h-5 w-5" />}
              tone="rose"
            />
            <MetricCard
              title="Total Processed"
              value={stats.totalProcessed}
              icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
              tone="blue"
            />
          </div>
        </StaggerItem>

        {/* Pending Queue + Approval History side by side */}
        <StaggerItem>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            {/* Pending Requests */}
            <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Approval Queue</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">
                    Pending Your Review
                    {stats.pendingCount > 0 ? (
                      <span className="ml-3 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                        {stats.pendingCount}
                      </span>
                    ) : null}
                  </h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <ClockIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6">
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse rounded-2xl border border-brown-200 bg-brown-50 p-5">
                        <div className="h-4 w-24 rounded-full bg-brown-200" />
                        <div className="mt-3 h-5 w-48 rounded-full bg-brown-200" />
                        <div className="mt-3 h-3 w-full rounded-full bg-brown-100" />
                      </div>
                    ))}
                  </div>
                ) : sortedRequests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brown-200 bg-brown-50 px-5 py-10 text-center">
                    <ClipboardDocumentCheckIcon className="mx-auto h-10 w-10 text-brown-300" />
                    <p className="mt-3 text-sm font-semibold text-brown-900">All caught up!</p>
                    <p className="mt-2 text-sm text-brown-500">No requests pending your approval.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedRequests.slice(0, 5).map((request) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-brown-200 bg-brown-50 p-4 transition hover:shadow-md cursor-pointer"
                        onClick={() => navigate("/approval-personnel/all-request")}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-brown-500">
                                {request.requestNumber}
                              </span>
                              <StatusBadge status={request.status} />
                            </div>
                            <p className="mt-2 text-sm text-brown-500">
                              By <span className="font-semibold text-brown-700">{request.requestedByName}</span>
                              {" · "}
                              {formatDateTimeShort(request.createdAt)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Total</p>
                            <p className="text-lg font-black text-primary-700">₱{(request.grandTotal ?? 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {request.department ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs text-brown-600">
                              <span className="font-semibold text-brown-700">Dept:</span> {request.department}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-white px-3 py-1 text-xs text-brown-600">
                            <span className="font-semibold text-brown-700">Items:</span> {request.totalItems}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                    {sortedRequests.length > 5 ? (
                      <button
                        type="button"
                        onClick={() => navigate("/approval-personnel/all-request")}
                        className="w-full rounded-2xl border border-dashed border-primary-200 bg-primary-50 px-4 py-3 text-sm font-bold text-primary-700 transition hover:bg-primary-100"
                      >
                        View all {sortedRequests.length} pending requests →
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            {/* Approval History */}
            <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">History</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Recent Activity</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <ClipboardDocumentCheckIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse rounded-2xl border border-brown-200 bg-brown-50 p-4">
                        <div className="h-4 w-32 rounded-full bg-brown-200" />
                        <div className="mt-2 h-3 w-48 rounded-full bg-brown-100" />
                      </div>
                    ))}
                  </div>
                ) : approvalHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brown-200 bg-brown-50 px-5 py-10 text-center">
                    <CheckCircleIcon className="mx-auto h-10 w-10 text-brown-300" />
                    <p className="mt-3 text-sm font-semibold text-brown-900">No history yet</p>
                    <p className="mt-2 text-sm text-brown-500">Your approval actions will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvalHistory.slice(0, 8).map((log) => (
                      <div key={log.id} className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-brown-900">{log.requestNumber}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                                  log.action === "approved"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {log.action}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-brown-500">
                              {log.requesterName}
                            </p>
                            {log.remarks ? (
                              <p className="mt-1 text-xs text-brown-400 line-clamp-1">"{log.remarks}"</p>
                            ) : null}
                          </div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brown-400 whitespace-nowrap">
                            {formatDateShort(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </ApprovalPersonnelShell>
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
  icon: React.ReactNode
  tone: "amber" | "emerald" | "rose" | "blue"
}) {
  const toneMap = {
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    blue: "bg-primary-50 text-primary-600 border-primary-100",
  }

  return (
    <div className="rounded-[1.5rem] border border-brown-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brown-400">{title}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneMap[tone]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-3xl font-black tracking-tight text-brown-900">{value.toLocaleString()}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    "Pending Immediate Head": "bg-amber-100 text-amber-700",
    "Pending Resource Planning Officer": "bg-amber-200 text-amber-800",
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
