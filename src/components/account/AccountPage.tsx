import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  CameraIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  IdentificationIcon,
  KeyIcon,
  LockClosedIcon,
  UserCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser, type AuthRole, type AuthUser } from "../../lib/auth"

type AccountForm = {
  idNumber: string
  firstname: string
  middlename: string
  lastname: string
  username: string
  email: string
  role: string
  profileImageUrl: string
}

type AccountErrors = Partial<Record<"firstname" | "lastname" | "profileImage", string>>
type EditableErrorField = Exclude<keyof AccountErrors, "profileImage">
type PasswordForm = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
type PasswordErrors = Partial<Record<keyof PasswordForm, string>>

const initialForm: AccountForm = {
  idNumber: "",
  firstname: "",
  middlename: "",
  lastname: "",
  username: "",
  email: "",
  role: "",
  profileImageUrl: "",
}

const getRoleNoun = (role: AuthRole) => {
  if (role === "Administrator") return "administrator"
  if (role === "Property Custodian") return "property custodian"
  return "faculty"
}

const getFallbackName = (role: AuthRole) => {
  if (role === "Administrator") return "Administrator"
  if (role === "Property Custodian") return "Property Custodian"
  return "Faculty Staff"
}

const getSuccessMessage = (role: AuthRole) => {
  if (role === "Administrator") return "Administrator account details saved successfully."
  if (role === "Property Custodian") return "Property custodian account details saved successfully."
  return "Faculty account details saved successfully."
}

