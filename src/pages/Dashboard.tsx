import AppShell from "../layout/AppShell"
import { items } from "../data/items"
import { transactions } from "../data/transactions"
import { suppliers } from "../data/suppliers"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import dayjs from "dayjs"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { StaggerContainer, StaggerItem } from "../components/ui/animations"
import { StatCard, Card } from "../components/ui"
import { LoadingState } from "../components/ui/LoadingStates"
import type { Item } from "../data/items"
import {
  CubeIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon
} from "@heroicons/react/24/outline"

type DashboardTotals = {
  totalItems: number
  totalSuppliers: number
  totalQty: number
  lowStock: number
  outOfStock: number
}

type InOutDailyPoint = {
  date: string
  in: number
  out: number
}

type MonthlyUsagePoint = {
  month: string
  usage: number
}

type DashboardData = {
  totals: DashboardTotals
  inOutDaily: InOutDailyPoint[]
  monthlyUsage: MonthlyUsagePoint[]
  recentlyAdded: Item[]
  lowAlerts: Item[]
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setDashboardData({
        totals: {
          totalItems: items.length,
          totalSuppliers: suppliers.length,
          totalQty: items.reduce((sum, i) => sum + i.quantity, 0),
          lowStock: items.filter((i) => i.status === "Low").length,
          outOfStock: items.filter((i) => i.status === "Out").length,
        },
        inOutDaily: aggregateInOut(14),
        monthlyUsage: aggregateMonthlyUsage(6),
        recentlyAdded: items.slice(0, 4),
        lowAlerts: items.filter((i) => i.status !== "In Stock")
      })
      setLoading(false)
    }, 2000) // 2 second delay to show loading state

    return () => clearTimeout(timer)
  }, [])

  if (loading || !dashboardData) {
    return (
      <AppShell>
        <LoadingState type="dashboard" />
      </AppShell>
    )
  }

  const { totals, inOutDaily, monthlyUsage, recentlyAdded, lowAlerts } = dashboardData

  return (
    <AppShell>
      <StaggerContainer className="space-y-6">
        {/* Stats Cards */}
        <StaggerItem>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <motion.div whileHover={{ scale: 1.02 }}>
              <StatCard
                title="Total Items"
                value={totals.totalItems.toString()}
                icon={<CubeIcon className="h-6 w-6 text-blue-600" />}
                trend={{ value: "+2.5%", isPositive: true }}
              />
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }}>
              <StatCard
                title="Total Quantity"
                value={totals.totalQty.toLocaleString()}
                icon={<ArrowTrendingUpIcon className="h-6 w-6 text-green-600" />}
                trend={{ value: "+12%", isPositive: true }}
              />
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }}>
              <StatCard
                title="Suppliers"
                value={totals.totalSuppliers.toString()}
                icon={<UsersIcon className="h-6 w-6 text-purple-600" />}
                trend={{ value: "+1", isPositive: true }}
              />
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }}>
              <StatCard
                title="Stock Alerts"
                value={`${totals.lowStock + totals.outOfStock}`}
                icon={<ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />}
                trend={{ value: "Needs attention", isPositive: false }}
              />
            </motion.div>
          </div>
        </StaggerItem>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <StaggerItem className="xl:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Stock In vs Stock Out</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">Stock In</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-600">Stock Out</span>
                  </div>
                </div>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={inOutDaily} margin={{ left: 8, right: 8 }}>
                    <defs>
                      <linearGradient id="inColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="in"
                      stroke="#22c55e"
                      fill="url(#inColor)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="out"
                      stroke="#ef4444"
                      fill="url(#outColor)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Usage</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyUsage} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar
                      dataKey="usage"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </StaggerItem>
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <StaggerItem>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {lowAlerts.length} items
                </span>
              </div>
              <div className="space-y-3">
                {lowAlerts.map((item, index) => (
                  <motion.div
                    key={item.itemCode}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        item.status === "Out" ? "bg-red-500" : "bg-amber-500"
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          {item.itemCode} • {item.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{item.quantity} {item.unit}</p>
                      <p className="text-xs text-gray-600">Min: {item.reorderLevel}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recently Added Items</h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  New
                </span>
              </div>
              <div className="space-y-3">
                {recentlyAdded.map((item, index) => (
                  <motion.div
                    key={item.itemCode}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          {item.itemCode} • {item.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{item.quantity.toLocaleString()} {item.unit}</p>
                      <p className="text-xs text-gray-600">In Stock</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </StaggerItem>
        </div>
      </StaggerContainer>
    </AppShell>
  )
}

function aggregateInOut(days: number) {
  const end = dayjs()
  const start = end.subtract(days - 1, "day")
  const range: string[] = []
  for (let d = 0; d < days; d++) range.push(start.add(d, "day").format("MMM D"))
  return range.map((label) => {
    const sameLabel = transactions.filter((t) => dayjs(t.date).format("MMM D") === label)
    const inQty = sameLabel.filter((t) => t.type === "IN").reduce((sum, t) => sum + t.quantity, 0)
    const outQty = sameLabel.filter((t) => t.type === "OUT").reduce((sum, t) => sum + t.quantity, 0)
    return { date: label, in: inQty, out: outQty }
  })
}

function aggregateMonthlyUsage(months: number) {
  const end = dayjs()
  const start = end.subtract(months - 1, "month")
  const range: string[] = []
  for (let m = 0; m < months; m++) range.push(start.add(m, "month").format("MMM YYYY"))
  return range.map((label) => {
    const sameLabel = transactions.filter((t) => dayjs(t.date).format("MMM YYYY") === label)
    const usage = sameLabel.filter((t) => t.type === "OUT").reduce((sum, t) => sum + t.quantity, 0)
    return { month: label, usage }
  })
}
