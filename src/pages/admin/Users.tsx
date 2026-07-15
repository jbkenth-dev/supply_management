import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { formatDateTime as manilaFormatDateTime } from "../../lib/date"
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline"
import { api } from "../../lib/api"
import AppShell from "../../layout/AppShell"
import { MessageModal } from "../../components/ui/MessageModal"

type ManagedRole = "Faculty Staff" | "Property Custodian" | "Resource Planning Officer" | "Vice President for Finance" | "College President"

type ApprovalStatus = "pending" | "approved" | "rejected"

type ManagedUser = {
  id: number
  role: ManagedRole
  idNumber: string | null
  firstname: string
  middlename: string | null
  lastname: string
  username: string
  email: string
  profileImageUrl?: string | null
  isVerified: boolean
  approvalStatus: ApprovalStatus
  createdAt: string
  updatedAt: string
}

type UserFormState = {
  role: ManagedRole
  idNumber: string
  firstname: string
  middlename: string
  lastname: string
  username: string
  email: string
  password: string
  confirmPassword: string
}

type FormErrors = Partial<Record<keyof UserFormState, string>>
type ExtendedFormErrors = FormErrors & { profileImage?: string }

type UsersResponse = {
  success: boolean
  users?: ManagedUser[]
  user?: ManagedUser
  message?: string
  errors?: FormErrors
}

const initialForm: UserFormState = {
  role: "Faculty Staff",
  idNumber: "",
  firstname: "",
  middlename: "",
  lastname: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
}

const USERS_PER_PAGE = 8

const OTP_CODE_LENGTH = 6
const OTP_EXPIRY_SECONDS = 5 * 60 // 5 minutes

const RESTRICTED_ROLES: readonly ManagedRole[] = [
  "Resource Planning Officer",
  "Vice President for Finance",
  "College President",
]

function formatOtpCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function AdminUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [formData, setFormData] = useState<UserFormState>(initialForm)
  const [errors, setErrors] = useState<ExtendedFormErrors>({})
  const [serverMessage, setServerMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [approvalTarget, setApprovalTarget] = useState<ManagedUser | null>(null)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve")
  const [isApprovalSubmitting, setIsApprovalSubmitting] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [showMessageModal, setShowMessageModal] = useState(false)

  // OTP verification state
  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_CODE_LENGTH).fill(""))
  const [otpPendingId, setOtpPendingId] = useState<number | null>(null)
  const [otpEmail, setOtpEmail] = useState("")
  const [otpError, setOtpError] = useState("")
  const [otpRemainingSeconds, setOtpRemainingSeconds] = useState(OTP_EXPIRY_SECONDS)
  const [otpIsExpired, setOtpIsExpired] = useState(false)
  const [otpIsVerifying, setOtpIsVerifying] = useState(false)
  const [otpIsResending, setOtpIsResending] = useState(false)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const isEditing = editingUserId !== null
  const formTitle = useMemo(() => (isEditing ? "Edit user account" : "Create new user account"), [isEditing])
  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) {
      return users
    }

    return users.filter((user) => {
      const searchableText = [
        user.idNumber,
        user.firstname,
        user.middlename,
        user.lastname,
        getFullName(user),
        user.username,
        user.email,
        user.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })
  }, [searchTerm, users])
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE))
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE)
  }, [currentPage, filteredUsers])
  const paginationStart = filteredUsers.length === 0 ? 0 : (currentPage - 1) * USERS_PER_PAGE + 1
  const paginationEnd = Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)

  const loadUsers = async () => {
    setIsLoading(true)

    try {
      const response = await api("/api/admin-users.php")
      const result = (await response.json()) as UsersResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load users.")
      }

      setUsers(result.users ?? [])
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unable to load users.")
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!selectedImage) {
      return
    }

    const objectUrl = URL.createObjectURL(selectedImage)
    setImagePreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedImage])

  useEffect(() => {
    if (openDropdownId === null) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setOpenDropdownId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdownId])

  useEffect(() => {
    if (serverMessage) {
      setShowMessageModal(true)
    }
  }, [serverMessage])

  // OTP countdown timer
  useEffect(() => {
    if (!otpModalOpen || otpRemainingSeconds <= 0) {
      if (otpRemainingSeconds <= 0) setOtpIsExpired(true)
      return
    }

    const timer = window.setInterval(() => {
      setOtpRemainingSeconds((prev) => {
        if (prev <= 1) {
          setOtpIsExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [otpModalOpen, otpRemainingSeconds])

  // Auto-focus first OTP input when modal opens
  useEffect(() => {
    if (otpModalOpen) {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    }
  }, [otpModalOpen])

  const resetForm = () => {
    setFormData(initialForm)
    setErrors({})
    setEditingUserId(null)
    setSelectedImage(null)
    setImagePreviewUrl("")
  }

  const closeFormModal = () => {
    setIsFormModalOpen(false)
    resetForm()
    resetOtpState()
  }

  const openCreateModal = () => {
    resetForm()
    setServerMessage("")
    setIsSuccess(false)
    setIsFormModalOpen(true)
  }

  const handleChange = (field: keyof UserFormState, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setServerMessage("")
    setIsSuccess(false)

    // Client-side role uniqueness check for restricted roles
    if (field === "role" && !isEditing) {
      const selectedRole = value as ManagedRole
      if (
        (RESTRICTED_ROLES as readonly string[]).includes(selectedRole) &&
        users.some((u) => u.role === selectedRole)
      ) {
        setErrors((current) => ({
          ...current,
          role: `The role "${selectedRole}" can only have one account.`,
        }))
      }
    }

    // Client-side duplicate checks against existing users
    if (!isEditing && field === "idNumber" && value.trim() !== "") {
      const duplicate = users.find(
        (u) => u.idNumber != null && u.idNumber.toLowerCase() === value.trim().toLowerCase()
      )
      if (duplicate) {
        setErrors((current) => ({
          ...current,
          idNumber: "ID number is already registered.",
        }))
      }
    }

    if (!isEditing && field === "username" && value.trim() !== "") {
      const duplicate = users.find(
        (u) => u.username.toLowerCase() === value.trim().toLowerCase()
      )
      if (duplicate) {
        setErrors((current) => ({
          ...current,
          username: "Username is already taken.",
        }))
      }
    }

    if (!isEditing && field === "email" && value.trim() !== "") {
      const duplicate = users.find(
        (u) => u.email.toLowerCase() === value.trim().toLowerCase()
      )
      if (duplicate) {
        setErrors((current) => ({
          ...current,
          email: "Email is already registered.",
        }))
      }
    }
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedImage(file)
    setErrors((current) => ({ ...current, profileImage: undefined }))
    setServerMessage("")
    setIsSuccess(false)

    if (!file) {
      setImagePreviewUrl(isEditing ? users.find((entry) => entry.id === editingUserId)?.profileImageUrl ?? "" : "")
    }
  }

  const handleEdit = (user: ManagedUser) => {
    setEditingUserId(user.id)
    setFormData({
      role: user.role,
      idNumber: user.idNumber ?? "",
      firstname: user.firstname,
      middlename: user.middlename ?? "",
      lastname: user.lastname,
      username: user.username,
      email: user.email,
      password: "",
      confirmPassword: "",
    })
    setErrors({})
    setServerMessage("")
    setIsSuccess(false)
    setSelectedImage(null)
    setImagePreviewUrl(user.profileImageUrl ?? "")
    setIsFormModalOpen(true)
  }

  const openDeleteModal = (user: ManagedUser) => {
    setDeleteTarget(user)
    setServerMessage("")
    setIsSuccess(false)
  }

  const closeDeleteModal = () => {
    if (isDeleteSubmitting) {
      return
    }

    setDeleteTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }

    setIsDeleteSubmitting(true)
    setServerMessage("")
    setIsSuccess(false)

    try {
      const response = await api("/api/admin-users.php", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const result = (await response.json()) as UsersResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to delete user.")
      }

      setUsers((current) => current.filter((entry) => entry.id !== deleteTarget.id))

      if (editingUserId === deleteTarget.id) {
        resetForm()
        setIsFormModalOpen(false)
      }

      setDeleteTarget(null)
      setServerMessage(result.message ?? "User account deleted successfully.")
      setIsSuccess(true)
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unable to delete user.")
      setIsSuccess(false)
    } finally {
      setIsDeleteSubmitting(false)
    }
  }

  const openApprovalModal = (user: ManagedUser, action: "approve" | "reject") => {
    setApprovalTarget(user)
    setApprovalAction(action)
    setServerMessage("")
    setIsSuccess(false)
  }

  const closeApprovalModal = () => {
    if (isApprovalSubmitting) {
      return
    }
    setApprovalTarget(null)
  }

  const handleApproval = async () => {
    if (!approvalTarget) {
      return
    }

    setIsApprovalSubmitting(true)
    setServerMessage("")
    setIsSuccess(false)

    try {
      const response = await api("/api/admin-users.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalAction,
          id: approvalTarget.id,
        }),
      })

      let result: UsersResponse
      try {
        result = (await response.json()) as UsersResponse
      } catch {
        throw new Error("Server error. Please try again.")
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update user status.")
      }

      if (result.user) {
        const updatedUser = result.user
        setUsers((current) =>
          current.map((entry) => (entry.id === updatedUser.id ? updatedUser : entry))
        )
      }

      const label = approvalAction === "approve" ? "approved" : "rejected"
      setServerMessage(`${getFullName(approvalTarget)} has been ${label}.`)
      setIsSuccess(true)
      setApprovalTarget(null)
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unable to update user status.")
      setIsSuccess(false)
    } finally {
      setIsApprovalSubmitting(false)
    }
  }

  // ---- OTP Handlers (admin create flow) ----

  const resetOtpState = () => {
    setOtpModalOpen(false)
    setOtpDigits(Array(OTP_CODE_LENGTH).fill(""))
    setOtpPendingId(null)
    setOtpEmail("")
    setOtpError("")
    setOtpRemainingSeconds(OTP_EXPIRY_SECONDS)
    setOtpIsExpired(false)
    setOtpIsVerifying(false)
    setOtpIsResending(false)
  }

  const closeOtpModal = () => {
    if (otpIsVerifying || otpIsResending) return
    resetOtpState()
  }

  const getFullOtpCode = useCallback(() => otpDigits.join(""), [otpDigits])

  const handleOtpDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (value !== "" && !/^\d$/.test(value)) return

    const newDigits = [...otpDigits]
    newDigits[index] = value
    setOtpDigits(newDigits)
    setOtpError("")

    if (value !== "" && index < OTP_CODE_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits are filled
    if (value !== "" && index === OTP_CODE_LENGTH - 1) {
      const fullCode = newDigits.join("")
      if (fullCode.length === OTP_CODE_LENGTH) {
        handleOtpVerify(fullCode)
      }
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (otpDigits[index] === "" && index > 0) {
        const newDigits = [...otpDigits]
        newDigits[index - 1] = ""
        setOtpDigits(newDigits)
        otpInputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < OTP_CODE_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_CODE_LENGTH)
    if (pasted.length === 0) return

    const newDigits = [...otpDigits]
    for (let i = 0; i < OTP_CODE_LENGTH; i++) {
      newDigits[i] = pasted[i] ?? ""
    }
    setOtpDigits(newDigits)
    setOtpError("")

    const focusIndex = Math.min(pasted.length, OTP_CODE_LENGTH - 1)
    otpInputRefs.current[focusIndex]?.focus()

    if (pasted.length === OTP_CODE_LENGTH) {
      handleOtpVerify(pasted)
    }
  }

  const handleOtpVerify = async (code?: string) => {
    const fullCode = code ?? getFullOtpCode()

    if (fullCode.length !== OTP_CODE_LENGTH) {
      setOtpError("Please enter all 6 digits.")
      return
    }

    if (otpIsExpired) {
      setOtpError("Verification code has expired. Please request a new one.")
      return
    }

    if (!otpPendingId) return

    // Guard against double-submission (auto-submit + button click race)
    if (otpIsVerifying) return

    setOtpIsVerifying(true)
    setOtpError("")

    try {
      const response = await api("/api/admin-create-verify.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: otpPendingId, code: fullCode }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setOtpError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setOtpError(result.message ?? "Invalid verification code. Please try again.")
        setOtpDigits(Array(OTP_CODE_LENGTH).fill(""))
        otpInputRefs.current[0]?.focus()
        return
      }

      // Success — add user to list and close everything
      if (result.user) {
        setUsers((current) => [result.user, ...current])
      }

      resetOtpState()
      closeFormModal()
      setServerMessage(result.message ?? "User account created successfully.")
      setIsSuccess(true)
    } catch {
      setOtpError("Unable to connect to the verification service. Please try again.")
    } finally {
      setOtpIsVerifying(false)
    }
  }

  const handleOtpResend = async () => {
    if (!otpPendingId) return

    setOtpIsResending(true)
    setOtpError("")

    try {
      const response = await api("/api/resend-verification.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: otpPendingId }),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setOtpError("Server error. Please try again.")
        return
      }

      if (!response.ok) {
        setOtpError(result.message ?? "Unable to resend verification code.")
        return
      }

      // Send verification email via Vercel serverless function
      if (result.code) {
        api("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: result.email ?? otpEmail,
            name: result.name ?? "",
            code: result.code,
            type: "resend",
          }),
        }).catch(() => {
          // Email failure is non-fatal — the code was regenerated
        })
      }

      setOtpRemainingSeconds(OTP_EXPIRY_SECONDS)
      setOtpIsExpired(false)
      setOtpDigits(Array(OTP_CODE_LENGTH).fill(""))
      otpInputRefs.current[0]?.focus()
    } catch {
      setOtpError("Unable to connect to the verification service. Please try again.")
    } finally {
      setOtpIsResending(false)
    }
  }

  // ---- Main form submit handler ----

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setServerMessage("")
    setIsSuccess(false)

    try {
      // --- Editing: direct save (no OTP required) ---
      if (isEditing) {
        const payload = new FormData()
        payload.append("action", "update")
        if (editingUserId !== null) {
          payload.append("id", String(editingUserId))
        }
        payload.append("role", formData.role)
        payload.append("idNumber", formData.idNumber)
        payload.append("firstname", formData.firstname)
        payload.append("middlename", formData.middlename)
        payload.append("lastname", formData.lastname)
        payload.append("username", formData.username)
        payload.append("email", formData.email)
        payload.append("password", formData.password)
        payload.append("confirmPassword", formData.confirmPassword)
        if (selectedImage) {
          payload.append("profileImage", selectedImage)
        }

        const response = await api("/api/admin-users.php", {
          method: "POST",
          body: payload,
        })
        const result = (await response.json()) as UsersResponse

        if (!response.ok || !result.success) {
          setErrors(result.errors ?? {})
          setServerMessage(result.message ?? "Unable to save user.")
          return
        }

        if (result.user) {
          const savedUser = result.user
          setUsers((current) => current.map((entry) => (entry.id === savedUser.id ? savedUser : entry)))
        }

        setServerMessage(result.message ?? "User account updated successfully.")
        setIsSuccess(true)
        closeFormModal()
        return
      }

      // --- Creating: Step 1 — validate, create pending registration, send OTP ---
      // Send as URL-encoded form data (application/x-www-form-urlencoded) so
      // the body always arrives via $_POST on the Awardspace PHP server,
      // even when proxied through Vercel rewrites.
      const formBody = new URLSearchParams({
        role: formData.role,
        idNumber: formData.idNumber,
        firstname: formData.firstname,
        middlename: formData.middlename,
        lastname: formData.lastname,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      })

      const response = await api("/api/admin-create-init.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody.toString(),
      })

      let result: any
      try {
        result = await response.json()
      } catch {
        setServerMessage("Server error. Please try again.")
        setIsSuccess(false)
        return
      }

      if (!response.ok || !result.success) {
        setErrors(result.errors ?? {})
        setServerMessage(result.message ?? "Unable to initiate user creation.")
        setIsSuccess(false)
        return
      }

      // Step 1 succeeded — open OTP verification modal
      setErrors({})
      setOtpPendingId(result.pendingId)
      setOtpEmail(result.email)
      setOtpRemainingSeconds(OTP_EXPIRY_SECONDS)
      setOtpIsExpired(false)
      setOtpDigits(Array(OTP_CODE_LENGTH).fill(""))
      setOtpError("")
      setOtpModalOpen(true)

      // Send email via Vercel serverless function (same as signup flow)
      if (result.code) {
        api("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: result.email,
            name: result.name,
            code: result.code,
            type: "verification",
          }),
        }).catch(() => {
          // Email failure is non-fatal — user can use Resend Code
        })
      }
    } catch {
      setServerMessage("Unable to connect to the PHP user management service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell role="Administrator">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Admin Users</p>
            <h1 className="text-3xl font-black tracking-tight text-brown-900">Manage faculty and custodian accounts</h1>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800"
          >
            <PlusIcon className="h-5 w-5" />
            Create User
          </button>
        </div>

        <MessageModal
          open={showMessageModal}
          title={isSuccess ? "Success" : "Error"}
          message={serverMessage}
          type={isSuccess ? "success" : "error"}
          onClose={() => setShowMessageModal(false)}
        />

        <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">User Directory</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Registered users</h2>
            </div>
            <p className="text-sm text-brown-500">
              {filteredUsers.length} of {users.length} managed accounts
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-brown-400">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, ID number, username, email, or role"
                className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3.5 pl-11 pr-4 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            {searchTerm.trim() ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-4 py-3 text-sm font-semibold text-brown-600 transition hover:bg-brown-50"
              >
                Clear Search
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-brown-100" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-brown-200 bg-brown-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-brown-900">No faculty or custodian accounts yet</p>
              <p className="mt-2 text-sm text-brown-500">Use the Create User button to add the first managed account.</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-brown-200 bg-brown-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-brown-900">No users match your search</p>
              <p className="mt-2 text-sm text-brown-500">
                Try a different name, ID number, username, email, or role keyword.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-brown-200">
                  <thead className="bg-brown-50">
                    <tr>
                      <TableHead>Name</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brown-100 bg-white">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="align-top hover:bg-brown-50/80">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar user={user} />
                            <div>
                              <p className="font-semibold text-brown-900">{getFullName(user)}</p>
                              <p className="mt-1 text-xs text-brown-500">Updated {formatDate(user.updatedAt)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.idNumber ?? "Not set"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              user.role === "Property Custodian"
                                ? "bg-amber-50 text-amber-700"
                                : user.role === "Resource Planning Officer"
                                ? "bg-purple-50 text-purple-700"
                                : user.role === "Vice President for Finance"
                                ? "bg-indigo-50 text-indigo-700"
                                : user.role === "College President"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-primary-50 text-primary-700"
                            }`}
                          >
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {(user.role === "Faculty Staff" || user.role === "Property Custodian") ? (
                            <StatusBadge status={user.approvalStatus} />
                          ) : (
                            <span className="text-xs text-brown-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end" data-dropdown>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-brown-200 px-3 py-2 text-sm font-semibold text-brown-600 transition hover:bg-brown-100"
                              >
                                Actions
                                <ChevronDownIcon className={`h-4 w-4 transition-transform ${openDropdownId === user.id ? 'rotate-180' : ''}`} />
                              </button>

                              {openDropdownId === user.id && (
                                <div className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-brown-200 bg-white py-1 shadow-xl">
                                  {(user.role === "Faculty Staff" || user.role === "Property Custodian") && user.approvalStatus === "pending" && (
                                    <>
                                      <DropdownItem
                                        icon={CheckCircleIcon}
                                        label="Approve"
                                        className="text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => { openApprovalModal(user, "approve"); setOpenDropdownId(null) }}
                                      />
                                      <DropdownItem
                                        icon={XCircleIcon}
                                        label="Reject"
                                        className="text-rose-600 hover:bg-rose-50"
                                        onClick={() => { openApprovalModal(user, "reject"); setOpenDropdownId(null) }}
                                      />
                                      <div className="my-1 border-t border-brown-100" />
                                    </>
                                  )}
                                  <DropdownItem
                                    icon={PencilSquareIcon}
                                    label="Edit"
                                    className="text-brown-600 hover:bg-brown-50"
                                    onClick={() => { handleEdit(user); setOpenDropdownId(null) }}
                                  />
                                  <DropdownItem
                                    icon={TrashIcon}
                                    label="Delete"
                                    className="text-rose-600 hover:bg-rose-50"
                                    onClick={() => { openDeleteModal(user); setOpenDropdownId(null) }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-brown-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-brown-500">
                  Showing {paginationStart} to {paginationEnd} of {filteredUsers.length} results
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-4 py-2 text-sm font-semibold text-brown-600 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Previous
                  </button>
                  <span className="rounded-xl bg-brown-100 px-4 py-2 text-sm font-semibold text-brown-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-4 py-2 text-sm font-semibold text-brown-600 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {isFormModalOpen ? (
        <ModalShell onClose={closeFormModal}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Account Form</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">{formTitle}</h2>
              <p className="mt-2 text-sm text-brown-500">
                {isEditing ? "Update the selected account details. Username and email stay locked for accuracy." : "Enter accurate account information for the new user."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeFormModal}
              className="rounded-xl border border-brown-200 p-2 text-brown-500 transition hover:bg-brown-50"
              aria-label="Close account form"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Profile Picture</label>
              <div className="flex items-center gap-4 rounded-2xl border border-brown-200 bg-brown-50 p-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brown-200">
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold uppercase text-brown-500">
                      {(formData.firstname[0] ?? formData.role[0] ?? "U").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-brown-600 file:mr-4 file:rounded-xl file:border-0 file:bg-brown-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brown-800"
                  />
                  <p className="mt-2 text-xs text-brown-500">JPG, PNG, or WEBP only. Maximum size: 2MB.</p>
                  {errors.profileImage ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.profileImage}</p> : null}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Role</label>
              <select
                value={formData.role}
                onChange={(event) => handleChange("role", event.target.value as ManagedRole)}
                className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="Faculty Staff">Faculty Staff</option>
                <option value="Property Custodian">Property Custodian</option>
                <option value="Resource Planning Officer">Resource Planning Officer</option>
                <option value="Vice President for Finance">Vice President for Finance</option>
                <option value="College President">College President</option>
              </select>
              {errors.role ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.role}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">ID Number</label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={(event) => handleChange("idNumber", event.target.value)}
                placeholder="2024-0001"
                className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              {errors.idNumber ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.idNumber}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="First Name" error={errors.firstname}>
                <input
                  type="text"
                  value={formData.firstname}
                  onChange={(event) => handleChange("firstname", event.target.value)}
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </FormField>

              <FormField label="Middle Name">
                <input
                  type="text"
                  value={formData.middlename}
                  onChange={(event) => handleChange("middlename", event.target.value)}
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </FormField>

              <FormField label="Last Name" error={errors.lastname}>
                <input
                  type="text"
                  value={formData.lastname}
                  onChange={(event) => handleChange("lastname", event.target.value)}
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Username" error={errors.username}>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(event) => handleChange("username", event.target.value)}
                  readOnly={isEditing}
                  className={`w-full rounded-xl border px-4 py-3.5 text-sm transition-all ${
                    isEditing
                      ? "cursor-not-allowed border-brown-200 bg-brown-100 text-brown-500"
                      : "border-brown-200 bg-brown-50 text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  }`}
                />
              </FormField>

              <FormField label="Email" error={errors.email}>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  readOnly={isEditing}
                  className={`w-full rounded-xl border px-4 py-3.5 text-sm transition-all ${
                    isEditing
                      ? "cursor-not-allowed border-brown-200 bg-brown-100 text-brown-500"
                      : "border-brown-200 bg-brown-50 text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  }`}
                />
              </FormField>
            </div>

            {!isEditing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Password" error={errors.password}>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(event) => handleChange("password", event.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </FormField>

                <FormField label="Confirm Password" error={errors.confirmPassword}>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(event) => handleChange("confirmPassword", event.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </FormField>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeFormModal}
                className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-5 py-3 text-sm font-semibold text-brown-600 transition hover:bg-brown-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlusIcon className="h-5 w-5" />
                {isSubmitting ? (isEditing ? "Saving Changes..." : "Creating User...") : isEditing ? "Save User Changes" : "Create User"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {otpModalOpen ? (
        <ModalShell onClose={closeOtpModal} maxWidthClassName="max-w-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-100">
                  <ShieldCheckIcon className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Email Verification</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-brown-900">Verify Email</h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-brown-500">
                We sent a 6-digit verification code to
              </p>
              <div className="mt-2 flex items-center gap-2">
                <EnvelopeIcon className="h-4 w-4 text-primary-500" />
                <span className="text-sm font-bold text-primary-600">{otpEmail}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={closeOtpModal}
              disabled={otpIsVerifying || otpIsResending}
              className="rounded-xl border border-brown-200 p-2 text-brown-500 transition hover:bg-brown-50 disabled:opacity-60"
              aria-label="Close verification"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Error display */}
          {otpError ? (
            <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {otpError}
            </div>
          ) : null}

          {/* OTP Code Input */}
          <div className="mt-6">
            <div className="flex justify-center gap-3">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  disabled={otpIsVerifying || otpIsExpired}
                  className={`w-12 h-14 text-center text-xl font-black rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                    digit
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-brown-200 bg-brown-50 text-brown-900"
                  } ${otpIsVerifying ? "opacity-60" : ""} ${
                    otpIsExpired ? "border-rose-300 bg-rose-50" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="mt-5 text-center">
            {otpIsExpired ? (
              <p className="text-sm font-bold text-rose-600">
                Code expired. Please request a new one.
              </p>
            ) : (
              <p className="text-sm text-brown-500">
                Code expires in{" "}
                <span
                  className={`font-bold tabular-nums ${
                    otpRemainingSeconds <= 60 ? "text-rose-600" : "text-primary-600"
                  }`}
                >
                  {formatOtpCountdown(otpRemainingSeconds)}
                </span>
              </p>
            )}
          </div>

          {/* Verify Button */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleOtpVerify()}
              disabled={otpIsVerifying || getFullOtpCode().length !== OTP_CODE_LENGTH || otpIsExpired}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brown-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {otpIsVerifying ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify Code
                  <CheckCircleIcon className="h-5 w-5" />
                </>
              )}
            </button>

            {/* Resend */}
            <div className="text-center">
              <p className="text-sm text-brown-500 font-medium">
                Didn't receive the code?{" "}
                {otpIsExpired ? (
                  <button
                    type="button"
                    onClick={() => void handleOtpResend()}
                    disabled={otpIsResending}
                    className="inline-flex items-center gap-1 text-primary-600 font-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {otpIsResending ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
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
                    Resend available in {formatOtpCountdown(otpRemainingSeconds)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {approvalTarget ? (
        <ModalShell onClose={closeApprovalModal} maxWidthClassName="max-w-md">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                approvalAction === "approve"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {approvalAction === "approve" ? (
                <CheckCircleIcon className="h-6 w-6" />
              ) : (
                <XCircleIcon className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <p
                className={`text-xs font-bold uppercase tracking-[0.24em] ${
                  approvalAction === "approve" ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {approvalAction === "approve" ? "Approve User" : "Reject User"}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">
                {approvalAction === "approve" ? "Approve this account?" : "Reject this account?"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-brown-500">
                You are about to{" "}
                <span
                  className={`font-semibold ${
                    approvalAction === "approve" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {approvalAction === "approve" ? "approve" : "reject"}
                </span>{" "}
                the account of{" "}
                <span className="font-semibold text-brown-900">
                  {getFullName(approvalTarget)}
                </span>
                .
              </p>
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  approvalAction === "approve"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-rose-100 bg-rose-50 text-rose-700"
                }`}
              >
                Role: {approvalTarget.role}
                <br />
                Email: {approvalTarget.email}
              </div>
              {approvalAction === "approve" && (
                <p className="mt-3 text-xs text-brown-500">
                  An approval email will be sent to the user automatically.
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeApprovalModal}
              disabled={isApprovalSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-5 py-3 text-sm font-semibold text-brown-600 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApproval()}
              disabled={isApprovalSubmitting}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                approvalAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {approvalAction === "approve" ? (
                <CheckCircleIcon className="h-5 w-5" />
              ) : (
                <XCircleIcon className="h-5 w-5" />
              )}
              {isApprovalSubmitting
                ? approvalAction === "approve"
                  ? "Approving..."
                  : "Rejecting..."
                : approvalAction === "approve"
                ? "Approve Account"
                : "Reject Account"}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell onClose={closeDeleteModal} maxWidthClassName="max-w-md">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <ExclamationTriangleIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-500">Delete User</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Delete this account?</h2>
              <p className="mt-3 text-sm leading-6 text-brown-500">
                You are deleting <span className="font-semibold text-brown-900">{getFullName(deleteTarget)}</span>. This action
                cannot be undone.
              </p>
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Role: {deleteTarget.role}
                <br />
                ID Number: {deleteTarget.idNumber ?? "Not set"}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={isDeleteSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-5 py-3 text-sm font-semibold text-brown-600 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleteSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TrashIcon className="h-5 w-5" />
              {isDeleteSubmitting ? "Deleting..." : "Delete User"}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </AppShell>
  )
}

function ModalShell({
  children,
  onClose,
  maxWidthClassName = "max-w-3xl",
}: {
  children: ReactNode
  onClose: () => void
  maxWidthClassName?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-[2rem] border border-brown-200 bg-white p-6 shadow-2xl sm:p-8 ${maxWidthClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">{label}</label>
      {children}
      {error ? <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  )
}

function getFullName(user: Pick<ManagedUser, "firstname" | "middlename" | "lastname">) {
  return [user.firstname, user.middlename, user.lastname].filter(Boolean).join(" ")
}

function Avatar({ user }: { user: ManagedUser }) {
  if (user.profileImageUrl) {
    return <img src={user.profileImageUrl} alt={getFullName(user)} className="h-11 w-11 rounded-full object-cover" />
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brown-200 text-sm font-bold uppercase text-brown-600">
      {(user.firstname[0] ?? user.role[0] ?? "U").toUpperCase()}
    </div>
  )
}

function DropdownItem({
  icon: Icon,
  label,
  className,
  onClick,
}: {
  icon: typeof CheckCircleIcon
  label: string
  className: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors ${className}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <CheckCircleIcon className="h-3.5 w-3.5" />
        Approved
      </span>
    )
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
        <XCircleIcon className="h-3.5 w-3.5" />
        Rejected
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
      <ClockIcon className="h-3.5 w-3.5" />
      Pending
    </span>
  )
}

function formatDate(value: string) {
  return manilaFormatDateTime(value)
}

function TableHead({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-brown-500 ${className}`}>{children}</th>
}

function TableCell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-4 py-4 text-sm text-brown-600 ${className}`}>{children}</td>
}
