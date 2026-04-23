import { motion } from "framer-motion"
import { StaggerContainer, StaggerItem } from "./animations"
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonChart, SkeletonStat } from "./Skeleton"

interface LoadingStateProps {
  type?: "dashboard" | "inventory" | "table" | "cards"
  count?: number
}

export function LoadingState({ type = "table", count = 5 }: LoadingStateProps) {
  return (
    <StaggerContainer className="space-y-6">
      {type === "dashboard" && (
        <>
          <StaggerItem>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <SkeletonStat key={i} />
              ))}
            </div>
          </StaggerItem>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <StaggerItem className="lg:col-span-2">
              <SkeletonChart />
            </StaggerItem>
            <StaggerItem>
              <SkeletonChart />
            </StaggerItem>
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StaggerItem>
              <SkeletonTable rows={4} columns={3} />
            </StaggerItem>
            <StaggerItem>
              <SkeletonTable rows={4} columns={3} />
            </StaggerItem>
          </div>
        </>
      )}
      
      {type === "inventory" && (
        <>
          <StaggerItem>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <Skeleton height="h-10" width="w-64" />
                <div className="flex gap-3">
                  <Skeleton height="h-10" width="w-32" />
                  <Skeleton height="h-10" width="w-32" />
                </div>
              </div>
            </div>
          </StaggerItem>
          
          <StaggerItem>
            <SkeletonTable rows={count} columns={8} />
          </StaggerItem>
        </>
      )}
      
      {type === "table" && (
        <StaggerItem>
          <SkeletonTable rows={count} columns={6} />
        </StaggerItem>
      )}
      
      {type === "cards" && (
        <StaggerItem>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(count)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </StaggerItem>
      )}
    </StaggerContainer>
  )
}

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title = "Something went wrong", message = "Please try again later.", onRetry }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12"
    >
      <div className="mx-auto h-12 w-12 text-red-500">
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {onRetry && (
        <div className="mt-6">
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try again
          </button>
        </div>
      )}
    </motion.div>
  )
}

interface EmptyStateProps {
  title?: string
  message?: string
  icon?: React.ReactNode
  action?: {
    text: string
    onClick: () => void
  }
}

export function EmptyState({ title = "No items found", message = "Get started by creating a new item.", icon, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12"
    >
      {icon || (
        <div className="mx-auto h-12 w-12 text-gray-400">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
      )}
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {action && (
        <div className="mt-6">
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {action.text}
          </button>
        </div>
      )}
    </motion.div>
  )
}