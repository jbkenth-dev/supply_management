import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { ToastContainer, type ToastProps } from "../../components/ui/Toast"
import { StaggerContainer, StaggerItem } from "../../components/ui/animations"
import type { StockEntry } from "../../types/adminInventory"

type DashboardStats = {
  totalUsers: number
  administrators: number
  custodians: number
  facultyStaff: number
  categories: number
  supplies: number
  totalQuantity: number
  outOfStock: number
  lowStock: number
  recentEntries: number
}

type DashboardResponse = {
  success: boolean
  stats: DashboardStats
  recentEntries: StockEntry[]
  message?: string
}

const emptyStats: DashboardStats = {
  totalUsers: 0,
  administrators: 0,
  custodians: 0,
  facultyStaff: 0,
  categories: 0,
  supplies: 0,
  totalQuantity: 0,
  outOfStock: 0,
  lowStock: 0,
  recentEntries: 0,
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [recentEntries, setRecentEntries] = useState<StockEntry[]>([])
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  async function loadDashboard() {
    setLoading(true)

    try {
      const response = await fetch("/api/admin-dashboard.php")
      const result = (await response.json()) as DashboardResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load dashboard data.")
      }

      setStats(result.stats)
      setRecentEntries(result.recentEntries ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load dashboard data."

      setToasts((current) => [
        ...current,
        {
          id: `dashboard-error-${Date.now()}`,
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

  if (loading) {
    return (
      <AppShell role="Administrator">
        <DashboardSkeleton />
      </AppShell>
    )
  }

  return (
    <AppShell role="Administrator">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <StaggerContainer className="space-y-8">
        <StaggerItem>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Admin Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Dashboard and Analytics</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                All values below come directly records for users, categories, supplies, and stock entries.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowPathIcon className="mr-2 h-4 w-4" />
              Refresh Data
            </button>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Categories"
              value={stats.categories}
              icon={<Squares2X2Icon className="h-5 w-5" />}
              tone="blue"
            />
            <MetricCard
              title="Supplies"
              value={stats.supplies}
              icon={<CubeIcon className="h-5 w-5" />}
              tone="slate"
            />
            <MetricCard
              title="Total Stock"
              value={stats.totalQuantity}
              icon={<ArchiveBoxIcon className="h-5 w-5" />}
              tone="emerald"
            />
            <MetricCard
              title="Low Stock"
              value={stats.lowStock}
              icon={<ExclamationTriangleIcon className="h-5 w-5" />}
              tone="amber"
            />
            <MetricCard
              title="Recent Entries"
              value={stats.recentEntries}
              icon={<ArrowDownTrayIcon className="h-5 w-5" />}
              tone="indigo"
            />
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Users</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Account Distribution</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <UsersIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SoftStat label="Total Users" value={stats.totalUsers} helper="All user accounts" />
                <SoftStat label="Administrators" value={stats.administrators} helper="Accounts with full admin access" />
                <SoftStat label="Custodians" value={stats.custodians} helper="Property custodian accounts" />
                <SoftStat label="Faculty Staff" value={stats.facultyStaff} helper="Faculty and staff requester accounts" />
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Stock Health</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Inventory Status</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ClipboardDocumentListIcon className="h-6 w-6" />
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
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">History</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Recent Stock Entries</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {recentEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-900">No stock entries yet</p>
                  <p className="mt-2 text-sm text-slate-500">Once stock is added from the admin stock page, the latest entries will appear here.</p>
                </div>
              ) : (
                recentEntries.map((entry, index) => (
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
                          {entry.categoryName} • Added by {entry.createdByName}
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
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${toneMap[tone]}`}>
          {icon}
        </div>
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

function formatDateTime(value: string) {
  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="h-3 w-32 rounded-full bg-slate-200" />
          <div className="mt-4 h-10 w-80 max-w-full rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-[32rem] max-w-full rounded-full bg-slate-100" />
          <div className="mt-2 h-4 w-[28rem] max-w-full rounded-full bg-slate-100" />
        </div>
        <div className="h-11 w-36 rounded-xl bg-slate-200" />
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
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-3 w-20 rounded-full bg-slate-200" />
              <div className="mt-4 h-8 w-56 rounded-2xl bg-slate-200" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-slate-100" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="h-3 w-24 rounded-full bg-slate-200" />
                <div className="mt-4 h-10 w-16 rounded-2xl bg-slate-200" />
                <div className="mt-3 h-4 w-full rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="mt-4 h-8 w-48 rounded-2xl bg-slate-200" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-slate-100" />
          </div>
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded-full bg-slate-200" />
                  <div className="h-4 w-20 rounded-full bg-slate-200" />
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className="mt-4 h-8 w-60 rounded-2xl bg-slate-200" />
          </div>
          <div className="h-4 w-52 rounded-full bg-slate-100" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="h-4 w-40 rounded-full bg-slate-200" />
                  <div className="mt-3 h-4 w-56 rounded-full bg-slate-100" />
                  <div className="mt-3 h-3 w-32 rounded-full bg-slate-100" />
                </div>
                <div className="h-8 w-16 rounded-full bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
