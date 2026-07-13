import { motion, AnimatePresence } from "framer-motion"
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { useEffect } from "react"

export type MessageModalType = "success" | "error"

export interface MessageModalProps {
  open: boolean
  title: string
  message: string
  type?: MessageModalType
  duration?: number
  onClose: () => void
}

const icons = {
  success: CheckCircleIcon,
  error: XCircleIcon,
}

const iconColors = {
  success: "text-emerald-500",
  error: "text-rose-500",
}

const bgColors = {
  success: "bg-emerald-50",
  error: "bg-rose-50",
}

const headerBg = {
  success: "from-emerald-600 to-emerald-700",
  error: "from-rose-600 to-rose-700",
}

export function MessageModal({ open, title, message, type = "success", duration = 0, onClose }: MessageModalProps) {
  useEffect(() => {
    if (!open || duration <= 0) return

    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [open, duration, onClose])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const Icon = icons[type]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-md overflow-hidden rounded-[2rem] border border-brown-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${headerBg[type]} p-6 text-white`}>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-[0.24em] ${type === "success" ? "text-emerald-100" : "text-rose-100"}`}>
                    {type === "success" ? "Success" : "Error"}
                  </p>
                  <h2 id="message-modal-title" className="mt-2 text-xl font-black tracking-tight leading-tight">
                    {title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-shrink-0 rounded-xl p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${bgColors[type]} ${iconColors[type].replace("text-", "border-")}/20`}>
                {message}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition ${
                    type === "success"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {type === "success" ? "Done" : "Got it"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
