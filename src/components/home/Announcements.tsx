import { useEffect, useState } from "react"
import dayjs from "dayjs"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Bell, ArrowRight, Sparkles, AlertCircle, Info } from "lucide-react"
import { Card } from "../ui/Card"
import { Skeleton } from "../ui/Skeleton"

type Announcement = {
  id: number
  title: string
  publishedAt: string
  description: string
  type: "feature" | "maintenance" | "update"
}

type AnnouncementsResponse = {
  success: boolean
  announcements: Announcement[]
  message?: string
}

const getTypeStyles = (type: Announcement["type"]) => {
  switch (type) {
    case "feature":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        icon: <Sparkles className="h-4 w-4" />,
      }
    case "maintenance":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        icon: <AlertCircle className="h-4 w-4" />,
      }
    default:
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        icon: <Info className="h-4 w-4" />,
      }
  }
}

export function SkeletonAnnouncements() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 rounded-3xl bg-white p-4 border border-slate-100">
          <Skeleton height="h-12" width="w-12" className="shrink-0 rounded-2xl" />
          <div className="flex-grow space-y-2">
            <div className="flex justify-between">
              <Skeleton height="h-4" width="w-24" />
              <Skeleton height="h-3" width="w-16" />
            </div>
            <Skeleton height="h-5" width="w-3/4" />
            <Skeleton height="h-4" width="w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Announcements() {
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    let cancelled = false

    const loadAnnouncements = async () => {
      setLoading(true)

      try {
        const response = await fetch("/api/announcements.php?limit=3")
        const result = (await response.json()) as AnnouncementsResponse

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Unable to load announcements.")
        }

        if (!cancelled) {
          setAnnouncements(result.announcements ?? [])
        }
      } catch {
        if (!cancelled) {
          setAnnouncements([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAnnouncements()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <SkeletonAnnouncements />
  }

  if (announcements.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <Bell className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-4 text-sm font-semibold text-slate-900">No announcements yet</p>
        <p className="mt-2 text-sm text-slate-500">Announcements posted by administrators will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {announcements.map((announcement, index) => {
          const styles = getTypeStyles(announcement.type)

          return (
            <motion.div
              key={announcement.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ x: 8 }}
              className="group cursor-pointer"
            >
              <Card className="h-full overflow-hidden rounded-[2rem] border border-slate-100 bg-white transition-all duration-300 hover:border-primary-100 hover:shadow-xl hover:shadow-primary-500/5">
                <div className="flex items-start gap-4 p-5">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles.bg} ${styles.text} transition-transform duration-300 group-hover:scale-110`}>
                    {styles.icon}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}>
                        {announcement.type}
                      </span>
                      <div className="flex items-center text-[10px] font-bold text-slate-400">
                        <Calendar className="mr-1 h-3 w-3" />
                        {dayjs(announcement.publishedAt).format("MMM D, YYYY")}
                      </div>
                    </div>
                    <h3 className="mb-1 line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-primary-600">
                      {announcement.title}
                    </h3>
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{announcement.description}</p>
                  </div>
                  <div className="shrink-0 self-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
