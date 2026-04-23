import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  PhotoIcon,
  TagIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import type { AuthRole } from "../../lib/auth"
import type { SupplyCategory, SupplyItem } from "../../types/adminInventory"

type CategoryForm = {
  name: string
}

type SupplyForm = {
  categoryId: string
  itemCode: string
  name: string
  description: string
}

type FieldErrors = Record<string, string>
type DeleteTarget =
  | { type: "category"; id: number; name: string }
  | { type: "supply"; id: number; name: string }
type ViewMode = "category" | "supply"

const initialCategoryForm: CategoryForm = {
  name: "",
}

const initialSupplyForm: SupplyForm = {
  categoryId: "",
  itemCode: "",
  name: "",
  description: "",
}

export default function SupplyManagementPage({ role }: { role: Extract<AuthRole, "Administrator" | "Property Custodian"> }) {
  const [categories, setCategories] = useState<SupplyCategory[]>([])
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [categoryQuery, setCategoryQuery] = useState("")
  const [supplyQuery, setSupplyQuery] = useState("")
  const [selectedSupplyCategory, setSelectedSupplyCategory] = useState("")
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(initialCategoryForm)
  const [categoryErrors, setCategoryErrors] = useState<FieldErrors>({})
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [supplyForm, setSupplyForm] = useState<SupplyForm>(initialSupplyForm)
  const [supplyErrors, setSupplyErrors] = useState<FieldErrors>({})
  const [editingSupplyId, setEditingSupplyId] = useState<number | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [message, setMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("category")
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false)

  useEffect(() => {
    void loadSupplyData()
  }, [])

  useEffect(() => {
    if (!message) {
      return
    }

    const timer = window.setTimeout(() => {
      setMessage("")
      setIsSuccess(false)
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!selectedImage) {
      return
    }

    const objectUrl = URL.createObjectURL(selectedImage)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedImage])

  const filteredCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()

    return categories.filter((category) =>
      category.name.toLowerCase().includes(query),
    )
  }, [categories, categoryQuery])

  const filteredSupplies = useMemo(() => {
    const query = supplyQuery.trim().toLowerCase()

    return supplies.filter((supply) => {
      const haystack = [
        supply.name,
        supply.itemCode,
        supply.categoryName,
        supply.description,
      ]
        .join(" ")
        .toLowerCase()

      const matchesQuery = haystack.includes(query)
      const matchesCategory = selectedSupplyCategory === "" || String(supply.categoryId) === selectedSupplyCategory

      return matchesQuery && matchesCategory
    })
  }, [selectedSupplyCategory, supplies, supplyQuery])

  async function loadSupplyData() {
    setLoading(true)

    try {
      const response = await fetch("/api/admin-supply.php")
      const result = await response.json()

      if (!response.ok) {
        setMessage(result.message ?? "Unable to load supply records.")
        setIsSuccess(false)
        return
      }

      applySnapshot(result)
    } catch {
      setMessage("Unable to connect to the supply service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setLoading(false)
    }
  }

  function applySnapshot(result: { categories?: SupplyCategory[]; supplies?: SupplyItem[]; message?: string }) {
    setCategories(result.categories ?? [])
    setSupplies(result.supplies ?? [])

    if (result.message) {
      setMessage(result.message)
      setIsSuccess(true)
    }
  }

  function resetCategoryForm() {
    setCategoryForm(initialCategoryForm)
    setCategoryErrors({})
    setEditingCategoryId(null)
  }

  function resetSupplyForm() {
    setSupplyForm(initialSupplyForm)
    setSupplyErrors({})
    setEditingSupplyId(null)
    setSelectedImage(null)
    setPreviewUrl("")
  }

  function closeSupplyModal() {
    setIsSupplyModalOpen(false)
    resetSupplyForm()
  }

  function openCreateSupplyModal() {
    resetSupplyForm()
    setIsSupplyModalOpen(true)
  }

  function handleSupplyImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSupplyErrors((current) => ({ ...current, image: "" }))

    if (!file) {
      setSelectedImage(null)
      if (!editingSupplyId) {
        setPreviewUrl("")
      }
      return
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    const maxSize = 2 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      setSupplyErrors((current) => ({
        ...current,
        image: "Supply image must be a JPG, PNG, or WEBP file.",
      }))
      return
    }

    if (file.size > maxSize) {
      setSupplyErrors((current) => ({
        ...current,
        image: "Supply image must be 2MB or smaller.",
      }))
      return
    }

    setSelectedImage(file)
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyAction("category")
    setCategoryErrors({})
    setMessage("")

    try {
      const response = await fetch("/api/admin-supply.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: editingCategoryId ? "update_category" : "create_category",
          id: editingCategoryId,
          name: categoryForm.name,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setCategoryErrors(result.errors ?? {})
        setMessage(result.message ?? "Unable to save category.")
        setIsSuccess(false)
        return
      }

      applySnapshot(result)
      resetCategoryForm()
    } catch {
      setMessage("Unable to connect to the supply service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleCategoryDelete(category: SupplyCategory) {
    setBusyAction(`delete-category-${category.id}`)
    setMessage("")

    try {
      const response = await fetch("/api/admin-supply.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete_category",
          id: category.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result.message ?? "Unable to delete category.")
        setIsSuccess(false)
        return
      }

      applySnapshot(result)
      if (editingCategoryId === category.id) {
        resetCategoryForm()
      }
    } catch {
      setMessage("Unable to connect to the supply service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSupplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyAction("supply")
    setSupplyErrors({})
    setMessage("")

    if (!editingSupplyId && !selectedImage) {
      setSupplyErrors({
        image: "Supply image is required.",
      })
      setMessage("Please add a supply image before saving.")
      setIsSuccess(false)
      return
    }

    const payload = new FormData()
    payload.append("action", editingSupplyId ? "update_supply" : "create_supply")

    if (editingSupplyId) {
      payload.append("id", String(editingSupplyId))
    }

    payload.append("categoryId", supplyForm.categoryId)
    payload.append("itemCode", supplyForm.itemCode)
    payload.append("name", supplyForm.name)
    payload.append("description", supplyForm.description)

    if (selectedImage) {
      payload.append("image", selectedImage)
    }

    try {
      const response = await fetch("/api/admin-supply.php", {
        method: "POST",
        body: payload,
      })

      const result = await response.json()

      if (!response.ok) {
        setSupplyErrors(result.errors ?? {})
        setMessage(result.message ?? "Unable to save supply.")
        setIsSuccess(false)
        return
      }

      applySnapshot(result)
      closeSupplyModal()
    } catch {
      setMessage("Unable to connect to the supply service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSupplyDelete(supply: SupplyItem) {
    setBusyAction(`delete-supply-${supply.id}`)
    setMessage("")

    try {
      const response = await fetch("/api/admin-supply.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete_supply",
          id: supply.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result.message ?? "Unable to delete supply.")
        setIsSuccess(false)
        return
      }

      applySnapshot(result)
      if (editingSupplyId === supply.id) {
        resetSupplyForm()
      }
    } catch {
      setMessage("Unable to connect to the supply service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setBusyAction(null)
    }
  }

  function startCategoryEdit(category: SupplyCategory) {
    setEditingCategoryId(category.id)
    setCategoryForm({ name: category.name })
    setCategoryErrors({})
  }

  function startSupplyEdit(supply: SupplyItem) {
    setEditingSupplyId(supply.id)
    setSupplyForm({
      categoryId: String(supply.categoryId),
      itemCode: supply.itemCode,
      name: supply.name,
      description: supply.description,
    })
    setSupplyErrors({})
    setSelectedImage(null)
    setPreviewUrl(supply.imagePath)
    setIsSupplyModalOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    if (deleteTarget.type === "category") {
      const category = categories.find((item) => item.id === deleteTarget.id)

      if (category) {
        await handleCategoryDelete(category)
      }
    }

    if (deleteTarget.type === "supply") {
      const supply = supplies.find((item) => item.id === deleteTarget.id)

      if (supply) {
        await handleSupplyDelete(supply)
      }
    }

    setDeleteTarget(null)
  }

  return (
    <AppShell role={role}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Admin Supply</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Supply Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Manage categories and supply records for each supply item.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSupplyData()}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Refresh Data
          </button>
        </div>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Workspace</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Choose what to manage</h2>
            </div>
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
              <ToggleButton
                label="Category"
                active={viewMode === "category"}
                onClick={() => setViewMode("category")}
              />
              <ToggleButton
                label="Supply"
                active={viewMode === "supply"}
                onClick={() => setViewMode("supply")}
              />
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {message ? (
            <motion.div
              key={message}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {message}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          {viewMode === "category" ? (
            <motion.section
              key="category-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]"
            >
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Category</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                    {editingCategoryId ? "Edit Category" : "Add Category"}
                  </h2>
                </div>

                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Category Name</label>
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(event) => setCategoryForm({ name: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Office Supplies"
                    />
                    {categoryErrors.name ? <p className="mt-2 text-xs font-semibold text-rose-600">{categoryErrors.name}</p> : null}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={busyAction === "category"}
                      className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "category" ? "Saving..." : editingCategoryId ? "Save Category" : "Add Category"}
                    </button>
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Category</p>
                    <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Category List</h2>
                  </div>
                  <div className="relative w-full max-w-sm">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={categoryQuery}
                      onChange={(event) => setCategoryQuery(event.target.value)}
                      placeholder="Search category"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {loading ? (
                    <LoadingBlock lines={5} />
                  ) : filteredCategories.length === 0 ? (
                    <EmptyCard title="No categories found" description="Create a category to start grouping your supplies." />
                  ) : (
                    filteredCategories.map((category) => (
                      <div key={category.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">{category.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{category.supplyCount} linked supplies</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <IconButton label="Edit category" onClick={() => startCategoryEdit(category)}>
                              <PencilSquareIcon className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label="Delete category"
                              onClick={() => setDeleteTarget({ type: "category", id: category.id, name: category.name })}
                              disabled={busyAction === `delete-category-${category.id}`}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </motion.section>
          ) : (
            <motion.section
              key="supply-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Supply</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Supply List</h2>
                </div>
                <div className="flex w-full flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
                  <div className="w-full lg:max-w-xs">
                    <select
                      value={selectedSupplyCategory}
                      onChange={(event) => setSelectedSupplyCategory(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">All categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative w-full lg:max-w-sm">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={supplyQuery}
                      onChange={(event) => setSupplyQuery(event.target.value)}
                      placeholder="Search supply"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  {selectedSupplyCategory || supplyQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplyCategory("")
                        setSupplyQuery("")
                      }}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Clear Filters
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={openCreateSupplyModal}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Supply
                  </button>
                </div>
              </div>

              {loading ? (
                <LoadingBlock lines={6} />
              ) : filteredSupplies.length === 0 ? (
                <EmptyCard title="No supplies found" description="Save a supply record to build your stock catalog." />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredSupplies.map((supply) => (
                    <article key={supply.id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                      <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <div className="bg-slate-100">
                          {supply.imagePath ? (
                            <img src={supply.imagePath} alt={supply.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full min-h-44 items-center justify-center text-slate-300">
                              <TagIcon className="h-14 w-14" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">{supply.categoryName}</p>
                              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{supply.name}</h3>
                              <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{supply.itemCode}</p>
                            </div>
                            <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                              {supply.quantityOnHand.toLocaleString()} in stock
                            </div>
                          </div>

                          <p className="text-sm leading-6 text-slate-500">
                            {supply.description || "No description added yet."}
                          </p>

                          <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                            <span className="rounded-full bg-slate-100 px-3 py-1">Code: {supply.itemCode}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              Updated {formatDateTime(supply.updatedAt)}
                            </span>
                          </div>

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => startSupplyEdit(supply)}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <PencilSquareIcon className="mr-2 h-4 w-4" />
                              Edit Supply
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: "supply", id: supply.id, name: supply.name })}
                              disabled={busyAction === `delete-supply-${supply.id}`}
                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Delete Supply
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isSupplyModalOpen ? (
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
              className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="supply-modal-title"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Supply</p>
                  <h2 id="supply-modal-title" className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    {editingSupplyId ? "Edit Supply" : "Add Supply"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeSupplyModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSupplySubmit} className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Category</label>
                    <select
                      value={supplyForm.categoryId}
                      onChange={(event) => setSupplyForm((current) => ({ ...current, categoryId: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {supplyErrors.categoryId ? <p className="mt-2 text-xs font-semibold text-rose-600">{supplyErrors.categoryId}</p> : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Item Code</label>
                    <input
                      type="text"
                      value={supplyForm.itemCode}
                      onChange={(event) => setSupplyForm((current) => ({ ...current, itemCode: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="PAPER_A4_001"
                    />
                    {supplyErrors.itemCode ? <p className="mt-2 text-xs font-semibold text-rose-600">{supplyErrors.itemCode}</p> : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Supply Name</label>
                    <input
                      type="text"
                      value={supplyForm.name}
                      onChange={(event) => setSupplyForm((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="A4 Bond Paper"
                    />
                    {supplyErrors.name ? <p className="mt-2 text-xs font-semibold text-rose-600">{supplyErrors.name}</p> : null}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Description</label>
                    <textarea
                      value={supplyForm.description}
                      onChange={(event) => setSupplyForm((current) => ({ ...current, description: event.target.value }))}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Short description of the supply item"
                    />
                    {supplyErrors.description ? <p className="mt-2 text-xs font-semibold text-rose-600">{supplyErrors.description}</p> : null}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-4">
                  <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Supply Image <span className="text-rose-500">*</span>
                  </label>
                  <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-[1.25rem] border border-slate-200 bg-white p-4 text-center transition hover:border-blue-300 hover:bg-blue-50/50">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Supply preview" className="h-36 w-full rounded-xl object-cover" />
                    ) : (
                      <>
                        <PhotoIcon className="h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-600">Add Supply with image</p>
                        <p className="mt-1 text-xs text-slate-400">JPG, PNG, or WEBP up to 2MB</p>
                      </>
                    )}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSupplyImageChange} />
                  </label>
                  {supplyErrors.image ? <p className="mt-2 text-xs font-semibold text-rose-600">{supplyErrors.image}</p> : null}
                </div>

                <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeSupplyModal}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyAction === "supply"}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "supply" ? "Saving..." : editingSupplyId ? "Save Supply" : "Add Supply"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}

        {deleteTarget ? (
          <DeleteConfirmModal
            title={deleteTarget.type === "category" ? "Delete Category" : "Delete Supply"}
            itemName={deleteTarget.name}
            description={
              deleteTarget.type === "category"
                ? "This will remove the category permanently if no supplies are assigned to it."
                : "This will remove the supply permanently if it does not have stock history."
            }
            isDeleting={busyAction === `delete-${deleteTarget.type}-${deleteTarget.id}`}
            onCancel={() => {
              if (busyAction !== `delete-${deleteTarget.type}-${deleteTarget.id}`) {
                setDeleteTarget(null)
              }
            }}
            onConfirm={() => void confirmDelete()}
          />
        ) : null}
      </AnimatePresence>
    </AppShell>
  )
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-28 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  )
}

function LoadingBlock({ lines }: { lines: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-16 rounded-2xl bg-slate-100" />
      ))}
    </div>
  )
}

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "just now"
  }

  const date = new Date(value.replace(" ", "T"))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function DeleteConfirmModal({
  title,
  itemName,
  description,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  title: string
  itemName: string
  description: string
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
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
        className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <ExclamationTriangleIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100">Confirm Action</p>
              <h3 id="delete-confirm-title" className="mt-2 text-2xl font-black tracking-tight">
                {title}
              </h3>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-600">{description}</p>
            <p className="mt-3 text-base font-bold text-slate-900">{itemName}</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This action cannot be undone.
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete Now"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
