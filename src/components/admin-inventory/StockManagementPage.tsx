import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { ArrowDownTrayIcon, ArrowPathIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline"
import AppShell from "../../layout/AppShell"
import { api } from "../../lib/api"
import { formatDateTime as manilaFormatDateTime, toTimestamp } from "../../lib/date"
import { MessageModal } from "../ui/MessageModal"
import { getStoredAuthUser, type AuthRole } from "../../lib/auth"
import type { StockEntry, SupplyItem } from "../../types/adminInventory"

type StockForm = {
  supplyId: string
  quantity: string
  unitCost: string
}

type FieldErrors = Record<string, string>

const initialStockForm: StockForm = {
  supplyId: "",
  quantity: "",
  unitCost: "",
}

const STOCKS_PER_PAGE = 8
const ENTRIES_PER_PAGE = 5

export default function StockManagementPage({ role }: { role: Extract<AuthRole, "Administrator" | "Property Custodian"> }) {
  const [supplies, setSupplies] = useState<SupplyItem[]>([])
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<StockForm>(initialStockForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [stockPage, setStockPage] = useState(1)
  const [entriesPage, setEntriesPage] = useState(1)
  const [supplySearch, setSupplySearch] = useState("")
  const [supplyDropdownOpen, setSupplyDropdownOpen] = useState(false)
  const supplyContainerRef = useRef<HTMLDivElement>(null)
  const [showMessageModal, setShowMessageModal] = useState(false)

  useEffect(() => {
    void loadStockData()
  }, [])

  useEffect(() => {
    if (!message) {
      return
    }

    setShowMessageModal(true)

    const timer = window.setTimeout(() => {
      setMessage("")
      setIsSuccess(false)
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [message])

  async function loadStockData() {
    setLoading(true)

    try {
      const response = await api("/api/admin-stock.php")
      const result = await response.json()

      if (!response.ok) {
        setMessage(result.message ?? "Unable to load stock data.")
        setIsSuccess(false)
        return
      }

      setSupplies(result.supplies ?? [])
      setEntries(result.entries ?? [])
    } catch {
      setMessage("Unable to connect to the stock service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setLoading(false)
    }
  }

  const filteredSupplies = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return supplies.filter((supply) => {
      const haystack = [supply.name, supply.itemCode, supply.categoryName, supply.description].join(" ").toLowerCase()
      return haystack.includes(needle)
    })
  }, [supplies, query])

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return entries.filter((entry) => {
      const haystack = [
        entry.supplyName,
        entry.supplyItemCode,
        entry.categoryName,
        entry.referenceNo ?? "",
        entry.remarks ?? "",
        entry.createdByName,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [entries, query])

  const stockTotalPages = Math.max(1, Math.ceil(filteredSupplies.length / STOCKS_PER_PAGE))
  const entriesTotalPages = Math.max(1, Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE))

  const latestUnitCostMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const entry of entries) {
      if (!(entry.supplyId in map)) {
        map[entry.supplyId] = entry.unitCost;
      }
    }
    return map;
  }, [entries])

  const paginatedSupplies = useMemo(() => {
    const startIndex = (stockPage - 1) * STOCKS_PER_PAGE
    return filteredSupplies.slice(startIndex, startIndex + STOCKS_PER_PAGE)
  }, [filteredSupplies, stockPage])

  const paginatedEntries = useMemo(() => {
    const startIndex = (entriesPage - 1) * ENTRIES_PER_PAGE
    return filteredEntries.slice(startIndex, startIndex + ENTRIES_PER_PAGE)
  }, [entriesPage, filteredEntries])

  useEffect(() => {
    setStockPage(1)
    setEntriesPage(1)
  }, [query])

  useEffect(() => {
    if (stockPage > stockTotalPages) {
      setStockPage(stockTotalPages)
    }
  }, [stockPage, stockTotalPages])

  useEffect(() => {
    if (entriesPage > entriesTotalPages) {
      setEntriesPage(entriesTotalPages)
    }
  }, [entriesPage, entriesTotalPages])

  // Close supply dropdown on outside click
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (supplyContainerRef.current && !supplyContainerRef.current.contains(event.target as Node)) {
        setSupplyDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (form.supplyId) {
      const id = Number(form.supplyId);
      const cost = latestUnitCostMap[id] ?? 0;
      setForm((prev) => ({ ...prev, unitCost: String(cost) }));
    } else {
      setForm((prev) => ({ ...prev, unitCost: "" }));
    }
  }, [form.supplyId, latestUnitCostMap])

  const filteredSuppliesList = useMemo(() => {
    const query = supplySearch.trim().toLowerCase()
    if (!query) return supplies
    return supplies.filter((s) =>
      s.name.toLowerCase().includes(query) ||
      s.itemCode.toLowerCase().includes(query) ||
      s.categoryName.toLowerCase().includes(query)
    )
  }, [supplies, supplySearch])

  const selectedSupply = useMemo(() => {
    if (!form.supplyId) return null
    return supplies.find((s) => s.id === Number(form.supplyId)) ?? null
  }, [supplies, form.supplyId])

  const stockSummary = useMemo(() => ({
    trackedItems: supplies.length,
    totalUnits: supplies.reduce((total, supply) => total + supply.quantityOnHand, 0),
    recentEntries: entries.length,
  }), [entries.length, supplies])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    setMessage("")

    try {
      const authUser = getStoredAuthUser()
      const response = await api("/api/admin-stock.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add_stock",
          supplyId: Number(form.supplyId),
          quantity: form.quantity,
          unitCost: form.unitCost || "0",
          createdByUserId: authUser?.id ?? null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrors(result.errors ?? {})
        setMessage(result.message ?? "Unable to save stock.")
        setIsSuccess(false)
        return
      }

      setSupplies(result.supplies ?? [])
      setEntries(result.entries ?? [])
      setForm(initialStockForm)
      setMessage(result.message ?? "Stock added successfully.")
      setIsSuccess(true)
    } catch {
      setMessage("Unable to connect to the stock service. Make sure Apache and MySQL are running in XAMPP.")
      setIsSuccess(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell role={role}>
      <div className={role === "Administrator" ? "admin-stock-page space-y-8" : "space-y-8"}>
        <div className="admin-stock-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Inventory · Stock</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-brown-900 sm:text-4xl">Stock Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brown-500">
              Search current quantities and add stock-in records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStockData()}
            className="inline-flex items-center justify-center rounded-xl border border-brown-200 bg-white px-4 py-2.5 text-sm font-semibold text-brown-700 transition hover:border-brown-300 hover:bg-brown-50"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Refresh Data
          </button>
        </div>

        {role === "Administrator" ? (
          <div className="admin-stock-summary grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Tracked items" value={stockSummary.trackedItems.toLocaleString()} />
            <SummaryCard label="Units on hand" value={stockSummary.totalUnits.toLocaleString()} />
            <SummaryCard label="Stock entries" value={stockSummary.recentEntries.toLocaleString()} />
          </div>
        ) : null}

        <MessageModal
          open={showMessageModal}
          title={isSuccess ? "Success" : "Error"}
          message={message}
          type={isSuccess ? "success" : "error"}
          onClose={() => setShowMessageModal(false)}
        />

        <div className="admin-stock-content grid gap-6 xl:grid-cols-[minmax(290px,340px)_minmax(0,1fr)]">
          <section className="admin-stock-form rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Add Stock</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Stock In</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div ref={supplyContainerRef} className="relative">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Supply <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedSupply ? `${selectedSupply.itemCode} - ${selectedSupply.name}` : supplySearch}
                    onChange={(e) => { setSupplySearch(e.target.value); setForm((f) => ({ ...f, supplyId: "" })); setSupplyDropdownOpen(true) }}
                    onFocus={() => setSupplyDropdownOpen(true)}
                    placeholder="Search supply by name, code, or category..."
                    className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3 pr-10 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  {selectedSupply ? (
                    <button
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, supplyId: "" })); setSupplySearch(""); setSupplyDropdownOpen(false) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brown-400 hover:text-brown-600"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  ) : (
                    <MagnifyingGlassIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                  )}
                </div>
                {supplyDropdownOpen && !selectedSupply ? (
                  <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-brown-200 bg-white shadow-lg">
                    {filteredSuppliesList.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-brown-400">No supplies match your search.</div>
                    ) : (
                      filteredSuppliesList.map((supply) => (
                        <button
                          key={supply.id}
                          type="button"
                          onClick={() => { setForm((f) => ({ ...f, supplyId: String(supply.id) })); setSupplySearch(""); setSupplyDropdownOpen(false) }}
                          className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-primary-50 ${
                            form.supplyId === String(supply.id) ? "bg-primary-50 font-semibold" : ""
                          }`}
                        >
                          <div>
                            <p className="font-medium text-brown-900">{supply.name}</p>
                            <p className="text-xs text-brown-400">{supply.itemCode} · {supply.categoryName}</p>
                          </div>
                          <span className="text-xs font-semibold text-brown-500">{supply.quantityOnHand.toLocaleString()} in stock</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
                {errors.supplyId ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.supplyId}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Quantity</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="100"
                />
                {errors.quantity ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.quantity}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-500">Unit Cost (₱) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="0.01"
                  required
                  value={form.unitCost}
                  onChange={(event) => setForm((current) => ({ ...current, unitCost: event.target.value }))}
                  className="w-full rounded-xl border border-brown-200 bg-brown-50 px-4 py-3 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="0.00"
                />
                {errors.unitCost ? <p className="mt-2 text-xs font-semibold text-rose-600">{errors.unitCost}</p> : null}
              </div>

              {form.quantity && form.unitCost ? (
                <div className="rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">Total Cost</p>
                  <p className="mt-1 text-lg font-black text-primary-800">
                    ₱{(parseInt(form.quantity || "0") * parseFloat(form.unitCost || "0")).toFixed(2)}
                  </p>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-brown-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                {submitting ? "Saving Stock..." : "Add Stock"}
              </button>
            </form>
          </section>

          <section className="admin-stock-results min-w-0 space-y-6">
            <div className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">Search</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Current Stock</h2>
                </div>
                <div className="relative w-full max-w-sm">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brown-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search stock"
                    className="w-full rounded-xl border border-brown-200 bg-brown-50 py-3 pl-11 pr-4 text-sm text-brown-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-[680px] divide-y divide-brown-200">
                  <thead className="bg-brown-50">
                    <tr>
                      <HeaderCell>Item Code</HeaderCell>
                      <HeaderCell>Supply</HeaderCell>
                      <HeaderCell className="text-right">Quantity</HeaderCell>
                      <HeaderCell className="text-right">Unit Cost</HeaderCell>
                      <HeaderCell className="text-right">Total Cost</HeaderCell>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brown-100 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10">
                          <div className="space-y-3 animate-pulse">
                            <div className="h-5 rounded bg-brown-100" />
                            <div className="h-5 rounded bg-brown-100" />
                            <div className="h-5 rounded bg-brown-100" />
                          </div>
                        </td>
                      </tr>
                    ) : filteredSupplies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-brown-500">
                          No stock records matched your search.
                        </td>
                      </tr>
                    ) : (
                      paginatedSupplies.map((supply) => {
                        // Get the latest unit cost from stock entries for this supply
                        const supplyEntries = entries.filter((e) => e.supplyId === supply.id)
                        const latestEntry = supplyEntries.length > 0
                          ? supplyEntries.reduce((latest, entry) =>
                              toTimestamp(entry.createdAt) > toTimestamp(latest.createdAt) ? entry : latest
                            )
                          : null
                        const unitCost = latestEntry?.unitCost ?? 0
                        const totalCost = supply.quantityOnHand * unitCost

                        return (
                          <tr key={supply.id} className="transition hover:bg-brown-50">
                            <BodyCell className="font-semibold text-brown-800">{supply.itemCode}</BodyCell>
                            <BodyCell>
                              <div className="font-semibold text-brown-900">{supply.name}</div>
                              <div className="text-xs text-brown-500">{supply.categoryName}</div>
                            </BodyCell>
                            <BodyCell className="text-right font-semibold text-brown-900">
                              {supply.quantityOnHand.toLocaleString()}
                            </BodyCell>
                            <BodyCell className="text-right text-brown-700">
                              ₱{unitCost.toFixed(2)}
                            </BodyCell>
                            <BodyCell className="text-right font-semibold text-brown-900">
                              ₱{totalCost.toFixed(2)}
                            </BodyCell>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && filteredSupplies.length > 0 ? (
                <PaginationBar
                  currentPage={stockPage}
                  totalPages={stockTotalPages}
                  totalItems={filteredSupplies.length}
                  itemsPerPage={STOCKS_PER_PAGE}
                  onPrevious={() => setStockPage((current) => Math.max(1, current - 1))}
                  onNext={() => setStockPage((current) => Math.min(stockTotalPages, current + 1))}
                />
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-brown-200 bg-white p-6 shadow-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-brown-400">History</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-brown-900">Recent Stock Entries</h2>
              </div>

              <div className="mt-6 space-y-3">
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-20 rounded-2xl bg-brown-100" />
                    <div className="h-20 rounded-2xl bg-brown-100" />
                    <div className="h-20 rounded-2xl bg-brown-100" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brown-200 bg-brown-50 px-5 py-8 text-center text-sm text-brown-500">
                    No stock entries yet.
                  </div>
                ) : (
                  paginatedEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-brown-200 bg-brown-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-brown-900">{entry.supplyName}</p>
                          <p className="mt-1 text-sm text-brown-500">
                            {entry.supplyItemCode} • {entry.categoryName} • Added by {entry.createdByName}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3">
                            {entry.unitCost > 0 ? (
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
                                ₱{entry.unitCost.toFixed(2)}/unit
                              </span>
                            ) : null}
                            {entry.totalCost > 0 ? (
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">
                                Total: ₱{entry.totalCost.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                          +{entry.quantity.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {!loading && filteredEntries.length > 0 ? (
                <PaginationBar
                  currentPage={entriesPage}
                  totalPages={entriesTotalPages}
                  totalItems={filteredEntries.length}
                  itemsPerPage={ENTRIES_PER_PAGE}
                  onPrevious={() => setEntriesPage((current) => Math.max(1, current - 1))}
                  onNext={() => setEntriesPage((current) => Math.min(entriesTotalPages, current + 1))}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function HeaderCell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-brown-500 ${className}`}>
      {children}
    </th>
  )
}

function BodyCell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={`px-6 py-4 text-sm text-brown-600 ${className}`}>{children}</td>
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brown-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brown-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-brown-900">{value}</p>
    </div>
  )
}

function formatDateTime(value: string) {
  return manilaFormatDateTime(value)
}

function PaginationBar({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPrevious,
  onNext,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPrevious: () => void
  onNext: () => void
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-brown-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-brown-500">
        Showing {startItem} to {endItem} of {totalItems} results
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
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
          onClick={onNext}
          disabled={currentPage === totalPages}
          className="inline-flex items-center justify-center rounded-xl border border-brown-200 px-4 py-2 text-sm font-semibold text-brown-600 transition hover:bg-brown-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  )
}
