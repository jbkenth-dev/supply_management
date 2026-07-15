export type AuthRole = "Administrator" | "Property Custodian" | "Faculty Staff" | "Resource Planning Officer" | "Vice President for Finance" | "College President"

export type ApprovalStatus = "pending" | "approved" | "rejected"

export type AuthUser = {
  id: number
  role: AuthRole
  isVerified: boolean
  approvalStatus: ApprovalStatus
  idNumber?: string | null
  firstname: string
  middlename: string | null
  lastname: string
  username: string
  email: string
  contactNumber?: string | null
  address?: string | null
  profileImageUrl?: string | null
}

const AUTH_STORAGE_KEY = "authUser"

const isBrowser = () => typeof window !== "undefined"

export const getStoredAuthUser = (): AuthUser | null => {
  if (!isBrowser()) {
    return null
  }

  const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY) ?? window.sessionStorage.getItem(AUTH_STORAGE_KEY)

  if (!storedUser) {
    return null
  }

  try {
    const parsedUser = JSON.parse(storedUser) as AuthUser

    // Migrate legacy session-only login to persistent login.
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsedUser))
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)

    return parsedUser
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export const setStoredAuthUser = (user: AuthUser) => {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export const clearStoredAuthUser = () => {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export const getDashboardPath = (role: AuthRole) => {
  if (role === "Administrator") {
    return "/admin/dashboard"
  }

  if (role === "Property Custodian") {
    return "/custodian/dashboard"
  }

  return "/dashboard"
}

export const getMessagesPath = (role: AuthRole) => {
  if (role === "Administrator") {
    return "/admin/message"
  }

  if (role === "Property Custodian") {
    return "/custodian/message"
  }

  return "/message"
}

export const getMyAccountPath = (role: AuthRole) => {
  if (role === "Administrator") {
    return "/admin/my-account"
  }

  if (role === "Property Custodian") {
    return "/custodian/my-account"
  }

  return "/my-account"
}

export const getNotificationPath = (role: AuthRole) => {
  if (role === "Administrator") {
    return "/admin/notification"
  }

  if (role === "Property Custodian") {
    return "/custodian/notification"
  }

  return "/notification"
}

export const getUserDisplayName = (user: AuthUser | null, fallbackRole: AuthRole) => {
  if (!user) {
    return fallbackRole
  }

  const nameParts = [user.firstname, user.middlename, user.lastname].filter(Boolean)
  return nameParts.join(" ")
}

export const getAccountStatusPath = (role?: AuthRole) => {
  if (role === "Faculty Staff") {
    return "/account-status"
  }

  // Property Custodian and Administrator (fallback) go to custodian path
  return "/custodian/account-status"
}

export const getVerificationPath = () => "/auth/verification-code"

export const isUserFullyApproved = (user: AuthUser): boolean => {
  return user.isVerified === true && user.approvalStatus === "approved"
}

export const needsVerification = (user: AuthUser): boolean => {
  return user.isVerified === false
}

export const needsApproval = (user: AuthUser): boolean => {
  return user.isVerified === true && user.approvalStatus !== "approved"
}

const APPROVAL_ROLES: readonly AuthRole[] = [
  "Resource Planning Officer",
  "Vice President for Finance",
  "College President",
]

export const isApprovalRole = (role: AuthRole): boolean =>
  (APPROVAL_ROLES as readonly string[]).includes(role)

export const getApprovalPersonnelAccountPath = () => "/approval-personnel/my-account"
export const getApprovalPersonnelNotificationPath = () => "/approval-personnel/notification"
