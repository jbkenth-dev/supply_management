import { motion } from "framer-motion"

interface SkeletonProps {
  className?: string
  height?: string
  width?: string
  rounded?: boolean
  circle?: boolean
}

export function Skeleton({
  className = "",
  height = "h-4",
  width = "w-full",
  rounded = true,
  circle = false
}: SkeletonProps) {
  const baseClasses = "bg-gray-200 animate-pulse"
  const roundedClasses = rounded ? "rounded-md" : ""
  const circleClasses = circle ? "rounded-full" : ""

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${baseClasses} ${roundedClasses} ${circleClasses} ${height} ${width} ${className}`}
    />
  )
}

export function SkeletonStat() {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm h-full">
      <div className="animate-pulse flex items-center justify-between">
        <div className="space-y-3 w-full">
          <Skeleton height="h-4" width="w-24" />
          <Skeleton height="h-8" width="w-16" />
          <Skeleton height="h-4" width="w-32" />
        </div>
        <Skeleton height="h-12" width="w-12" rounded className="ml-4" />
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-0 overflow-hidden h-full flex flex-col">
      <Skeleton height="aspect-[4/3]" className="rounded-none" />
      <div className="p-6 space-y-4 flex-grow">
        <div className="flex justify-between items-center">
          <Skeleton height="h-3" width="w-16" />
          <Skeleton height="h-5" width="w-20" rounded />
        </div>
        <Skeleton height="h-7" width="w-3/4" />
        <div className="space-y-2 pt-2">
          <Skeleton height="h-3" width="w-24" />
          <Skeleton height="h-8" width="w-32" />
        </div>
      </div>
      <div className="px-6 pb-6 mt-auto">
        <Skeleton height="h-1.5" width="w-full" rounded />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="p-4 border-b">
        <Skeleton height="h-5" width="w-32" />
      </div>
      <div className="p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 mb-4 last:mb-0">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} height="h-4" width={`w-${Math.floor(Math.random() * 4) + 4}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="rounded-lg border bg-white p-6">
      <Skeleton height="h-5" width="w-32" className="mb-4" />
      <Skeleton height="h-64" />
    </div>
  )
}

export function SkeletonItemDetails() {
  return (
    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Image & Quick Stats */}
          <div className="lg:col-span-5 space-y-6">
            <Skeleton height="aspect-square" className="rounded-[2.5rem]" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton height="h-24" className="rounded-3xl" />
              <Skeleton height="h-24" className="rounded-3xl" />
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <Skeleton height="h-4" width="w-32" />
              <Skeleton height="h-12" width="w-3/4" />
              <Skeleton height="h-6" width="w-1/2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height="h-20" className="rounded-2xl" />
              ))}
            </div>

            <div className="space-y-4">
              <Skeleton height="h-8" width="w-48" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height="h-16" className="rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}