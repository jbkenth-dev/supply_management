import { useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
import { useNavigate } from "react-router-dom"
import {
  BellIcon,
  CheckCircleIcon,
  MegaphoneIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { getStoredAuthUser, type AuthRole } from "../../lib/auth"
import type { AppNotification, NotificationsResponse } from "../../types/notifications"

const typeClassMap: Record<string, string> = {
  request_submitted: "bg-blue-50 text-blue-600",
  request_approved: "bg-emerald-50 text-emerald-600",
  request_rejected: "bg-rose-50 text-rose-600",
  request_fulfilled: "bg-emerald-50 text-emerald-600",
}

export default function NotificationPage({ role }: { role: AuthRole }) {
  const authUser = getStoredAuthUser()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const groupedNotifications = useMemo(() => notifications, [notifications])

  useEffect(() => {
    void loadNotifications(true)
  }, [authUser?.id, authUser?.role, role])

  async function loadNotifications(showLoading = false) {
    if (!authUser?.id || authUser.role !== role) {
      setLoading(false)
      return
    }

    if (showLoading) {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams({
        userId: String(authUser.id),
        role: authUser.role,
        limit: "100",
      })
      const response = await fetch(`/api/notifications.php?${params.toString()}`)
      const result = (await response.json()) as NotificationsResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load notifications.")
      }

      setNotifications(result.notifications ?? [])
      setUnreadCount(result.unreadCount ?? 0)
      setMessage("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load notifications.")
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  async function markAllAsRead() {
    if (!authUser?.id || authUser.role !== role) {
      return
    }

    setBusy(true)

    try {
      const response = await fetch("/api/notifications.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "mark_all_read",
          userId: authUser.id,
          role: authUser.role,
        }),
      })
      const result = (await response.json()) as NotificationsResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update notifications.")
      }

      setNotifications(result.notifications ?? [])
      setUnreadCount(result.unreadCount ?? 0)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update notifications.")
    } finally {
      setBusy(false)
    }
  }

  async function openNotification(notification: AppNotification) {
    if (!authUser?.id || authUser.role !== role) {
      return
    }

    if (!notification.isRead) {
      try {
        const response = await fetch("/api/notifications.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "mark_read",
            notificationId: notification.id,
            userId: authUser.id,
            role: authUser.role,
          }),
        })
        const result = (await response.json()) as NotificationsResponse

        if (response.ok && result.success) {
          setNotifications(result.notifications ?? [])
          setUnreadCount(result.unreadCount ?? 0)
        }
      } catch {
        // Preserve navigation even if read state fails to update.
      }
    }

    navigate(notification.actionUrl)
  }

  return (
    <AppShell role={role}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Notifications</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Notification Center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Review the latest request alerts and workflow updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700">
              {unreadCount} unread
            </div>
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={busy || unreadCount === 0}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mark All as Read
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {message}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : groupedNotifications.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <BellIcon className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-4 text-sm font-semibold text-slate-900">No notifications yet</p>
              <p className="mt-2 text-sm text-slate-500">New request and workflow updates will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`block rounded-[1.5rem] border p-5 transition ${
                    notification.isRead
                      ? "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      : "border-blue-200 bg-blue-50/40 hover:border-blue-300 hover:bg-blue-50/70"
                  } w-full text-left`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${typeClassMap[notification.type] ?? "bg-slate-100 text-slate-600"}`}>
                        <NotificationIcon type={notification.type} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-black tracking-tight text-slate-900">{notification.title}</span>
                          {!notification.isRead ? (
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                              New
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                          {formatDateTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">{notification.actorName || "System"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "request_approved" || type === "request_fulfilled") {
    return <CheckCircleIcon className="h-6 w-6" />
  }

  if (type === "request_rejected") {
    return <XCircleIcon className="h-6 w-6" />
  }

  if (type === "request_submitted") {
    return <MegaphoneIcon className="h-6 w-6" />
  }

  return <BellIcon className="h-6 w-6" />
}

function formatDateTime(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format("MMMM D, YYYY h:mm A") : value
}
