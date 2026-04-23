import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  BellRing,
  Boxes,
  ClipboardCheck,
  MessageSquareText,
  ShieldCheck,
  Warehouse,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card"

type PublicSupply = {
  id: number
  categoryId: number
  categoryName: string
  itemCode: string
  name: string
  description: string
  imagePath: string
  quantityOnHand: number
  createdAt: string | null
  updatedAt: string | null
}

type PublicSuppliesResponse = {
  success: boolean
  categories: string[]
  supplies: PublicSupply[]
  message?: string
}

type AnnouncementRecord = {
  id: number
}

type AnnouncementsResponse = {
  success: boolean
  announcements: AnnouncementRecord[]
  message?: string
}

type OverviewStats = {
  categories: number
  supplies: number
  availableStock: number
  announcements: number
}

const emptyStats: OverviewStats = {
  categories: 0,
  supplies: 0,
  availableStock: 0,
  announcements: 0,
}

export default function SystemOverview() {
  const [stats, setStats] = useState<OverviewStats>(emptyStats)

  useEffect(() => {
    let cancelled = false

    const loadOverview = async () => {
      try {
        const [suppliesResponse, announcementsResponse] = await Promise.all([
          fetch("/api/public-supplies.php"),
          fetch("/api/announcements.php?limit=20"),
        ])

        const suppliesResult = (await suppliesResponse.json()) as PublicSuppliesResponse
        const announcementsResult = (await announcementsResponse.json()) as AnnouncementsResponse

        if (!suppliesResponse.ok || !suppliesResult.success) {
          throw new Error(suppliesResult.message ?? "Unable to load public supply data.")
        }

        if (!announcementsResponse.ok || !announcementsResult.success) {
          throw new Error(announcementsResult.message ?? "Unable to load announcement data.")
        }

        if (cancelled) {
          return
        }

        const supplies = suppliesResult.supplies ?? []

        setStats({
          categories: (suppliesResult.categories ?? []).length,
          supplies: supplies.length,
          availableStock: supplies.reduce((total, supply) => total + (supply.quantityOnHand ?? 0), 0),
          announcements: (announcementsResult.announcements ?? []).length,
        })
      } catch {
        if (!cancelled) {
          setStats(emptyStats)
        }
      }
    }

    void loadOverview()

    return () => {
      cancelled = true
    }
  }, [])

  const overviewCards = useMemo(
    () => [
      {
        icon: <Warehouse className="h-6 w-6" />,
        title: "Supply Visibility",
        description: `${stats.categories} categories and ${stats.supplies} supply items are available from the live public inventory feed.`,
        color: "bg-blue-500",
      },
      {
        icon: <ClipboardCheck className="h-6 w-6" />,
        title: "Request and Issuance",
        description: "Faculty can submit requests, while administrators and property custodians review, approve, issue, and track them.",
        color: "bg-emerald-500",
      },
      {
        icon: <MessageSquareText className="h-6 w-6" />,
        title: "Messages and Notifications",
        description: `${stats.announcements} published announcements plus in-app notifications and direct messaging keep users updated.`,
        color: "bg-amber-500",
      },
      {
        icon: <ShieldCheck className="h-6 w-6" />,
        title: "Role-Based Access",
        description: "The project uses separate workflows for Administrator, Property Custodian, and Faculty Staff accounts.",
        color: "bg-slate-700",
      },
      {
        icon: <Boxes className="h-6 w-6" />,
        title: "Stock Monitoring",
        description: `${stats.availableStock.toLocaleString()} total on-hand quantity is currently represented across database-backed supplies.`,
        color: "bg-indigo-500",
      },
      {
        icon: <BellRing className="h-6 w-6" />,
        title: "Public Updates",
        description: "Announcements posted by admins are published to the home page so users can immediately see current updates.",
        color: "bg-rose-500",
      },
    ],
    [stats],
  )

  return (
    <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
      {overviewCards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.08 }}
          whileHover={{ y: -5 }}
        >
          <Card className="group h-full overflow-hidden rounded-[2rem] border-none bg-white/85 shadow-xl shadow-slate-200/50 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/10">
            <CardHeader className="pb-4">
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${card.color} text-white shadow-lg transition-transform duration-500 group-hover:scale-110`}>
                {card.icon}
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 transition-colors group-hover:text-primary-600">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-slate-600">{card.description}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
