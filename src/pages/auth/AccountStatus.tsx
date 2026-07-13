import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ClockIcon,
  UserCircleIcon,
  EnvelopeIcon,
  IdentificationIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import { clearStoredAuthUser, getStoredAuthUser, getUserDisplayName, type AuthUser } from "../../lib/auth"

const statusConfig = {
  pending: {
    icon: ClockIcon,
    label: "Waiting for Approval",
    description:
      "Your account has been verified and is now pending approval from an administrator. You will be able to access the system once your account is approved.",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    iconColor: "text-amber-500",
    dotColor: "bg-amber-400",
  },
  approved: {
    icon: CheckCircleIcon,
    label: "Account Approved",
    description: "Your account has been approved! You can now access the full system.",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    iconColor: "text-emerald-500",
    dotColor: "bg-emerald-400",
  },
  rejected: {
    icon: XCircleIcon,
    label: "Account Rejected",
    description:
      "Your account application has been rejected. Please contact the administrator for more information.",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    textColor: "text-rose-700",
    iconColor: "text-rose-500",
    dotColor: "bg-rose-400",
  },
} as const

export default function AccountStatus() {
  const navigate = useNavigate()
  const user = getStoredAuthUser()

  useEffect(() => {
    if (!user) {
      navigate("/auth/login", { replace: true })
    }
  }, [user, navigate])

  const handleLogout = () => {
    clearStoredAuthUser()
    navigate("/auth/login", { replace: true })
  }

  if (!user) {
    return null
  }

  const status = (user as AuthUser).approvalStatus ?? "pending"
  const config = statusConfig[status]
  const StatusIcon = config.icon
  const displayName = getUserDisplayName(user, user.role)
  const initials = [user.firstname?.[0], user.lastname?.[0]].filter(Boolean).join("").toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-br from-brown-50 via-amber-50/30 to-brown-100 flex items-center justify-center p-4 sm:p-6">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-brown-900/5 border border-white/60 overflow-hidden">
          {/* Header with avatar */}
          <div className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 px-8 pt-10 pb-16 text-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZG90cyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjZG90cykiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-40" />
            <div className="relative">
              <div className="mx-auto w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-xl">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-black text-white">{initials}</span>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="relative px-8 -mt-8 pb-8">
            {/* User info */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-black text-brown-900 mb-1">{displayName}</h1>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200">
                <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                  {user.role}
                </span>
              </div>
            </div>

            {/* Status card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className={`${config.bgColor} ${config.borderColor} border rounded-2xl p-5 mb-6`}
            >
              <div className="flex items-start gap-3">
                <div className={`${config.iconColor} flex-shrink-0 mt-0.5`}>
                  <StatusIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {status === "pending" && (
                      <span className={`inline-flex items-center gap-1.5`}>
                        <span className={`w-2 h-2 ${config.dotColor} rounded-full animate-pulse`} />
                      </span>
                    )}
                    <h3 className={`text-base font-bold ${config.textColor}`}>
                      {config.label}
                    </h3>
                  </div>
                  <p className={`text-sm ${config.textColor} opacity-80 leading-relaxed`}>
                    {config.description}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Personal information */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-brown-50/50 rounded-2xl border border-brown-100 p-5 mb-6"
            >
              <h3 className="text-xs font-bold text-brown-500 uppercase tracking-wider mb-4">
                Personal Information
              </h3>
              <div className="space-y-3">
                <InfoRow
                  icon={IdentificationIcon}
                  label="ID Number"
                  value={user.idNumber ?? "—"}
                />
                <InfoRow
                  icon={UserCircleIcon}
                  label="Name"
                  value={displayName}
                />
                <InfoRow
                  icon={EnvelopeIcon}
                  label="Email"
                  value={user.email}
                />
              </div>
            </motion.div>

            {/* Logout button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-brown-200 text-brown-600 font-bold text-sm hover:bg-brown-50 hover:border-brown-300 transition-all"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Sign Out
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IdentificationIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-brown-400 flex-shrink-0" />
      <span className="text-xs font-bold text-brown-400 uppercase tracking-wider min-w-[80px]">
        {label}
      </span>
      <span className="text-sm font-medium text-brown-800">{value}</span>
    </div>
  )
}
