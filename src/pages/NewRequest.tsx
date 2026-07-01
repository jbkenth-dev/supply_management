import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { ToastContainer, type ToastProps } from "../components/ui/Toast"
import { api } from "../lib/api"
import { getStoredAuthUser } from "../lib/auth"
import type { SupplyItem } from "../types/adminInventory"

type CatalogResponse = {
  success: boolean
  supplies: SupplyItem[]
  message?: string
}

type CartItem = {
  supplyId: number | null
  name: string
  itemCode: string
  imagePath: string
  categoryName: string
  quantity: number
  unitCost: number
  totalAmount: number
  isCustom: boolean
  customItemName: string
}

const DEPARTMENTS = [
  "College of Arts and Sciences",
  "College of Business and Accountancy",
  "College of Education",
  "College of Engineering and Technology",
  "College of Nursing and Health Sciences",
  "Senior High School Department",
  "Junior High School Department",
  "Elementary Department",
  "Administration Office",
  "Finance Office",
  "Registrar's Office",
  "Library",
  "Guidance Office",
  "MIS/IT Office",
  "Property and Supply Office",
]

export default function NewRequest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [purpose, setPurpose] = useState("")
  const [department, setDepartment] = useState("")
  const [dateNeeded, setDateNeeded] = useState("")
  const [notes, setNotes] = useState("")
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const [customItemName, setCustomItemName] = useState("")
  const [customItemQuantity, setCustomItemQuantity] = useState(1)
  const [customItemCost, setCustomItemCost] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const authUser = getStoredAuthUser()
  const preselectedItemCode = searchParams.get("itemCode")?.trim().toUpperCase() ?? ""
  const customNameInputRef = useRef<HTMLInputElement>(null)

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  const pushToast = (toast: Omit<ToastProps, "onDismiss">) => {
    setToasts((current) => [...current, { ...toast, onDismiss: removeToast }])
  }

  useEffect(() => {
    let cancelled = false

    const loadSupplies = async () => {
      setLoading(true)

      try {
        const response = await api("/api/public-supplies.php")
        const result = (await response.json()) as CatalogResponse

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Unable to load supply catalog.")
        }

        if (!cancelled) {
          setSupplies(result.supplies ?? [])
        }
      } catch (error) {
        if (!cancelled) {
          setSupplies([])
          pushToast({
            id: `catalog-error-${Date.now()}`,
            title: "Catalog Load Failed",
            message: error instanceof Error ? error.message : "Unable to load supply catalog.",
            type: "error",
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSupplies()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!preselectedItemCode || supplies.length === 0) {
      return
    }

    const preselectedSupply = supplies.find((supply) => supply.itemCode.toUpperCase() === preselectedItemCode)

    if (!preselectedSupply || preselectedSupply.quantityOnHand < 1) {
      return
    }

    const existingIndex = cart.findIndex((item) => item.supplyId === preselectedSupply.id)
    if (existingIndex >= 0) return

    setCart((current) => [
      ...current,
      {
        supplyId: preselectedSupply.id,
        name: preselectedSupply.name,
        itemCode: preselectedSupply.itemCode,
        imagePath: preselectedSupply.imagePath,
        categoryName: preselectedSupply.categoryName,
        quantity: 1,
        unitCost: 0,
        totalAmount: 0,
        isCustom: false,
        customItemName: "",
      },
    ])
  }, [preselectedItemCode, supplies]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSupplies = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return supplies
    }

    return supplies.filter((supply) =>
      [supply.name, supply.itemCode, supply.categoryName, supply.description].some((value) =>
        value.toLowerCase().includes(query)
      )
    )
  }, [search, supplies])

  const addToCart = (supply: SupplyItem) => {
    const existingIndex = cart.findIndex((item) => item.supplyId === supply.id)
    if (existingIndex >= 0) return

    setCart((current) => [
      ...current,
      {
        supplyId: supply.id,
        name: supply.name,
        itemCode: supply.itemCode,
        imagePath: supply.imagePath,
        categoryName: supply.categoryName,
        quantity: 1,
        unitCost: 0,
        totalAmount: 0,
        isCustom: false,
        customItemName: "",
      },
    ])
  }

  const addCustomToCart = () => {
    const name = customItemName.trim()
    if (!name || customItemQuantity < 1) return

    setCart((current) => [
      ...current,
      {
        supplyId: null,
        name: name,
        itemCode: "CUSTOM",
        imagePath: "",
        categoryName: "Other",
        quantity: customItemQuantity,
        unitCost: customItemCost,
        totalAmount: customItemQuantity * customItemCost,
        isCustom: true,
        customItemName: name,
      },
    ])

    setCustomItemName("")
    setCustomItemQuantity(1)
    setCustomItemCost(0)
  }

  const removeFromCart = (index: number) => {
    setCart((current) => current.filter((_, i) => i !== index))
  }

  const updateCartQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    setCart((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, quantity, totalAmount: quantity * item.unitCost }
          : item
      )
    )
  }

  const updateCartUnitCost = (index: number, unitCost: number) => {
    if (unitCost < 0) return
    setCart((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, unitCost, totalAmount: item.quantity * unitCost }
          : item
      )
    )
  }

  const grandTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  }, [cart])

  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0)

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!purpose.trim()) {
      newErrors.purpose = "Purpose is required."
    }

    if (!department) {
      newErrors.department = "Department is required."
    }

    if (cart.length === 0) {
      newErrors.cart = "Add at least one item to your request."
    }

    for (const item of cart) {
      if (!item.isCustom && item.unitCost < 0) {
        newErrors.unitCost = "Unit cost cannot be negative."
      }
      if (item.quantity < 1) {
        newErrors.quantity = "Quantity must be at least 1."
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!authUser?.id || authUser.role !== "Faculty Staff") {
      pushToast({
        id: `auth-error-${Date.now()}`,
        title: "Faculty Login Required",
        message: "Sign in with a faculty account before submitting a request.",
        type: "error",
      })
      return
    }

    if (!validate()) {
      pushToast({
        id: `validation-error-${Date.now()}`,
        title: "Validation Error",
        message: "Please fix the highlighted fields before submitting.",
        type: "warning",
      })
      return
    }

    if (cart.length === 0) {
      pushToast({
        id: `empty-request-${Date.now()}`,
        title: "No Items Selected",
        message: "Add at least one supply item to your request.",
        type: "warning",
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await api("/api/faculty-requests.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: authUser.id,
          role: authUser.role,
          purpose,
          department,
          dateNeeded: dateNeeded || null,
          notes,
          items: cart.map((item) => ({
            supplyId: item.supplyId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalAmount: item.quantity * item.unitCost,
            isCustom: item.isCustom,
            customItemName: item.customItemName,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message ?? "Unable to submit your supply request.")
      }

      setCart([])
      setPurpose("")
      setDepartment("")
      setDateNeeded("")
      setNotes("")
      setErrors({})
      pushToast({
        id: `request-created-${Date.now()}`,
        title: "Request Submitted",
        message: result.message ?? "Your supply request has been submitted.",
        type: "success",
      })
      navigate("/my-requests")
    } catch (error) {
      pushToast({
        id: `request-error-${Date.now()}`,
        title: "Submission Failed",
        message: error instanceof Error ? error.message : "Unable to submit your supply request.",
        type: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell role="Faculty Staff">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="space-y-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Faculty Request</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900">New Supply Request</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
              Fill in the details below to request supplies. Items marked with an asterisk (*) are required.
            </p>
          </div>
          <div className="rounded-2xl border border-brown-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brown-400">Selection</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-brown-900">{cart.length}</p>
            <p className="text-sm text-brown-500">{totalUnits} total quantity{totalUnits === 1 ? "" : "ies"}</p>
          </div>
        </div>

        {/* Request Details Section */}
        <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Request Details</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Purpose & Information</h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Purpose */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brown-500">
                <PencilIcon className="h-4 w-4" />
                Purpose <span className="text-danger-500">*</span>
              </label>
              <textarea
                value={purpose}
                onChange={(e) => { setPurpose(e.target.value); setErrors((prev) => ({ ...prev, purpose: "" })); }}
                rows={3}
                placeholder="Describe the purpose of this request (e.g., Classroom supplies for BSIT 2-A, Office supplies for Admin Department, etc.)"
                className={`mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm text-brown-900 focus:outline-none focus:ring-2 ${
                  errors.purpose
                    ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20"
                    : "border-brown-200 focus:border-primary-500 focus:ring-primary-500/20"
                }`}
              />
              {errors.purpose ? (
                <p className="mt-1.5 text-xs font-semibold text-danger-600">{errors.purpose}</p>
              ) : null}
            </div>

            {/* Department */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brown-500">
                <BuildingOfficeIcon className="h-4 w-4" />
                Department <span className="text-danger-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => { setDepartment(e.target.value); setErrors((prev) => ({ ...prev, department: "" })); }}
                className={`mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm text-brown-900 focus:outline-none focus:ring-2 ${
                  errors.department
                    ? "border-danger-400 focus:border-danger-500 focus:ring-danger-500/20"
                    : "border-brown-200 focus:border-primary-500 focus:ring-primary-500/20"
                }`}
              >
                <option value="">Select a department...</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {errors.department ? (
                <p className="mt-1.5 text-xs font-semibold text-danger-600">{errors.department}</p>
              ) : null}
            </div>

            {/* Date Needed */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brown-500">
                <CalendarDaysIcon className="h-4 w-4" />
                Date Needed
              </label>
              <input
                type="date"
                value={dateNeeded}
                onChange={(e) => setDateNeeded(e.target.value)}
                className="mt-3 w-full rounded-xl border border-brown-200 bg-white px-4 py-3 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Catalog</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Available Supplies</h2>
                <p className="mt-1 text-sm text-brown-500">Click an item to add it to your request.</p>
              </div>
              <label className="relative block w-full sm:max-w-md">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, code, or category"
                  className="w-full rounded-2xl border border-brown-200 bg-brown-50 py-3 pl-11 pr-4 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </label>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-[1.5rem] border border-brown-200 bg-brown-50 p-5">
                      <div className="aspect-[4/3] rounded-[1.25rem] bg-brown-200" />
                      <div className="mt-4 h-4 w-24 rounded-full bg-brown-200" />
                      <div className="mt-3 h-7 w-40 rounded-2xl bg-brown-200" />
                      <div className="mt-4 h-4 w-full rounded-full bg-brown-100" />
                      <div className="mt-2 h-4 w-4/5 rounded-full bg-brown-100" />
                    </div>
                  ))}
                </div>
              ) : filteredSupplies.length === 0 && !search ? (
                <div className="rounded-[1.5rem] border border-dashed border-brown-200 bg-brown-50 px-6 py-12 text-center">
                  <ClipboardDocumentListIcon className="mx-auto h-10 w-10 text-brown-300" />
                  <p className="mt-4 text-sm font-semibold text-brown-900">No supplies found</p>
                  <p className="mt-2 text-sm text-brown-500">Try another search term or use the "Others" option below.</p>
                </div>
              ) : (
                <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
                  {filteredSupplies.map((supply) => {
                    const inCart = cart.some((item) => item.supplyId === supply.id)
                    const outOfStock = supply.quantityOnHand < 1

                    return (
                      <article
                        key={supply.id}
                        className={`group mx-auto flex h-full w-full max-w-[460px] cursor-pointer flex-col overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                          inCart ? "border-primary-300 shadow-lg shadow-primary-100/50 ring-2 ring-primary-200" : outOfStock ? "border-brown-200 opacity-60" : "border-brown-200 hover:border-brown-300"
                        }`}
                        onClick={() => !inCart && !outOfStock && addToCart(supply)}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden border-b border-brown-200 bg-brown-100">
                          <img
                            src={supply.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop"}
                            alt={supply.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brown-950/70 via-brown-950/10 to-transparent px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-brown-700 bg-brown-950/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                                {supply.categoryName}
                              </span>
                              <span className="rounded-full border border-brown-900 bg-brown-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                                {supply.itemCode}
                              </span>
                            </div>
                          </div>
                          {inCart ? (
                            <div className="absolute right-3 top-3 rounded-full bg-primary-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-lg">
                              Added
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-1 flex-col p-4">
                          <h3 className="line-clamp-2 text-[12px] font-black uppercase tracking-[0.08em] text-brown-900">{supply.name}</h3>

                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="flex min-w-0 flex-col rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">In Stock</p>
                              <p className="mt-1 text-[12px] font-black tracking-tight text-brown-900">{supply.quantityOnHand}</p>
                            </div>
                            <div className="flex min-w-0 flex-col rounded-2xl border border-brown-200 bg-brown-50 px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Status</p>
                              <p className="mt-1 text-[12px] font-black tracking-tight text-brown-900">{outOfStock ? "Out of Stock" : "Available"}</p>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}

                  {/* Others - Custom Item Card */}
                  <article className="mx-auto flex h-full w-full max-w-[460px] flex-col overflow-hidden rounded-[1.75rem] border-2 border-dashed border-accent-300 bg-accent-50/50 transition-all duration-300 hover:border-accent-400">
                    <div className="bg-gradient-to-br from-accent-100 to-accent-50 px-5 py-6 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <PencilIcon className="h-6 w-6 text-accent-500" />
                      </div>
                      <p className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-accent-700">Others</p>
                      <p className="mt-1 text-xs text-accent-600">Request an item not in the catalog</p>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Specify Item *</label>
                        <input
                          ref={customNameInputRef}
                          type="text"
                          value={customItemName}
                          onChange={(e) => setCustomItemName(e.target.value)}
                          placeholder="Enter item name..."
                          className="mt-1.5 w-full rounded-xl border border-brown-200 bg-white px-3 py-2.5 text-sm text-brown-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Qty *</label>
                          <input
                            type="number"
                            min="1"
                            value={customItemQuantity}
                            onChange={(e) => setCustomItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="mt-1.5 w-full rounded-xl border border-brown-200 bg-white px-3 py-2.5 text-sm text-brown-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">Unit Cost</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={customItemCost}
                            onChange={(e) => setCustomItemCost(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="mt-1.5 w-full rounded-xl border border-brown-200 bg-white px-3 py-2.5 text-sm text-brown-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addCustomToCart}
                        disabled={!customItemName.trim() || customItemQuantity < 1}
                        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add to Request
                      </button>
                    </div>
                  </article>
                </div>
              )}

              {search && filteredSupplies.length === 0 ? (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-brown-200 bg-brown-50 px-6 py-8 text-center">
                  <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-brown-300" />
                  <p className="mt-3 text-sm font-semibold text-brown-900">No results for "{search}"</p>
                  <p className="mt-1 text-sm text-brown-500">Try a different search term or add a custom item using the "Others" card.</p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Request Summary</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-brown-900">Cart</h2>

              {errors.cart ? (
                <p className="mt-2 text-xs font-semibold text-danger-600">{errors.cart}</p>
              ) : null}

              <div className="mt-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-brown-200 bg-brown-50 px-5 py-8 text-center">
                    <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-brown-300" />
                    <p className="mt-3 text-sm font-semibold text-brown-900">No items added yet</p>
                    <p className="mt-2 text-sm text-brown-500">
                      Click on items from the catalog or use the "Others" card to add custom items.
                    </p>
                  </div>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} className="rounded-[1.25rem] border border-brown-200 bg-brown-50 p-4">
                      <div className="flex items-start gap-3">
                        {!item.isCustom ? (
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-brown-200 bg-white">
                            <img
                              src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop"}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-accent-200 bg-accent-50">
                            <PencilIcon className="h-6 w-6 text-accent-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="truncate font-bold text-brown-900">{item.name}</p>
                              {item.isCustom ? (
                                <span className="mt-0.5 inline-block rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-700">
                                  Custom Item
                                </span>
                              ) : (
                                <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-brown-400">
                                  {item.itemCode}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(index)}
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-brown-200 bg-white text-brown-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-brown-400">Qty</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateCartQuantity(index, Math.max(1, parseInt(e.target.value) || 1))}
                                className="mt-1 w-full rounded-lg border border-brown-200 bg-white px-2 py-1.5 text-center text-xs font-bold text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/20"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-brown-400">Unit Cost</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitCost}
                                onChange={(e) => updateCartUnitCost(index, Math.max(0, parseFloat(e.target.value) || 0))}
                                className="mt-1 w-full rounded-lg border border-brown-200 bg-white px-2 py-1.5 text-center text-xs font-bold text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/20"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-brown-400">Total</label>
                              <div className="mt-1 flex h-8 w-full items-center justify-center rounded-lg border border-brown-200 bg-primary-50 text-xs font-black text-primary-700">
                                ₱{(item.quantity * item.unitCost).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Grand Total */}
              {cart.length > 0 ? (
                <div className="mt-4 rounded-[1.5rem] border-2 border-primary-200 bg-primary-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-700">Grand Total</p>
                    <p className="text-2xl font-black text-primary-900">₱{grandTotal.toFixed(2)}</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 rounded-[1.5rem] border border-brown-200 bg-brown-50 p-4">
                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-brown-500">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Any additional information for the approving body..."
                  className="mt-3 w-full rounded-xl border border-brown-200 bg-white px-4 py-3 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-brown-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
                {submitting ? "Submitting Request..." : "Submit Request"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
