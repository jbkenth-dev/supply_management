import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ComponentType } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { MessageModal } from "../ui/MessageModal"
import {
  ArrowPathIcon,
  CameraIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  IdentificationIcon,
  KeyIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { api } from "../../lib/api"
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

type AccountErrors = Partial<Record<"firstname" | "lastname" | "email" | "profileImage", string>>
type EditableErrorField = Exclude<keyof AccountErrors, "profileImage">
type PasswordForm = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
type PasswordErrors = Partial<Record<keyof PasswordForm, string>>

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

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
  if (role === "Faculty Staff") return "faculty"
  return "approval personnel"
}

const getFallbackName = (role: AuthRole) => {
  if (role === "Administrator") return "Administrator"
  if (role === "Property Custodian") return "Property Custodian"
  if (role === "Faculty Staff") return "Faculty Staff"
  return role
}

const getSuccessMessage = (role: AuthRole) => {
  if (role === "Administrator") return "Administrator account details saved successfully."
  if (role === "Property Custodian") return "Property custodian account details saved successfully."
  if (role === "Faculty Staff") return "Faculty account details saved successfully."
  return `${role} account details saved successfully.`
}

export default function AccountPage({ role, shell: CustomShell }: { role: AuthRole; shell?: ComponentType<{ children: React.ReactNode; role?: AuthRole }> }) {
  const navigate = useNavigate()
  const ShellComponent = CustomShell ?? AppShell
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
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showPasswordMsgModal, setShowPasswordMsgModal] = useState(false)

  // ─── Email change verification state ──────────────────────
  const [originalEmail, setOriginalEmail] = useState("")
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false)
  const [emailVerifyDigits, setEmailVerifyDigits] = useState<string[]>(Array(6).fill(""))
  const [emailVerifyError, setEmailVerifyError] = useState("")
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false)
  const [isResendingEmailCode, setIsResendingEmailCode] = useState(false)
  const [emailVerifyRemainingSeconds, setEmailVerifyRemainingSeconds] = useState(10 * 60)
  const [emailVerifyExpired, setEmailVerifyExpired] = useState(false)
  const [pendingEmailChange, setPendingEmailChange] = useState("")
  const [emailVerifySuccess, setEmailVerifySuccess] = useState(false)
  const emailVerifyInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!serverMessage) return

    setShowProfileModal(true)

    const timer = window.setTimeout(() => {
      setServerMessage("")
      setIsSuccess(false)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [serverMessage])

  useEffect(() => {
    if (!passwordMessage || showPasswordChangeModal) return

    setShowPasswordMsgModal(true)

    const timer = window.setTimeout(() => {
      setPasswordMessage("")
      setPasswordSuccess(false)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [passwordMessage, showPasswordChangeModal])

  // ─── Email verification countdown timer ───────────────────
  useEffect(() => {
    if (!showEmailVerifyModal || emailVerifyRemainingSeconds <= 0) {
      if (emailVerifyRemainingSeconds <= 0) setEmailVerifyExpired(true)
      return
    }

    const timer = window.setInterval(() => {
      setEmailVerifyRemainingSeconds((prev) => {
        if (prev <= 1) {
          setEmailVerifyExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [showEmailVerifyModal, emailVerifyRemainingSeconds])

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
        const response = await api(`/api/my-account.php?${params.toString()}`)
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
        setOriginalEmail(user.email ?? "")
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
    if (field === "email") {
      setErrors((current) => ({ ...current, email: undefined }))
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
    if (!formData.email.trim()) nextErrors.email = "Email address is required."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) nextErrors.email = "Please enter a valid email address."
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerMessage("")
    setIsSuccess(false)
    if (!authUser?.id || !validateForm()) return
    setIsSaving(true)

    const emailChanged = formData.email.trim().toLowerCase() !== originalEmail.toLowerCase()

    try {
      // Step 1: Always save profile fields (name, image) first
      const profilePayload = new FormData()
      profilePayload.append("id", String(authUser.id))
      profilePayload.append("role", role)
      profilePayload.append("firstname", formData.firstname.trim())
      profilePayload.append("middlename", formData.middlename.trim())
      profilePayload.append("lastname", formData.lastname.trim())
      if (selectedImage) profilePayload.append("profileImage", selectedImage)

      const profileResponse = await api("/api/my-account.php", { method: "POST", body: profilePayload })
      const profileResult = await profileResponse.json()

      if (!profileResponse.ok) {
        setErrors((current) => ({ ...current, ...(profileResult.errors ?? {}) }))
        setServerMessage(profileResult.message ?? "Unable to save account changes.")
        return
      }

      // Update local state with saved profile data
      const updatedUser = profileResult.user as AuthUser
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
      setOriginalEmail(updatedUser.email ?? "")
      setPreviewUrl(updatedUser.profileImageUrl ?? "")
      setSelectedImage(null)
      setErrors({})

      // Step 2: If email was changed, initiate email change verification
      if (emailChanged) {
        const newEmail = formData.email.trim().toLowerCase()

        const emailResponse = await api("/api/email-change-request.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: authUser.id,
            role,
            newEmail,
          }),
        })

        let emailResult: any
        try {
          emailResult = await emailResponse.json()
        } catch {
          setServerMessage("Server error while requesting email change. Please try again.")
          return
        }

        if (!emailResponse.ok) {
          setErrors((current) => ({ ...current, ...(emailResult.errors ?? {}) }))
          setServerMessage(emailResult.message ?? "Unable to process email change request.")
          return
        }

        // Send email via Vercel serverless function (Awardspace blocks outbound)
        if (emailResult.code) {
          api("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: emailResult.email ?? newEmail,
              name: emailResult.name ?? "",
              code: emailResult.code,
              type: "email-change",
              expiryMinutes: 10,
            }),
          }).catch(() => {
            // Email failure is non-fatal — the code was saved on the server
          })
        }

        // Show the OTP verification modal
        setPendingEmailChange(newEmail)
        setEmailVerifyDigits(Array(6).fill(""))
        setEmailVerifyError("")
        setEmailVerifyExpired(false)
        setEmailVerifyRemainingSeconds(10 * 60)
        setEmailVerifySuccess(false)
        setShowEmailVerifyModal(true)
        setServerMessage("")

        // Focus the first input after modal opens
        setTimeout(() => emailVerifyInputRefs.current[0]?.focus(), 100)
        return
      }

      // Email not changed — show success
      setServerMessage(profileResult.message ?? getSuccessMessage(role))
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

      const response = await api("/api/my-account.php", { method: "POST", body: payload })
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

  // ─── Email Verification Handlers ─────────────────────────

  const getFullEmailVerifyCode = useCallback(() => emailVerifyDigits.join(""), [emailVerifyDigits])

  const handleEmailVerifyDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (value !== "" && !/^\d$/.test(value)) return

    const newDigits = [...emailVerifyDigits]
    newDigits[index] = value
    setEmailVerifyDigits(newDigits)
    setEmailVerifyError("")

    if (value !== "" && index < 5) {
      emailVerifyInputRefs.current[index + 1]?.focus()
    }

    if (value !== "" && index === 5) {
      const fullCode = newDigits.join("")
      if (fullCode.length === 6) {
        handleEmailVerify(fullCode)
      }
    }
  }

  const handleEmailVerifyKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (emailVerifyDigits[index] === "" && index > 0) {
        const newDigits = [...emailVerifyDigits]
        newDigits[index - 1] = ""
        setEmailVerifyDigits(newDigits)
        emailVerifyInputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      emailVerifyInputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      emailVerifyInputRefs.current[index + 1]?.focus()
    }
  }

  const handleEmailVerifyPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (pastedText.length === 0) return

    const newDigits = [...emailVerifyDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedText[i] ?? ""
    }
    setEmailVerifyDigits(newDigits)
    setEmailVerifyError("")

    const focusIndex = Math.min(pastedText.length, 5)
    emailVerifyInputRefs.current[focusIndex]?.focus()

    if (pastedText.length === 6) {
      handleEmailVerify(pastedText)
    }
  }

  const handleEmailVerify = async (code?: string) => {
    const fullCode = code ?? getFullEmailVerifyCode()

    if (fullCode.length !== 6) {
      setEmailVerifyError("Please enter all 6 digits.")
      return
    }

    if (emailVerifyExpired) {
      setEmailVerifyError("Verification code has expired. Please request a new one.")
      return
    }

    setIsVerifyingEmail(true)
    setEmailVerifyError("")

    try {
      const response = await api("/api/email-change-verify.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser?.id,
          role,
          code: fullCode,
          newEmail: pendingEmailChange,
        }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setEmailVerifyError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setEmailVerifyError(result.message ?? "Invalid verification code. Please try again.")
        setEmailVerifyDigits(Array(6).fill(""))
        emailVerifyInputRefs.current[0]?.focus()
        return
      }

      // Success — update local state
      const updatedUser = result.user as AuthUser
      setAuthUser(updatedUser)
      setStoredAuthUser(updatedUser)
      setOriginalEmail(updatedUser.email ?? "")
      setFormData((current) => ({ ...current, email: updatedUser.email ?? "" }))
      setEmailVerifySuccess(true)

      // Close modal after a short delay
      setTimeout(() => {
        setShowEmailVerifyModal(false)
        setEmailVerifySuccess(false)
        setPendingEmailChange("")
        setServerMessage("Email address updated successfully.")
        setIsSuccess(true)
      }, 1500)
    } catch {
      setEmailVerifyError("Unable to connect to the verification service. Please try again.")
    } finally {
      setIsVerifyingEmail(false)
    }
  }

  const handleResendEmailCode = async () => {
    setIsResendingEmailCode(true)
    setEmailVerifyError("")

    try {
      const response = await api("/api/email-change-request.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser?.id,
          role,
          newEmail: pendingEmailChange,
        }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setEmailVerifyError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setEmailVerifyError(result.message ?? "Unable to resend verification code.")
        return
      }

      // Send email via Vercel serverless function
      if (result.code) {
        api("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: result.email ?? pendingEmailChange,
            name: result.name ?? "",
            code: result.code,
            type: "email-change",
            expiryMinutes: 10,
          }),
        }).catch(() => {
          // Email failure is non-fatal
        })
      }

      // Reset the timer and code
      setEmailVerifyRemainingSeconds(10 * 60)
      setEmailVerifyExpired(false)
      setEmailVerifyDigits(Array(6).fill(""))
      emailVerifyInputRefs.current[0]?.focus()
    } catch {
      setEmailVerifyError("Unable to connect to the verification service. Please try again.")
    } finally {
      setIsResendingEmailCode(false)
    }
  }

  const handleCancelEmailVerify = () => {
    setShowEmailVerifyModal(false)
    setPendingEmailChange("")
    setEmailVerifyDigits(Array(6).fill(""))
    setEmailVerifyError("")
    setEmailVerifySuccess(false)
    // Revert the email in the form back to the original
    setFormData((current) => ({ ...current, email: originalEmail }))
  }

  const handleReLogin = () => {
    clearStoredAuthUser()
    setAuthUser(null)
    setShowPasswordChangeModal(false)
    navigate("/auth/login", { replace: true, state: { passwordChanged: true } })
  }

  return (
    <ShellComponent role={role}>
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-brown-900">My Account</h1>
          <p className="text-sm text-brown-500">
            Review your {roleNoun} profile, upload a profile picture, and keep your personal information updated.
          </p>
        </div>

        <MessageModal
          open={showProfileModal}
          title={isSuccess ? "Profile Updated" : "Profile Update Error"}
          message={serverMessage}
          type={isSuccess ? "success" : "error"}
          onClose={() => setShowProfileModal(false)}
        />

        {isLoading ? (
          <div className="rounded-3xl border border-brown-200 bg-white p-10 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 rounded bg-brown-200" />
              <div className="h-24 rounded bg-brown-100" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-14 rounded bg-brown-100" />
                <div className="h-14 rounded bg-brown-100" />
                <div className="h-14 rounded bg-brown-100" />
                <div className="h-14 rounded bg-brown-100" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm">
              <div className="rounded-[1.75rem] bg-gradient-to-br from-brown-900 via-brown-800 to-primary-900 p-6 text-white">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    {previewUrl ? (
                      <img src={previewUrl} alt={fullName || `${fallbackName} profile`} className="h-28 w-28 rounded-full border-4 border-white/25 object-cover shadow-xl" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-white">
                        <UserCircleIcon className="h-16 w-16" />
                      </div>
                    )}
                    <label className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-brown-900 shadow-lg transition hover:scale-105">
                      <CameraIcon className="h-5 w-5" />
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageChange} />
                    </label>
                  </div>

                  <h2 className="mt-5 text-2xl font-black tracking-tight">{fullName || fallbackName}</h2>
                  <p className="mt-1 text-sm text-primary-100">{formData.role || fallbackName}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Login Details</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <IdentificationIcon className="mt-0.5 h-5 w-5 text-brown-400" />
                      <div>
                        <p className="font-semibold text-brown-900">ID Number</p>
                        <p className="text-brown-500">{formData.idNumber || "Not available"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <IdentificationIcon className="mt-0.5 h-5 w-5 text-brown-400" />
                      <div>
                        <p className="font-semibold text-brown-900">Username</p>
                        <p className="text-brown-500">{formData.username || "Not available"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <EnvelopeIcon className="mt-0.5 h-5 w-5 text-brown-400" />
                      <div>
                        <p className="font-semibold text-brown-900">Email</p>
                        <p className="break-all text-brown-500">{formData.email || "Not available"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <p>Username is a read-only identifier. Email changes require verification via a code sent to the new email address.</p>
                  </div>
                </div>

                {errors.profileImage ? <p className="text-xs font-semibold text-rose-600">{errors.profileImage}</p> : null}
              </div>
            </aside>

            <div className="space-y-8">
              <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-8">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Profile Information</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Edit personal information</h2>
                  <p className="mt-2 text-sm leading-6 text-brown-500">
                    Keep your {roleNoun} account details complete. Username is a read-only identifier. Changing your email will require verification.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">First Name</label>
                      <div className="relative">
                        <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                        <input
                          type="text"
                          value={formData.firstname}
                          onChange={(event) => handleChange("firstname", event.target.value)}
                          className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3.5 pl-11 pr-4 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          required
                        />
                      </div>
                      {errors.firstname ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.firstname}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Middle Name</label>
                      <input
                        type="text"
                        value={formData.middlename}
                        onChange={(event) => handleChange("middlename", event.target.value)}
                        className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastname}
                        onChange={(event) => handleChange("lastname", event.target.value)}
                        className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        required
                      />
                      {errors.lastname ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.lastname}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">ID Number</label>
                      <div className="relative">
                        <IdentificationIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                        <input
                          type="text"
                          value={formData.idNumber}
                          className="w-full cursor-not-allowed rounded-xl border border-brown-200 bg-brown-100 py-3.5 pl-11 pr-4 text-sm text-brown-500"
                          readOnly
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Username</label>
                      <div className="relative">
                        <IdentificationIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                        <input
                          type="text"
                          value={formData.username}
                          className="w-full cursor-not-allowed rounded-xl border border-brown-200 bg-brown-100 py-3.5 pl-11 pr-4 text-sm text-brown-500"
                          readOnly
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Email</label>
                      <div className="relative">
                        <EnvelopeIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(event) => handleChange("email", event.target.value)}
                          className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3.5 pl-11 pr-4 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      {errors.email ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.email}</p> : null}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Role</label>
                    <input
                      type="text"
                      value={formData.role}
                      className="w-full cursor-not-allowed rounded-xl border border-brown-200 bg-brown-100 px-4 py-3.5 text-sm text-brown-500"
                      readOnly
                    />
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-brown-200 bg-brown-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center justify-center rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving Changes..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-8">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Security</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Change password</h2>
                  <p className="mt-2 text-sm leading-6 text-brown-500">
                    Enter your current password, choose a new one with at least 8 characters, and confirm it before saving.
                  </p>
                </div>

                <MessageModal
                  open={showPasswordMsgModal}
                  title={passwordSuccess ? "Password Changed" : "Password Change Error"}
                  message={passwordMessage}
                  type={passwordSuccess ? "success" : "error"}
                  onClose={() => setShowPasswordMsgModal(false)}
                />

                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Current Password</label>
                      <div className="relative">
                        <LockClosedIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                        <input
                          type={showPasswords.currentPassword ? "text" : "password"}
                          value={passwordForm.currentPassword}
                          onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
                          className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3.5 pl-11 pr-12 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility("currentPassword")}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-brown-400 transition-colors hover:text-brown-600"
                          aria-label={showPasswords.currentPassword ? "Hide current password" : "Show current password"}
                        >
                          {showPasswords.currentPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      {passwordErrors.currentPassword ? <p className="mt-2 text-xs font-semibold text-rose-600">{passwordErrors.currentPassword}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">New Password</label>
                      <div className="relative">
                        <KeyIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                        <input
                          type={showPasswords.newPassword ? "text" : "password"}
                          value={passwordForm.newPassword}
                          onChange={(event) => handlePasswordChange("newPassword", event.target.value)}
                          className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3.5 pl-11 pr-12 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility("newPassword")}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-brown-400 transition-colors hover:text-brown-600"
                          aria-label={showPasswords.newPassword ? "Hide new password" : "Show new password"}
                        >
                          {showPasswords.newPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      {passwordErrors.newPassword ? <p className="mt-2 text-xs font-semibold text-rose-600">{passwordErrors.newPassword}</p> : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Confirm New Password</label>
                      <div className="relative">
                        <KeyIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                        <input
                          type={showPasswords.confirmPassword ? "text" : "password"}
                          value={passwordForm.confirmPassword}
                          onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                          className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3.5 pl-11 pr-12 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility("confirmPassword")}
                          className="absolute inset-y-0 right-0 flex items-center pr-4 text-brown-400 transition-colors hover:text-brown-600"
                          aria-label={showPasswords.confirmPassword ? "Hide confirm new password" : "Show confirm new password"}
                        >
                          {showPasswords.confirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                      </div>
                      {passwordErrors.confirmPassword ? <p className="mt-2 text-xs font-semibold text-rose-600">{passwordErrors.confirmPassword}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-brown-200 bg-brown-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="inline-flex items-center justify-center rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-md rounded-[2rem] border border-brown-200 bg-white p-7 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="password-change-title"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircleIcon className="h-8 w-8" />
              </div>
              <h3 id="password-change-title" className="mt-5 text-2xl font-black tracking-tight text-brown-900">
                Password changed successfully
              </h3>
              <p className="mt-3 text-sm leading-6 text-brown-500">
                For security, you need to log in again to confirm this password change. Continue to the login page and sign in using your new password.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleReLogin}
                  className="inline-flex items-center justify-center rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800"
                >
                  Login Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ─── Email Change Verification Modal ───────────────── */}
      <AnimatePresence>
        {showEmailVerifyModal ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-md rounded-[2rem] border border-brown-200 bg-white p-7 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="email-verify-title"
            >
              {/* Success State */}
              {emailVerifySuccess ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircleIcon className="h-8 w-8" />
                  </div>
                  <h3 id="email-verify-title" className="mt-5 text-2xl font-black tracking-tight text-brown-900">
                    Email address updated successfully
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-brown-500">
                    Your email address has been changed to <span className="font-semibold text-brown-900">{pendingEmailChange}</span>. All future communications will be sent to this address.
                  </p>
                </>
              ) : (
                <>
                  {/* Verification Header */}
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                    <ShieldCheckIcon className="h-8 w-8" />
                  </div>
                  <h3 id="email-verify-title" className="mt-5 text-2xl font-black tracking-tight text-brown-900">
                    Verify Email Change
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brown-500">
                    We sent a 6-digit verification code to
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <EnvelopeIcon className="h-4 w-4 text-primary-500" />
                    <span className="text-sm font-bold text-primary-600">{pendingEmailChange}</span>
                  </div>

                  {/* Error */}
                  {emailVerifyError ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                      {emailVerifyError}
                    </div>
                  ) : null}

                  {/* Code Input */}
                  <div className="mt-6">
                    <div className="flex justify-center gap-3">
                      {emailVerifyDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { emailVerifyInputRefs.current[index] = el }}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleEmailVerifyDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleEmailVerifyKeyDown(index, e)}
                          onPaste={handleEmailVerifyPaste}
                          disabled={isVerifyingEmail || emailVerifyExpired}
                          className={`w-12 h-14 text-center text-xl font-black rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                            digit
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-brown-200 bg-brown-50 text-brown-900"
                          } ${isVerifyingEmail ? "opacity-60" : ""} ${
                            emailVerifyExpired ? "border-rose-300 bg-rose-50" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="mt-4 text-center">
                    {emailVerifyExpired ? (
                      <p className="text-sm font-bold text-rose-600">
                        Code expired. Please request a new one.
                      </p>
                    ) : (
                      <p className="text-sm text-brown-500">
                        Code expires in{" "}
                        <span
                          className={`font-bold tabular-nums ${
                            emailVerifyRemainingSeconds <= 60 ? "text-rose-600" : "text-primary-600"
                          }`}
                        >
                          {formatCountdown(emailVerifyRemainingSeconds)}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Verify Button */}
                  <button
                    type="button"
                    onClick={() => handleEmailVerify()}
                    disabled={isVerifyingEmail || getFullEmailVerifyCode().length !== 6 || emailVerifyExpired}
                    className="mt-4 w-full inline-flex items-center justify-center rounded-xl bg-brown-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVerifyingEmail ? (
                      <>
                        <div className="mr-2 h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </button>

                  {/* Resend */}
                  <div className="mt-4 text-center">
                    <p className="text-sm text-brown-500">
                      Didn't receive the code?{" "}
                      {emailVerifyExpired ? (
                        <button
                          type="button"
                          onClick={handleResendEmailCode}
                          disabled={isResendingEmailCode}
                          className="text-primary-600 font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {isResendingEmailCode ? (
                            <>
                              <div className="h-3 w-3 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <ArrowPathIcon className="h-3.5 w-3.5" />
                              Resend Code
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-brown-400">
                          Resend available in {formatCountdown(emailVerifyRemainingSeconds)}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Cancel */}
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={handleCancelEmailVerify}
                      disabled={isVerifyingEmail}
                      className="text-sm text-brown-400 font-medium hover:text-brown-600 transition-colors disabled:opacity-50"
                    >
                      Cancel and keep current email
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ShellComponent>
  )
}
