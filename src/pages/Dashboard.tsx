import { AnimatePresence, motion } from "framer-motion"
import dayjs from "dayjs"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowPathIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  EnvelopeIcon,
  MegaphoneIcon,
  PlusIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { LoadingState } from "../components/ui/LoadingStates"
import { StaggerContainer, StaggerItem } from "../components/ui/animations"
import { ToastContainer, type ToastProps } from "../components/ui/Toast"
import { getMessagesPath, getStoredAuthUser } from "../lib/auth"
import type { FacultyRequest, FacultyRequestSummary } from "../types/requests"

type DashboardStats = {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  rejectedRequests: number
  fulfilledRequests: number
}

type MessageContact = {
  id: number
  name: string
  role: string
  email: string
  username: string
  profileImageUrl: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  lastMessageSenderId: number | null
  unreadCount: number
}

type MessageApiResponse = {
  success: boolean
  contacts: MessageContact[]
  message?: string
}

type RequestsResponse = {
  success: boolean
  requests: FacultyRequest[]
  summary: FacultyRequestSummary
  message?: string
}

type Notification = {
  id: string
  title: string
  message: string
  type: "success" | "warning" | "info" | "error"
  time: string
  read: boolean
}

type DashboardData = {
  stats: DashboardStats
  recentRequests: FacultyRequest[]
  messages: MessageContact[]
  notifications: Notification[]
}

const emptySummary: FacultyRequestSummary = {
  totalRequests: 0,
  pendingRequests: 0,
  approvedRequests: 0,
  fulfilledRequests: 0,
  rejectedRequests: 0,
}

