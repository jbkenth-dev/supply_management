import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"

type ManagedRole = "Faculty Staff" | "Property Custodian"

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
      const response = await fetch("/api/admin-users.php")
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
      const response = await fetch("/api/admin-users.php", {
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setServerMessage("")
    setIsSuccess(false)

    try {
      const payload = new FormData()
      payload.append("action", isEditing ? "update" : "create")
      if (isEditing && editingUserId !== null) {
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

      const response = await fetch("/api/admin-users.php", {
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
        setUsers((current) => {
          if (isEditing) {
            return current.map((entry) => (entry.id === savedUser.id ? savedUser : entry))
          }

          return [savedUser, ...current]
        })
      }

      setServerMessage(result.message ?? (isEditing ? "User account updated successfully." : "User account created successfully."))
      setIsSuccess(true)
      closeFormModal()
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
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Admin Users</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Manage faculty and custodian accounts</h1>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <PlusIcon className="h-5 w-5" />
            Create User
          </button>
        </div>

        {serverMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {serverMessage}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">User Directory</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Registered users</h2>
            </div>
            <p className="text-sm text-slate-500">
              {filteredUsers.length} of {users.length} managed accounts
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <MagnifyingGlassIcon className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, ID number, username, email, or role"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {searchTerm.trim() ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Clear Search
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">No faculty or custodian accounts yet</p>
              <p className="mt-2 text-sm text-slate-500">Use the Create User button to add the first managed account.</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">No users match your search</p>
              <p className="mt-2 text-sm text-slate-500">
                Try a different name, ID number, username, email, or role keyword.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHead>Name</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="align-top hover:bg-slate-50/80">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar user={user} />
                            <div>
                              <p className="font-semibold text-slate-900">{getFullName(user)}</p>
                              <p className="mt-1 text-xs text-slate-500">Updated {formatDate(user.updatedAt)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.idNumber ?? "Not set"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              user.role === "Property Custodian"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {user.role}
                          </span>
                        </TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(user)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {paginationStart} to {paginationEnd} of {filteredUsers.length} results
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Previous
                  </button>
                  <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Account Form</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{formTitle}</h2>
              <p className="mt-2 text-sm text-slate-500">
                {isEditing ? "Update the selected account details. Username and email stay locked for accuracy." : "Enter accurate account information for the new user."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeFormModal}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              aria-label="Close account form"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Profile Picture</label>
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold uppercase text-slate-500">
                      {(formData.firstname[0] ?? formData.role[0] ?? "U").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                  />
                  <p className="mt-2 text-xs text-slate-500">JPG, PNG, or WEBP only. Maximum size: 2MB.</p>
                  {errors.profileImage ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.profileImage}</p> : null}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Role</label>
              <select
                value={formData.role}
                onChange={(event) => handleChange("role", event.target.value as ManagedRole)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Faculty Staff">Faculty Staff</option>
                <option value="Property Custodian">Property Custodian</option>
              </select>
              {errors.role ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.role}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">ID Number</label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={(event) => handleChange("idNumber", event.target.value)}
                placeholder="2024-0001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {errors.idNumber ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.idNumber}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="First Name" error={errors.firstname}>
                <input
                  type="text"
                  value={formData.firstname}
                  onChange={(event) => handleChange("firstname", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </FormField>

              <FormField label="Middle Name">
                <input
                  type="text"
                  value={formData.middlename}
                  onChange={(event) => handleChange("middlename", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </FormField>

              <FormField label="Last Name" error={errors.lastname}>
                <input
                  type="text"
                  value={formData.lastname}
                  onChange={(event) => handleChange("lastname", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                      : "border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                      : "border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </FormField>

                <FormField label="Confirm Password" error={errors.confirmPassword}>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(event) => handleChange("confirmPassword", event.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </FormField>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeFormModal}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlusIcon className="h-5 w-5" />
                {isSubmitting ? (isEditing ? "Saving Changes..." : "Creating User...") : isEditing ? "Save User Changes" : "Create User"}
              </button>
            </div>
          </form>
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
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Delete this account?</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                You are deleting <span className="font-semibold text-slate-900">{getFullName(deleteTarget)}</span>. This action
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
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 ${maxWidthClassName}`}
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
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>
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
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-bold uppercase text-slate-600">
      {(user.firstname[0] ?? user.role[0] ?? "U").toUpperCase()}
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function TableHead({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 ${className}`}>{children}</th>
}

function TableCell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-4 py-4 text-sm text-slate-600 ${className}`}>{children}</td>
}