export default function AccountPage({ role }: { role: AuthRole }) {
  const navigate = useNavigate()
  const roleNoun = getRoleNoun(role)
  const fallbackName = getFallbackName(role)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser())
  const [formData, setFormData] = useState<AccountForm>(initialForm)
  const [errors, setErrors] = useState<AccountErrors>({})
  const [serverMessage, setServerMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({})
  const [passwordMessage, setPasswordMessage] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  })
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false)

  useEffect(() => {
    if (!serverMessage) return
    const timer = window.setTimeout(() => {
      setServerMessage("")
      setIsSuccess(false)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [serverMessage])

  useEffect(() => {
    if (!passwordMessage || showPasswordChangeModal) return
    const timer = window.setTimeout(() => {
      setPasswordMessage("")
      setPasswordSuccess(false)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [passwordMessage, showPasswordChangeModal])

  useEffect(() => {
    const storedUser = getStoredAuthUser()
    setAuthUser(storedUser)

    if (!storedUser?.id) {
      setIsLoading(false)
      setServerMessage(`Unable to identify the logged-in ${roleNoun} account.`)
      return
    }

    let cancelled = false

    const loadAccount = async () => {
      setIsLoading(true)
      setServerMessage("")

      try {
        const params = new URLSearchParams({ id: String(storedUser.id), role })
        const response = await fetch(`/api/my-account.php?${params.toString()}`)
        const result = await response.json()

        if (!response.ok) {
          if (!cancelled) setServerMessage(result.message ?? "Unable to load account details.")
          return
        }

        const user = result.user as AuthUser
        if (cancelled) return

        setFormData({
          idNumber: user.idNumber ?? "",
          firstname: user.firstname ?? "",
          middlename: user.middlename ?? "",
          lastname: user.lastname ?? "",
          username: user.username ?? "",
          email: user.email ?? "",
          role: user.role ?? "",
          profileImageUrl: user.profileImageUrl ?? "",
        })
        setPreviewUrl(user.profileImageUrl ?? "")
        setAuthUser(user)
        setStoredAuthUser(user)
      } catch {
        if (!cancelled) {
          setServerMessage("Unable to connect to the PHP account service. Make sure Apache and MySQL are running in XAMPP.")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadAccount()
    return () => {
      cancelled = true
    }
  }, [role, roleNoun])

  useEffect(() => {
    if (!selectedImage) return
    const objectUrl = URL.createObjectURL(selectedImage)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedImage])

  const fullName = useMemo(() => [formData.firstname, formData.middlename, formData.lastname].filter(Boolean).join(" "), [
    formData.firstname,
    formData.middlename,
    formData.lastname,
  ])

  const handleChange = (field: keyof AccountForm, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
    if (field === "firstname" || field === "lastname") {
      const errorField = field as EditableErrorField
      setErrors((current) => ({ ...current, [errorField]: undefined }))
    }
    setServerMessage("")
    setIsSuccess(false)
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setServerMessage("")
    setIsSuccess(false)
    setErrors((current) => ({ ...current, profileImage: undefined }))

    if (!file) {
      setSelectedImage(null)
      setPreviewUrl(formData.profileImageUrl)
      return
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((current) => ({ ...current, profileImage: "Please upload a JPG, PNG, or WEBP image only." }))
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrors((current) => ({ ...current, profileImage: "Profile picture must be 2MB or smaller." }))
      return
    }

    setSelectedImage(file)
  }

  const handlePasswordChange = (field: keyof PasswordForm, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }))
    setPasswordErrors((current) => ({ ...current, [field]: undefined }))
    setPasswordMessage("")
    setPasswordSuccess(false)
  }

  const togglePasswordVisibility = (field: keyof PasswordForm) => {
    setShowPasswords((current) => ({ ...current, [field]: !current[field] }))
  }

  const validateForm = () => {
    const nextErrors: AccountErrors = {}
    if (!formData.firstname.trim()) nextErrors.firstname = "First name is required."
    if (!formData.lastname.trim()) nextErrors.lastname = "Last name is required."
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerMessage("")
    setIsSuccess(false)
    if (!authUser?.id || !validateForm()) return
    setIsSaving(true)

    try {
      const payload = new FormData()
      payload.append("id", String(authUser.id))
      payload.append("role", role)
      payload.append("firstname", formData.firstname.trim())
      payload.append("middlename", formData.middlename.trim())
      payload.append("lastname", formData.lastname.trim())
      if (selectedImage) payload.append("profileImage", selectedImage)

      const response = await fetch("/api/my-account.php", { method: "POST", body: payload })
      const result = await response.json()

      if (!response.ok) {
        setErrors((current) => ({ ...current, ...(result.errors ?? {}) }))
        setServerMessage(result.message ?? "Unable to save account changes.")
        return
      }

      const updatedUser = result.user as AuthUser
      setAuthUser(updatedUser)
      setStoredAuthUser(updatedUser)
      setFormData({
        idNumber: updatedUser.idNumber ?? "",
        firstname: updatedUser.firstname ?? "",
        middlename: updatedUser.middlename ?? "",
        lastname: updatedUser.lastname ?? "",
        username: updatedUser.username ?? "",
        email: updatedUser.email ?? "",
        role: updatedUser.role ?? "",
        profileImageUrl: updatedUser.profileImageUrl ?? "",
      })
      setPreviewUrl(updatedUser.profileImageUrl ?? "")
      setSelectedImage(null)
      setErrors({})
      setServerMessage(result.message ?? getSuccessMessage(role))
      setIsSuccess(true)
    } catch {
      setServerMessage("Unable to connect to the PHP account service. Make sure Apache and MySQL are running in XAMPP.")
    } finally {
      setIsSaving(false)
    }
  }

  const validatePasswordForm = () => {
    const nextErrors: PasswordErrors = {}
    if (!passwordForm.currentPassword) nextErrors.currentPassword = "Current password is required."
    if (!passwordForm.newPassword) nextErrors.newPassword = "New password is required."
    else if (passwordForm.newPassword.length < 8) nextErrors.newPassword = "New password must be at least 8 characters."
    else if (passwordForm.newPassword === passwordForm.currentPassword) nextErrors.newPassword = "New password must be different from your current password."
    if (!passwordForm.confirmPassword) nextErrors.confirmPassword = "Please confirm your new password."
    else if (passwordForm.confirmPassword !== passwordForm.newPassword) nextErrors.confirmPassword = "New password and confirmation do not match."
    setPasswordErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordMessage("")
    setPasswordSuccess(false)
    if (!authUser?.id || !validatePasswordForm()) return
    setIsChangingPassword(true)

    try {
      const payload = new FormData()
      payload.append("action", "change_password")
      payload.append("id", String(authUser.id))
      payload.append("role", role)
      payload.append("currentPassword", passwordForm.currentPassword)
      payload.append("newPassword", passwordForm.newPassword)
      payload.append("confirmPassword", passwordForm.confirmPassword)

      const response = await fetch("/api/my-account.php", { method: "POST", body: payload })
      const result = await response.json()

      if (!response.ok) {
        setPasswordErrors(result.errors ?? {})
        setPasswordMessage(result.message ?? "Unable to change password.")
        return
      }

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setPasswordErrors({})
      setPasswordMessage("")
      setPasswordSuccess(true)
      setShowPasswords({ currentPassword: false, newPassword: false, confirmPassword: false })
      setShowPasswordChangeModal(true)
    } catch {
      setPasswordMessage("Unable to connect to the PHP account service. Make sure Apache and MySQL are running in XAMPP.")
      setPasswordSuccess(false)
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleReLogin = () => {
    clearStoredAuthUser()
    setAuthUser(null)
    setShowPasswordChangeModal(false)
    navigate("/auth/login", { replace: true, state: { passwordChanged: true } })
  }

  return (
    <AppShell role={role}>
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">My Account</h1>
          <p className="text-sm text-slate-500">
            Review your {roleNoun} profile, upload a profile picture, and keep your personal information updated.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {serverMessage ? (
            <motion.div
              key={`profile-message-${serverMessage}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {serverMessage}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 rounded bg-slate-200" />
              <div className="h-24 rounded bg-slate-100" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-14 rounded bg-slate-100" />
                <div className="h-14 rounded bg-slate-100" />
                <div className="h-14 rounded bg-slate-100" />
                <div className="h-14 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    {previewUrl ? (
                      <img src={previewUrl} alt={fullName || `${fallbackName} profile`} className="h-28 w-28 rounded-full border-4 border-white/25 object-cover shadow-xl" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-white">
                        <UserCircleIcon className="h-16 w-16" />
                      </div>
                    )}
                    <label className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-slate-900 shadow-lg transition hover:scale-105">
                      <CameraIcon className="h-5 w-5" />
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageChange} />
                    </label>
                  </div>

                  <h2 className="mt-5 text-2xl font-black tracking-tight">{fullName || fallbackName}</h2>
                  <p className="mt-1 text-sm text-blue-100">{formData.role || fallbackName}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Login Details</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <IdentificationIcon className="mt-0.5 h-5 w-5 text-slate-400" />
                      <div>
                        <p className="font-semibold text-slate-900">ID Number</p>
                        <p className="text-slate-500">{formData.idNumber || "Not available"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <IdentificationIcon className="mt-0.5 h-5 w-5 text-slate-400" />
                      <div>
                        <p className="font-semibold text-slate-900">Username</p>
                        <p className="text-slate-500">{formData.username || "Not available"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <EnvelopeIcon className="mt-0.5 h-5 w-5 text-slate-400" />
                      <div>
                        <p className="font-semibold text-slate-900">Email</p>
                        <p className="break-all text-slate-500">{formData.email || "Not available"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <p>Username and email stay protected as read-only values. Personal information and your profile picture can be updated here.</p>
                  </div>
                </div>

                {errors.profileImage ? <p className="text-xs font-semibold text-rose-600">{errors.profileImage}</p> : null}
              </div>
            </aside>

            <div className="space-y-8">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-8">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Profile Information</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Edit personal information</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Keep your {roleNoun} account details complete. Email and username are displayed for reference and cannot be changed here.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">First Name</label>
                      <div className="relative">
                        <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={formData.firstname}
                          onChange={(event) => handleChange("firstname", event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          required
                        />
                      </div>
                      {errors.firstname ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.firstname}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Middle Name</label>
                      <input
                        type="text"
                        value={formData.middlename}
                        onChange={(event) => handleChange("middlename", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastname}
                        onChange={(event) => handleChange("lastname", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        required
                      />
                      {errors.lastname ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.lastname}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">ID Number</label>
                      <div className="relative">
                        <IdentificationIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={formData.idNumber}
                          className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3.5 pl-11 pr-4 text-sm text-slate-500"
                          readOnly
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Username</label>
                      <div className="relative">
                        <IdentificationIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={formData.username}
                          className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3.5 pl-11 pr-4 text-sm text-slate-500"
                          readOnly
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Email</label>
                      <div className="relative">
                        <EnvelopeIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          value={formData.email}
                          className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-3.5 pl-11 pr-4 text-sm text-slate-500"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Role</label>
                    <input
                      type="text"
                      value={formData.role}
                      className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm text-slate-500"
                      readOnly
                    />
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving Changes..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-8">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Security</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Change password</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Enter your current password, choose a new one with at least 8 characters, and confirm it before saving.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {passwordMessage ? (
                    <motion.div
                      key={`password-message-${passwordMessage}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                        passwordSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {passwordMessage}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Current Password</label>
                      <div className="relative">
                        <LockClosedIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPasswords.currentPassword ? "text" : "password"}
                          value={passwordForm.currentPassword}
                          onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility("currentPassword")}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600"
                          aria-label={showPasswords.currentPassword ? "Hide current password" : "Show current password"}
                        >
                          {showPasswords.currentPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      {passwordErrors.currentPassword ? <p className="mt-2 text-xs font-semibold text-rose-600">{passwordErrors.currentPassword}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">New Password</label>
                      <div className="relative">
                        <KeyIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPasswords.newPassword ? "text" : "password"}
                          value={passwordForm.newPassword}
                          onChange={(event) => handlePasswordChange("newPassword", event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility("newPassword")}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600"
                          aria-label={showPasswords.newPassword ? "Hide new password" : "Show new password"}
                        >
                          {showPasswords.newPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      {passwordErrors.newPassword ? <p className="mt-2 text-xs font-semibold text-rose-600">{passwordErrors.newPassword}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Confirm New Password</label>
                      <div className="relative">
                        <KeyIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPasswords.confirmPassword ? "text" : "password"}
                          value={passwordForm.confirmPassword}
                          onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility("confirmPassword")}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-slate-600"
                          aria-label={showPasswords.confirmPassword ? "Hide confirm new password" : "Show confirm new password"}
                        >
                          {showPasswords.confirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      {passwordErrors.confirmPassword ? <p className="mt-2 text-xs font-semibold text-rose-600">{passwordErrors.confirmPassword}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isChangingPassword ? "Changing Password..." : "Change Password"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPasswordChangeModal ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="password-change-title"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircleIcon className="h-8 w-8" />
              </div>
              <h3 id="password-change-title" className="mt-5 text-2xl font-black tracking-tight text-slate-900">
                Password changed successfully
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                For security, you need to log in again to confirm this password change. Continue to the login page and sign in using your new password.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleReLogin}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Login Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AppShell>
  )
}
