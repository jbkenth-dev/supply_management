import { Fragment, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { Dialog, Transition } from "@headlessui/react"
import { motion } from "framer-motion"
import {
  Bars3Icon,
  BellIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CubeIcon,
  ListBulletIcon,
  DocumentChartBarIcon,
  UsersIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  PlusCircleIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  MegaphoneIcon,
  UserCircleIcon
} from "@heroicons/react/24/outline"
import { clearStoredAuthUser, getDashboardPath, getMessagesPath, getMyAccountPath, getNotificationPath, getStoredAuthUser, getUserDisplayName, type AuthRole, type AuthUser } from "../lib/auth"
import type { AppNotification, NotificationsResponse } from "../types/notifications"

type Props = {
  children: ReactNode
  role?: AuthRole
}

const adminNavGroups = [
  {
    name: "Overview",
    items: [
      { name: "Dashboard", to: "/admin/dashboard", icon: ChartBarIcon },
      { name: "Messages", to: "/admin/message", icon: ChatBubbleLeftRightIcon },
      { name: "Request & Issuance", to: "/admin/request-issuance", icon: DocumentChartBarIcon },
    ]
  },
  {
    name: "Inventory",
    items: [
      { name: "Supply", to: "/admin/supply", icon: CubeIcon },
      { name: "Stock", to: "/admin/stock", icon: ListBulletIcon },
    ]
  },
  {
    name: "System",
    items: [
      { name: "Announcements", to: "/admin/announcements", icon: MegaphoneIcon },
      { name: "Users", to: "/admin/users", icon: UsersIcon },
      { name: "My Account", to: "/admin/my-account", icon: UserCircleIcon },
    ]
  }
]

const custodianNavGroups = [
  {
    name: "Overview",
    items: [
      { name: "Dashboard", to: "/custodian/dashboard", icon: ChartBarIcon },
      { name: "Messages", to: "/custodian/message", icon: ChatBubbleLeftRightIcon },
      { name: "Request & Issuance", to: "/custodian/request-issuance", icon: DocumentChartBarIcon },
    ]
  },
  {
    name: "Inventory",
    items: [
      { name: "Supply", to: "/custodian/supply", icon: CubeIcon },
      { name: "Stock", to: "/custodian/stock", icon: ListBulletIcon },
    ]
  },
  {
    name: "Operations",
    items: [
      { name: "My Account", to: "/custodian/my-account", icon: UserCircleIcon },
    ]
  }
]

const facultyNavGroups = [
  {
    name: "Overview",
    items: [
      { name: "Dashboard", to: "/dashboard", icon: ChartBarIcon },
      { name: "Messages", to: "/message", icon: ChatBubbleLeftRightIcon },
    ]
  },
  {
    name: "Requests",
    items: [
      { name: "New Request", to: "/new-request", icon: PlusCircleIcon },
      { name: "My Requests", to: "/my-requests", icon: ClipboardDocumentCheckIcon },
    ]
  },
  {
    name: "Account",
    items: [
      { name: "My Account", to: "/my-account", icon: UserCircleIcon },
    ]
  }
]

function SidebarContent({
  role = "Faculty Staff",
  user,
  onLogout,
  onOpenAccount,
}: {
  role?: AuthRole
  user: AuthUser | null
  onLogout: () => void
  onOpenAccount: () => void
}) {
  const navGroups =
    role === "Faculty Staff"
      ? facultyNavGroups
      : role === "Property Custodian"
        ? custodianNavGroups
        : adminNavGroups

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
      <div className="flex h-16 flex-shrink-0 items-center px-6 border-b border-gray-100 gap-3">
        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm">
          <img
            src="/sfcg-logo.jpg"
            alt="SFC-G Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          SFC-G
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {navGroups.map((group) => (
          <div key={group.name}>
            <div className="flex items-center gap-2 px-2 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group.name}</span>
              <div className="h-px bg-gray-100 flex-1" />
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  state={{ role }}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-700 shadow-sm"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={`h-5 w-5 flex-shrink-0 transition-colors ${
                          isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                        }`}
                      />
                      <span className="flex-1">{item.name}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeSidebar"
                          className="absolute left-0 h-full w-1 bg-blue-600 rounded-r-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-gray-200 p-4 space-y-3">
        <button
          type="button"
          onClick={onOpenAccount}
          className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition-all duration-200 hover:border-gray-100 hover:bg-gray-50 hover:shadow-sm group"
        >
          <div className="relative">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={getUserDisplayName(user, role)}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100 transition-all group-hover:ring-blue-100"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 font-bold uppercase text-blue-700 ring-2 ring-gray-100 transition-all group-hover:ring-blue-100">
                {user?.firstname?.[0] ?? role[0]}
              </div>
            )}
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
              {getUserDisplayName(user, role)}
            </p>
            <p className="text-xs text-gray-500 truncate font-medium">{role}</p>
          </div>
          <ArrowTopRightOnSquareIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  )
}

export default function AppShell({ children, role = "Faculty Staff" }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser())
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const notificationMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const storedUser = getStoredAuthUser()

    if (!storedUser) {
      navigate("/auth/login", { replace: true })
      return
    }

    if (storedUser.role !== role) {
      const currentMessagePaths = ["/message", "/custodian/message", "/admin/message"]
      const fallbackPath = currentMessagePaths.includes(location.pathname)
        ? getMessagesPath(storedUser.role)
        : getDashboardPath(storedUser.role)

      navigate(fallbackPath, { replace: true })
      return
    }

    setAuthUser(storedUser)
  }, [location.pathname, navigate, role])

  useEffect(() => {
    if (!authUser?.id || authUser.role !== role) {
      setNotifications([])
      setUnreadNotificationCount(0)
      return
    }

    let cancelled = false

    const loadNotifications = async () => {
      try {
        const params = new URLSearchParams({
          userId: String(authUser.id),
          role: authUser.role,
          limit: "6",
        })
        const response = await fetch(`/api/notifications.php?${params.toString()}`)
        const result = (await response.json()) as NotificationsResponse

        if (!response.ok || !result.success || cancelled) {
          return
        }

        setNotifications(result.notifications ?? [])
        setUnreadNotificationCount(result.unreadCount ?? 0)
      } catch {
        if (!cancelled) {
          setNotifications([])
          setUnreadNotificationCount(0)
        }
      }
    }

    void loadNotifications()
    const intervalId = window.setInterval(() => {
      void loadNotifications()
    }, 30000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [authUser?.id, authUser?.role, role])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!notificationMenuRef.current) {
        return
      }

      if (!notificationMenuRef.current.contains(event.target as Node)) {
        setNotificationMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleDocumentClick)

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick)
    }
  }, [])

  const handleLogout = () => {
    clearStoredAuthUser()
    setAuthUser(null)
    setSidebarOpen(false)
    navigate("/auth/login", { replace: true })
  }

  const handleOpenAccount = () => {
    setSidebarOpen(false)
    navigate(getMyAccountPath(role))
  }

  const handleOpenNotificationsPage = () => {
    setNotificationMenuOpen(false)
    navigate(getNotificationPath(role))
  }

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!authUser?.id) {
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
          setNotifications(result.notifications.slice(0, 6) ?? [])
          setUnreadNotificationCount(result.unreadCount ?? 0)
        }
      } catch {
        // Keep navigation responsive even if mark-as-read fails.
      }
    }

    setNotificationMenuOpen(false)
    navigate(notification.actionUrl)
  }

  const handleMarkAllNotificationsRead = async () => {
    if (!authUser?.id || unreadNotificationCount === 0) {
      return
    }

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

      if (response.ok && result.success) {
        setNotifications(result.notifications.slice(0, 6) ?? [])
        setUnreadNotificationCount(result.unreadCount ?? 0)
      }
    } catch {
      // Silent fallback keeps the header simple.
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent role={role} user={authUser} onLogout={handleLogout} onOpenAccount={handleOpenAccount} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent role={role} user={authUser} onLogout={handleLogout} onOpenAccount={handleOpenAccount} />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:pl-72 transition-all duration-300">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white/80 backdrop-blur-lg px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notifications */}
              <div className="relative" ref={notificationMenuRef}>
                <button
                  type="button"
                  className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 relative"
                  onClick={() => setNotificationMenuOpen((current) => !current)}
                >
                  <span className="sr-only">View notifications</span>
                  <BellIcon className="h-6 w-6" aria-hidden="true" />
                  {unreadNotificationCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-white">
                      {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                    </span>
                  ) : null}
                </button>

                {notificationMenuOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-[24rem] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notifications</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{unreadNotificationCount} unread</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleMarkAllNotificationsRead()}
                        disabled={unreadNotificationCount === 0}
                        className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        Mark all
                      </button>
                    </div>

                    <div className="max-h-[26rem] overflow-y-auto p-3">
                      {notifications.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                          <BellIcon className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-3 text-sm font-semibold text-slate-900">No notifications yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => void handleNotificationClick(notification)}
                              className={`w-full rounded-2xl border p-4 text-left transition ${
                                notification.isRead
                                  ? "border-slate-200 bg-white hover:bg-slate-50"
                                  : "border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${getNotificationToneClass(notification.type)}`}>
                                  <HeaderNotificationIcon type={notification.type} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={`truncate text-sm text-slate-900 ${notification.isRead ? "font-normal" : "font-black"}`}>{notification.title}</p>
                                    {!notification.isRead ? (
                                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
                                        New
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className={`mt-1 line-clamp-2 text-sm ${notification.isRead ? "font-normal text-slate-500" : "font-black text-slate-700"}`}>
                                    {notification.message}
                                  </p>
                                  <p
                                    className={`mt-2 text-[11px] uppercase tracking-[0.18em] ${
                                      notification.isRead ? "font-normal text-slate-400" : "font-black text-blue-600"
                                    }`}
                                  >
                                    {formatNotificationTime(notification.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 p-3">
                      <button
                        type="button"
                        onClick={handleOpenNotificationsPage}
                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        Open Notification Center
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Separator */}
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />

              {/* Profile dropdown (Simplified for now since it's in sidebar too, but good for mobile/desktop parity or quick actions) */}
              <div className="flex items-center gap-x-4 lg:hidden">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                  JD
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}

function HeaderNotificationIcon({ type }: { type: string }) {
  if (type === "request_approved" || type === "request_fulfilled") {
    return <CheckCircleIcon className="h-5 w-5" />
  }

  if (type === "request_submitted") {
    return <MegaphoneIcon className="h-5 w-5" />
  }

  return <BellIcon className="h-5 w-5" />
}

function getNotificationToneClass(type: string) {
  if (type === "request_approved" || type === "request_fulfilled") {
    return "bg-emerald-50 text-emerald-600"
  }

  if (type === "request_submitted") {
    return "bg-blue-50 text-blue-600"
  }

  if (type === "request_rejected") {
    return "bg-rose-50 text-rose-600"
  }

  return "bg-slate-100 text-slate-600"
}

function formatNotificationTime(value: string) {
  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}
