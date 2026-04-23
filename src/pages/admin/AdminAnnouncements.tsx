import { useEffect, useMemo, useState } from "react"
import dayjs from "dayjs"
import { MegaphoneIcon, SparklesIcon, WrenchScrewdriverIcon, InformationCircleIcon } from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { ToastContainer, type ToastProps } from "../../components/ui/Toast"
import { getStoredAuthUser } from "../../lib/auth"

type AnnouncementType = "feature" | "maintenance" | "update"

type AnnouncementRecord = {
  id: number
  title: string
  description: string
  type: AnnouncementType
  publishedAt: string
  createdAt: string
  updatedAt: string
  createdByName: string
}

type AnnouncementsResponse = {
  success: boolean
  announcements: AnnouncementRecord[]
  message?: string
  errors?: Record<string, string>
}

const initialForm = {
  title: "",
  description: "",
}

export default function AdminAnnouncements() {
  const authUser = getStoredAuthUser()
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const [statusMessage, setStatusMessage] = useState("")
  const [statusType, setStatusType] = useState<"success" | "error" | "">("")

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  const pushToast = (title: string, message: string, type: ToastProps["type"]) => {
    setToasts((current) => [
      ...current,
      {
        id: `announcement-toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        message,
        type,
        onDismiss: removeToast,
      },
    ])
  }

  const recentAnnouncements = useMemo(() => announcements.slice(0, 10), [announcements])

  useEffect(() => {
    void loadAnnouncements()
  }, [])

  useEffect(() => {
    if (!statusMessage) {
      return
    }

    const timer = window.setTimeout(() => {
      setStatusMessage("")
      setStatusType("")
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [statusMessage])

  async function loadAnnouncements() {
    setLoading(true)

    try {
      const response = await fetch("/api/announcements.php?includeAll=true&limit=20")
      const result = (await response.json()) as AnnouncementsResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load announcements.")
      }

      setAnnouncements(result.announcements ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load announcements."
      setStatusMessage(message)
      setStatusType("error")
      pushToast("Announcement Sync Failed", message, "error")
    } finally {
      setLoading(false)
    }
  }

  async function submitAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!authUser?.id || authUser.role !== "Administrator") {
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const response = await fetch("/api/announcements.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
                  ...form,
                  type: "update",
                  userId: authUser.id,
                  role: authUser.role,
                }),
      })
      const result = (await response.json()) as AnnouncementsResponse

      if (!response.ok || !result.success) {
        if (result.errors) {
          setErrors(result.errors)
        }

        throw new Error(result.message ?? "Unable to post announcement.")
      }

      setAnnouncements(result.announcements ?? [])
      setForm(initialForm)
      setStatusMessage(result.message ?? "Announcement posted successfully.")
      setStatusType("success")
      pushToast("Announcement Posted", result.message ?? "Announcement posted successfully.", "success")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post announcement."
      setStatusMessage(message)
      setStatusType("error")
      pushToast("Announcement Failed", message, "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell role="Administrator">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Admin Announcements</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Announcements</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Post announcements and publish directly to the public home page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAnnouncements()}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Refresh Data
          </button>
        </div>

        {statusMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              statusType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <MegaphoneIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Compose</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Post Announcement</h2>
              </div>
            </div>

            <form onSubmit={submitAnnouncement} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Enter announcement title"
                />
                {errors.title ? <p className="mt-2 text-sm text-rose-600">{errors.title}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={6}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Write the full announcement message"
                />
                {errors.description ? <p className="mt-2 text-sm text-rose-600">{errors.description}</p> : null}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Posting..." : "Post Announcement"}
              </button>
            </form>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Published</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Latest Announcements</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                {announcements.length} total
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                ))
              ) : recentAnnouncements.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-900">No announcements yet</p>
                  <p className="mt-2 text-sm text-slate-500">Posted announcements will appear here and on the public home page.</p>
                </div>
              ) : (
                recentAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${getAnnouncementToneClass(announcement.type)}`}>
                          <AnnouncementIcon type={announcement.type} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black text-slate-900">{announcement.title}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${getAnnouncementBadgeClass(announcement.type)}`}>
                              {announcement.type}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-500">{announcement.description}</p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                            Published {dayjs(announcement.publishedAt).format("MMMM D, YYYY h:mm A")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <p>By {announcement.createdByName || "Administrator"}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function AnnouncementIcon({ type }: { type: AnnouncementType }) {
  if (type === "feature") {
    return <SparklesIcon className="h-5 w-5" />
  }

  if (type === "maintenance") {
    return <WrenchScrewdriverIcon className="h-5 w-5" />
  }

  return <InformationCircleIcon className="h-5 w-5" />
}

function getAnnouncementToneClass(type: AnnouncementType) {
  if (type === "feature") {
    return "bg-blue-50 text-blue-600"
  }

  if (type === "maintenance") {
    return "bg-amber-50 text-amber-600"
  }

  return "bg-emerald-50 text-emerald-600"
}

function getAnnouncementBadgeClass(type: AnnouncementType) {
  if (type === "feature") {
    return "bg-blue-100 text-blue-700"
  }

  if (type === "maintenance") {
    return "bg-amber-100 text-amber-700"
  }

  return "bg-emerald-100 text-emerald-700"
}
