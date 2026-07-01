import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { ToastContainer, type ToastProps } from "../components/ui/Toast"
import { api } from "../lib/api"
import { getStoredAuthUser, getUserDisplayName } from "../lib/auth"
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
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toasts, setToasts] = useState<ToastProps[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [customRowOpen, setCustomRowOpen] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customQty, setCustomQty] = useState(1)
  const [customCost, setCustomCost] = useState(0)
  const authUser = getStoredAuthUser()
  const preselectedItemCode = searchParams.get("itemCode")?.trim().toUpperCase() ?? ""

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
        if (!cancelled) setLoading(false)
      }
    }

    void loadSupplies()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!preselectedItemCode || supplies.length === 0) return
    const preselectedSupply = supplies.find(
      (supply) => supply.itemCode.toUpperCase() === preselectedItemCode
    )
    if (!preselectedSupply || preselectedSupply.quantityOnHand < 1) return
    const existingIndex = items.findIndex((item) => item.supplyId === preselectedSupply.id)
    if (existingIndex >= 0) return

    setItems((current) => [
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
  }, [preselectedItemCode, supplies])

  const filteredSupplies = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return supplies
    return supplies.filter((supply) =>
      [supply.name, supply.itemCode, supply.categoryName, supply.description].some((value) =>
        value.toLowerCase().includes(query)
      )
    )
  }, [search, supplies])

  const addCatalogItem = (supply: SupplyItem) => {
    const existingIndex = items.findIndex((item) => item.supplyId === supply.id)
    if (existingIndex >= 0) return
    setItems((current) => [
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

  const addCustomItem = () => {
    const name = customName.trim()
    if (!name || customQty < 1) return
    setItems((current) => [
      ...current,
      {
        supplyId: null,
        name,
        itemCode: "CUSTOM",
        imagePath: "",
        categoryName: "Other",
        quantity: customQty,
        unitCost: customCost,
        totalAmount: customQty * customCost,
        isCustom: true,
        customItemName: name,
      },
    ])
    setCustomName("")
    setCustomQty(1)
    setCustomCost(0)
    setCustomRowOpen(false)
  }

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index))
  }

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, quantity, totalAmount: quantity * item.unitCost }
          : item
      )
    )
  }

  const updateUnitCost = (index: number, unitCost: number) => {
    if (unitCost < 0) return
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? { ...item, unitCost, totalAmount: item.quantity * unitCost }
          : item
      )
    )
  }

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  }, [items])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!purpose.trim()) newErrors.purpose = "Purpose is required."
    if (!department) newErrors.department = "Department is required."
    if (items.length === 0) newErrors.items = "Add at least one item."
    for (const item of items) {
      if (!item.isCustom && item.unitCost < 0) newErrors.unitCost = "Unit cost cannot be negative."
      if (item.quantity < 1) newErrors.quantity = "Quantity must be at least 1."
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

    if (items.length === 0) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.id,
          role: authUser.role,
          purpose,
          department,
          dateNeeded: dateNeeded || null,
          notes,
          items: items.map((item) => ({
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
      if (!response.ok) throw new Error(result.message ?? "Unable to submit your supply request.")

      setItems([])
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

  /* ─── Catalog Modal ─── */
  const CatalogModal = () => {
    if (!catalogOpen) return null
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-12 sm:pt-24">
        <div className="relative w-full max-w-3xl mx-4 mb-12 bg-white border-2 border-black shadow-xl">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b-2 border-black px-4 py-3 sm:px-6">
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider">Supply Catalog</h2>
              <p className="text-xs text-gray-600 mt-0.5">Click an item to add it to the request form.</p>
            </div>
            <button
              type="button"
              onClick={() => setCatalogOpen(false)}
              className="flex h-8 w-8 items-center justify-center border-2 border-black hover:bg-gray-100"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="border-b-2 border-black px-4 py-3 sm:px-6">
            <label className="relative block">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code, or category..."
                className="w-full border-2 border-black py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </label>
          </div>

          {/* Grid */}
          <div className="max-h-[420px] overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse border-2 border-gray-200 p-4">
                    <div className="aspect-[4/3] bg-gray-200" />
                    <div className="mt-3 h-4 w-3/4 bg-gray-200" />
                    <div className="mt-2 h-3 w-1/2 bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : filteredSupplies.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 py-12 text-center">
                <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-3 text-sm font-semibold text-gray-700">No supplies found</p>
                <p className="mt-1 text-xs text-gray-500">Try a different search term.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSupplies.map((supply) => {
                  const inCart = items.some((item) => item.supplyId === supply.id)
                  const outOfStock = supply.quantityOnHand < 1
                  return (
                    <button
                      key={supply.id}
                      type="button"
                      disabled={inCart || outOfStock}
                      onClick={() => { addCatalogItem(supply); setCatalogOpen(false) }}
                      className={`text-left border-2 p-0 transition ${
                        inCart
                          ? "border-gray-400 bg-gray-100 cursor-not-allowed"
                          : outOfStock
                            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                            : "border-black hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <div className="aspect-[4/3] overflow-hidden border-b-2 border-inherit bg-gray-100">
                        <img
                          src={supply.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop"}
                          alt={supply.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-bold uppercase leading-tight">{supply.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="border border-gray-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600">
                            {supply.categoryName}
                          </span>
                          <span className="border border-gray-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600">
                            {supply.itemCode}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] text-gray-500">
                          Stock: {supply.quantityOnHand}
                        </p>
                        {inCart && (
                          <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Already Added</p>
                        )}
                        {outOfStock && (
                          <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Out of Stock</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="border-t-2 border-black px-4 py-3 sm:px-6 text-right">
            <button
              type="button"
              onClick={() => setCatalogOpen(false)}
              className="border-2 border-black px-6 py-1.5 text-sm font-bold hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Render ─── */
  return (
    <AppShell role="Faculty Staff">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex justify-center py-4 sm:py-6">
        <div className="w-full max-w-[210mm] bg-white border-2 border-black shadow-md print:shadow-none">
          {/* ── HEADER ── */}
          <div className="border-b-2 border-black px-6 pb-4 pt-6 text-center sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-700">
              Republic of the Philippines
            </p>
            <h1 className="mt-1 text-lg font-black uppercase tracking-wide sm:text-xl">
              St. Francis College — Guagua
            </h1>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Office of the Property and Supply
            </p>
            <div className="mx-auto my-3 h-0.5 w-24 bg-black" />
            <h2 className="text-base font-black uppercase tracking-[0.15em] sm:text-lg">
              Supply Request Form
            </h2>
            <p className="mt-1.5 text-xs text-gray-700">
              Employee: <span className="font-semibold">{authUser ? getUserDisplayName(authUser, "Faculty Staff") : "—"}</span>
            </p>
          </div>

          {/* ── INFORMATION SECTION ── */}
          <div className="border-b-2 border-black px-6 py-4 sm:px-10">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-12">
              {/* Purpose */}
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold uppercase tracking-wider">
                  Purpose <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => { setPurpose(e.target.value); setErrors((p) => ({ ...p, purpose: "" })) }}
                  rows={2}
                  placeholder="e.g., Classroom supplies for BSIT 2-A"
                  className={`mt-1 w-full border-2 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black ${
                    errors.purpose ? "border-red-600" : "border-black"
                  }`}
                />
                {errors.purpose && <p className="mt-0.5 text-[11px] font-semibold text-red-600">{errors.purpose}</p>}
              </div>

              {/* Department */}
              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold uppercase tracking-wider">
                  Department <span className="text-red-600">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => { setDepartment(e.target.value); setErrors((p) => ({ ...p, department: "" })) }}
                  className={`mt-1 w-full border-2 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black ${
                    errors.department ? "border-red-600" : "border-black"
                  }`}
                >
                  <option value="">Select...</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && <p className="mt-0.5 text-[11px] font-semibold text-red-600">{errors.department}</p>}
              </div>

              {/* Date */}
              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={dateNeeded}
                  onChange={(e) => setDateNeeded(e.target.value)}
                  className="mt-1 w-full border-2 border-black px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>

          {/* ── ITEMS TABLE ── */}
          <div className="px-6 py-4 sm:px-10">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-black text-xs sm:text-sm">
                {/* Table Header */}
                <thead>
                  <tr className="border-b-2 border-black bg-gray-100">
                    <th className="border-r border-black px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider sm:w-[60px]">
                      Qty
                    </th>
                    <th className="border-r border-black px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider">
                      Item / Description
                    </th>
                    <th className="border-r border-black px-2 py-1.5 text-right text-[11px] font-bold uppercase tracking-wider sm:w-[110px]">
                      Unit Cost
                    </th>
                    <th className="px-2 py-1.5 text-right text-[11px] font-bold uppercase tracking-wider sm:w-[120px]">
                      Total Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* Item Rows */}
                  {items.length === 0 && (
                    <tr className="border-b border-black">
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 italic">
                        No items added yet. Use the buttons below to add items.
                      </td>
                    </tr>
                  )}

                  {items.map((item, index) => (
                    <tr key={index} className="border-b border-black">
                      {/* Qty */}
                      <td className="border-r border-black px-1 py-1 sm:px-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(index, Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full border-2 border-black px-1 py-0.5 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black sm:text-sm"
                        />
                      </td>

                      {/* Item / Description */}
                      <td className="border-r border-black px-2 py-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold sm:text-sm">{item.name}</p>
                            {item.isCustom ? (
                              <span className="inline-block border border-gray-400 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                                Custom
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500">{item.itemCode}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-black hover:bg-red-50 hover:border-red-600 hover:text-red-600"
                            title="Remove item"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Unit Cost */}
                      <td className="border-r border-black px-1 py-1 sm:px-2">
                        <div className="flex items-center">
                          <span className="text-[10px] text-gray-600 sm:text-xs">₱</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => updateUnitCost(index, Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full border-2 border-black px-1 py-0.5 text-right text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black sm:text-sm"
                          />
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="px-2 py-1 text-right text-xs font-bold sm:text-sm">
                        ₱{(item.quantity * item.unitCost).toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {/* Empty placeholder rows for printed look */}
                  {items.length > 0 && items.length < 5 && (
                    Array.from({ length: Math.min(5 - items.length, 3) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-black h-8">
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td className="border-r border-black" />
                        <td />
                      </tr>
                    ))
                  )}

                  {/* Add Row / Browse Catalog Row */}
                  <tr className="border-b-2 border-black">
                    <td colSpan={4} className="px-2 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {customRowOpen ? (
                          <div className="flex w-full flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              placeholder="Enter custom item name..."
                              className="flex-1 border-2 border-black px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-black min-w-[180px]"
                            />
                            <label className="flex items-center gap-1 text-xs font-semibold">
                              Qty:
                              <input
                                type="number"
                                min="1"
                                value={customQty}
                                onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 border-2 border-black px-1 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-black"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs font-semibold">
                              Cost:
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={customCost}
                                onChange={(e) => setCustomCost(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-20 border-2 border-black px-1 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-black"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={addCustomItem}
                              disabled={!customName.trim() || customQty < 1}
                              className="border-2 border-black px-3 py-1 text-xs font-bold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => { setCustomRowOpen(false); setCustomName(""); setCustomQty(1); setCustomCost(0) }}
                              className="border-2 border-black px-3 py-1 text-xs font-bold hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setCatalogOpen(true)}
                              className="inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 text-xs font-bold hover:bg-gray-100"
                            >
                              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                              Browse Catalog
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomRowOpen(true)}
                              className="inline-flex items-center gap-1.5 border-2 border-black px-3 py-1 text-xs font-bold hover:bg-gray-100"
                            >
                              <PlusIcon className="h-3.5 w-3.5" />
                              Add Custom Item
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Footer Row */}
                  <tr className="font-bold">
                    <td colSpan={2} className="border-r border-black px-2 py-1.5">
                      <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
                        SOF:
                        <span className="inline-block border-b-2 border-black min-w-[120px]">&nbsp;</span>
                      </span>
                    </td>
                    <td className="border-r border-black px-2 py-1.5 text-right text-[11px] uppercase tracking-wider">
                      Grand Total
                    </td>
                    <td className="px-2 py-1.5 text-right text-sm font-black sm:text-base">
                      ₱{grandTotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {errors.items && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-600">{errors.items}</p>
            )}

            {/* Item count summary */}
            <p className="mt-2 text-[10px] text-gray-500 uppercase tracking-wider">
              Total Items: {items.length} | Total Quantity: {items.reduce((s, i) => s + i.quantity, 0)}
            </p>
          </div>

          {/* ── APPROVAL SECTION ── */}
          <div className="border-t-2 border-black px-6 py-4 sm:px-10">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-black text-[10px] sm:text-xs">
                <thead>
                  <tr className="border-b border-black bg-gray-100">
                    <th className="border-r border-black px-1 py-1.5 text-center font-bold uppercase tracking-wider sm:px-2">
                      Requested By
                    </th>
                    <th className="border-r border-black px-1 py-1.5 text-center font-bold uppercase tracking-wider sm:px-2">
                      Recommended By
                    </th>
                    <th className="border-r border-black px-1 py-1.5 text-center font-bold uppercase tracking-wider sm:px-2">
                      Checked By
                    </th>
                    <th className="border-r border-black px-1 py-1.5 text-center font-bold uppercase tracking-wider sm:px-2">
                      Noted By
                    </th>
                    <th className="px-1 py-1.5 text-center font-bold uppercase tracking-wider sm:px-2">
                      Approved By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {["Requested", "Recommended", "Checked", "Noted", "Approved"].map((label) => (
                      <td key={label} className="border-r border-black last:border-r-0 px-1 py-3 text-center sm:px-2">
                        {/* Signature line */}
                        <div className="mx-auto mb-2 h-px w-3/4 border-t border-black" />
                        <p className="text-[9px] uppercase tracking-wider text-gray-500 sm:text-[10px]">Signature</p>
                        {/* Printed Name */}
                        <p className="mt-3 border-b border-black pb-0.5 text-[10px] font-semibold sm:text-xs">
                          {authUser && label === "Requested" ? getUserDisplayName(authUser, "Faculty Staff") : ""}
                        </p>
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider sm:text-[10px]">Printed Name</p>
                        {/* Position */}
                        <p className="mt-2 border-b border-black pb-0.5 text-[10px] sm:text-xs"></p>
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider sm:text-[10px]">Position / Designation</p>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── NOTES & SUBMIT ── */}
          <div className="border-t-2 border-black px-6 py-4 sm:px-10">
            {/* Notes */}
            <div className="mb-4">
              <label className="text-[11px] font-bold uppercase tracking-wider">Notes / Remarks</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional information for the approving body..."
                className="mt-1 w-full border-2 border-black px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Submit */}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                className="w-full border-2 border-black bg-black px-8 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed sm:w-auto"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
              <p className="text-[10px] text-gray-500 italic">
                Ensure all fields are correctly filled before submitting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Modal */}
      <CatalogModal />
    </AppShell>
  )
}
