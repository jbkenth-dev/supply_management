import { motion, AnimatePresence } from "framer-motion"
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XCircleIcon } from "@heroicons/react/24/outline"
import { useEffect } from "react"

export type ToastType = "success" | "error" | "info" | "warning"

export interface ToastProps {
  id: string
  title: string
  message?: string
  type?: ToastType
  duration?: number
  onDismiss: (id: string) => void
}

const icons = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
  warning: ExclamationCircleIcon,
}

const colors = {
  success: "text-green-500 bg-green-50 border-green-200",
  error: "text-red-500 bg-red-50 border-red-200",
  info: "text-blue-500 bg-blue-50 border-blue-200",
  warning: "text-amber-500 bg-amber-50 border-amber-200",
}

export function Toast({ id, title, message, type = "info", duration = 5000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, id, onDismiss])

  const Icon = icons[type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex w-full max-w-md rounded-lg border bg-white shadow-lg ring-1 ring-black ring-opacity-5 ${colors[type].split(' ')[2]}`}
    >
      <div className="w-0 flex-1 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <Icon className={`h-10 w-10 ${colors[type].split(' ')[0]}`} aria-hidden="true" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900">{title}</p>
            {message && <p className="mt-1 text-sm text-gray-500">{message}</p>}
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              onClick={() => onDismiss(id)}
            >
              <span className="sr-only">Close</span>
              <XCircleIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function ToastContainer({ toasts, removeToast }: { toasts: ToastProps[], removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 sm:p-6 w-full sm:w-auto pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  )
}