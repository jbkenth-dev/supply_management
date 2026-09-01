import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import AppShell from "../layout/AppShell"
import { MessageModal } from "../components/ui/MessageModal"
import { api } from "../lib/api"
import { getStoredAuthUser, getUserDisplayName } from "../lib/auth"
import type { SupplyItem } from "../types/adminInventory"

type CatalogResponse = {
  success: boolean
  supplies: SupplyItem[]
  message?: string
}

type ApprovalPersonnelItem = {
  role: string
  fullName: string
}

type ApprovalPersonnelResponse = {
  success: boolean
  personnel: ApprovalPersonnelItem[]
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
  maxStock: number | null
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [customRowOpen, setCustomRowOpen] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customQty, setCustomQty] = useState(1)
  const [customCost, setCustomCost] = useState(0)
  const [unitCostMap, setUnitCostMap] = useState<Record<number, number>>({})
  const authUser = getStoredAuthUser()
  const preselectedItemCode = searchParams.get("itemCode")?.trim().toUpperCase() ?? ""
  const [showModal, setShowModal] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalMessage, setModalMessage] = useState("")
  const [modalType, setModalType] = useState<"success" | "error">("error")
  const [approvalPersonnel, setApprovalPersonnel] = useState<Record<string, string>>({})
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({})

  const pushMessage = (title: string, message: string, type: "success" | "error") => {
    setModalTitle(title)
    setModalMessage(message)
    setModalType(type)
    setShowModal(true)
  }

  const qtyInputStyle = `
    .qty-input::-webkit-outer-spin-button,
    .qty-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .qty-input[type=number] {
      -moz-appearance: textfield;
    }
  `

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      try {
        // Load supplies
        const suppliesResponse = await api("/api/public-supplies.php")
        const suppliesResult = (await suppliesResponse.json()) as CatalogResponse
        if (!suppliesResponse.ok || !suppliesResult.success) {
          throw new Error(suppliesResult.message ?? "Unable to load supply catalog.")
        }
        if (!cancelled) {
          setSupplies(suppliesResult.supplies ?? [])
        }

        // Load stock entries to compute latest unit cost per supply
        const stockResponse = await api("/api/admin-stock.php")
        const stockResult = await stockResponse.json()
        if (stockResponse.ok && stockResult.success) {
          const entries = stockResult.entries ?? []
          const map: Record<number, number> = {}
          for (const entry of entries) {
            const id = entry.supplyId
            const cost = entry.unitCost ?? 0
            // Keep the latest (assuming entries are sorted descending by createdAt)
            if (!map[id]) {
              map[id] = cost
            }
          }
          if (!cancelled) {
            setUnitCostMap(map)
          }
        } else {
          // If fails, keep empty map
          if (!cancelled) setUnitCostMap({})
        }
      } catch (error) {
        if (!cancelled) {
          setSupplies([])
          setUnitCostMap({})
          pushMessage(
            "Catalog Load Failed",
            error instanceof Error ? error.message : "Unable to load supply catalog.",
            "error"
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadApprovalPersonnel = async () => {
      try {
        const roles = "Immediate Head,Resource Planning Officer,Vice President for Finance,College President"
        const response = await api(`/api/approval-personnel-info.php?roles=${encodeURIComponent(roles)}`)
        const result = (await response.json()) as ApprovalPersonnelResponse
        if (!response.ok || !result.success) return
        if (cancelled) return

        const map: Record<string, string> = {}
        for (const p of result.personnel ?? []) {
          map[p.role] = p.fullName
        }
        setApprovalPersonnel(map)
      } catch {
        // Non-fatal — signatures will show empty
      }
    }

    void loadApprovalPersonnel()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!preselectedItemCode || supplies.length === 0) return
    const preselectedSupply = supplies.find(
      (supply) => supply.itemCode.toUpperCase() === preselectedItemCode
    )
    if (!preselectedSupply || preselectedSupply.quantityOnHand < 1) return
    const existingIndex = items.findIndex((item) => item.supplyId === preselectedSupply.id)
    if (existingIndex >= 0) return

    setItems((current) => [...current, buildCatalogCartItem(preselectedSupply)])
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
    const unitCost = unitCostMap[supply.id] ?? 0
    setItems((current) => [
      ...current,
      {
        supplyId: supply.id,
        name: supply.name,
        itemCode: supply.itemCode,
        imagePath: supply.imagePath,
        categoryName: supply.categoryName,
        quantity: 1,
        unitCost,
        totalAmount: unitCost,
        isCustom: false,
        customItemName: "",
        maxStock: supply.quantityOnHand,
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
        maxStock: null,
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

  const clampQuantity = (nextQuantity: number, maxStock: number | null) => {
    const minimumQuantity = 1
    const maximumQuantity = maxStock !== null ? maxStock : Number.MAX_SAFE_INTEGER
    return Math.min(Math.max(nextQuantity, minimumQuantity), maximumQuantity)
  }

  const updateItemQuantity = (index: number, nextQuantity: number) => {
    setQtyDrafts((current) => {
      const next = { ...current }
      delete next[`qty-${index}`]
      return next
    })

    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        const safeQuantity = clampQuantity(nextQuantity, item.maxStock)

        return {
          ...item,
          quantity: safeQuantity,
          totalAmount: safeQuantity * item.unitCost,
        }
      })
    )
  }

  const handleManualQuantityInput = (index: number, rawValue: string) => {
    const draftKey = `qty-${index}`

    if (rawValue === "") {
      setQtyDrafts((current) => ({ ...current, [draftKey]: "" }))
      return
    }

    const trimmedValue = rawValue.trim()
    if (!trimmedValue) {
      setQtyDrafts((current) => ({ ...current, [draftKey]: "" }))
      return
    }

    const parsedValue = Number(trimmedValue)
    if (!Number.isFinite(parsedValue)) return

    setQtyDrafts((current) => ({ ...current, [draftKey]: trimmedValue }))

    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        return {
          ...item,
          quantity: parsedValue,
          totalAmount: parsedValue * item.unitCost,
        }
      })
    )
  }

  const commitManualQuantity = (index: number) => {
    const draftKey = `qty-${index}`
    const rawDraft = qtyDrafts[draftKey]

    setQtyDrafts((current) => {
      const next = { ...current }
      delete next[draftKey]
      return next
    })

    if (rawDraft === undefined) return

    const trimmedDraft = rawDraft.trim()
    if (trimmedDraft === "") {
      setItems((current) =>
        current.map((item, itemIndex) => {
          if (itemIndex !== index) return item
          const fallbackQuantity = clampQuantity(item.quantity, item.maxStock)
          return {
            ...item,
            quantity: fallbackQuantity,
            totalAmount: fallbackQuantity * item.unitCost,
          }
        })
      )
      return
    }

    const parsedValue = Number(trimmedDraft)
    if (!Number.isFinite(parsedValue)) {
      setItems((current) =>
        current.map((item, itemIndex) => {
          if (itemIndex !== index) return item
          const fallbackQuantity = clampQuantity(item.quantity, item.maxStock)
          return {
            ...item,
            quantity: fallbackQuantity,
            totalAmount: fallbackQuantity * item.unitCost,
          }
        })
      )
      return
    }

    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        const safeQuantity = clampQuantity(parsedValue < 1 ? 1 : parsedValue, item.maxStock)

        return {
          ...item,
          quantity: safeQuantity,
          totalAmount: safeQuantity * item.unitCost,
        }
      })
    )
  }

  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  }, [items])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!purpose.trim()) newErrors.purpose = "Purpose is required."
    if (!department) newErrors.department = "Department is required."
    if (!dateNeeded) newErrors.dateNeeded = "Date is required."
    if (items.length === 0) newErrors.items = "Add at least one item."
    for (const item of items) {
      if (item.unitCost < 0) newErrors.unitCost = "Unit cost cannot be negative."
      if (item.quantity < 1) newErrors.quantity = "Quantity must be at least 1."
      if (item.maxStock !== null && item.quantity > item.maxStock) {
        // This shouldn't happen due to blur clamping, but just in case
        newErrors.quantity = `Quantity cannot exceed available stock (${item.maxStock}).`
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!authUser?.id || authUser.role !== "Faculty Staff") {
      pushMessage("Faculty Login Required", "Sign in with a faculty account before submitting a request.", "error")
      return
    }

    if (!validate()) {
      pushMessage("Validation Error", "Please fix the highlighted fields before submitting.", "error")
      return
    }

    const parseResponseJson = async (response: Response) => {
      const text = await response.text()
      if (!text) return {}

      try {
        return JSON.parse(text)
      } catch {
        const cleaned = text
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()

        throw new Error(cleaned || `Request failed with status ${response.status}.`)
      }
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

      const result = await parseResponseJson(response)
      if (!response.ok) throw new Error(result.message ?? "Unable to submit your supply request.")

      setItems([])
      setPurpose("")
      setDepartment("")
      setDateNeeded("")
      setNotes("")
      setErrors({})
      pushMessage("Request Submitted", result.message ?? "Your supply request has been submitted.", "success")
      navigate("/my-requests")
    } catch (error) {
      pushMessage("Submission Failed", error instanceof Error ? error.message : "Unable to submit your supply request.", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <AppShell role="Faculty Staff">
      <style dangerouslySetInnerHTML={{ __html: qtyInputStyle }} />
      <MessageModal
        open={showModal}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onClose={() => setShowModal(false)}
      />

      <div className="flex justify-center py-4 sm:py-6">
        <div className="w-full max-w-[210mm] overflow-hidden rounded-[1.75rem] border border-brown-200 bg-white shadow-sm print:rounded-none print:shadow-none">
          <div className="border-b border-brown-200 bg-gradient-to-b from-brown-50 to-white px-6 pb-5 pt-6 text-center sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary-600">
              Saint Francis College, Guihulngan, Negros Oriental, Incorporated
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brown-500">
              Bateria, Poblacion, Guihulngan City, Negros Oriental
            </p>
            <h1 className="mt-2 text-lg font-black uppercase tracking-wide text-brown-900 sm:text-xl">
              OFFICE OF THE VICE PRESIDENT FOR FINANCE
            </h1>
            <div className="mx-auto my-4 h-0.5 w-24 rounded-full bg-primary-500" />
            <h2 className="text-base font-black uppercase tracking-[0.15em] text-brown-900 sm:text-lg">
              REQUEST FORM
            </h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brown-500">
              (<span className="font-semibold text-brown-800">
                {authUser ? getUserDisplayName(authUser, "Faculty Staff") : "-"}
              </span>)
            </p>
          </div>

          <div className="border-b border-brown-200 px-6 py-4 sm:px-10">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                  Purpose <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value)
                    setErrors((previous) => ({ ...previous, purpose: "" }))
                  }}
                  rows={2}
                  placeholder="e.g., Classroom supplies for BSIT 2-A"
                  className={`mt-1 w-full rounded-xl border bg-brown-50 px-3 py-2 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                    errors.purpose ? "border-rose-300 bg-rose-50" : "border-brown-200"
                  }`}
                />
                {errors.purpose ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors.purpose}</p> : null}
              </div>

              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                  Department <span className="text-rose-600">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value)
                    setErrors((previous) => ({ ...previous, department: "" }))
                  }}
                  className={`mt-1 w-full rounded-xl border bg-brown-50 px-3 py-2 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                    errors.department ? "border-rose-300 bg-rose-50" : "border-brown-200"
                  }`}
                >
                  <option value="">Select...</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors.department}</p> : null}
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                  Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={dateNeeded}
                  onChange={(e) => {
                    setDateNeeded(e.target.value)
                    setErrors((previous) => ({ ...previous, dateNeeded: "" }))
                  }}
                  className={`mt-1 w-full rounded-xl border bg-brown-50 px-3 py-2 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                    errors.dateNeeded ? "border-rose-300 bg-rose-50" : "border-brown-200"
                  }`}
                />
                {errors.dateNeeded ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{errors.dateNeeded}</p> : null}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 sm:px-10">
            <div className="overflow-x-auto rounded-2xl border border-brown-200">
              <table className="w-full border-collapse table-fixed text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-brown-200 bg-brown-100">
                    <TableHead className="w-[130px] text-center">Qty</TableHead>
                    <TableHead className="min-w-0">Item / Description</TableHead>
                    <TableHead className="w-[110px] text-right">Unit Cost</TableHead>
                    <TableHead className="w-[120px] border-r-0 text-right">Total Amount</TableHead>
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr className="border-b border-brown-200">
                      <td colSpan={4} className="px-4 py-8 text-center text-sm italic text-brown-400">
                        No items added yet. Use the buttons below to add items.
                      </td>
                    </tr>
                  ) : null}

                  {items.map((item, index) => (
                    <tr key={`${item.itemCode}-${index}`} className="border-b border-brown-200">
                      <TableCell className="w-[130px] py-2 align-middle">
                        <div className="mx-auto flex w-[100px] items-center justify-between gap-1.5 rounded-xl border border-brown-200 bg-white p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(index, item.quantity - 1)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base font-bold text-brown-700 transition hover:bg-brown-100"
                            aria-label={`Decrease quantity for ${item.name}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.maxStock ?? undefined}
                            value={qtyDrafts[`qty-${index}`] ?? item.quantity}
                            onFocus={() => {
                              setQtyDrafts((current) => ({ ...current, [`qty-${index}`]: String(item.quantity) }))
                            }}
                            onChange={(e) => handleManualQuantityInput(index, e.target.value)}
                            onBlur={() => commitManualQuantity(index)}
                            className="qty-input w-[28px] min-w-[28px] border-0 bg-transparent px-0 py-0 text-center text-xs font-bold text-brown-900 outline-none"
                            aria-label={`Quantity for ${item.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(index, item.quantity + 1)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base font-bold text-brown-700 transition hover:bg-brown-100"
                            aria-label={`Increase quantity for ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                        {item.maxStock !== null && qtyDrafts[`qty-${index}`] === undefined && item.quantity >= item.maxStock ? (
                          <div className="mt-1 text-center text-[9px] font-bold uppercase tracking-wider text-amber-700">
                            Reached Max {item.maxStock}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-0 py-2 align-middle">
                        <div className="flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden">
                          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                            <img
                              src={item.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop"}
                              alt={item.name}
                              className="h-8 w-8 flex-shrink-0 rounded border border-brown-200 bg-brown-100 object-cover"
                            />
                            <div className="min-w-0 flex-1 overflow-hidden text-left leading-tight">
                              <p className="truncate text-[11px] font-bold uppercase tracking-[0.04em] text-brown-900">{item.name}</p>
                              {item.isCustom ? (
                                <span className="mt-0.5 inline-block rounded-full bg-accent-100 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary-600">
                                  Custom
                                </span>
                              ) : (
                                <span className="mt-0.5 block truncate text-[9px] font-medium text-brown-400">{item.itemCode}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-brown-200 bg-white text-brown-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Remove ${item.name}`}
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right w-[110px]">
                        <div className="text-xs font-bold text-brown-900">
                          ₱{item.unitCost.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="border-r-0 text-right text-xs font-bold text-brown-900 sm:text-sm w-[120px]">
                        <div className="text-xs font-bold text-brown-900">
                          ₱{(item.quantity * item.unitCost).toFixed(2)}
                        </div>
                      </TableCell>
                    </tr>
                  ))}

                  <tr className="border-b border-brown-200 bg-brown-50">
                    <td colSpan={4} className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {customRowOpen ? (
                          <div className="flex w-full flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              placeholder="Enter custom item name..."
                              className="min-w-[180px] flex-1 rounded-xl border border-brown-200 bg-white px-3 py-2 text-xs text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                            <NumberField label="Qty" value={customQty} onChange={setCustomQty} min={1} />
                            <NumberField label="Cost" value={customCost} onChange={setCustomCost} min={0} step="0.01" />
                            <button
                              type="button"
                              onClick={addCustomItem}
                              disabled={!customName.trim() || customQty < 1}
                              className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomRowOpen(false)
                                setCustomName("")
                                setCustomQty(1)
                                setCustomCost(0)
                              }}
                              className="rounded-xl border border-brown-200 bg-white px-4 py-2 text-xs font-bold text-brown-700 transition hover:bg-brown-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setCatalogOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-brown-200 bg-white px-4 py-2 text-xs font-bold text-brown-700 transition hover:border-brown-300 hover:bg-brown-100"
                            >
                              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                              Browse Supply
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomRowOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-700"
                            >
                              <img src="/sfcg-logo.jpg" alt="Add custom item" className="h-4 w-4 rounded-sm object-cover" />
                              Add Custom Item
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  <tr className="bg-white font-bold">
                    <td colSpan={2} className="border-r border-brown-200 px-3 py-2">
                      <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-brown-600">
                        SOF:
                        <span className="inline-block min-w-[120px] border-b border-brown-300">&nbsp;</span>
                      </span>
                    </td>
                    <td className="border-r border-brown-200 px-3 py-2 text-right text-[11px] uppercase tracking-wider text-brown-600">
                      Grand Total
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-black text-brown-900 sm:text-base">
                      PHP {grandTotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {errors.items ? <p className="mt-2 text-[11px] font-semibold text-rose-600">{errors.items}</p> : null}

            <p className="mt-3 text-[10px] uppercase tracking-wider text-brown-400">
              Total Items: {items.length} | Total Quantity: {totalQuantity}
            </p>
          </div>

          <div className="border-t border-brown-200 px-6 py-4 sm:px-10">
            <div className="overflow-x-auto rounded-2xl border border-brown-200">
              <table className="w-full border-collapse text-[10px] sm:text-xs">
                <thead>
                  <tr className="border-b border-brown-200 bg-brown-100">
                    {["Requested By", "Recommended By", "Checked By", "Noted By", "Approved By"].map((label) => (
                      <th key={label} className="border-r border-brown-200 px-2 py-2 align-middle text-center font-bold uppercase tracking-wider text-brown-600 last:border-r-0">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {(["Requested", "Recommended", "Checked", "Noted", "Approved"] as const).map((label) => {
                      const printedName = label === "Requested"
                        ? (authUser ? getUserDisplayName(authUser, "Faculty Staff") : "")
                        : label === "Recommended"
                        ? (approvalPersonnel["Immediate Head"] ?? "")
                        : label === "Checked"
                        ? (approvalPersonnel["Resource Planning Officer"] ?? "")
                        : label === "Noted"
                        ? (approvalPersonnel["Vice President for Finance"] ?? "")
                        : label === "Approved"
                        ? (approvalPersonnel["College President"] ?? "")
                        : ""
                      const position = label === "Recommended"
                        ? "Immediate Head"
                        : label === "Checked"
                        ? "Resource Planning Officer"
                        : label === "Noted"
                        ? "Vice President for Finance"
                        : label === "Approved"
                        ? "College President"
                        : ""
                      return (
                        <td key={label} className="border-r border-brown-200 px-2 py-4 align-middle text-center last:border-r-0">
                          <div className="mx-auto mb-2 h-px w-3/4 border-t border-brown-300" />
                          <p className="text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Signature</p>
                          <p className="mt-3 text-[10px] sm:text-xs">{printedName}</p>
                          <div className="mx-auto mt-1 h-px w-full border-t border-brown-300" />
                          <p className="mt-1 text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Printed Name</p>
                          <p className="mt-2 text-[10px] sm:text-xs">{position}</p>
                          <div className="mx-auto mt-1 h-px w-full border-t border-brown-300" />
                          <p className="mt-1 text-[9px] uppercase tracking-wider text-brown-400 sm:text-[10px]">Position / Designation</p>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-brown-200 px-6 py-4 sm:px-10">
            <div className="mb-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-brown-600">Notes / Remarks</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional information for the approving body..."
                className="mt-1 w-full rounded-xl border border-brown-200 bg-brown-50 px-3 py-2 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                className="w-full rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
              <p className="text-[10px] italic text-brown-400">
                Ensure all fields are correctly filled before submitting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {catalogOpen ? (
        <CatalogModal
          loading={loading}
          search={search}
          setSearch={setSearch}
          supplies={filteredSupplies}
          items={items}
          addCatalogItem={addCatalogItem}
          close={() => setCatalogOpen(false)}
          unitCostMap={unitCostMap}
        />
      ) : null}
    </AppShell>
  )
}

function buildCatalogCartItem(supply: SupplyItem): CartItem {
  return {
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
    maxStock: supply.quantityOnHand,
  }
}

function TableHead({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`border-r border-brown-200 px-3 py-2 align-middle text-left text-[11px] font-bold uppercase tracking-wider text-brown-600 ${className}`}>
      {children}
    </th>
  )
}

function TableCell({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`border-r border-brown-200 px-2 py-2 align-middle ${className}`}>
      {children}
    </td>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step = "1",
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  step?: string
}) {
  return (
    <label className="flex items-center gap-1 text-xs font-semibold text-brown-600">
      {label}:
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.min(Number(e.target.value) || min))}
        className="w-20 rounded-xl border border-brown-200 bg-white px-2 py-2 text-center text-xs text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
    </label>
  )
}

function CatalogModal({
  loading,
  search,
  setSearch,
  supplies,
  items,
  addCatalogItem,
  close,
  unitCostMap,
}: {
  loading: boolean
  search: string
  setSearch: (value: string) => void
  supplies: SupplyItem[]
  items: CartItem[]
  addCatalogItem: (supply: SupplyItem) => void
  close: () => void
  unitCostMap: Record<number, number>
}) {
  const displaySupplies = supplies.filter((supply) => (unitCostMap[supply.id] ?? 0) > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brown-950/55 px-4 pt-12 backdrop-blur-sm sm:pt-24">
      <div className="relative mb-12 w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-brown-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-brown-200 bg-brown-50 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-brown-900">Supply Catalog</h2>
            <p className="mt-1 text-xs text-brown-500">Click an item to add it to the request form.</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-brown-200 bg-white text-brown-600 transition hover:bg-brown-100"
            aria-label="Close catalog"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-brown-200 px-4 py-3 sm:px-6">
          <label className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or category..."
              className="w-full rounded-xl border border-brown-200 bg-brown-50 py-2.5 pl-10 pr-3 text-sm text-brown-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </label>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-brown-100 bg-brown-50 p-4">
                  <div className="aspect-[4/3] rounded-xl bg-brown-200" />
                  <div className="mt-3 h-4 w-3/4 rounded-full bg-brown-200" />
                  <div className="mt-2 h-3 w-1/2 rounded-full bg-brown-100" />
                </div>
              ))
              }
            </div>
          ) : displaySupplies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brown-200 bg-brown-50 py-12 text-center">
              <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-brown-300" />
              <p className="mt-3 text-sm font-semibold text-brown-800">No supplies found</p>
              <p className="mt-1 text-xs text-brown-500">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displaySupplies.map((supply) => {
                const inCart = items.some((item) => item.supplyId === supply.id)
                const outOfStock = supply.quantityOnHand < 1
                return (
                  <button
                    key={supply.id}
                    type="button"
                    disabled={inCart || outOfStock}
                    onClick={() => {
                      addCatalogItem(supply)
                      close()
                    }}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      inCart
                        ? "cursor-not-allowed border-brown-200 bg-brown-100"
                        : outOfStock
                          ? "cursor-not-allowed border-brown-100 bg-brown-50 opacity-60"
                          : "border-brown-200 bg-white hover:border-primary-300 hover:bg-brown-50"
                    }`}
                  >
                    <div className="aspect-[4/3] overflow-hidden border-b border-brown-100 bg-brown-100">
                      <img
                        src={supply.imagePath || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=320&h=320&fit=crop"}
                        alt={supply.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold uppercase leading-tight text-brown-900">{supply.name}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="rounded-full bg-brown-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-brown-500">
                          {supply.categoryName}
                        </span>
                        <span className="rounded-full bg-accent-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-600">
                          {supply.itemCode}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-brown-500">Stock: {supply.quantityOnHand}</p>
                      {inCart ? <p className="mt-1 text-[10px] font-bold uppercase text-brown-500">Already Added</p> : null}
                      {outOfStock ? <p className="mt-1 text-[10px] font-bold uppercase text-brown-500">Out of Stock</p> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-brown-200 px-4 py-3 text-right sm:px-6">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-brown-200 bg-white px-6 py-2 text-sm font-bold text-brown-700 transition hover:bg-brown-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}