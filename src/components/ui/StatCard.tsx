import { motion } from "framer-motion"

interface StatCardProps {
  title: string
  value: string
  icon?: React.ReactNode
  trend?: {
    value: string
    isPositive: boolean
  }
  loading?: boolean
}

export function StatCard({ title, value, icon, trend, loading }: StatCardProps) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border bg-white p-6 shadow-sm"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-32"></div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={`mt-1 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↗' : '↘'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  )
}
