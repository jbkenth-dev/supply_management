import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { formatDateTime as manilaFormatDateTime } from "../../lib/date"
import {
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { api } from "../../lib/api"
import { MessageModal } from "../../components/ui/MessageModal"

type Department = {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

type DepartmentResponse = {
  success: boolean
  departments?: Department[]
  department?: Department
  message?: string
  errors?: {
    name?: string
  }
}

const DEPARTMENTS_PER_PAGE = 8

export default function AdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [departmentName, setDepartmentName] = useState("")
  const [nameError, setNameError] = useState("")
  const [serverMessage, setServerMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [showMessageModal, setShowMessageModal] = useState(false)

  const isEditing = editingDepartment !== null
  const filteredDepartments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) {
      return departments
    }

    return departments.filter((department) => department.name.toLowerCase().includes(normalizedSearch))
  }, [departments, searchTerm])
  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / DEPARTMENTS_PER_PAGE))
  const paginatedDepartments = useMemo(() => {
    const startIndex = (currentPage - 1) * DEPARTMENTS_PER_PAGE
    return filteredDepartments.slice(startIndex, startIndex + DEPARTMENTS_PER_PAGE)
  }, [currentPage, filteredDepartments])
  const paginationStart = filteredDepartments.length === 0 ? 0 : (currentPage - 1) * DEPARTMENTS_PER_PAGE + 1
  const paginationEnd = Math.min(currentPage * DEPARTMENTS_PER_PAGE, filteredDepartments.length)

  const loadDepartments = async () => {
    setIsLoading(true)

    try {
      const response = await api("/api/admin-departments.php")
      const result = (await response.json()) as DepartmentResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unexpected server error.")
      }

      setDepartments(result.departments ?? [])
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unexpected server error.")
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDepartments()
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
    if (serverMessage) {
      setShowMessageModal(true)
    }
  }, [serverMessage])

  const resetForm = () => {
    setDepartmentName("")
    setNameError("")
    setEditingDepartment(null)
  }

  const openCreateModal = () => {
    resetForm()
    setServerMessage("")
    setIsSuccess(false)
    setIsFormModalOpen(true)
  }

  const openEditModal = (department: Department) => {
    setEditingDepartment(department)
    setDepartmentName(department.name)
    setNameError("")
    setServerMessage("")
    setIsSuccess(false)
    setIsFormModalOpen(true)
  }

  const closeFormModal = () => {
    if (isSubmitting) {
      return
    }

    setIsFormModalOpen(false)
    resetForm()
  }

  const openDeleteModal = (department: Department) => {
    setDeleteTarget(department)
    setServerMessage("")
    setIsSuccess(false)
  }

  const closeDeleteModal = () => {
    if (isDeleteSubmitting) {
      return
    }

    setDeleteTarget(null)
  }

  const handleNameChange = (value: string) => {
    setDepartmentName(value)
    setNameError("")
    setServerMessage("")
    setIsSuccess(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = departmentName.trim()

    if (!name) {
      setNameError("Department name is required.")
      setServerMessage("Department name is required.")
      setIsSuccess(false)
      return
    }

    const duplicate = departments.some(
      (department) =>
        department.name.toLowerCase() === name.toLowerCase() &&
        (!isEditing || department.id !== editingDepartment.id)
    )

    if (duplicate) {
      setNameError("Department already exists.")
      setServerMessage("Department already exists.")
      setIsSuccess(false)
      return
    }

    setIsSubmitting(true)
    setServerMessage("")
    setIsSuccess(false)

    try {
      const response = await api("/api/admin-departments.php", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingDepartment?.id,
          name,
        }),
      })
      const result = (await response.json()) as DepartmentResponse

      if (!response.ok || !result.success) {
        setNameError(result.errors?.name ?? "")
        throw new Error(result.message ?? "Unexpected server error.")
      }

      if (result.department) {
        const savedDepartment = result.department
        setDepartments((current) => {
          if (isEditing) {
            return current
              .map((department) => (department.id === savedDepartment.id ? savedDepartment : department))
              .sort((left, right) => left.name.localeCompare(right.name))
          }

          return [savedDepartment, ...current].sort((left, right) => left.name.localeCompare(right.name))
        })
      }

      setServerMessage(result.message ?? (isEditing ? "Department updated successfully." : "Department created successfully."))
      setIsSuccess(true)
      setIsFormModalOpen(false)
      resetForm()
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unexpected server error.")
      setIsSuccess(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }

    setIsDeleteSubmitting(true)
    setServerMessage("")
    setIsSuccess(false)

    try {
      const response = await api("/api/admin-departments.php", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const result = (await response.json()) as DepartmentResponse

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unexpected server error.")
      }

      setDepartments((current) => current.filter((department) => department.id !== deleteTarget.id))
      setDeleteTarget(null)
      setServerMessage(result.message ?? "Department deleted successfully.")
      setIsSuccess(true)
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Unable to delete because users are assigned.")
      setIsSuccess(false)
    } finally {
      setIsDeleteSubmitting(false)
    }
  }

  return (
    <AppShell role="Administrator">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Admin Department</p>
            <h1 className="text-3xl font-black tracking-tight text-brown-900">Department Management</h1>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800"
          >
            <PlusIcon className="h-5 w-5" />
            Add Department
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Department Directory</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Registered departments</h2>
            </div>
            <p className="text-sm text-brown-500">
              {filteredDepartments.length} of {departments.length} departments
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
                placeholder="Search by department name"
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
          ) : departments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-brown-200 bg-brown-50 px-5 py-10 text-center">
              <BuildingOfficeIcon className="mx-auto h-10 w-10 text-brown-300" />
              <p className="mt-4 text-sm font-semibold text-brown-900">No departments yet</p>
              <p className="mt-2 text-sm text-brown-500">Use the Add Department button to create the first department.</p>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-brown-200 bg-brown-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-brown-900">No departments match your search</p>
              <p className="mt-2 text-sm text-brown-500">Try a different department keyword.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-brown-200">
                  <thead className="bg-brown-50">
                    <tr>
                      <TableHead>Department Name</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brown-100 bg-white">
                    {paginatedDepartments.map((department) => (
                      <tr key={department.id} className="align-top hover:bg-brown-50/80">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brown-200 text-brown-600">
                              <BuildingOfficeIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-brown-900">{department.name}</p>
                              <p className="mt-1 text-xs text-brown-500">Created {formatDate(department.createdAt)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(department.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(department)}
                              className="inline-flex items-center gap-2 rounded-xl border border-brown-200 px-3 py-2 text-sm font-semibold text-brown-600 transition hover:bg-brown-100"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(department)}
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

              <div className="flex flex-col gap-3 border-t border-brown-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-brown-500">
                  Showing {paginationStart} to {paginationEnd} of {filteredDepartments.length} results
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
        <ModalShell onClose={closeFormModal} maxWidthClassName="max-w-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Department Form</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">
                {isEditing ? "Edit department" : "Add department"}
              </h2>
              <p className="mt-2 text-sm text-brown-500">
                {isEditing ? "Update the selected department name." : "Enter a unique department name."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeFormModal}
              className="rounded-xl border border-brown-200 p-2 text-brown-500 transition hover:bg-brown-50"
              aria-label="Close department form"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <FormField label="Department Name" error={nameError}>
              <input
                type="text"
                value={departmentName}
                onChange={(event) => handleNameChange(event.target.value)}
                className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3.5 text-sm text-brown-900 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </FormField>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeFormModal}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-5 py-3 text-sm font-semibold text-brown-600 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <BuildingOfficeIcon className="h-5 w-5" />
                {isSubmitting ? "Saving..." : isEditing ? "Save Department" : "Create Department"}
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-500">Delete Department</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Delete this department?</h2>
              <p className="mt-3 text-sm leading-6 text-brown-500">
                You are deleting <span className="font-semibold text-brown-900">{deleteTarget.name}</span>. This action
                cannot be undone.
              </p>
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
              {isDeleteSubmitting ? "Deleting..." : "Delete Department"}
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

function formatDate(value: string) {
  return manilaFormatDateTime(value)
}