const emptyStats: DashboardStats = {
  totalRequests: 0,
  pendingRequests: 0,
  approvedRequests: 0,
  rejectedRequests: 0,
  fulfilledRequests: 0,
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [activeTab, setActiveTab] = useState<"notifications" | "messages">("notifications")
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const authUser = getStoredAuthUser()

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  useEffect(() => {
    let cancelled = false

    const loadDashboard = async (showLoading = false) => {
      if (!authUser?.id || authUser.role !== "Faculty Staff") {
        if (!cancelled) {
          setData({
            stats: emptyStats,
            recentRequests: [],
            messages: [],
            notifications: [],
          })
          setLoading(false)
        }
        return
      }

      if (showLoading) {
        setLoading(true)
      }

      try {
        const requestParams = new URLSearchParams({
          userId: String(authUser.id),
          role: authUser.role,
        })
        const messageParams = new URLSearchParams({
          userId: String(authUser.id),
        })

        const [requestsResponse, messagesResponse] = await Promise.all([
          fetch(`/api/faculty-requests.php?${requestParams.toString()}`),
          fetch(`/api/messages.php?${messageParams.toString()}`),
        ])

        const requestsResult = (await requestsResponse.json()) as RequestsResponse
        const messagesResult = (await messagesResponse.json()) as MessageApiResponse

        if (!requestsResponse.ok || !requestsResult.success) {
          throw new Error(requestsResult.message ?? "Unable to load your supply requests.")
        }

        if (!messagesResponse.ok || !messagesResult.success) {
          throw new Error(messagesResult.message ?? "Unable to load your messages.")
        }

        if (cancelled) {
          return
        }

        const summary = requestsResult.summary ?? emptySummary
        const requests = requestsResult.requests ?? []
        const contacts = (messagesResult.contacts ?? []).filter((contact) => Boolean(contact.lastMessage))

        setData({
          stats: {
            totalRequests: summary.totalRequests,
            pendingRequests: summary.pendingRequests,
            approvedRequests: summary.approvedRequests,
            rejectedRequests: summary.rejectedRequests,
            fulfilledRequests: summary.fulfilledRequests,
          },
          recentRequests: requests.slice(0, 8),
          messages: contacts.slice(0, 8),
          notifications: buildNotifications(requests, contacts, authUser.id).slice(0, 10),
        })
      } catch (error) {
        if (!cancelled) {
          setData({
            stats: emptyStats,
            recentRequests: [],
            messages: [],
            notifications: [],
          })
          setToasts((prev) => [
            ...prev,
            {
              id: `dashboard-error-${Date.now()}`,
              title: "Dashboard Sync Failed",
              message: error instanceof Error ? error.message : "Unable to load dashboard data.",
              type: "error",
              onDismiss: removeToast,
            },
          ])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard(true)

    const intervalId = window.setInterval(() => {
      void loadDashboard(false)
    }, 30000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [authUser?.id, authUser?.role])

  const unreadNotifications = useMemo(
    () => data?.notifications.filter((notification) => !notification.read).length ?? 0,
    [data]
  )
  const unreadMessages = useMemo(
    () => data?.messages.reduce((count, message) => count + message.unreadCount, 0) ?? 0,
    [data]
  )

  if (loading || !data) {
    return (
      <AppShell role="Faculty Staff">
        <div className="space-y-8">
          <div>
            <div className="h-3 w-32 rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-80 max-w-full rounded-2xl bg-slate-200" />
            <div className="mt-3 h-4 w-[32rem] max-w-full rounded-full bg-slate-100" />
            <div className="mt-2 h-4 w-[28rem] max-w-full rounded-full bg-slate-100" />
          </div>
          <LoadingState type="dashboard" />
        </div>
      </AppShell>
    )
  }

  const { stats, recentRequests, messages, notifications } = data

  return (
    <AppShell role="Faculty Staff">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <StaggerContainer className="space-y-8">
        <StaggerItem>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Faculty Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Dashboard and Analytics</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                All values below come directly from your submitted request records and current messaging activity.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <ArrowPathIcon className="mr-2 h-4 w-4" />
                Refresh Data
              </button>
              <Link to="/new-request">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  New Request
                </button>
              </Link>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Total Requests"
              value={stats.totalRequests}
              icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
              tone="blue"
            />
            <MetricCard
              title="Pending"
              value={stats.pendingRequests}
              icon={<ClockIcon className="h-5 w-5" />}
              tone="amber"
            />
            <MetricCard
              title="Approved"
              value={stats.approvedRequests}
              icon={<CheckCircleIcon className="h-5 w-5" />}
              tone="emerald"
            />
            <MetricCard
              title="Rejected"
              value={stats.rejectedRequests}
              icon={<XCircleIcon className="h-5 w-5" />}
              tone="rose"
            />
            <MetricCard
              title="Unread Messages"
              value={unreadMessages}
              icon={<ChatBubbleLeftRightIcon className="h-5 w-5" />}
              tone="indigo"
            />
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Requests</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Request Distribution</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <ClipboardDocumentCheckIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SoftStat label="Total Requests" value={stats.totalRequests} helper="All requests you submitted from the database" />
                <SoftStat label="Pending" value={stats.pendingRequests} helper="Requests still waiting for review or issuance" />
                <SoftStat label="Approved" value={stats.approvedRequests} helper="Requests already approved by the office" />
                <SoftStat label="Fulfilled" value={stats.fulfilledRequests} helper="Requests already completed and released" />
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Communication</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Updates and Messages</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <BellIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <ProgressRow
                  label="Unread notifications"
                  value={unreadNotifications}
                  total={Math.max(notifications.length, 1)}
                  tone="amber"
                />
                <ProgressRow
                  label="Unread messages"
                  value={unreadMessages}
                  total={Math.max(messages.length + unreadMessages, 1)}
                  tone="indigo"
                />
                <ProgressRow
                  label="Completed requests"
                  value={stats.approvedRequests + stats.fulfilledRequests}
                  total={Math.max(stats.totalRequests, 1)}
                  tone="emerald"
                />
              </div>
            </section>
          </div>
        </StaggerItem>

        <StaggerItem>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  {activeTab === "notifications" ? "Updates" : "Messages"}
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                  {activeTab === "notifications" ? "Recent Request Updates" : "Recent Messages"}
                </h2>
              </div>
              <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("notifications")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                    activeTab === "notifications" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <BellIcon className="h-4 w-4" />
                  Notifications
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("messages")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                    activeTab === "messages" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Messages
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <AnimatePresence mode="wait">
                {activeTab === "notifications" ? (
                  <motion.div
                    key="notifications-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {notifications.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                        <p className="text-sm font-semibold text-slate-900">No updates yet</p>
                        <p className="mt-2 text-sm text-slate-500">Request status updates and unread message alerts will appear here.</p>
                      </div>
                    ) : (
                      notifications.map((notification, index) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="flex gap-3">
                              <div
                                className={`mt-1 flex h-10 w-10 items-center justify-center rounded-2xl ${
                                  notification.type === "success"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : notification.type === "warning"
                                      ? "bg-amber-50 text-amber-600"
                                      : notification.type === "error"
                                        ? "bg-rose-50 text-rose-600"
                                        : "bg-blue-50 text-blue-600"
                                }`}
                              >
                                {notification.type === "success" ? <CheckCircleIcon className="h-5 w-5" /> : null}
                                {notification.type === "warning" ? <MegaphoneIcon className="h-5 w-5" /> : null}
                                {notification.type === "error" ? <XCircleIcon className="h-5 w-5" /> : null}
                                {notification.type === "info" ? <BellIcon className="h-5 w-5" /> : null}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-slate-900">{notification.title}</span>
                                  {!notification.read ? (
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                                      New
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-sm text-slate-500">{notification.message}</p>
                                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{notification.time}</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="messages-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {messages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                        <p className="text-sm font-semibold text-slate-900">No conversations yet</p>
                        <p className="mt-2 text-sm text-slate-500">Start a conversation from the message center to see it here.</p>
                      </div>
                    ) : (
                      messages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{message.name}</span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                  {message.role}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500">{message.lastMessage ?? "No messages yet."}</p>
                              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                                {formatRelativeDate(message.lastMessageAt)}
                              </p>
                            </div>
                            <div>
                              {message.unreadCount > 0 ? (
                                <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-700">
                                  {message.unreadCount} unread
                                </span>
                              ) : (
                                <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-600">Read</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                    <Link to={getMessagesPath("Faculty Staff")}>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <EnvelopeIcon className="mr-2 h-4 w-4" />
                        Open Message Center
                      </button>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </StaggerItem>

        <StaggerItem>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">History</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Recent Requests</h2>
              </div>
              <Link to="/my-requests" className="text-sm text-slate-500 transition hover:text-primary-600">
                View all request records
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {recentRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-900">No request records yet</p>
                  <p className="mt-2 text-sm text-slate-500">Once you submit a request, the latest entries will appear here.</p>
                </div>
              ) : (
                recentRequests.map((request, index) => (
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
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                            {request.totalItems} item{request.totalItems === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {request.totalQuantity} total quantity{request.totalQuantity === 1 ? "" : "s"}
                          {request.notes ? ` • ${request.notes}` : ""}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                          {dayjs(request.createdAt).format("MMM D, YYYY h:mm A")}
                        </p>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-sm font-bold ${
                          request.status === "Pending"
                            ? "bg-amber-50 text-amber-700"
                            : request.status === "Approved" || request.status === "Fulfilled"
                              ? "bg-emerald-50 text-emerald-700"
                              : request.status === "Rejected"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {request.status}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {request.items.slice(0, 3).map((item) => (
                        <span key={`${request.id}-${item.supplyId}`} className="rounded-full bg-white px-3 py-1">
                          {item.name} x{item.quantityRequested}
                        </span>
                      ))}
                      {request.items.length > 3 ? (
                        <span className="rounded-full bg-white px-3 py-1">+{request.items.length - 3} more</span>
                      ) : null}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>
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
  icon: React.ReactNode
  tone: "blue" | "amber" | "emerald" | "rose" | "indigo"
}) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
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

function SoftStat({
  label,
  value,
  helper,
}: {
  label: string
  value: number
  helper: string
}) {
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
  tone: "emerald" | "amber" | "indigo"
}) {
  const percentage = Math.max(0, Math.min(100, Math.round((value / total) * 100)))
  const barClass = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    indigo: "bg-indigo-500",
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

function buildNotifications(requests: FacultyRequest[], contacts: MessageContact[], currentUserId: number): Notification[] {
  const requestNotifications = requests.map((request) => ({
    id: `request-${request.id}`,
    title: getRequestNotificationTitle(request.status),
    message: `${request.requestNumber} is currently ${request.status.toLowerCase()}.`,
    type: getRequestNotificationType(request.status),
    time: formatRelativeDate(request.updatedAt),
    read: request.status === "Pending",
    sortTime: toTimestamp(request.updatedAt),
  }))

  const messageNotifications = contacts
    .filter((contact) => contact.unreadCount > 0 && contact.lastMessage)
    .map((contact) => ({
      id: `message-${contact.id}`,
      title: "Unread Message",
      message:
        contact.lastMessageSenderId === currentUserId
          ? `${contact.name} has not replied yet.`
          : `${contact.name}: ${contact.lastMessage}`,
      type: "info" as const,
      time: formatRelativeDate(contact.lastMessageAt),
      read: false,
      sortTime: toTimestamp(contact.lastMessageAt),
    }))

  return [...messageNotifications, ...requestNotifications]
    .sort((left, right) => right.sortTime - left.sortTime)
    .map(({ sortTime: _sortTime, ...notification }) => notification)
}

function getRequestNotificationTitle(status: FacultyRequest["status"]) {
  if (status === "Approved") {
    return "Request Approved"
  }

  if (status === "Rejected") {
    return "Request Rejected"
  }

  if (status === "Fulfilled") {
    return "Request Fulfilled"
  }

  if (status === "Cancelled") {
    return "Request Cancelled"
  }

  return "Request Pending"
}

function getRequestNotificationType(status: FacultyRequest["status"]): Notification["type"] {
  if (status === "Approved" || status === "Fulfilled") {
    return "success"
  }

  if (status === "Rejected" || status === "Cancelled") {
    return "error"
  }

  return "warning"
}

function formatRelativeDate(value: string | null) {
  if (!value) {
    return "No timestamp"
  }

  const parsed = dayjs(value)

  if (!parsed.isValid()) {
    return value
  }

  const diffMinutes = Math.abs(dayjs().diff(parsed, "minute"))

  if (diffMinutes < 1) {
    return "Just now"
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`
  }

  const diffHours = Math.abs(dayjs().diff(parsed, "hour"))

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  }

  return parsed.format("MMM D, YYYY h:mm A")
}

function toTimestamp(value: string | null) {
  if (!value) {
    return 0
  }

  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.valueOf() : 0
}
