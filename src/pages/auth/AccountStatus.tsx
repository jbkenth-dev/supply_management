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
  PhoneIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline"
import { clearStoredAuthUser, getStoredAuthUser, getUserDisplayName, type AuthUser } from "../../lib/auth"

/* ─── Status configuration ─── */

const statusConfig = {
  pending: {
    icon: ClockIcon,
    label: "Pending Approval",
    description:
      "Your account is awaiting administrator approval. You will be redirected to your dashboard automatically once approved.",
    accent: "amber",
    ringColor: "ring-amber-100",
    iconBg: "bg-amber-50 text-amber-600",
    badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    barColor: "bg-amber-400",
  },
  approved: {
    icon: CheckCircleIcon,
    label: "Approved",
    description:
      "Your account has been fully approved. You now have full access to the system.",
    accent: "emerald",
    ringColor: "ring-emerald-100",
    iconBg: "bg-emerald-50 text-emerald-600",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    barColor: "bg-emerald-400",
  },
  rejected: {
    icon: XCircleIcon,
    label: "Application Rejected",
    description:
      "Your account application was not approved. Please contact the system administrator for further assistance.",
    accent: "rose",
    ringColor: "ring-rose-100",
    iconBg: "bg-rose-50 text-rose-600",
    badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
    barColor: "bg-rose-400",
  },
} as const

/* ─── Page ─── */

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

  if (!user) return null

  const status = (user as AuthUser).approvalStatus ?? "pending"
  const config = statusConfig[status]
  const StatusIcon = config.icon
  const displayName = getUserDisplayName(user, user.role)
  const initials = [user.firstname?.[0], user.lastname?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase()

  return (
    <div className="min-h-screen bg-brown-50 flex items-center justify-center p-4 sm:p-6">
      {/* Subtle background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary-200/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-accent-100/30 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg"
      >
        {/* Main card */}
        <div className="rounded-[2rem] border border-brown-200 bg-white shadow-sm overflow-hidden">
          {/* ── Avatar strip ── */}
          <div className="flex items-center justify-center pt-10 pb-6">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 ring-4 ring-white shadow-md">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt={displayName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-black text-primary-700 select-none">
                    {initials}
                  </span>
                )}
              </div>
              {/* Online dot */}
              <span className="absolute bottom-0.5 right-0.5 block h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-white" />
            </div>
          </div>

          {/* ── User identity ── */}
          <div className="px-8 text-center">
            <h1 className="text-xl font-black tracking-tight text-brown-900">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-brown-500">{user.email}</p>

            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-200 px-3 py-1">
              <ShieldCheckIcon className="h-3.5 w-3.5 text-primary-500" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-700">
                {user.role}
              </span>
            </div>
          </div>

          {/* ── Status banner ── */}
          <div className="mx-8 mt-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className={`rounded-2xl bg-brown-50 border border-brown-200 p-5`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconBg}`}>
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-brown-900">{config.label}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${config.badgeClass}`}>
                      {status === "pending" && (
                        <span className={`h-1.5 w-1.5 rounded-full ${config.barColor} animate-pulse`} />
                      )}
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-brown-500">
                    {config.description}
                  </p>
                </div>
              </div>

              {/* Progress hint for pending */}
              {status === "pending" && (
                <div className="mt-4 overflow-hidden rounded-full bg-brown-200/60 h-1.5">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "65%" }}
                    transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
                    className={`h-full rounded-full ${config.barColor}`}
                  />
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Personal information ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="mx-8 mt-6 rounded-2xl border border-brown-200 bg-brown-50 p-5"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brown-400 mb-4">
              Personal Information
            </p>
            <div className="space-y-3">
              <InfoRow
                icon={IdentificationIcon}
                label="ID Number"
                value={user.idNumber ?? "—"}
              />
              <InfoRow
                icon={UserCircleIcon}
                label="Full Name"
                value={displayName}
              />
              <InfoRow
                icon={EnvelopeIcon}
                label="Email"
                value={user.email}
              />
              {user.contactNumber && (
                <InfoRow
                  icon={PhoneIcon}
                  label="Contact"
                  value={user.contactNumber}
                />
              )}
              {user.address && (
                <InfoRow
                  icon={MapPinIcon}
                  label="Address"
                  value={user.address}
                />
              )}
            </div>
          </motion.div>

          {/* ── Actions ── */}
          <div className="mx-8 mt-6 mb-8 flex flex-col gap-3">
            {status === "approved" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                onClick={() => navigate(user.role === "Administrator" ? "/admin/dashboard" : "/custodian/dashboard")}
                className="w-full rounded-xl bg-primary-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-600/15 transition hover:bg-primary-700 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Go to Dashboard
              </motion.button>
            )}

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-brown-200 bg-white px-4 py-3.5 text-sm font-bold text-brown-600 transition hover:border-brown-300 hover:bg-brown-50"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign Out
            </motion.button>
          </div>
        </div>

      </motion.div>
    </div>
  )
}

/* ─── Sub-components ─── */

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
    <div className="flex items-center gap-3 rounded-xl bg-white border border-brown-200 px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-brown-400" />
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brown-400 min-w-18">
        {label}
      </span>
      <span className="text-sm font-medium text-brown-800 truncate">{value}</span>
    </div>
  )
}
